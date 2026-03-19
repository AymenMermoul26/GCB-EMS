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
