import { APP_ROLES, type AppRole } from '@/constants/roles'
import { supabase } from '@/lib/supabaseClient'
import type { RoleInfo } from '@/types/auth'

interface ProfilUtilisateurRoleRow {
  role: string | null
  employe_id: string | null
}

interface ProfilUtilisateurUserRow {
  user_id: string | null
}

interface RoleMetadataRecord {
  role?: unknown
  employe_id?: unknown
  employee_id?: unknown
}

function normalizeRole(value: string | null): AppRole | null {
  if (value === APP_ROLES.ADMIN_RH) {
    return APP_ROLES.ADMIN_RH
  }

  if (value === APP_ROLES.EMPLOYE) {
    return APP_ROLES.EMPLOYE
  }

  if (value === APP_ROLES.PAYROLL_AGENT) {
    return APP_ROLES.PAYROLL_AGENT
  }

  return null
}

function readString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

function asRoleMetadataRecord(value: unknown): RoleMetadataRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  return value as RoleMetadataRecord
}

async function resolveRoleFromAuthMetadata(): Promise<RoleInfo | null> {
  const { data, error } = await supabase.auth.getUser()

  if (error) {
    throw new Error(error.message)
  }

  const appMetadata = asRoleMetadataRecord(data.user?.app_metadata)
  const role = normalizeRole(readString(appMetadata.role))

  if (role !== APP_ROLES.PAYROLL_AGENT) {
    return null
  }

  return {
    role,
    employeId: readString(appMetadata.employe_id) ?? readString(appMetadata.employee_id),
  }
}

export async function resolveRoleByUserId(
  userId: string,
): Promise<RoleInfo | null> {
  const { data, error } = await supabase
    .from('ProfilUtilisateur')
    .select('role, employe_id')
    .eq('user_id', userId)
    .maybeSingle<ProfilUtilisateurRoleRow>()

  if (error) {
    throw new Error(error.message)
  }

  if (!data) {
    return resolveRoleFromAuthMetadata()
  }

  const role = normalizeRole(data.role)

  if (!role) {
    return null
  }

  if (role !== APP_ROLES.PAYROLL_AGENT && !data?.employe_id) {
    return null
  }

  return {
    role,
    employeId: data?.employe_id ?? null,
  }
}

export async function listAdminUserIds(): Promise<string[]> {
  const { data, error } = await supabase.rpc('get_admin_user_ids')

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as string[]
}

export async function getUserIdByEmployeId(employeId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('ProfilUtilisateur')
    .select('user_id')
    .eq('employe_id', employeId)
    .limit(2)
    .returns<ProfilUtilisateurUserRow[]>()

  if (error) {
    throw new Error(error.message)
  }

  if (!data || data.length === 0) {
    return null
  }

  if (data.length > 1) {
    console.error('Multiple ProfilUtilisateur rows found for employe_id', employeId)
    throw new Error('Data integrity issue: duplicate ProfilUtilisateur mapping for employee.')
  }

  return data[0].user_id
}

export const roleService = {
  resolveRoleByUserId,
  listAdminUserIds,
  getUserIdByEmployeId,
}
