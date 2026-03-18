import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { supabase } from '@/lib/supabaseClient'
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
] as const

const EMAIL_ACTIVITY_CONFIG = [
  {
    key: 'EMPLOYEE_INVITE_SENT',
    label: 'Invites Sent',
    helper: 'Employee invite emails sent',
    tone: 'orange',
  },
  {
    key: 'EMPLOYEE_INVITE_FAILED',
    label: 'Invite Failures',
    helper: 'Invite email attempts that failed',
    tone: 'rose',
  },
  {
    key: 'EMPLOYEE_SHEET_SENT',
    label: 'Sheets Sent',
    helper: 'Employee information sheets sent',
    tone: 'orange',
  },
  {
    key: 'EMPLOYEE_SHEET_SEND_FAILED',
    label: 'Sheet Failures',
    helper: 'Information sheet sends that failed',
    tone: 'rose',
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

function buildRecentInviteEvents(rows: MonitoringAuditRow[]): MonitoringRecentInviteItem[] {
  return rows
    .filter(
      (row) => row.action === 'EMPLOYEE_INVITE_SENT' || row.action === 'EMPLOYEE_INVITE_FAILED',
    )
    .slice(0, 5)
    .map((row) => {
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
  const failedEmailCount = rows.filter((row) => row.action === 'EMPLOYEE_INVITE_FAILED').length
  const failedSheetCount = rows.filter((row) => row.action === 'EMPLOYEE_SHEET_SEND_FAILED').length
  const qrRefreshRequiredCount = rows.filter(
    (row) => row.action === 'QR_REFRESH_REQUIRED_CREATED',
  ).length
  const revokedQrCount = rows.filter((row) => row.action === 'QR_REVOKED').length
  const rejectedRequestCount = rows.filter((row) => row.action === 'REQUEST_REJECTED').length
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

  if (failedSheetCount > 0) {
    items.push({
      id: 'failed-sheets',
      title: 'Information sheet failures',
      description: 'Employee sheet delivery attempts that need review.',
      count: failedSheetCount,
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
  const subject = readText(detailsJson.subject)
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
    case 'EMPLOYEE_SHEET_SENT':
      if (recipientEmail && subject) {
        return `Sent an employee information sheet to ${recipientEmail} with subject "${subject}".`
      }
      return recipientEmail
        ? `Sent an employee information sheet to ${recipientEmail}.`
        : 'Sent an employee information sheet.'
    case 'EMPLOYEE_SHEET_SEND_FAILED':
      if (recipientEmail && failureReason) {
        return `Information sheet email to ${recipientEmail} failed: ${failureReason}`
      }
      return recipientEmail
        ? `Information sheet email to ${recipientEmail} failed.`
        : 'Information sheet email failed.'
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

  const actorUserIds = [
    ...new Set(criticalRows.map((row) => row.actor_user_id).filter(Boolean)),
  ] as string[]
  const employeeIds = new Set(
    criticalRows
      .filter((row) => row.target_type === 'Employe' && row.target_id)
      .map((row) => row.target_id as string),
  )

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

  const lookupEmployeeIds = [
    ...new Set(
      [...employeeIds].filter(Boolean),
    ),
  ]

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

  const items: MonitoringRecentEvent[] = criticalRows.map((row) => {
    const detailsJson = normalizeDetailsJson(row.details_json)
    const actionMeta = getAuditActionMeta(row.action)
    const categoryMeta = getMonitoringCategoryMeta(actionMeta.categoryKey)

    return {
      id: row.id,
      actorUserId: row.actor_user_id,
      actorLabel: formatActorLabel(row, profileByUserId, employeeById, detailsJson),
      action: row.action,
      actionLabel: actionMeta.label,
      targetType: row.target_type,
      targetId: row.target_id,
      targetLabel: formatTargetLabel(row, detailsJson, employeeById),
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
    error: errorMessages.length > 0 ? errorMessages.join(' ') : undefined,
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
  const securityEvents = filteredRows.filter(
    (row) => categorizeAuditAction(row.action) === 'security',
  ).length
  const failedEvents = filteredRows.filter((row) => isFailedAuditAction(row.action)).length
  const criticalEvents = filteredRows.filter((row) => isCriticalAuditAction(row.action)).length

  const recentCriticalEventsResult = await buildRecentCriticalEvents(filteredRows)

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
      securityEvents,
      failedEvents,
      criticalEvents,
    },
    activityTimeline: buildTimeline(filteredRows, buckets),
    categoryDistribution: buildCategoryDistribution(filteredRows),
    qrActivity: buildMetricItems(filteredRows, QR_ACTIVITY_CONFIG),
    emailActivity: buildMetricItems(filteredRows, EMAIL_ACTIVITY_CONFIG),
    recentInviteEvents: buildRecentInviteEvents(filteredRows),
    recentCriticalEvents: recentCriticalEventsResult.items,
    topActions: buildTopActions(filteredRows),
    attentionItems: buildAttentionItems(filteredRows),
    sectionErrors: {
      recentCriticalEvents: recentCriticalEventsResult.error,
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
