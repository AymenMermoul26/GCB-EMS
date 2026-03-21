import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}

const SECURITY_NOTIFICATION_TITLE = 'Security'
const SECURITY_NOTIFICATION_BODY = 'Welcome! Please change your password to a strong one.'
const SECURITY_NOTIFICATION_LINK = '/employee/security'

interface ProfileLookupRow {
  employe_id: string | null
  role: string | null
}

interface EmployeeLookupRow {
  id: string
  matricule: string
  nom: string
  prenom: string
  email: string | null
}

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
  if (trimmed.toLowerCase().startsWith(prefix)) {
    const token = trimmed.slice(prefix.length).trim()
    return token.length > 0 ? token : null
  }

  return null
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  return value as Record<string, unknown>
}

function readBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    return normalized === 'true' || normalized === '1'
  }

  if (typeof value === 'number') {
    return value === 1
  }

  return false
}

function buildEmployeeName(employee: EmployeeLookupRow): string {
  return `${employee.prenom} ${employee.nom}`.replace(/\s+/g, ' ').trim()
}

async function logInviteAcceptedIfEligible(
  adminClient: SupabaseClient,
  params: {
    userId: string
    recipientEmail: string | null
  },
): Promise<boolean> {
  const { data: profileRows, error: profileError } = await adminClient
    .from('ProfilUtilisateur')
    .select('employe_id, role')
    .eq('user_id', params.userId)
    .limit(1)
    .returns<ProfileLookupRow[]>()

  if (profileError) {
    throw new Error(profileError.message)
  }

  const profile = profileRows?.[0] ?? null
  if (!profile?.employe_id || profile.role !== 'EMPLOYE') {
    return false
  }

  const { data: employeeRows, error: employeeError } = await adminClient
    .from('Employe')
    .select('id, matricule, nom, prenom, email')
    .eq('id', profile.employe_id)
    .limit(1)
    .returns<EmployeeLookupRow[]>()

  if (employeeError) {
    throw new Error(employeeError.message)
  }

  const employee = employeeRows?.[0] ?? null
  if (!employee) {
    return false
  }

  const { error: auditError } = await adminClient.from('audit_log').insert({
    actor_user_id: params.userId,
    action: 'EMPLOYEE_INVITE_ACCEPTED',
    target_type: 'Employe',
    target_id: employee.id,
    details_json: {
      employee_id: employee.id,
      employee_name: buildEmployeeName(employee),
      matricule: employee.matricule,
      recipient_email: employee.email ?? params.recipientEmail,
      trigger_source: 'invite',
      completion_source: 'first_login_password_change',
    },
  })

  if (auditError) {
    throw new Error(auditError.message)
  }

  return true
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed.' })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return jsonResponse(500, { error: 'Server configuration error.' })
  }

  const accessToken = extractBearerToken(request.headers.get('Authorization'))
  if (!accessToken) {
    return jsonResponse(401, { error: 'Missing Authorization header.' })
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey)

  const { data: userData, error: userError } = await adminClient.auth.getUser(accessToken)
  const user = userData.user

  if (userError || !user) {
    return jsonResponse(401, { error: 'Unauthorized.' })
  }

  const appMetadata = asRecord(user.app_metadata)
  const mustChangePasswordBefore = readBoolean(appMetadata.must_change_password)
  const { error: updateError } = await adminClient.auth.admin.updateUserById(user.id, {
    app_metadata: {
      ...appMetadata,
      must_change_password: false,
    },
  })

  if (updateError) {
    return jsonResponse(500, { error: updateError.message })
  }

  const { error: notificationError } = await adminClient
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', user.id)
    .eq('title', SECURITY_NOTIFICATION_TITLE)
    .eq('body', SECURITY_NOTIFICATION_BODY)
    .eq('link', SECURITY_NOTIFICATION_LINK)
    .eq('is_read', false)

  if (notificationError) {
    return jsonResponse(500, { error: notificationError.message })
  }

  let auditLogged = false
  let warning: string | undefined

  if (mustChangePasswordBefore) {
    try {
      auditLogged = await logInviteAcceptedIfEligible(adminClient, {
        userId: user.id,
        recipientEmail: user.email ?? null,
      })
    } catch (error) {
      console.error('Failed to log invite acceptance', error)
      warning = 'Password was updated, but invite acceptance audit logging failed.'
    }
  }

  return jsonResponse(200, {
    ok: true,
    user_id: user.id,
    must_change_password: false,
    audit_logged: auditLogged,
    warning,
  })
})
