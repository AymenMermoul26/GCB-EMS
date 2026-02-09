import { APP_ROLES, type AppRole } from '@/constants/roles'
import { supabase } from '@/lib/supabaseClient'
import type { RoleInfo } from '@/types/auth'

interface ProfilUtilisateurRoleRow {
  role: string | null
  employe_id: string | null
}

function normalizeRole(value: string | null): AppRole | null {
  if (value === APP_ROLES.ADMIN_RH) {
    return APP_ROLES.ADMIN_RH
  }

  if (value === APP_ROLES.EMPLOYE) {
    return APP_ROLES.EMPLOYE
  }

  return null
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

  if (!data?.employe_id) {
    return null
  }

  const role = normalizeRole(data.role)

  if (!role) {
    return null
  }

  return {
    role,
    employeId: data.employe_id,
  }
}

export async function listAdminUserIds(): Promise<string[]> {
  const { data, error } = await supabase.rpc('get_admin_user_ids')

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as string[]
}

export const roleService = {
  resolveRoleByUserId,
  listAdminUserIds,
}
