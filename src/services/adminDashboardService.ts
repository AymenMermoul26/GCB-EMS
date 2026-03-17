import { useQuery } from '@tanstack/react-query'

import { ROUTES } from '@/constants/routes'
import { supabase } from '@/lib/supabaseClient'
import { auditLogService } from '@/services/auditLogService'
import { departmentsService } from '@/services/departmentsService'
import { QR_REFRESH_NOTIFICATION_TITLE } from '@/services/notificationsService'
import { requestsService } from '@/services/requestsService'
import type {
  AdminDashboardData,
  DashboardAlertItem,
  DashboardDepartmentMetric,
  DashboardRecentEmployee,
  DashboardRecentInvite,
} from '@/types/admin-dashboard'

interface DashboardEmployeeRow {
  id: string
  departement_id: string
  matricule: string
  nom: string
  prenom: string
  poste: string | null
  email: string | null
  photo_url: string | null
  is_active: boolean
  created_at: string
}

interface AdminRoleRow {
  employe_id: string
}

interface ActiveQrRow {
  employe_id: string
}

interface InviteAuditRow {
  id: string
  action: 'EMPLOYEE_INVITE_SENT' | 'EMPLOYEE_INVITE_FAILED'
  target_id: string | null
  details_json: unknown
  created_at: string
}

const INVITE_ACTIVITY_WINDOW_DAYS = 7

function getSettledErrorMessage(
  result: PromiseSettledResult<unknown>,
  fallback: string,
): string | null {
  if (result.status !== 'rejected') {
    return null
  }

  return result.reason instanceof Error ? result.reason.message : fallback
}

async function getAdminEmployeeIds(): Promise<string[]> {
  const { data, error } = await supabase
    .from('ProfilUtilisateur')
    .select('employe_id')
    .eq('role', 'ADMIN_RH')
    .returns<AdminRoleRow[]>()

  if (error) {
    throw new Error(error.message)
  }

  return [...new Set((data ?? []).map((row) => row.employe_id).filter(Boolean))]
}

async function listDashboardEmployees(): Promise<DashboardEmployeeRow[]> {
  const adminEmployeeIds = await getAdminEmployeeIds()

  let query = supabase
    .from('Employe')
    .select('id, departement_id, matricule, nom, prenom, poste, email, photo_url, is_active, created_at')
    .order('created_at', { ascending: false })

  if (adminEmployeeIds.length > 0) {
    query = query.not('id', 'in', `(${adminEmployeeIds.join(',')})`)
  }

  const { data, error } = await query.returns<DashboardEmployeeRow[]>()

  if (error) {
    throw new Error(error.message)
  }

  return data ?? []
}

async function countUnreadNotifications(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false)

  if (error) {
    throw new Error(error.message)
  }

  return count ?? 0
}

async function countUnreadQrRefresh(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('title', QR_REFRESH_NOTIFICATION_TITLE)
    .eq('is_read', false)

  if (error) {
    throw new Error(error.message)
  }

  return count ?? 0
}

async function countRequestsByStatus(status: 'EN_ATTENTE' | 'ACCEPTEE' | 'REJETEE'): Promise<number> {
  const { count, error } = await supabase
    .from('DemandeModification')
    .select('id', { count: 'exact', head: true })
    .eq('statut_demande', status)

  if (error) {
    throw new Error(error.message)
  }

  return count ?? 0
}

async function listActiveQrRows(): Promise<ActiveQrRow[]> {
  const { data, error } = await supabase
    .from('TokenQR')
    .select('employe_id')
    .eq('statut_token', 'ACTIF')
    .returns<ActiveQrRow[]>()

  if (error) {
    throw new Error(error.message)
  }

  return data ?? []
}

function normalizeDetailsJson(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }

  if (Array.isArray(value)) {
    return { values: value }
  }

  return {}
}

function readText(value: unknown): string | null {
  if (typeof value === 'string') {
    const normalized = value.trim()
    return normalized.length > 0 ? normalized : null
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  return null
}

function getRecentWindowStart(days: number): string {
  const start = new Date()
  start.setDate(start.getDate() - (days - 1))
  start.setHours(0, 0, 0, 0)
  return start.toISOString()
}

async function countAuditActionsSince(action: string, startAt: string): Promise<number> {
  const { count, error } = await supabase
    .from('audit_log')
    .select('id', { count: 'exact', head: true })
    .eq('action', action)
    .gte('created_at', startAt)

  if (error) {
    throw new Error(error.message)
  }

  return count ?? 0
}

async function listRecentInviteEvents(startAt: string): Promise<DashboardRecentInvite[]> {
  const { data, error } = await supabase
    .from('audit_log')
    .select('id, action, target_id, details_json, created_at')
    .in('action', ['EMPLOYEE_INVITE_SENT', 'EMPLOYEE_INVITE_FAILED'])
    .gte('created_at', startAt)
    .order('created_at', { ascending: false })
    .limit(5)
    .returns<InviteAuditRow[]>()

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []).map((row) => {
    const detailsJson = normalizeDetailsJson(row.details_json)
    const employeeName = readText(detailsJson.employee_name)
    const matricule = readText(detailsJson.matricule)

    return {
      id: row.id,
      employeeId: row.target_id ?? readText(detailsJson.employee_id),
      employeeName:
        employeeName && matricule
          ? `${employeeName} (${matricule})`
          : employeeName ?? matricule ?? 'Unknown employee',
      recipientEmail: readText(detailsJson.recipient_email) ?? 'No recipient recorded',
      status: row.action === 'EMPLOYEE_INVITE_FAILED' ? 'failed' : 'sent',
      createdAt: row.created_at,
      failureReason: readText(detailsJson.failure_reason) ?? undefined,
    }
  })
}

function buildDepartmentDistribution(
  employees: DashboardEmployeeRow[],
  departments: Array<{ id: string; nom: string }>,
): DashboardDepartmentMetric[] {
  const metricsByDepartment = new Map(
    departments.map((department) => [
      department.id,
      {
        id: department.id,
        name: department.nom,
        employeeCount: 0,
        activeCount: 0,
      },
    ]),
  )

  for (const employee of employees) {
    const metric =
      metricsByDepartment.get(employee.departement_id) ??
      {
        id: employee.departement_id,
        name: 'Unknown department',
        employeeCount: 0,
        activeCount: 0,
      }

    metric.employeeCount += 1
    if (employee.is_active) {
      metric.activeCount += 1
    }

    metricsByDepartment.set(employee.departement_id, metric)
  }

  return [...metricsByDepartment.values()]
    .filter((item) => item.employeeCount > 0)
    .sort((left, right) => right.employeeCount - left.employeeCount)
}

function buildRecentEmployees(
  employees: DashboardEmployeeRow[],
  departments: Array<{ id: string; nom: string }>,
): DashboardRecentEmployee[] {
  const departmentNames = new Map(departments.map((department) => [department.id, department.nom]))

  return employees.slice(0, 5).map((employee) => ({
    id: employee.id,
    fullName: `${employee.prenom} ${employee.nom}`.replace(/\s+/g, ' ').trim(),
    matricule: employee.matricule,
    poste: employee.poste,
    departmentName: departmentNames.get(employee.departement_id) ?? 'Unknown department',
    createdAt: employee.created_at,
    isActive: employee.is_active,
  }))
}

function buildAlerts(params: {
  pendingRequests: number
  inactiveEmployees: number
  employeesMissingPhoto: number
  employeesWithoutActiveQr: number
  departmentsCount: number
  unreadQrRefresh: number
  inviteFailuresRecent: number
}): DashboardAlertItem[] {
  const alerts: DashboardAlertItem[] = []

  if (params.pendingRequests > 0) {
    alerts.push({
      id: 'pending-requests',
      title: `${params.pendingRequests} pending request${params.pendingRequests === 1 ? '' : 's'}`,
      description: 'Employee changes are waiting for HR review.',
      href: ROUTES.ADMIN_REQUESTS,
      tone: 'warning',
    })
  }

  if (params.employeesWithoutActiveQr > 0) {
    alerts.push({
      id: 'missing-qr',
      title: `${params.employeesWithoutActiveQr} employee${params.employeesWithoutActiveQr === 1 ? '' : 's'} without active QR`,
      description: 'Public profile access is missing or revoked for these employees.',
      href: ROUTES.ADMIN_EMPLOYEES,
      tone: 'info',
    })
  }

  if (params.unreadQrRefresh > 0) {
    alerts.push({
      id: 'qr-refresh',
      title: `${params.unreadQrRefresh} QR refresh alert${params.unreadQrRefresh === 1 ? '' : 's'}`,
      description: 'Employee profile changes require a QR refresh review.',
      href: ROUTES.ADMIN_REQUESTS,
      tone: 'warning',
    })
  }

  if (params.inviteFailuresRecent > 0) {
    alerts.push({
      id: 'invite-failures',
      title: `${params.inviteFailuresRecent} invite failure${params.inviteFailuresRecent === 1 ? '' : 's'} in the last ${INVITE_ACTIVITY_WINDOW_DAYS} days`,
      description: 'One or more employee invite emails could not be delivered.',
      href: ROUTES.ADMIN_AUDIT,
      tone: 'warning',
    })
  }

  if (params.employeesMissingPhoto > 0) {
    alerts.push({
      id: 'missing-photo',
      title: `${params.employeesMissingPhoto} employee${params.employeesMissingPhoto === 1 ? '' : 's'} missing a photo`,
      description: 'Employee profiles without photos reduce badge and directory quality.',
      href: ROUTES.ADMIN_EMPLOYEES,
      tone: 'info',
    })
  }

  if (params.inactiveEmployees > 0) {
    alerts.push({
      id: 'inactive-employees',
      title: `${params.inactiveEmployees} inactive employee${params.inactiveEmployees === 1 ? '' : 's'}`,
      description: 'Inactive records remain in the system for audit and history purposes.',
      href: ROUTES.ADMIN_EMPLOYEES,
      tone: 'info',
    })
  }

  if (params.departmentsCount === 0) {
    alerts.push({
      id: 'missing-departments',
      title: 'No departments configured',
      description: 'Employees cannot be organized properly until departments are created.',
      href: ROUTES.ADMIN_DEPARTMENTS,
      tone: 'warning',
    })
  }

  return alerts.slice(0, 5)
}

export async function getAdminDashboardData(userId: string): Promise<AdminDashboardData> {
  const inviteWindowStart = getRecentWindowStart(INVITE_ACTIVITY_WINDOW_DAYS)
  const [
    employeesResult,
    departmentsResult,
    activeQrResult,
    pendingRequestsResult,
    approvedRequestsResult,
    rejectedRequestsResult,
    unreadNotificationsResult,
    unreadQrRefreshResult,
    recentRequestsResult,
    recentActivityResult,
    invitesSentRecentResult,
    inviteFailuresRecentResult,
    recentInvitesResult,
  ] = await Promise.allSettled([
    listDashboardEmployees(),
    departmentsService.listDepartments(),
    listActiveQrRows(),
    requestsService.countPendingRequests(),
    countRequestsByStatus('ACCEPTEE'),
    countRequestsByStatus('REJETEE'),
    countUnreadNotifications(userId),
    countUnreadQrRefresh(userId),
    requestsService.listRequestsForAdmin({ page: 1, pageSize: 5 }),
    auditLogService.listLogs({ page: 1, pageSize: 6 }),
    countAuditActionsSince('EMPLOYEE_INVITE_SENT', inviteWindowStart),
    countAuditActionsSince('EMPLOYEE_INVITE_FAILED', inviteWindowStart),
    listRecentInviteEvents(inviteWindowStart),
  ])

  const employees = employeesResult.status === 'fulfilled' ? employeesResult.value : []
  const departments = departmentsResult.status === 'fulfilled' ? departmentsResult.value : []
  const activeQrRows = activeQrResult.status === 'fulfilled' ? activeQrResult.value : []
  const pendingRequests = pendingRequestsResult.status === 'fulfilled' ? pendingRequestsResult.value : 0
  const approvedRequests = approvedRequestsResult.status === 'fulfilled' ? approvedRequestsResult.value : 0
  const rejectedRequests = rejectedRequestsResult.status === 'fulfilled' ? rejectedRequestsResult.value : 0
  const unreadNotifications =
    unreadNotificationsResult.status === 'fulfilled' ? unreadNotificationsResult.value : 0
  const unreadQrRefresh =
    unreadQrRefreshResult.status === 'fulfilled' ? unreadQrRefreshResult.value : 0
  const invitesSentRecent =
    invitesSentRecentResult.status === 'fulfilled' ? invitesSentRecentResult.value : 0
  const inviteFailuresRecent =
    inviteFailuresRecentResult.status === 'fulfilled' ? inviteFailuresRecentResult.value : 0

  const activeQrEmployeeIds = new Set(activeQrRows.map((row) => row.employe_id))
  const activeEmployees = employees.filter((employee) => employee.is_active).length
  const inactiveEmployees = employees.length - activeEmployees
  const employeesMissingPhoto = employees.filter((employee) => !employee.photo_url?.trim()).length
  const employeesWithoutActiveQr = employees.filter(
    (employee) => !activeQrEmployeeIds.has(employee.id),
  ).length

  const overviewErrors = [
    getSettledErrorMessage(employeesResult, 'Unable to load employee metrics.'),
    getSettledErrorMessage(departmentsResult, 'Unable to load department metrics.'),
    getSettledErrorMessage(activeQrResult, 'Unable to load QR metrics.'),
    getSettledErrorMessage(pendingRequestsResult, 'Unable to load pending request metrics.'),
    getSettledErrorMessage(approvedRequestsResult, 'Unable to load approved request metrics.'),
    getSettledErrorMessage(rejectedRequestsResult, 'Unable to load rejected request metrics.'),
    getSettledErrorMessage(unreadNotificationsResult, 'Unable to load unread notification count.'),
    getSettledErrorMessage(unreadQrRefreshResult, 'Unable to load QR refresh alerts.'),
    getSettledErrorMessage(invitesSentRecentResult, 'Unable to load invite send metrics.'),
    getSettledErrorMessage(inviteFailuresRecentResult, 'Unable to load invite failure metrics.'),
  ].filter((message): message is string => Boolean(message))

  const sectionErrors = {
    overview: overviewErrors.length > 0 ? overviewErrors.join(' ') : undefined,
    recentActivity: getSettledErrorMessage(
      recentActivityResult,
      'Unable to load recent activity.',
    ) ?? undefined,
    recentRequests: getSettledErrorMessage(
      recentRequestsResult,
      'Unable to load recent requests.',
    ) ?? undefined,
    recentInvites: getSettledErrorMessage(
      recentInvitesResult,
      'Unable to load recent invite activity.',
    ) ?? undefined,
  }

  return {
    kpis: {
      totalEmployees: employees.length,
      activeEmployees,
      inactiveEmployees,
      pendingRequests,
      departmentsCount: departments.length,
      unreadNotifications,
      invitesSentRecent,
      inviteFailuresRecent,
    },
    departmentDistribution: buildDepartmentDistribution(employees, departments),
    requestOverview: {
      pending: pendingRequests,
      approved: approvedRequests,
      rejected: rejectedRequests,
      total: pendingRequests + approvedRequests + rejectedRequests,
    },
    recentActivity:
      recentActivityResult.status === 'fulfilled' ? recentActivityResult.value.items : [],
    recentRequests:
      recentRequestsResult.status === 'fulfilled' ? recentRequestsResult.value.items : [],
    recentInvites:
      recentInvitesResult.status === 'fulfilled' ? recentInvitesResult.value : [],
    recentEmployees: buildRecentEmployees(employees, departments),
    qrSummary: {
      activeQrEmployees: activeQrEmployeeIds.size,
      employeesWithoutActiveQr,
      needsQrRefresh: unreadQrRefresh,
    },
    alerts: buildAlerts({
      pendingRequests,
      inactiveEmployees,
      employeesMissingPhoto,
      employeesWithoutActiveQr,
      departmentsCount: departments.length,
      unreadQrRefresh,
      inviteFailuresRecent,
    }),
    sectionErrors,
  }
}

export function useAdminDashboardQuery(userId?: string | null) {
  return useQuery({
    queryKey: ['adminDashboard', userId ?? null],
    queryFn: () => getAdminDashboardData(userId as string),
    enabled: Boolean(userId),
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}

export const adminDashboardService = {
  getAdminDashboardData,
}
