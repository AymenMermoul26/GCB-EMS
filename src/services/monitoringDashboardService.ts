import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { supabase } from '@/lib/supabaseClient'
import { getDepartmentDisplayName } from '@/types/department'
import type {
  MonitoringCategory,
  MonitoringDashboardData,
  MonitoringDashboardFilters,
  MonitoringDistributionItem,
  MonitoringEventCategoryKey,
  MonitoringInsightItem,
  MonitoringMetricItem,
  MonitoringPeriod,
  MonitoringRecentEvent,
  MonitoringRecentInviteItem,
  MonitoringRecentPayrollActivityItem,
  MonitoringTimelinePoint,
  MonitoringTopActionItem,
} from '@/types/monitoring-dashboard'
import {
  categorizeAuditAction,
  getAuditActionMeta,
  getMonitoringCategoryMeta,
  isCriticalAuditAction,
  isFailedAuditAction,
} from '@/utils/monitoring-events'

interface MonitoringAuditRow {
  id: string
  actor_user_id: string | null
  action: string
  target_type: string
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

interface TimelineBucket {
  key: string
  label: string
  fullLabel: string
  start: Date
  end: Date
}

const AUDIT_FETCH_BATCH_SIZE = 500
const EXCLUDED_AUDIT_ACTIONS_FILTER = '(EMPLOYEE_SHEET_SENT,EMPLOYEE_SHEET_SEND_FAILED)'

const QR_ACTIVITY_CONFIG = [
  {
    key: 'QR_GENERATED',
    label: 'Generated',
    helper: 'Fresh QR tokens issued',
    tone: 'sky',
  },
  {
    key: 'QR_REGENERATED',
    label: 'Regenerated',
    helper: 'Replacement QR tokens issued',
    tone: 'sky',
  },
  {
    key: 'QR_REVOKED',
    label: 'Revoked',
    helper: 'QR tokens revoked or replaced',
    tone: 'rose',
  },
  {
    key: 'QR_REFRESH_REQUIRED_CREATED',
    label: 'Refresh Required',
    helper: 'Profile changes requiring QR review',
    tone: 'amber',
  },
  {
    key: 'QR_REFRESH_COMPLETED',
    label: 'Refresh Completed',
    helper: 'Pending QR refresh items resolved',
    tone: 'emerald',
  },
  {
    key: 'PUBLIC_PROFILE_VIEWED',
    label: 'Public Profile Views',
    helper: 'Successful public QR profile loads',
    tone: 'emerald',
  },
] as const

const EMAIL_ACTIVITY_CONFIG = [
  {
    key: 'invite_sent',
    label: 'Invites Sent',
    helper: 'Initial employee invite emails sent',
    tone: 'orange',
  },
  {
    key: 'invite_resent',
    label: 'Resend Attempts',
    helper: 'Invite resend attempts recorded by HR',
    tone: 'amber',
  },
  {
    key: 'invite_accepted',
    label: 'Invite Accepted',
    helper: 'Employees completed first-login password setup',
    tone: 'emerald',
  },
  {
    key: 'invite_failed',
    label: 'Invite Failures',
    helper: 'Invite email delivery failures',
    tone: 'rose',
  },
  {
    key: 'document_sent',
    label: 'Document Emails Sent',
    helper: 'Employee document emails sent successfully',
    tone: 'orange',
  },
  {
    key: 'document_failed',
    label: 'Document Email Failures',
    helper: 'Employee document emails that failed to send',
    tone: 'rose',
  },
] as const

const PAYROLL_ACTIVITY_CONFIG = [
  {
    key: 'export_output',
    label: 'Exports & Sheet Output',
    helper: 'CSV exports and payroll-safe sheet print or PDF actions',
    tone: 'sky',
  },
  {
    key: 'run_setup',
    label: 'Periods & Runs',
    helper: 'Payroll periods and runs prepared for processing',
    tone: 'sky',
  },
  {
    key: 'calculations',
    label: 'Calculations',
    helper: 'Payroll calculation starts, completions, and failures',
    tone: 'amber',
  },
  {
    key: 'publication',
    label: 'Finalization & Publication',
    helper: 'Run finalization and payslip publication actions',
    tone: 'emerald',
  },
  {
    key: 'requests',
    label: 'Payslip Requests',
    helper: 'Employee payslip request submission and review actions',
    tone: 'amber',
  },
  {
    key: 'documents',
    label: 'Payslip Documents',
    helper: 'Published, viewed, and downloaded payslip files',
    tone: 'slate',
  },
] as const

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

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((item) => readText(item))
    .filter((item): item is string => Boolean(item))
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

function formatFieldLabel(value: string): string {
  return value
    .replaceAll('_', ' ')
    .replaceAll('-', ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase())
    .replace(/\bQr\b/g, 'QR')
}

function stringifyPreviewValue(value: unknown): string {
  if (Array.isArray(value)) {
    const rendered = value
      .map((item) => readText(item) ?? JSON.stringify(item))
      .filter(Boolean)
      .join(', ')
    return rendered || '[]'
  }

  const text = readText(value)
  if (text) {
    return text
  }

  if (value && typeof value === 'object') {
    return JSON.stringify(value)
  }

  return String(value)
}

function truncatePreview(value: string, maxLength = 140): string {
  if (value.length <= maxLength) {
    return value
  }

  return `${value.slice(0, maxLength - 3)}...`
}

function formatEmployeeLabel(employee?: EmployeeLookupRow | null): string {
  if (!employee) {
    return 'Unknown employee'
  }

  return `${employee.prenom} ${employee.nom} (${employee.matricule})`
}

function buildRangeLabel(period: MonitoringPeriod): string {
  switch (period) {
    case 'TODAY':
      return 'Today'
    case 'LAST_7_DAYS':
      return 'Last 7 days'
    case 'LAST_30_DAYS':
      return 'Last 30 days'
    default:
      return 'Selected period'
  }
}

function startOfDay(date: Date): Date {
  const nextDate = new Date(date)
  nextDate.setHours(0, 0, 0, 0)
  return nextDate
}

function endOfDay(date: Date): Date {
  const nextDate = new Date(date)
  nextDate.setHours(23, 59, 59, 999)
  return nextDate
}

function addDays(date: Date, days: number): Date {
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + days)
  return nextDate
}

function addHours(date: Date, hours: number): Date {
  const nextDate = new Date(date)
  nextDate.setHours(nextDate.getHours() + hours)
  return nextDate
}

function buildTimelineBuckets(period: MonitoringPeriod): {
  startAt: string
  endAt: string
  rangeLabel: string
  buckets: TimelineBucket[]
} {
  const now = new Date()

  if (period === 'TODAY') {
    const start = startOfDay(now)
    const buckets: TimelineBucket[] = Array.from({ length: 24 }, (_, index) => {
      const bucketStart = addHours(start, index)
      const bucketEnd = addHours(bucketStart, 1)
      bucketEnd.setMilliseconds(bucketEnd.getMilliseconds() - 1)

      return {
        key: bucketStart.toISOString(),
        label: bucketStart.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
        fullLabel: bucketStart.toLocaleString([], {
          dateStyle: 'medium',
          timeStyle: 'short',
        }),
        start: bucketStart,
        end: bucketEnd,
      }
    })

    return {
      startAt: start.toISOString(),
      endAt: now.toISOString(),
      rangeLabel: buildRangeLabel(period),
      buckets,
    }
  }

  const numberOfDays = period === 'LAST_7_DAYS' ? 7 : 30
  const start = startOfDay(addDays(now, -(numberOfDays - 1)))
  const end = endOfDay(now)
  const buckets: TimelineBucket[] = Array.from({ length: numberOfDays }, (_, index) => {
    const bucketStart = startOfDay(addDays(start, index))
    const bucketEnd = endOfDay(bucketStart)

    return {
      key: bucketStart.toISOString(),
      label: bucketStart.toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
      }),
      fullLabel: bucketStart.toLocaleDateString([], {
        weekday: 'short',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }),
      start: bucketStart,
      end: bucketEnd,
    }
  })

  return {
    startAt: start.toISOString(),
    endAt: end.toISOString(),
    rangeLabel: buildRangeLabel(period),
    buckets,
  }
}

async function listAuditRowsInRange(
  startAt: string,
  endAt: string,
): Promise<MonitoringAuditRow[]> {
  const rows: MonitoringAuditRow[] = []
  let from = 0

  while (true) {
    const to = from + AUDIT_FETCH_BATCH_SIZE - 1
    const { data, error } = await supabase
      .from('audit_log')
      .select('id, actor_user_id, action, target_type, target_id, details_json, created_at')
      .not('action', 'in', EXCLUDED_AUDIT_ACTIONS_FILTER)
      .gte('created_at', startAt)
      .lte('created_at', endAt)
      .order('created_at', { ascending: false })
      .range(from, to)
      .returns<MonitoringAuditRow[]>()

    if (error) {
      throw new Error(error.message)
    }

    const nextRows = data ?? []
    rows.push(...nextRows)

    if (nextRows.length < AUDIT_FETCH_BATCH_SIZE) {
      break
    }

    from += AUDIT_FETCH_BATCH_SIZE
  }

  return rows
}

function filterRowsByCategory(
  rows: MonitoringAuditRow[],
  category: MonitoringCategory,
): MonitoringAuditRow[] {
  if (category === 'ALL') {
    return rows
  }

  return rows.filter((row) => categorizeAuditAction(row.action) === category)
}

function buildTimeline(
  rows: MonitoringAuditRow[],
  buckets: TimelineBucket[],
): MonitoringTimelinePoint[] {
  return buckets.map((bucket) => {
    let total = 0
    let critical = 0
    let qr = 0
    let email = 0

    for (const row of rows) {
      const createdAt = new Date(row.created_at)
      if (createdAt < bucket.start || createdAt > bucket.end) {
        continue
      }

      total += 1

      if (isCriticalAuditAction(row.action)) {
        critical += 1
      }

      const categoryKey = categorizeAuditAction(row.action)
      if (categoryKey === 'qr') {
        qr += 1
      }

      if (categoryKey === 'email') {
        email += 1
      }
    }

    return {
      key: bucket.key,
      label: bucket.label,
      fullLabel: bucket.fullLabel,
      total,
      critical,
      qr,
      email,
    }
  })
}

function buildCategoryDistribution(
  rows: MonitoringAuditRow[],
): MonitoringDistributionItem[] {
  const counts = new Map<MonitoringEventCategoryKey, number>()

  for (const row of rows) {
    const categoryKey = categorizeAuditAction(row.action)
    counts.set(categoryKey, (counts.get(categoryKey) ?? 0) + 1)
  }

  return (Object.keys(
    {
      employee: true,
      request: true,
      qr: true,
      email: true,
      payroll: true,
      security: true,
      visibility: true,
      system: true,
    },
  ) as MonitoringEventCategoryKey[])
    .map((categoryKey) => {
      const meta = getMonitoringCategoryMeta(categoryKey)
      return {
        key: categoryKey,
        label: meta.label,
        value: counts.get(categoryKey) ?? 0,
        color: meta.color,
      }
    })
    .filter((item) => item.value > 0)
    .sort((left, right) => right.value - left.value)
}

function buildMetricItems(
  rows: MonitoringAuditRow[],
  config: ReadonlyArray<{
    key: string
    label: string
    helper: string
    tone: MonitoringMetricItem['tone']
  }>,
): MonitoringMetricItem[] {
  const counts = new Map<string, number>()
  for (const row of rows) {
    counts.set(row.action, (counts.get(row.action) ?? 0) + 1)
  }

  return config.map((item) => ({
    key: item.key,
    label: item.label,
    value: counts.get(item.key) ?? 0,
    helper: item.helper,
    tone: item.tone,
    }))
}

function buildEmailActivity(rows: MonitoringAuditRow[]): MonitoringMetricItem[] {
  const counts = {
    invite_sent: 0,
    invite_resent: 0,
    invite_accepted: 0,
    invite_failed: 0,
    document_sent: 0,
    document_failed: 0,
  }

  for (const row of rows) {
    const detailsJson = normalizeDetailsJson(row.details_json)
    const triggerSource = readText(detailsJson.trigger_source)

    switch (row.action) {
      case 'EMPLOYEE_INVITE_SENT':
        if (triggerSource === 'resend_invite') {
          counts.invite_resent += 1
        } else {
          counts.invite_sent += 1
        }
        break
      case 'EMPLOYEE_INVITE_ACCEPTED':
        counts.invite_accepted += 1
        break
      case 'EMPLOYEE_INVITE_FAILED':
        counts.invite_failed += 1
        break
      case 'EMPLOYEE_SHEET_EMAIL_SENT':
        counts.document_sent += 1
        break
      case 'EMPLOYEE_SHEET_EMAIL_FAILED':
        counts.document_failed += 1
        break
      default:
        break
    }
  }

  return EMAIL_ACTIVITY_CONFIG.map((item) => ({
    key: item.key,
    label: item.label,
    value: counts[item.key],
    helper: item.helper,
    tone: item.tone,
  }))
}

function buildPayrollActivity(rows: MonitoringAuditRow[]): MonitoringMetricItem[] {
  const counts = {
    export_output: 0,
    run_setup: 0,
    calculations: 0,
    publication: 0,
    requests: 0,
    documents: 0,
  }

  for (const row of rows) {
    switch (row.action) {
      case 'PAYROLL_EXPORT_REQUESTED':
      case 'PAYROLL_EXPORT_GENERATED':
      case 'PAYROLL_EXPORT_PRINT_INITIATED':
        counts.export_output += 1
        break
      case 'PAYROLL_PERIOD_CREATED':
      case 'PAYROLL_RUN_CREATED':
        counts.run_setup += 1
        break
      case 'PAYROLL_CALCULATION_STARTED':
      case 'PAYROLL_CALCULATION_COMPLETED':
      case 'PAYROLL_CALCULATION_FAILED':
        counts.calculations += 1
        break
      case 'PAYROLL_RUN_UPDATED':
      case 'PAYROLL_RUN_FINALIZED':
      case 'PAYROLL_PAYSLIP_PUBLISHED':
        counts.publication += 1
        break
      case 'PAYSLIP_REQUEST_CREATED':
      case 'PAYSLIP_REQUEST_STATUS_UPDATED':
      case 'PAYSLIP_REQUEST_FULFILLED':
        counts.requests += 1
        break
      case 'PAYSLIP_DOCUMENT_PUBLISHED':
      case 'PAYSLIP_DOCUMENT_VIEWED':
      case 'PAYSLIP_DOCUMENT_DOWNLOADED':
        counts.documents += 1
        break
      default:
        break
    }
  }

  return PAYROLL_ACTIVITY_CONFIG.map((item) => ({
    key: item.key,
    label: item.label,
    value: counts[item.key],
    helper: item.helper,
    tone: item.tone,
  }))
}

function buildRecentInviteEvents(rows: MonitoringAuditRow[]): MonitoringRecentInviteItem[] {
  return rows
    .filter(
      (row) =>
        row.action === 'EMPLOYEE_INVITE_SENT' ||
        row.action === 'EMPLOYEE_INVITE_FAILED' ||
        row.action === 'EMPLOYEE_INVITE_ACCEPTED',
    )
    .slice(0, 5)
    .map((row) => {
      const detailsJson = normalizeDetailsJson(row.details_json)
      const employeeName = readText(detailsJson.employee_name)
      const matricule = readText(detailsJson.matricule)
      const triggerSource = readText(detailsJson.trigger_source)

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
        triggerSource:
          triggerSource === 'invite' || triggerSource === 'resend_invite'
            ? triggerSource
            : null,
        createdAt: row.created_at,
        failureReason: readText(detailsJson.failure_reason) ?? undefined,
      }
    })
}

interface MonitoringAuditLookups {
  profileByUserId: Map<string, ProfilLookupRow>
  employeeById: Map<string, EmployeeLookupRow>
  error?: string
}

async function buildAuditLookups(rows: MonitoringAuditRow[]): Promise<MonitoringAuditLookups> {
  if (rows.length === 0) {
    return {
      profileByUserId: new Map<string, ProfilLookupRow>(),
      employeeById: new Map<string, EmployeeLookupRow>(),
    }
  }

  const actorUserIds = [...new Set(rows.map((row) => row.actor_user_id).filter(Boolean))] as string[]
  const employeeIds = new Set<string>()

  for (const row of rows) {
    const detailsJson = normalizeDetailsJson(row.details_json)

    if (row.target_type === 'Employe' && row.target_id) {
      employeeIds.add(row.target_id)
    }

    const detailEmployeeId = readText(detailsJson.employee_id)
    if (detailEmployeeId) {
      employeeIds.add(detailEmployeeId)
    }
  }

  const profileByUserId = new Map<string, ProfilLookupRow>()
  const employeeById = new Map<string, EmployeeLookupRow>()
  const errorMessages: string[] = []

  if (actorUserIds.length > 0) {
    const { data, error } = await supabase
      .from('ProfilUtilisateur')
      .select('user_id, role, employe_id')
      .in('user_id', actorUserIds)
      .returns<ProfilLookupRow[]>()

    if (error) {
      errorMessages.push(error.message)
    } else {
      for (const profile of data ?? []) {
        if (profile.user_id) {
          profileByUserId.set(profile.user_id, profile)
        }
        if (profile.employe_id) {
          employeeIds.add(profile.employe_id)
        }
      }
    }
  }

  const lookupEmployeeIds = [...new Set([...employeeIds].filter(Boolean))]

  if (lookupEmployeeIds.length > 0) {
    const { data, error } = await supabase
      .from('Employe')
      .select('id, matricule, nom, prenom')
      .in('id', lookupEmployeeIds)
      .returns<EmployeeLookupRow[]>()

    if (error) {
      errorMessages.push(error.message)
    } else {
      for (const employee of data ?? []) {
        employeeById.set(employee.id, employee)
      }
    }
  }

  return {
    profileByUserId,
    employeeById,
    error: errorMessages.length > 0 ? errorMessages.join(' ') : undefined,
  }
}

async function buildRecentPayrollActivity(
  rows: MonitoringAuditRow[],
): Promise<{ items: MonitoringRecentPayrollActivityItem[]; error?: string }> {
  const payrollRows = rows
    .filter((row) => categorizeAuditAction(row.action) === 'payroll')
    .slice(0, 8)

  if (payrollRows.length === 0) {
    return { items: [] }
  }

  const lookups = await buildAuditLookups(payrollRows)

  const items = payrollRows.map((row) => {
    const detailsJson = normalizeDetailsJson(row.details_json)
    const actionMeta = getAuditActionMeta(row.action)
    const employeeId =
      readText(detailsJson.employee_id) ?? (row.target_type === 'Employe' ? row.target_id : null)
    const employee = employeeId ? lookups.employeeById.get(employeeId) : null
    const employeeName =
      readText(detailsJson.employee_name) ??
      (employee ? `${employee.prenom} ${employee.nom}` : null)

    return {
      id: row.id,
      action: row.action,
      actionLabel: actionMeta.label,
      tone: actionMeta.tone,
      actorLabel: formatActorLabel(
        row,
        lookups.profileByUserId,
        lookups.employeeById,
        detailsJson,
      ),
      targetLabel: formatTargetLabel(row, detailsJson, lookups.employeeById),
      employeeId,
      employeeName,
      rowCount: readNumber(detailsJson.row_count),
      fileName: readText(detailsJson.file_name),
      format: readText(detailsJson.format),
      summary: buildDetailsPreview(row.action, detailsJson),
      createdAt: row.created_at,
    }
  })

  return {
    items,
    error: lookups.error,
  }
}

function buildTopActions(rows: MonitoringAuditRow[]): MonitoringTopActionItem[] {
  const counts = new Map<string, number>()

  for (const row of rows) {
    counts.set(row.action, (counts.get(row.action) ?? 0) + 1)
  }

  return [...counts.entries()]
    .map(([action, count]) => {
      const actionMeta = getAuditActionMeta(action)
      const categoryMeta = getMonitoringCategoryMeta(actionMeta.categoryKey)

      return {
        action,
        label: actionMeta.label,
        categoryKey: actionMeta.categoryKey,
        categoryLabel: categoryMeta.label,
        count,
        tone: actionMeta.tone,
        critical: isCriticalAuditAction(action),
      }
    })
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
    .slice(0, 6)
}

function buildAttentionItems(rows: MonitoringAuditRow[]): MonitoringInsightItem[] {
  const failedEmailCount = rows.filter(
    (row) => categorizeAuditAction(row.action) === 'email' && isFailedAuditAction(row.action),
  ).length
  const qrRefreshRequiredCount = rows.filter(
    (row) => row.action === 'QR_REFRESH_REQUIRED_CREATED',
  ).length
  const revokedQrCount = rows.filter((row) => row.action === 'QR_REVOKED').length
  const rejectedRequestCount = rows.filter((row) => row.action === 'REQUEST_REJECTED').length
  const payrollCalculationFailureCount = rows.filter(
    (row) => row.action === 'PAYROLL_CALCULATION_FAILED',
  ).length
  const rejectedPayslipRequestCount = rows.filter((row) => {
    if (row.action !== 'PAYSLIP_REQUEST_STATUS_UPDATED') {
      return false
    }

    const detailsJson = normalizeDetailsJson(row.details_json)
    return readText(detailsJson.next_status) === 'REJECTED'
  }).length
  const securityCount = rows.filter(
    (row) => categorizeAuditAction(row.action) === 'security',
  ).length

  const items: MonitoringInsightItem[] = []

  if (failedEmailCount > 0) {
    items.push({
      id: 'failed-invites',
      title: 'Invite email failures',
      description: 'Invite delivery failures recorded in the selected window.',
      count: failedEmailCount,
      tone: 'danger',
    })
  }

  if (qrRefreshRequiredCount > 0) {
    items.push({
      id: 'qr-refresh-required',
      title: 'QR refresh required',
      description: 'Profile changes are waiting for QR reissue follow-up.',
      count: qrRefreshRequiredCount,
      tone: 'warning',
    })
  }

  if (revokedQrCount > 0) {
    items.push({
      id: 'revoked-qr',
      title: 'Revoked QR activity',
      description: 'QR tokens were revoked or replaced in the current window.',
      count: revokedQrCount,
      tone: 'info',
    })
  }

  if (rejectedRequestCount > 0) {
    items.push({
      id: 'rejected-requests',
      title: 'Rejected requests',
      description: 'Employee requests closed without applying changes.',
      count: rejectedRequestCount,
      tone: 'warning',
    })
  }

  if (payrollCalculationFailureCount > 0) {
    items.push({
      id: 'payroll-calculation-failures',
      title: 'Payroll calculation failures',
      description: 'At least one payroll run failed during calculation.',
      count: payrollCalculationFailureCount,
      tone: 'danger',
    })
  }

  if (rejectedPayslipRequestCount > 0) {
    items.push({
      id: 'rejected-payslip-requests',
      title: 'Rejected payslip requests',
      description: 'Employee payslip requests were closed without delivery.',
      count: rejectedPayslipRequestCount,
      tone: 'warning',
    })
  }

  if (securityCount > 0) {
    items.push({
      id: 'security-signals',
      title: 'Security / auth signals',
      description: 'Auth-related events are present in the selected period.',
      count: securityCount,
      tone: 'positive',
    })
  }

  return items.slice(0, 5)
}

function buildDetailsPreview(action: string, detailsJson: Record<string, unknown>): string {
  const recipientEmail = readText(detailsJson.recipient_email)
  const matricule = readText(detailsJson.matricule)
  const triggerSource = readText(detailsJson.trigger_source)
  const failureReason = readText(detailsJson.failure_reason)
  const fieldKey = readText(detailsJson.field_key)
  const publicationSummary = readText(detailsJson.publication_summary)
  const tokenStatus =
    readText(detailsJson.resulting_token_status) ?? readText(detailsJson.statut_token)
  const changedFields = readStringArray(detailsJson.changed_fields)
  const publicFields = readStringArray(detailsJson.public_fields)

  switch (action) {
    case 'EMPLOYEE_DEACTIVATED':
      return matricule ? `Deactivated employee ${matricule}.` : 'Deactivated an employee profile.'
    case 'EMPLOYEE_ACTIVATED':
      return matricule ? `Reactivated employee ${matricule}.` : 'Reactivated an employee profile.'
    case 'REQUEST_REJECTED':
      return failureReason ?? 'Rejected an employee modification request.'
    case 'QR_GENERATED':
      if (publicationSummary) {
        return publicationSummary
      }
      return publicFields.length > 0
        ? `Generated a new QR token with public fields: ${publicFields.map(formatFieldLabel).join(', ')}.`
        : matricule
          ? `Generated a new QR token for ${matricule}.`
          : 'Generated a new QR token.'
    case 'QR_REGENERATED':
      if (publicationSummary) {
        return publicationSummary
      }
      if (publicFields.length > 0) {
        return `Regenerated QR with public fields: ${publicFields.map(formatFieldLabel).join(', ')}.`
      }
      return changedFields.length > 0
        ? `Regenerated QR after changes to ${changedFields.map(formatFieldLabel).join(', ')}.`
        : tokenStatus
          ? `Issued a replacement QR token with status ${tokenStatus}.`
          : 'Generated or refreshed a QR token.'
    case 'QR_REVOKED':
      return 'Revoked an active QR token.'
    case 'QR_REFRESH_REQUIRED_CREATED':
      return changedFields.length > 0
        ? `QR refresh required after ${changedFields.map(formatFieldLabel).join(', ')} changes.`
        : 'QR refresh review is required.'
    case 'EMPLOYEE_INVITE_SENT':
      return triggerSource === 'resend_invite' && recipientEmail
        ? `Re-sent employee invite email to ${recipientEmail}.`
        : recipientEmail
          ? `Sent employee invite email to ${recipientEmail}.`
          : 'Sent an employee invite email.'
    case 'EMPLOYEE_INVITE_FAILED':
      if (recipientEmail && failureReason) {
        return `Invite email to ${recipientEmail} failed: ${failureReason}`
      }
      return recipientEmail
        ? `Invite email to ${recipientEmail} failed.`
        : 'Employee invite email failed.'
    case 'EMPLOYEE_INVITE_ACCEPTED':
      return recipientEmail
        ? `Invite recipient ${recipientEmail} completed first-login password setup.`
        : 'An invited employee completed first-login password setup.'
    case 'EMPLOYEE_SHEET_PREVIEWED':
      return matricule
        ? `Previewed employee information sheet for ${matricule}.`
        : 'Previewed an employee information sheet.'
    case 'EMPLOYEE_SHEET_EXPORTED': {
      const format = readText(detailsJson.format)
      if (matricule && format === 'pdf') {
        return `Exported employee information sheet PDF for ${matricule}.`
      }
      if (matricule) {
        return `Started print or PDF export for employee information sheet ${matricule}.`
      }
      return format === 'pdf'
        ? 'Exported an employee information sheet PDF.'
        : 'Started a print or PDF export for an employee information sheet.'
    }
    case 'EMPLOYEE_SHEET_EMAIL_SENT':
      return recipientEmail
        ? `Sent employee information sheet email to ${recipientEmail}.`
        : 'Sent an employee information sheet email.'
    case 'EMPLOYEE_SHEET_EMAIL_FAILED':
      if (recipientEmail && failureReason) {
        return `Employee information sheet email to ${recipientEmail} failed: ${failureReason}`
      }
      return recipientEmail
        ? `Employee information sheet email to ${recipientEmail} failed.`
        : 'Employee information sheet email failed.'
    case 'PAYROLL_EXPORT_REQUESTED':
    case 'PAYROLL_EXPORT_GENERATED': {
      const rowCount = readText(detailsJson.row_count)
      const departmentName = getDepartmentDisplayName(readText(detailsJson.department_name))
      const status = readText(detailsJson.status)
      const typeContrat = readText(detailsJson.type_contrat)
      const scopeParts = [
        departmentName,
        status && status !== 'ALL' ? status : null,
        typeContrat ? `Contract ${typeContrat}` : null,
      ].filter((value): value is string => Boolean(value))

      const actionVerb =
        action === 'PAYROLL_EXPORT_REQUESTED' ? 'Requested' : 'Generated'

      if (rowCount && scopeParts.length > 0) {
        return `${actionVerb} payroll CSV export (${rowCount} rows) for ${scopeParts.join(', ')}.`
      }

      if (rowCount) {
        return `${actionVerb} payroll CSV export (${rowCount} rows).`
      }

      return action === 'PAYROLL_EXPORT_REQUESTED'
        ? 'Requested a payroll CSV export.'
        : 'Generated a payroll CSV export.'
    }
    case 'PAYROLL_EXPORT_PRINT_INITIATED':
      return matricule
        ? `Started payroll information-sheet print or PDF export for ${matricule}.`
        : 'Started a payroll information-sheet print or PDF export.'
    case 'PAYROLL_PERIOD_CREATED': {
      const periodLabel = readText(detailsJson.period_label)
      const periodCode = readText(detailsJson.period_code)
      const reference = periodLabel ?? periodCode

      return reference
        ? `Created payroll period ${reference}.`
        : 'Created a payroll period.'
    }
    case 'PAYROLL_RUN_CREATED': {
      const runCode = readText(detailsJson.payroll_run_code)
      const employeeCount = readText(detailsJson.employee_count)

      if (runCode && employeeCount) {
        return `Created payroll run ${runCode} with ${employeeCount} seeded employee entries.`
      }

      return runCode ? `Created payroll run ${runCode}.` : 'Created a payroll run.'
    }
    case 'PAYROLL_CALCULATION_STARTED': {
      const runCode = readText(detailsJson.payroll_run_code)

      return runCode
        ? `Started payroll calculation for ${runCode}.`
        : 'Started payroll calculation.'
    }
    case 'PAYROLL_CALCULATION_COMPLETED': {
      const runCode = readText(detailsJson.payroll_run_code)
      const calculatedCount = readText(detailsJson.calculated_employee_count)
      const excludedCount = readText(detailsJson.excluded_employee_count)

      if (runCode && calculatedCount && excludedCount) {
        return `Completed payroll calculation for ${runCode}: ${calculatedCount} calculated, ${excludedCount} excluded.`
      }

      return runCode
        ? `Completed payroll calculation for ${runCode}.`
        : 'Completed payroll calculation.'
    }
    case 'PAYROLL_CALCULATION_FAILED': {
      const runCode = readText(detailsJson.payroll_run_code)

      if (runCode && failureReason) {
        return `Payroll calculation failed for ${runCode}: ${failureReason}`
      }

      return runCode
        ? `Payroll calculation failed for ${runCode}.`
        : failureReason
          ? `Payroll calculation failed: ${failureReason}`
          : 'Payroll calculation failed.'
    }
    case 'PAYROLL_RUN_UPDATED': {
      const runCode = readText(detailsJson.payroll_run_code)
      const nextStatus = readText(detailsJson.next_status)

      if (runCode && nextStatus) {
        return `Updated payroll run ${runCode} to ${nextStatus.toLowerCase().replaceAll('_', ' ')}.`
      }

      return runCode ? `Updated payroll run ${runCode}.` : 'Updated a payroll run.'
    }
    case 'PAYROLL_RUN_FINALIZED': {
      const runCode = readText(detailsJson.payroll_run_code)

      return runCode ? `Finalized payroll run ${runCode}.` : 'Finalized a payroll run.'
    }
    case 'PAYROLL_PAYSLIP_PUBLISHED': {
      const employeeName = readText(detailsJson.employee_name)
      const employeeReference =
        employeeName && matricule
          ? `${employeeName} (${matricule})`
          : employeeName ?? matricule

      return employeeReference
        ? `Published payslip metadata for ${employeeReference}.`
        : 'Published a payslip.'
    }
    case 'PAYSLIP_REQUEST_CREATED': {
      const periodLabel = readText(detailsJson.payroll_period_label)
      const periodCode = readText(detailsJson.payroll_period_code)
      const reference = periodLabel ?? periodCode

      return reference
        ? `Submitted a payslip request for ${reference}.`
        : 'Submitted a payslip request.'
    }
    case 'PAYSLIP_REQUEST_STATUS_UPDATED': {
      const periodLabel = readText(detailsJson.payroll_period_label)
      const periodCode = readText(detailsJson.payroll_period_code)
      const nextStatus = readText(detailsJson.next_status)
      const reference = periodLabel ?? periodCode

      if (reference && nextStatus) {
        return `Updated payslip request ${reference} to ${nextStatus.toLowerCase().replaceAll('_', ' ')}.`
      }

      return reference
        ? `Updated payslip request ${reference}.`
        : 'Updated a payslip request.'
    }
    case 'PAYSLIP_REQUEST_FULFILLED': {
      const periodLabel = readText(detailsJson.payroll_period_label)
      const periodCode = readText(detailsJson.payroll_period_code)
      const reference = periodLabel ?? periodCode

      return reference
        ? `Fulfilled payslip request for ${reference}.`
        : 'Fulfilled a payslip request.'
    }
    case 'PAYSLIP_DOCUMENT_PUBLISHED': {
      const periodLabel = readText(detailsJson.payroll_period_label)
      const periodCode = readText(detailsJson.payroll_period_code)
      const fileName = readText(detailsJson.file_name)
      const reference = periodLabel ?? periodCode

      if (reference && fileName) {
        return `Published payslip document ${fileName} for ${reference}.`
      }

      return reference
        ? `Published a payslip document for ${reference}.`
        : 'Published a payslip document.'
    }
    case 'PAYSLIP_DOCUMENT_VIEWED': {
      const periodLabel = readText(detailsJson.payroll_period_label)
      const periodCode = readText(detailsJson.payroll_period_code)
      const fileName = readText(detailsJson.file_name)
      const reference = periodLabel ?? periodCode

      if (reference && fileName) {
        return `Viewed payslip document ${fileName} for ${reference}.`
      }

      return reference
        ? `Viewed a payslip document for ${reference}.`
        : 'Viewed a payslip document.'
    }
    case 'PAYSLIP_DOCUMENT_DOWNLOADED': {
      const periodLabel = readText(detailsJson.payroll_period_label)
      const periodCode = readText(detailsJson.payroll_period_code)
      const fileName = readText(detailsJson.file_name)
      const reference = periodLabel ?? periodCode

      if (reference && fileName) {
        return `Downloaded payslip document ${fileName} for ${reference}.`
      }

      return reference
        ? `Downloaded a payslip document for ${reference}.`
        : 'Downloaded a payslip document.'
    }
    case 'PUBLIC_PROFILE_VIEWED': {
      const publicFieldsCount = readNumber(detailsJson.public_fields_count)
      return publicFieldsCount !== null
        ? `Public QR profile loaded with ${publicFieldsCount} visible field${publicFieldsCount === 1 ? '' : 's'}.`
        : 'Public QR profile was viewed successfully.'
    }
    case 'PUBLIC_PROFILE_VISIBILITY_REQUEST_SUBMITTED': {
      const requestedFieldKeys = readStringArray(detailsJson.requested_field_keys)
      return requestedFieldKeys.length > 0
        ? `Submitted visibility request for ${requestedFieldKeys.map(formatFieldLabel).join(', ')}.`
        : 'Submitted a public profile visibility request.'
    }
    case 'PUBLIC_PROFILE_VISIBILITY_REQUEST_IN_REVIEW':
      return 'Public profile visibility request moved to in review.'
    case 'PUBLIC_PROFILE_VISIBILITY_REQUEST_APPROVED': {
      const requestedFieldKeys = readStringArray(detailsJson.requested_field_keys)
      return requestedFieldKeys.length > 0
        ? `Approved visibility request for ${requestedFieldKeys.map(formatFieldLabel).join(', ')}.`
        : 'Approved a public profile visibility request.'
    }
    case 'PUBLIC_PROFILE_VISIBILITY_REQUEST_REJECTED':
      return readText(detailsJson.review_note)
        ? `Rejected public profile visibility request: ${readText(detailsJson.review_note)}`
        : 'Rejected a public profile visibility request.'
    case 'VISIBILITY_UPDATED':
      return fieldKey
        ? `${formatFieldLabel(fieldKey)} visibility was updated.`
        : 'Updated employee visibility settings.'
    default: {
      const summaryEntries = Object.entries(detailsJson)
        .filter(([, value]) => value !== null && value !== undefined && value !== '')
        .slice(0, 2)

      if (summaryEntries.length === 0) {
        return 'No additional event details.'
      }

      return truncatePreview(
        summaryEntries
          .map(([key, value]) => `${formatFieldLabel(key)}: ${stringifyPreviewValue(value)}`)
          .join(' | '),
      )
    }
  }
}

function formatTargetLabel(
  row: MonitoringAuditRow,
  detailsJson: Record<string, unknown>,
  employeeById: Map<string, EmployeeLookupRow>,
): string {
  if (!row.target_id) {
    if (row.target_type === 'payroll_export') {
      return 'Payroll export activity'
    }

    return row.target_type
  }

  if (row.target_type === 'Employe') {
    const directEmployee = employeeById.get(row.target_id)
    if (directEmployee) {
      return formatEmployeeLabel(directEmployee)
    }

    const employeeName = readText(detailsJson.employee_name)
    const matricule = readText(detailsJson.matricule)
    if (employeeName && matricule) {
      return `${employeeName} (${matricule})`
    }

    if (employeeName) {
      return employeeName
    }
  }

  if (row.target_type === 'DemandeModification') {
    const fieldKey = readText(detailsJson.field_key) ?? readText(detailsJson.champ_cible)
    if (fieldKey) {
      return `Modification request | ${formatFieldLabel(fieldKey)}`
    }

    return `Modification request (${row.target_id.slice(0, 8)})`
  }

  if (row.target_type === 'TokenQR') {
    return `QR token (${row.target_id.slice(0, 8)})`
  }

  if (row.target_type === 'employee_visibility') {
    return 'Employee visibility settings'
  }

  if (row.target_type === 'PublicProfileVisibilityRequest') {
    return 'Public profile visibility request'
  }

  if (row.target_type === 'payroll_export') {
    return 'Payroll export activity'
  }

  if (row.target_type === 'PayrollPeriod') {
    const reference =
      readText(detailsJson.period_label) ??
      readText(detailsJson.payroll_period_label) ??
      readText(detailsJson.period_code) ??
      readText(detailsJson.payroll_period_code)

    return reference ? `Payroll period | ${reference}` : `Payroll period (${row.target_id.slice(0, 8)})`
  }

  if (row.target_type === 'PayrollRun') {
    const runCode = readText(detailsJson.payroll_run_code)
    return runCode ? `Payroll run | ${runCode}` : `Payroll run (${row.target_id.slice(0, 8)})`
  }

  if (row.target_type === 'Payslip') {
    const reference =
      readText(detailsJson.payroll_period_label) ??
      readText(detailsJson.payroll_period_code) ??
      readText(detailsJson.file_name)

    return reference ? `Payslip | ${reference}` : `Payslip (${row.target_id.slice(0, 8)})`
  }

  if (row.target_type === 'PayslipRequest') {
    const reference =
      readText(detailsJson.payroll_period_label) ?? readText(detailsJson.payroll_period_code)

    return reference
      ? `Payslip request | ${reference}`
      : `Payslip request (${row.target_id.slice(0, 8)})`
  }

  if (row.target_type === 'PayslipDelivery') {
    const reference =
      readText(detailsJson.file_name) ??
      readText(detailsJson.payroll_period_label) ??
      readText(detailsJson.payroll_period_code)

    return reference
      ? `Payslip delivery | ${reference}`
      : `Payslip delivery (${row.target_id.slice(0, 8)})`
  }

  return `${row.target_type} (${row.target_id.slice(0, 8)})`
}

function formatActorLabel(
  row: MonitoringAuditRow,
  profileByUserId: Map<string, ProfilLookupRow>,
  employeeById: Map<string, EmployeeLookupRow>,
  detailsJson: Record<string, unknown>,
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

async function buildRecentCriticalEvents(
  rows: MonitoringAuditRow[],
): Promise<{ items: MonitoringRecentEvent[]; error?: string }> {
  const criticalRows = rows.filter((row) => isCriticalAuditAction(row.action)).slice(0, 8)

  if (criticalRows.length === 0) {
    return { items: [] }
  }

  const lookups = await buildAuditLookups(criticalRows)

  const items: MonitoringRecentEvent[] = criticalRows.map((row) => {
    const detailsJson = normalizeDetailsJson(row.details_json)
    const actionMeta = getAuditActionMeta(row.action)
    const categoryMeta = getMonitoringCategoryMeta(actionMeta.categoryKey)

    return {
      id: row.id,
      actorUserId: row.actor_user_id,
      actorLabel: formatActorLabel(
        row,
        lookups.profileByUserId,
        lookups.employeeById,
        detailsJson,
      ),
      action: row.action,
      actionLabel: actionMeta.label,
      targetType: row.target_type,
      targetId: row.target_id,
      targetLabel: formatTargetLabel(row, detailsJson, lookups.employeeById),
      detailsJson,
      detailsPreview: buildDetailsPreview(row.action, detailsJson),
      createdAt: row.created_at,
      categoryKey: actionMeta.categoryKey,
      categoryLabel: categoryMeta.label,
      tone: actionMeta.tone,
      critical: isCriticalAuditAction(row.action),
    }
  })

  return {
    items,
    error: lookups.error,
  }
}

export async function getMonitoringDashboardData(
  filters: MonitoringDashboardFilters = {},
): Promise<MonitoringDashboardData> {
  const period = filters.period ?? 'LAST_7_DAYS'
  const category = filters.category ?? 'ALL'
  const { startAt, endAt, rangeLabel, buckets } = buildTimelineBuckets(period)

  const allRows = await listAuditRowsInRange(startAt, endAt)
  const filteredRows = filterRowsByCategory(allRows, category)

  const totalEvents = filteredRows.length
  const qrEvents = filteredRows.filter((row) => categorizeAuditAction(row.action) === 'qr').length
  const emailEvents = filteredRows.filter((row) => categorizeAuditAction(row.action) === 'email').length
  const payrollEvents = filteredRows.filter(
    (row) => categorizeAuditAction(row.action) === 'payroll',
  ).length
  const securityEvents = filteredRows.filter(
    (row) => categorizeAuditAction(row.action) === 'security',
  ).length
  const failedEvents = filteredRows.filter((row) => isFailedAuditAction(row.action)).length
  const criticalEvents = filteredRows.filter((row) => isCriticalAuditAction(row.action)).length

  const [recentCriticalEventsResult, recentPayrollActivityResult] = await Promise.all([
    buildRecentCriticalEvents(filteredRows),
    buildRecentPayrollActivity(filteredRows),
  ])

  return {
    period,
    categoryFilter: category,
    rangeLabel,
    startAt,
    endAt,
    totalAvailableEvents: allRows.length,
    filteredEvents: totalEvents,
    hasSecuritySignals: securityEvents > 0,
    kpis: {
      totalEvents,
      qrEvents,
      emailEvents,
      payrollEvents,
      securityEvents,
      failedEvents,
      criticalEvents,
    },
    activityTimeline: buildTimeline(filteredRows, buckets),
    categoryDistribution: buildCategoryDistribution(filteredRows),
    qrActivity: buildMetricItems(filteredRows, QR_ACTIVITY_CONFIG),
    emailActivity: buildEmailActivity(filteredRows),
    recentInviteEvents: buildRecentInviteEvents(filteredRows),
    payrollActivity: buildPayrollActivity(filteredRows),
    recentPayrollActivity: recentPayrollActivityResult.items,
    recentCriticalEvents: recentCriticalEventsResult.items,
    topActions: buildTopActions(filteredRows),
    attentionItems: buildAttentionItems(filteredRows),
    sectionErrors: {
      recentCriticalEvents: recentCriticalEventsResult.error,
      recentPayrollActivity: recentPayrollActivityResult.error,
    },
  }
}

export function useMonitoringDashboardQuery(
  filters: MonitoringDashboardFilters = {},
) {
  return useQuery({
    queryKey: ['adminMonitoringDashboard', filters],
    queryFn: () => getMonitoringDashboardData(filters),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}

export const monitoringDashboardService = {
  getMonitoringDashboardData,
}
