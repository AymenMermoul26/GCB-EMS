import { createClient } from 'npm:@supabase/supabase-js@2'

interface NotifyPayload {
  employe_id?: string
  changed_fields?: unknown
}

interface ProfilUtilisateurRow {
  employe_id: string
  role: string
  user_id: string | null
}

interface EmployeIdentityRow {
  id: string
  nom: string
  prenom: string
  matricule: string
}

interface NotificationLookupRow {
  user_id: string
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}

const QR_REFRESH_NOTIFICATION_TITLE = 'QR refresh required'
const DEDUPE_WINDOW_MINUTES = 30
const ALLOWED_CHANGED_FIELDS = new Set(['poste', 'email', 'telephone', 'photo_url'])

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders,
  })
}

function extractBearerToken(value: string | null): string | null {
  if (!value) {
    return null
  }

  const trimmed = value.trim()
  if (trimmed.length === 0) {
    return null
  }

  const prefix = 'bearer '
  if (!trimmed.toLowerCase().startsWith(prefix)) {
    return null
  }

  const token = trimmed.slice(prefix.length).trim()
  return token.length > 0 ? token : null
}

function normalizePayload(rawBody: unknown): NotifyPayload {
  if (!rawBody || typeof rawBody !== 'object') {
    return {}
  }

  return rawBody as NotifyPayload
}

function sanitizeChangedFields(rawValue: unknown): Array<'poste' | 'email' | 'telephone' | 'photo_url'> {
  if (!Array.isArray(rawValue)) {
    return []
  }

  const unique = new Set<'poste' | 'email' | 'telephone' | 'photo_url'>()
  for (const item of rawValue) {
    if (typeof item !== 'string') {
      continue
    }

    const normalized = item.trim()
    if (ALLOWED_CHANGED_FIELDS.has(normalized)) {
      unique.add(normalized as 'poste' | 'email' | 'telephone' | 'photo_url')
    }
  }

  return [...unique]
}

function getQrRefreshLink(employeId: string) {
  return `/admin/employees/${employeId}#qr`
}

function buildNotificationBody(
  employee: EmployeIdentityRow,
  changedFields: string[],
) {
  const fullName = `${employee.nom} ${employee.prenom}`.trim()
  const changedFieldsLabel = changedFields.join(', ')
  return `${fullName} (${employee.matricule}) updated: ${changedFieldsLabel}. Please regenerate the QR code.`
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed.' })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(500, { error: 'Server configuration error.' })
  }

  const accessToken = extractBearerToken(request.headers.get('Authorization'))
  if (!accessToken) {
    return jsonResponse(401, { error: 'Missing Authorization header.' })
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey)

  const {
    data: userData,
    error: userError,
  } = await adminClient.auth.getUser(accessToken)

  const caller = userData.user
  if (userError || !caller) {
    return jsonResponse(401, { error: 'Unauthorized.' })
  }

  let payload: NotifyPayload
  try {
    payload = normalizePayload(await request.json())
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON payload.' })
  }

  const employeId = payload.employe_id?.trim()
  const changedFields = sanitizeChangedFields(payload.changed_fields)

  if (!employeId) {
    return jsonResponse(400, { error: 'employe_id is required.' })
  }

  if (changedFields.length === 0) {
    return jsonResponse(400, { error: 'changed_fields must include at least one allowed field.' })
  }

  const { data: ownerProfiles, error: ownerProfileError } = await adminClient
    .from('ProfilUtilisateur')
    .select('employe_id, role, user_id')
    .eq('user_id', caller.id)
    .limit(2)
    .returns<ProfilUtilisateurRow[]>()

  if (ownerProfileError) {
    return jsonResponse(500, { error: ownerProfileError.message })
  }

  if (!ownerProfiles || ownerProfiles.length === 0) {
    return jsonResponse(403, { error: 'Forbidden.' })
  }

  if (ownerProfiles.length > 1) {
    return jsonResponse(500, { error: 'Data integrity issue: duplicate caller profile mappings.' })
  }

  const callerProfile = ownerProfiles[0]
  if (callerProfile.employe_id !== employeId) {
    return jsonResponse(403, { error: 'Forbidden. You can only trigger notifications for your own employee profile.' })
  }

  const { data: employeeRows, error: employeeError } = await adminClient
    .from('Employe')
    .select('id, nom, prenom, matricule')
    .eq('id', employeId)
    .limit(1)
    .returns<EmployeIdentityRow[]>()

  if (employeeError) {
    return jsonResponse(500, { error: employeeError.message })
  }

  const employee = employeeRows?.[0]
  if (!employee) {
    return jsonResponse(404, { error: 'Employee not found.' })
  }

  const { data: adminRows, error: adminRowsError } = await adminClient
    .from('ProfilUtilisateur')
    .select('user_id')
    .eq('role', 'ADMIN_RH')
    .not('user_id', 'is', null)
    .returns<Array<{ user_id: string | null }>>()

  if (adminRowsError) {
    return jsonResponse(500, { error: adminRowsError.message })
  }

  const adminUserIds = [...new Set((adminRows ?? []).map((row) => row.user_id).filter((id): id is string => Boolean(id)))]

  const link = getQrRefreshLink(employeId)
  const notificationBody = buildNotificationBody(employee, changedFields)
  const dedupeSinceIso = new Date(Date.now() - DEDUPE_WINDOW_MINUTES * 60 * 1000).toISOString()

  let deduped = 0
  let adminsNotified = 0

  if (adminUserIds.length > 0) {
    const { data: existingRows, error: existingRowsError } = await adminClient
      .from('notifications')
      .select('user_id')
      .in('user_id', adminUserIds)
      .eq('title', QR_REFRESH_NOTIFICATION_TITLE)
      .eq('link', link)
      .eq('is_read', false)
      .gte('created_at', dedupeSinceIso)
      .returns<NotificationLookupRow[]>()

    if (existingRowsError) {
      return jsonResponse(500, { error: existingRowsError.message })
    }

    const existingUserIds = new Set((existingRows ?? []).map((row) => row.user_id))

    const rowsToInsert = adminUserIds
      .filter((adminUserId) => !existingUserIds.has(adminUserId))
      .map((adminUserId) => ({
        user_id: adminUserId,
        title: QR_REFRESH_NOTIFICATION_TITLE,
        body: notificationBody,
        link,
        is_read: false,
      }))

    deduped = adminUserIds.length - rowsToInsert.length
    adminsNotified = rowsToInsert.length

    if (rowsToInsert.length > 0) {
      const { error: insertError } = await adminClient
        .from('notifications')
        .insert(rowsToInsert)

      if (insertError) {
        return jsonResponse(500, { error: insertError.message })
      }
    }
  }

  const { error: auditInsertError } = await adminClient
    .from('audit_log')
    .insert({
      actor_user_id: caller.id,
      action: 'QR_REFRESH_REQUIRED_CREATED',
      target_type: 'Employe',
      target_id: employeId,
      details_json: {
        changed_fields: changedFields,
        actor_user_id: caller.id,
        admins_notified: adminsNotified,
        deduped,
      },
    })

  if (auditInsertError) {
    return jsonResponse(500, { error: auditInsertError.message })
  }

  return jsonResponse(200, {
    ok: true,
    admins_notified: adminsNotified,
    deduped,
  })
})
