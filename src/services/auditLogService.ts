import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { supabase } from '@/lib/supabaseClient'
import type {
  AuditLogItem,
  AuditLogListResponse,
  ListAuditLogsParams,
} from '@/types/audit-log'

interface AuditLogRow {
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

interface ModificationRequestLookupRow {
  id: string
}

const EXCLUDED_AUDIT_ACTIONS_FILTER = '(EMPLOYEE_SHEET_SENT,EMPLOYEE_SHEET_SEND_FAILED)'

function paginate(page = 1, pageSize = 20) {
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  return { page, pageSize, from, to }
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
}

function formatEventSourceLabel(value: string): string {
  return formatFieldLabel(value).replace(/\bQr\b/g, 'QR')
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

function truncatePreview(value: string, maxLength = 120): string {
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

function toStartOfDay(date: string): string {
  return `${date}T00:00:00`
}

function toEndOfDay(date: string): string {
  return `${date}T23:59:59.999`
}

function toDetailsPreview(action: string, detailsJson: Record<string, unknown>): string {
  const matricule = readText(detailsJson.matricule)
  const recipientEmail = readText(detailsJson.recipient_email)
  const fieldKey = readText(detailsJson.field_key)
  const triggerSource = readText(detailsJson.trigger_source)
  const failureReason = readText(detailsJson.failure_reason)
  const reason = readText(detailsJson.reason)
  const publicationSummary = readText(detailsJson.publication_summary)
  const isPublic = detailsJson.is_public === true
  const tokenStatus =
    readText(detailsJson.resulting_token_status) ?? readText(detailsJson.statut_token)
  const changedFields = Array.isArray(detailsJson.changed_fields)
    ? detailsJson.changed_fields
        .map((item) => readText(item))
        .filter((item): item is string => Boolean(item))
    : []
  const publicFields = readStringArray(detailsJson.public_fields)

  switch (action) {
    case 'EMPLOYEE_ACTIVATED':
      return matricule ? `Reactivated employee ${matricule}.` : 'Reactivated an employee profile.'
    case 'EMPLOYEE_CREATED':
      return matricule ? `Created employee ${matricule}.` : 'Created a new employee profile.'
    case 'EMPLOYEE_UPDATED':
      return matricule ? `Updated employee ${matricule}.` : 'Updated an employee profile.'
    case 'EMPLOYEE_DEACTIVATED':
      return matricule ? `Deactivated employee ${matricule}.` : 'Deactivated an employee profile.'
    case 'EMPLOYEE_INVITE_SENT':
      if (recipientEmail && triggerSource === 'resend_invite') {
        return `Re-sent employee invite email to ${recipientEmail}.`
      }
      return recipientEmail
        ? `Sent employee invite email to ${recipientEmail}.`
        : 'Sent an employee invite email.'
    case 'EMPLOYEE_INVITE_FAILED':
      if (recipientEmail && failureReason) {
        return `Employee invite email to ${recipientEmail} failed: ${failureReason}`
      }
      if (recipientEmail) {
        return `Employee invite email to ${recipientEmail} failed.`
      }
      return failureReason
        ? `Employee invite email failed: ${failureReason}`
        : 'Employee invite email failed.'
    case 'EMPLOYEE_INVITE_ACCEPTED':
      return matricule
        ? `Invite accepted and first login completed for ${matricule}.`
        : recipientEmail
          ? `Invite accepted by ${recipientEmail}.`
          : 'Employee completed first-login account setup.'
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
      if (recipientEmail) {
        return `Employee information sheet email to ${recipientEmail} failed.`
      }
      return failureReason
        ? `Employee information sheet email failed: ${failureReason}`
        : 'Employee information sheet email failed.'
    case 'EMPLOYEE_SELF_UPDATED':
      return changedFields.length > 0
        ? `Employee updated: ${changedFields.map(formatFieldLabel).join(', ')}.`
        : 'Employee submitted direct profile updates.'
    case 'REQUEST_SUBMITTED':
      return changedFields.length > 0
        ? `Request submitted for ${changedFields.map(formatFieldLabel).join(', ')}.`
        : 'Submitted an employee modification request.'
    case 'REQUEST_APPROVED':
      return changedFields.length > 0
        ? `Approved request for ${changedFields.map(formatFieldLabel).join(', ')}.`
        : 'Approved an employee modification request.'
    case 'REQUEST_REJECTED':
      return readText(detailsJson.commentaire_traitement)
        ? `Rejected request: ${readText(detailsJson.commentaire_traitement)}`
        : 'Rejected an employee modification request.'
    case 'QR_GENERATED':
      if (publicationSummary) {
        return publicationSummary
      }
      if (publicFields.length > 0) {
        return `Generated a new active QR with public fields: ${publicFields.map(formatFieldLabel).join(', ')}.`
      }
      return matricule ? `Generated a new active QR for ${matricule}.` : 'Generated a new active QR token.'
    case 'QR_REGENERATED':
      if (publicationSummary) {
        return publicationSummary
      }
      if (publicFields.length > 0) {
        return `Regenerated QR with public fields: ${publicFields.map(formatFieldLabel).join(', ')}.`
      }
      if (detailsJson.refresh_required_resolved === true && changedFields.length > 0) {
        return `Regenerated QR after updates to ${changedFields.map(formatFieldLabel).join(', ')}.`
      }
      if (reason === 'manual_regeneration' || reason === 'public_profile_refresh') {
        return 'Regenerated the active QR token.'
      }
      return tokenStatus ? `Issued a replacement QR token with status ${tokenStatus}.` : 'Generated or refreshed a QR token.'
    case 'QR_REVOKED':
      if (reason === 'employee_deactivated') {
        return 'Revoked the active QR token because the employee was deactivated.'
      }
      if (reason === 'regeneration_replaced_previous_active_qr') {
        return 'Revoked the previous QR token during regeneration.'
      }
      return 'Revoked the active QR token.'
    case 'QR_REFRESH_COMPLETED':
      return changedFields.length > 0
        ? `Completed QR refresh after updates to ${changedFields.map(formatFieldLabel).join(', ')}.`
        : 'Completed a pending QR refresh by issuing a new active QR token.'
    case 'QR_REFRESH_REQUIRED_CREATED':
      if (changedFields.length > 0 && triggerSource) {
        return `QR refresh required from ${formatEventSourceLabel(triggerSource).toLowerCase()} changes to ${changedFields.map(formatFieldLabel).join(', ')}.`
      }
      return changedFields.length > 0
        ? `QR refresh required after updates to ${changedFields.map(formatFieldLabel).join(', ')}.`
        : 'Created a QR refresh alert.'
    case 'VISIBILITY_UPDATED':
      return fieldKey
        ? `${formatFieldLabel(fieldKey)} visibility set to ${isPublic ? 'public' : 'private'}.`
        : 'Updated public profile visibility.'
    case 'PAYROLL_EXPORT_GENERATED': {
      const rowCount = readText(detailsJson.row_count)
      const departmentName = readText(detailsJson.department_name)
      const status = readText(detailsJson.status)
      const typeContrat = readText(detailsJson.type_contrat)
      const scopeParts = [
        departmentName,
        status && status !== 'ALL' ? status : null,
        typeContrat ? `Contract ${typeContrat}` : null,
      ].filter((value): value is string => Boolean(value))

      if (rowCount && scopeParts.length > 0) {
        return `Generated payroll CSV export (${rowCount} rows) for ${scopeParts.join(', ')}.`
      }

      if (rowCount) {
        return `Generated payroll CSV export (${rowCount} rows).`
      }

      return 'Generated a payroll CSV export.'
    }
    case 'PAYROLL_EXPORT_PRINT_INITIATED':
      return matricule
        ? `Started payroll information sheet print or PDF export for ${matricule}.`
        : 'Started a payroll information sheet print or PDF export.'
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
      const failureReason = readText(detailsJson.failure_reason)

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
      const publicFields = readStringArray(detailsJson.public_fields)
      if (matricule && publicFields.length > 0) {
        return `Public QR profile viewed for ${matricule} with fields: ${publicFields.map(formatFieldLabel).join(', ')}.`
      }
      if (matricule) {
        return `Public QR profile viewed for ${matricule}.`
      }
      return 'A public QR profile was viewed.'
    }
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
  row: AuditLogRow,
  detailsJson: Record<string, unknown>,
  employeeById: Map<string, EmployeeLookupRow>,
): string {
  if (!row.target_id) {
    return row.target_type
  }

  if (row.target_type === 'Employe') {
    return formatEmployeeLabel(employeeById.get(row.target_id))
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

  if (row.target_type === 'payroll_export') {
    return 'Payroll export activity'
  }

  if (row.target_type === 'PayrollPeriod') {
    return readText(detailsJson.period_label) ?? readText(detailsJson.period_code) ?? 'Payroll period'
  }

  if (row.target_type === 'PayrollRun') {
    return readText(detailsJson.payroll_run_code) ?? 'Payroll run'
  }

  if (row.target_type === 'Payslip') {
    const employeeName = readText(detailsJson.employee_name)
    const matricule = readText(detailsJson.matricule)

    if (employeeName && matricule) {
      return `Payslip | ${employeeName} (${matricule})`
    }

    return employeeName ? `Payslip | ${employeeName}` : 'Payslip'
  }

  if (row.target_type === 'PayslipRequest') {
    return readText(detailsJson.payroll_period_label) ??
      readText(detailsJson.payroll_period_code) ??
      'Payslip request'
  }

  if (row.target_type === 'PayslipDelivery') {
    const fileName = readText(detailsJson.file_name)
    const periodLabel = readText(detailsJson.payroll_period_label)

    if (fileName && periodLabel) {
      return `Payslip delivery | ${periodLabel} | ${fileName}`
    }

    return fileName ? `Payslip delivery | ${fileName}` : 'Payslip delivery'
  }

  return `${row.target_type} (${row.target_id.slice(0, 8)})`
}

export async function listLogs(
  params: ListAuditLogsParams = {},
): Promise<AuditLogListResponse> {
  const { page, pageSize, from, to } = paginate(params.page, params.pageSize)

  const targetEmployeeSearch = params.targetEmployeeSearch?.trim()
  let scopedTargetIds: string[] | null = null

  if (targetEmployeeSearch) {
    const ilikeValue = `%${targetEmployeeSearch}%`
    const { data: employeeScopeRows, error: employeeScopeError } = await supabase
      .from('Employe')
      .select('id')
      .or(`matricule.ilike.${ilikeValue},nom.ilike.${ilikeValue},prenom.ilike.${ilikeValue}`)
      .returns<Array<{ id: string }>>()

    if (employeeScopeError) {
      throw new Error(employeeScopeError.message)
    }

    const scopedEmployeeIds = (employeeScopeRows ?? []).map((employee) => employee.id)

    if (scopedEmployeeIds.length === 0) {
      return { items: [], total: 0, page, pageSize }
    }

    const { data: requestRows, error: requestRowsError } = await supabase
      .from('DemandeModification')
      .select('id')
      .in('employe_id', scopedEmployeeIds)
      .returns<ModificationRequestLookupRow[]>()

    if (requestRowsError) {
      throw new Error(requestRowsError.message)
    }

    scopedTargetIds = [
      ...new Set([
        ...scopedEmployeeIds,
        ...(requestRows ?? []).map((request) => request.id),
      ]),
    ]
  }

  let query = supabase
    .from('audit_log')
    .select('id, actor_user_id, action, target_type, target_id, details_json, created_at', {
      count: 'exact',
    })
    .not('action', 'in', EXCLUDED_AUDIT_ACTIONS_FILTER)
    .order('created_at', { ascending: false })

  if (params.action && params.action !== 'ALL') {
    query = query.eq('action', params.action)
  }

  if (params.dateFrom) {
    query = query.gte('created_at', toStartOfDay(params.dateFrom))
  }

  if (params.dateTo) {
    query = query.lte('created_at', toEndOfDay(params.dateTo))
  }

  if (scopedTargetIds) {
    query = query.in('target_id', scopedTargetIds)
  }

  const { data, count, error } = await query.range(from, to).returns<AuditLogRow[]>()

  if (error) {
    throw new Error(error.message)
  }

  const rows = data ?? []

  const actorUserIds = [...new Set(rows.map((row) => row.actor_user_id).filter(Boolean))] as string[]
  const { data: actorProfiles, error: actorProfilesError } = actorUserIds.length
    ? await supabase
        .from('ProfilUtilisateur')
        .select('user_id, role, employe_id')
        .in('user_id', actorUserIds)
        .returns<ProfilLookupRow[]>()
    : { data: [], error: null as Error | null }

  if (actorProfilesError) {
    throw new Error(actorProfilesError.message)
  }

  const profileByUserId = new Map(
    (actorProfiles ?? [])
      .filter((profile) => profile.user_id)
      .map((profile) => [profile.user_id as string, profile]),
  )

  const employeeLookupIds = new Set<string>()
  for (const profile of actorProfiles ?? []) {
    if (profile.employe_id) {
      employeeLookupIds.add(profile.employe_id)
    }
  }
  for (const row of rows) {
    if (row.target_type === 'Employe' && row.target_id) {
      employeeLookupIds.add(row.target_id)
    }
  }

  const lookupEmployeeIds = [...employeeLookupIds]
  const { data: employeeLookupRows, error: employeeLookupError } = lookupEmployeeIds.length
    ? await supabase
        .from('Employe')
        .select('id, matricule, nom, prenom')
        .in('id', lookupEmployeeIds)
        .returns<EmployeeLookupRow[]>()
    : { data: [], error: null as Error | null }

  if (employeeLookupError) {
    throw new Error(employeeLookupError.message)
  }

  const employeeById = new Map((employeeLookupRows ?? []).map((employee) => [employee.id, employee]))

  const items: AuditLogItem[] = rows.map((row) => {
    const detailsJson = normalizeDetailsJson(row.details_json)

    let actorLabel = row.actor_user_id ?? 'System'
    if (row.actor_user_id) {
      const profile = profileByUserId.get(row.actor_user_id)
      if (profile?.employe_id) {
        const actorEmployee = employeeById.get(profile.employe_id)
        if (actorEmployee) {
          actorLabel = `${actorEmployee.prenom} ${actorEmployee.nom}${profile.role ? ` (${profile.role})` : ''}`
        } else if (profile.role) {
          actorLabel = `${profile.role} (${row.actor_user_id.slice(0, 8)})`
        }
      } else if (profile?.role) {
        actorLabel = `${profile.role} (${row.actor_user_id.slice(0, 8)})`
      } else {
        actorLabel = `User (${row.actor_user_id.slice(0, 8)})`
      }
    }

    return {
      id: row.id,
      actorUserId: row.actor_user_id,
      actorLabel,
      action: row.action,
      targetType: row.target_type,
      targetId: row.target_id,
      targetLabel: formatTargetLabel(row, detailsJson, employeeById),
      detailsJson,
      detailsPreview: toDetailsPreview(row.action, detailsJson),
      createdAt: row.created_at,
    }
  })

  return {
    items,
    total: count ?? 0,
    page,
    pageSize,
  }
}

export function useAuditLogQuery(filters: ListAuditLogsParams = {}) {
  return useQuery({
    queryKey: ['auditLog', filters, filters.page ?? 1],
    queryFn: () => listLogs(filters),
    placeholderData: keepPreviousData,
  })
}

export const auditLogService = {
  listLogs,
}
