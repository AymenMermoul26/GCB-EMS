import { supabase } from '@/lib/supabaseClient'
import { auditService } from '@/services/auditService'

type TokenStatus = 'ACTIF' | 'REVOQUE'

interface EmployeeAuditRow {
  id: string
  matricule: string
  nom: string
  prenom: string
}

interface TokenAuditRow {
  id: string
  employe_id: string
  statut_token: TokenStatus
  created_at: string
  updated_at: string
}

interface AuditLookupRow {
  id: string
  created_at: string
  details_json: unknown
}

interface PendingQrRefreshRequirement {
  id: string
  createdAt: string
  changedFields: string[]
  triggerSource: string | null
}

export interface QrLifecycleContext {
  employee: EmployeeAuditRow | null
  activeToken: TokenAuditRow | null
  latestToken: TokenAuditRow | null
  pendingRefreshRequirement: PendingQrRefreshRequirement | null
}

interface LogQrRevokedParams {
  employeId: string
  employee: EmployeeAuditRow | null
  tokenId: string
  previousTokenStatus?: TokenStatus | null
  triggerSource: string
  reason: string
  replacedByTokenId?: string | null
}

interface LogQrIssuedParams {
  employeId: string
  employee: EmployeeAuditRow | null
  previousToken: TokenAuditRow | null
  latestTokenBeforeChange: TokenAuditRow | null
  pendingRefreshRequirement: PendingQrRefreshRequirement | null
  nextToken: TokenAuditRow
  triggerSource: string
}

function normalizeDetailsJson(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
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

function buildEmployeeName(employee: EmployeeAuditRow | null): string | null {
  if (!employee) {
    return null
  }

  const fullName = `${employee.prenom} ${employee.nom}`.replace(/\s+/g, ' ').trim()
  return fullName.length > 0 ? fullName : null
}

async function getEmployeeAuditRow(employeId: string): Promise<EmployeeAuditRow | null> {
  const { data, error } = await supabase
    .from('Employe')
    .select('id, matricule, nom, prenom')
    .eq('id', employeId)
    .limit(1)
    .returns<EmployeeAuditRow[]>()

  if (error) {
    throw new Error(error.message)
  }

  return data?.[0] ?? null
}

async function getActiveTokenAuditRow(employeId: string): Promise<TokenAuditRow | null> {
  const { data, error } = await supabase
    .from('TokenQR')
    .select('id, employe_id, statut_token, created_at, updated_at')
    .eq('employe_id', employeId)
    .eq('statut_token', 'ACTIF')
    .order('created_at', { ascending: false })
    .limit(1)
    .returns<TokenAuditRow[]>()

  if (error) {
    throw new Error(error.message)
  }

  return data?.[0] ?? null
}

async function getLatestTokenAuditRow(employeId: string): Promise<TokenAuditRow | null> {
  const { data, error } = await supabase
    .from('TokenQR')
    .select('id, employe_id, statut_token, created_at, updated_at')
    .eq('employe_id', employeId)
    .order('created_at', { ascending: false })
    .limit(1)
    .returns<TokenAuditRow[]>()

  if (error) {
    throw new Error(error.message)
  }

  return data?.[0] ?? null
}

async function getLatestQrRefreshRequirementRow(
  employeId: string,
): Promise<AuditLookupRow | null> {
  const { data, error } = await supabase
    .from('audit_log')
    .select('id, created_at, details_json')
    .eq('action', 'QR_REFRESH_REQUIRED_CREATED')
    .eq('target_type', 'Employe')
    .eq('target_id', employeId)
    .order('created_at', { ascending: false })
    .limit(1)
    .returns<AuditLookupRow[]>()

  if (error) {
    throw new Error(error.message)
  }

  return data?.[0] ?? null
}

async function insertQrAuditSafely(
  action: string,
  targetId: string,
  detailsJson: Record<string, unknown>,
): Promise<void> {
  try {
    await auditService.insertAuditLog({
      action,
      targetType: 'Employe',
      targetId,
      detailsJson,
    })
  } catch (error) {
    console.error(`Failed to write ${action} audit log`, error)
  }
}

export async function getQrLifecycleContext(employeId: string): Promise<QrLifecycleContext> {
  const [employee, activeToken, latestToken, latestRefreshRequirementRow] = await Promise.all([
    getEmployeeAuditRow(employeId),
    getActiveTokenAuditRow(employeId),
    getLatestTokenAuditRow(employeId),
    getLatestQrRefreshRequirementRow(employeId),
  ])

  const latestTokenTimestamp = latestToken?.updated_at ?? latestToken?.created_at ?? null
  const latestRefreshRequirement = latestRefreshRequirementRow
    ? normalizeDetailsJson(latestRefreshRequirementRow.details_json)
    : null

  const pendingRefreshRequirement =
    latestRefreshRequirementRow &&
    (!latestTokenTimestamp || latestRefreshRequirementRow.created_at > latestTokenTimestamp)
      ? {
          id: latestRefreshRequirementRow.id,
          createdAt: latestRefreshRequirementRow.created_at,
          changedFields: readStringArray(latestRefreshRequirement?.changed_fields),
          triggerSource: readText(latestRefreshRequirement?.trigger_source),
        }
      : null

  return {
    employee,
    activeToken,
    latestToken,
    pendingRefreshRequirement,
  }
}

export async function logQrRevoked({
  employeId,
  employee,
  tokenId,
  previousTokenStatus = 'ACTIF',
  triggerSource,
  reason,
  replacedByTokenId,
}: LogQrRevokedParams): Promise<void> {
  await insertQrAuditSafely('QR_REVOKED', employeId, {
    employe_id: employeId,
    employee_name: buildEmployeeName(employee),
    matricule: employee?.matricule ?? null,
    token_id: tokenId,
    previous_token_status: previousTokenStatus,
    resulting_token_status: 'REVOQUE',
    status_transition: `${previousTokenStatus ?? 'UNKNOWN'}->REVOQUE`,
    trigger_source: triggerSource,
    reason,
    replaced_by_token_id: replacedByTokenId ?? null,
  })
}

export async function logQrIssued({
  employeId,
  employee,
  previousToken,
  latestTokenBeforeChange,
  pendingRefreshRequirement,
  nextToken,
  triggerSource,
}: LogQrIssuedParams): Promise<void> {
  const action = previousToken ? 'QR_REGENERATED' : 'QR_GENERATED'
  const reason = previousToken ? 'manual_regeneration' : 'manual_generation'

  await insertQrAuditSafely(action, employeId, {
    employe_id: employeId,
    employee_name: buildEmployeeName(employee),
    matricule: employee?.matricule ?? null,
    previous_token_id: previousToken?.id ?? null,
    previous_token_status: previousToken?.statut_token ?? null,
    latest_known_token_id_before_change: latestTokenBeforeChange?.id ?? null,
    new_token_id: nextToken.id,
    resulting_token_status: nextToken.statut_token,
    status_transition: `${previousToken?.statut_token ?? 'NONE'}->${nextToken.statut_token}`,
    trigger_source: triggerSource,
    reason,
    refresh_required_resolved: Boolean(pendingRefreshRequirement),
    refresh_required_event_id: pendingRefreshRequirement?.id ?? null,
    refresh_required_created_at: pendingRefreshRequirement?.createdAt ?? null,
    refresh_required_trigger_source: pendingRefreshRequirement?.triggerSource ?? null,
    changed_fields: pendingRefreshRequirement?.changedFields ?? [],
  })

  if (!pendingRefreshRequirement) {
    return
  }

  await insertQrAuditSafely('QR_REFRESH_COMPLETED', employeId, {
    employe_id: employeId,
    employee_name: buildEmployeeName(employee),
    matricule: employee?.matricule ?? null,
    previous_token_id: previousToken?.id ?? latestTokenBeforeChange?.id ?? null,
    new_token_id: nextToken.id,
    resulting_token_status: nextToken.statut_token,
    status_transition: 'REFRESH_REQUIRED->ACTIF',
    trigger_source: triggerSource,
    reason: 'admin_issued_new_qr_after_refresh_required',
    resolved_refresh_event_id: pendingRefreshRequirement.id,
    refresh_required_created_at: pendingRefreshRequirement.createdAt,
    refresh_required_trigger_source: pendingRefreshRequirement.triggerSource,
    changed_fields: pendingRefreshRequirement.changedFields,
    resulting_state: 'active_qr_issued',
  })
}
