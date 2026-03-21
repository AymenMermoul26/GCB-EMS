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
  DashboardInviteLifecycleSummary,
  DashboardRecentEmployee,
  DashboardRecentInvite,
  DashboardRecentPayrollExport,
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
  action: 'EMPLOYEE_INVITE_SENT' | 'EMPLOYEE_INVITE_FAILED' | 'EMPLOYEE_INVITE_ACCEPTED'
  target_id: string | null
  details_json: unknown
  created_at: string
}

interface PayrollExportAuditRow {
  id: string
  actor_user_id: string | null
  action: 'PAYROLL_EXPORT_GENERATED' | 'PAYROLL_EXPORT_PRINT_INITIATED'
  target_id: string | null
  details_json: unknown
  created_at: string
}

interface ProfilLookupRow {
  user_id: string | null
  role: string | null
  employe_id: string | null
}

interface EmployeeLookupRow {
  id: string
  matricule: string
  nom: string
  prenom: string
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

function readNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function buildEmployeeName(prenom: string, nom: string): string | null {
  const fullName = `${prenom} ${nom}`.replace(/\s+/g, ' ').trim()
  return fullName.length > 0 ? fullName : null
}

function normalizeInviteTriggerSource(value: unknown): 'invite' | 'resend_invite' | null {
  const text = readText(value)
  return text === 'invite' || text === 'resend_invite' ? text : null
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

async function listRecentInviteLifecycleRows(startAt: string): Promise<InviteAuditRow[]> {
  const { data, error } = await supabase
    .from('audit_log')
    .select('id, action, target_id, details_json, created_at')
    .in('action', ['EMPLOYEE_INVITE_SENT', 'EMPLOYEE_INVITE_FAILED', 'EMPLOYEE_INVITE_ACCEPTED'])
    .gte('created_at', startAt)
    .order('created_at', { ascending: false })
    .limit(100)
    .returns<InviteAuditRow[]>()

  if (error) {
    throw new Error(error.message)
  }

  return data ?? []
}

function buildInviteLifecycleSummary(
  rows: InviteAuditRow[],
): DashboardInviteLifecycleSummary {
  return rows.reduce<DashboardInviteLifecycleSummary>(
    (summary, row) => {
      const detailsJson = normalizeDetailsJson(row.details_json)
      const triggerSource = normalizeInviteTriggerSource(detailsJson.trigger_source)

      if (row.action === 'EMPLOYEE_INVITE_FAILED') {
        summary.failed += 1
        return summary
      }

      if (row.action === 'EMPLOYEE_INVITE_ACCEPTED') {
        summary.accepted += 1
        return summary
      }

      if (triggerSource === 'resend_invite') {
        summary.resend += 1
      } else {
        summary.sent += 1
      }

      return summary
    },
    {
      sent: 0,
      resend: 0,
      accepted: 0,
      failed: 0,
    },
  )
}

function buildRecentInviteEvents(rows: InviteAuditRow[]): DashboardRecentInvite[] {
  return rows.slice(0, 5).map((row) => {
    const detailsJson = normalizeDetailsJson(row.details_json)
    const employeeName = readText(detailsJson.employee_name)
    const matricule = readText(detailsJson.matricule)
    const triggerSource = normalizeInviteTriggerSource(detailsJson.trigger_source)

    return {
      id: row.id,
      employeeId: row.target_id ?? readText(detailsJson.employee_id),
      employeeName:
        employeeName && matricule
          ? `${employeeName} (${matricule})`
          : employeeName ?? matricule ?? 'Unknown employee',
      recipientEmail: readText(detailsJson.recipient_email) ?? 'No recipient recorded',
      status:
        row.action === 'EMPLOYEE_INVITE_FAILED'
          ? 'failed'
          : row.action === 'EMPLOYEE_INVITE_ACCEPTED'
            ? 'accepted'
            : 'sent',
      triggerSource,
      createdAt: row.created_at,
      failureReason: readText(detailsJson.failure_reason) ?? undefined,
    }
  })
}

async function listRecentPayrollExportRows(startAt: string): Promise<PayrollExportAuditRow[]> {
  const { data, error } = await supabase
    .from('audit_log')
    .select('id, actor_user_id, action, target_id, details_json, created_at')
    .in('action', ['PAYROLL_EXPORT_GENERATED', 'PAYROLL_EXPORT_PRINT_INITIATED'])
    .gte('created_at', startAt)
    .order('created_at', { ascending: false })
    .limit(10)
    .returns<PayrollExportAuditRow[]>()

  if (error) {
    throw new Error(error.message)
  }

  return data ?? []
}

async function buildAuditActorLookups(
  rows: PayrollExportAuditRow[],
): Promise<{
  profileByUserId: Map<string, ProfilLookupRow>
  employeeById: Map<string, EmployeeLookupRow>
}> {
  const actorUserIds = [...new Set(rows.map((row) => row.actor_user_id).filter(Boolean))] as string[]
  const employeeIds = new Set<string>()

  for (const row of rows) {
    const detailsJson = normalizeDetailsJson(row.details_json)
    const detailEmployeeId = readText(detailsJson.employee_id)
    if (detailEmployeeId) {
      employeeIds.add(detailEmployeeId)
    } else if (row.target_id) {
      employeeIds.add(row.target_id)
    }
  }

  const profileByUserId = new Map<string, ProfilLookupRow>()
  const employeeById = new Map<string, EmployeeLookupRow>()

  if (actorUserIds.length > 0) {
    const { data, error } = await supabase
      .from('ProfilUtilisateur')
      .select('user_id, role, employe_id')
      .in('user_id', actorUserIds)
      .returns<ProfilLookupRow[]>()

    if (error) {
      throw new Error(error.message)
    }

    for (const row of data ?? []) {
      if (row.user_id) {
        profileByUserId.set(row.user_id, row)
      }
      if (row.employe_id) {
        employeeIds.add(row.employe_id)
      }
    }
  }

  const lookupEmployeeIds = [...new Set([...employeeIds])]
  if (lookupEmployeeIds.length > 0) {
    const { data, error } = await supabase
      .from('Employe')
      .select('id, matricule, nom, prenom')
      .in('id', lookupEmployeeIds)
      .returns<EmployeeLookupRow[]>()

    if (error) {
      throw new Error(error.message)
    }

    for (const employee of data ?? []) {
      employeeById.set(employee.id, employee)
    }
  }

  return { profileByUserId, employeeById }
}

function formatActorLabel(
  row: PayrollExportAuditRow,
  detailsJson: Record<string, unknown>,
  profileByUserId: Map<string, ProfilLookupRow>,
  employeeById: Map<string, EmployeeLookupRow>,
): string {
  if (!row.actor_user_id) {
    return 'System'
  }

  const profile = profileByUserId.get(row.actor_user_id)
  if (profile?.employe_id) {
    const employee = employeeById.get(profile.employe_id)
    if (employee) {
      return `${employee.prenom} ${employee.nom}${profile.role ? ` (${profile.role})` : ''}`
    }
  }

  if (profile?.role) {
    return `${profile.role} (${row.actor_user_id.slice(0, 8)})`
  }

  const senderEmail = readText(detailsJson.sender_email)
  if (senderEmail) {
    return senderEmail
  }

  return `User (${row.actor_user_id.slice(0, 8)})`
}

function buildPayrollScopeSummary(detailsJson: Record<string, unknown>, action: PayrollExportAuditRow['action']): string {
  if (action === 'PAYROLL_EXPORT_PRINT_INITIATED') {
    return 'Single employee information sheet'
  }

  const summaryParts: string[] = []
  const search = readText(detailsJson.search)
  const departmentName = readText(detailsJson.department_name)
  const status = readText(detailsJson.status)
  const typeContrat = readText(detailsJson.type_contrat)

  if (search) {
    summaryParts.push(`Search: ${search}`)
  }

  if (departmentName) {
    summaryParts.push(`Department: ${departmentName}`)
  }

  if (status && status !== 'ALL') {
    summaryParts.push(`Status: ${status}`)
  }

  if (typeContrat) {
    summaryParts.push(`Contract: ${typeContrat}`)
  }

  return summaryParts.length > 0 ? summaryParts.join(' | ') : 'All payroll-visible employees'
}

async function listRecentPayrollExports(startAt: string): Promise<DashboardRecentPayrollExport[]> {
  const rows = await listRecentPayrollExportRows(startAt)

  if (rows.length === 0) {
    return []
  }

  const { profileByUserId, employeeById } = await buildAuditActorLookups(rows)

  return rows.slice(0, 5).map((row) => {
    const detailsJson = normalizeDetailsJson(row.details_json)
    const employeeId = readText(detailsJson.employee_id) ?? row.target_id
    const employee = employeeId ? employeeById.get(employeeId) : null

    return {
      id: row.id,
      action: row.action,
      actorLabel: formatActorLabel(row, detailsJson, profileByUserId, employeeById),
      employeeId,
      employeeName:
        readText(detailsJson.employee_name) ??
        (employee ? buildEmployeeName(employee.prenom, employee.nom) : null),
      rowCount: readNumber(detailsJson.row_count),
      format: readText(detailsJson.format),
      fileName: readText(detailsJson.file_name),
      scopeSummary: buildPayrollScopeSummary(detailsJson, row.action),
      createdAt: row.created_at,
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
    publicProfileViewsRecentResult,
    inviteRowsResult,
    recentPayrollExportsResult,
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
    countAuditActionsSince('PUBLIC_PROFILE_VIEWED', inviteWindowStart),
    listRecentInviteLifecycleRows(inviteWindowStart),
    listRecentPayrollExports(inviteWindowStart),
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
  const publicProfileViewsRecent =
    publicProfileViewsRecentResult.status === 'fulfilled'
      ? publicProfileViewsRecentResult.value
      : 0
  const inviteRows = inviteRowsResult.status === 'fulfilled' ? inviteRowsResult.value : []
  const inviteLifecycleSummary = buildInviteLifecycleSummary(inviteRows)
  const recentInvites = buildRecentInviteEvents(inviteRows)

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
    getSettledErrorMessage(
      publicProfileViewsRecentResult,
      'Unable to load recent public profile view metrics.',
    ),
    getSettledErrorMessage(inviteRowsResult, 'Unable to load invite lifecycle metrics.'),
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
    recentInvites:
      getSettledErrorMessage(inviteRowsResult, 'Unable to load recent invite activity.') ??
      undefined,
    recentPayrollExports:
      getSettledErrorMessage(
        recentPayrollExportsResult,
        'Unable to load recent payroll export activity.',
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
      invitesSentRecent: inviteLifecycleSummary.sent,
      inviteFailuresRecent: inviteLifecycleSummary.failed,
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
    recentInvites,
    inviteLifecycleSummary,
    recentPayrollExports:
      recentPayrollExportsResult.status === 'fulfilled'
        ? recentPayrollExportsResult.value
        : [],
    recentEmployees: buildRecentEmployees(employees, departments),
    qrSummary: {
      activeQrEmployees: activeQrEmployeeIds.size,
      employeesWithoutActiveQr,
      needsQrRefresh: unreadQrRefresh,
      publicProfileViewsRecent,
    },
    alerts: buildAlerts({
      pendingRequests,
      inactiveEmployees,
      employeesMissingPhoto,
      employeesWithoutActiveQr,
      departmentsCount: departments.length,
      unreadQrRefresh,
      inviteFailuresRecent: inviteLifecycleSummary.failed,
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
