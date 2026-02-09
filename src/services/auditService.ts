import { supabase } from '@/lib/supabaseClient'

export interface AuditLogPayload {
  action: string
  targetType: string
  targetId?: string | null
  detailsJson?: Record<string, unknown>
}

async function currentUserId() {
  const { data, error } = await supabase.auth.getUser()
  if (error) {
    throw new Error(error.message)
  }

  return data.user?.id ?? null
}

export async function insertAuditLog(payload: AuditLogPayload): Promise<void> {
  const userId = await currentUserId()

  const { error } = await supabase.from('audit_log').insert({
    actor_user_id: userId,
    action: payload.action,
    target_type: payload.targetType,
    target_id: payload.targetId ?? null,
    details_json: payload.detailsJson ?? {},
  })

  if (error) {
    throw new Error(error.message)
  }
}

export const auditService = {
  insertAuditLog,
}
