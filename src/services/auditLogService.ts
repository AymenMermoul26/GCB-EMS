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

function toDetailsPreview(detailsJson: Record<string, unknown>): string {
  const serialized = JSON.stringify(detailsJson)
  if (serialized.length <= 100) {
    return serialized
  }

  return `${serialized.slice(0, 100)}...`
}

function formatEmployeeLabel(employee?: EmployeeLookupRow | null): string {
  if (!employee) {
    return 'Unknown employee'
  }

  return `${employee.prenom} ${employee.nom} (${employee.matricule})`
}

export async function listLogs(
  params: ListAuditLogsParams = {},
): Promise<AuditLogListResponse> {
  const { page, pageSize, from, to } = paginate(params.page, params.pageSize)

  let scopedEmployeeIds: string[] | null = null
  const targetEmployeeSearch = params.targetEmployeeSearch?.trim()
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

    scopedEmployeeIds = (employeeScopeRows ?? []).map((employee) => employee.id)
    if (scopedEmployeeIds.length === 0) {
      return { items: [], total: 0, page, pageSize }
    }
  }

  let query = supabase
    .from('audit_log')
    .select('id, actor_user_id, action, target_type, target_id, details_json, created_at', {
      count: 'exact',
    })
    .order('created_at', { ascending: false })

  if (params.actionFilter && params.actionFilter !== 'ALL') {
    query = query.eq('action', params.actionFilter)
  }

  if (scopedEmployeeIds) {
    query = query.in('target_id', scopedEmployeeIds)
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
      }
    }

    let targetLabel = row.target_type
    if (row.target_id) {
      if (row.target_type === 'Employe') {
        targetLabel = formatEmployeeLabel(employeeById.get(row.target_id))
      } else {
        targetLabel = `${row.target_type} (${row.target_id.slice(0, 8)})`
      }
    }

    return {
      id: row.id,
      actorUserId: row.actor_user_id,
      actorLabel,
      action: row.action,
      targetType: row.target_type,
      targetId: row.target_id,
      targetLabel,
      detailsJson,
      detailsPreview: toDetailsPreview(detailsJson),
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
    queryKey: ['auditLog', filters],
    queryFn: () => listLogs(filters),
    placeholderData: keepPreviousData,
  })
}

export const auditLogService = {
  listLogs,
}
