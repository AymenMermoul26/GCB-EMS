import { createClient } from 'npm:@supabase/supabase-js@2'

interface InviteEmployeePayload {
  employe_id?: string
  email?: string
}

interface ProfilUtilisateurRow {
  id: string
  employe_id: string
  user_id: string | null
  role: string
}

interface EmployeRow {
  id: string
}

interface UserLookupRow {
  employe_id: string
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders,
  })
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function isAlreadyRegisteredError(message: string): boolean {
  const normalized = message.toLowerCase()
  return (
    normalized.includes('already registered') ||
    normalized.includes('already been registered') ||
    normalized.includes('user already exists') ||
    normalized.includes('already exists')
  )
}

async function findAuthUserIdByEmail(
  adminClient: ReturnType<typeof createClient>,
  email: string,
): Promise<string | null> {
  let page = 1
  const perPage = 200
  const maxPages = 25

  while (page <= maxPages) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage })
    if (error) {
      throw new Error(error.message)
    }

    const users = data?.users ?? []
    const matchedUser = users.find(
      (user) => (user.email ?? '').toLowerCase() === email.toLowerCase(),
    )

    if (matchedUser?.id) {
      return matchedUser.id
    }

    const lastPage = data?.lastPage ?? page
    if (page >= lastPage) {
      break
    }

    page += 1
  }

  return null
}

async function inviteOrResolveAuthUser(
  adminClient: ReturnType<typeof createClient>,
  normalizedEmail: string,
): Promise<string> {
  const inviteResult = await adminClient.auth.admin.inviteUserByEmail(normalizedEmail)

  if (!inviteResult.error && inviteResult.data.user?.id) {
    return inviteResult.data.user.id
  }

  if (inviteResult.error && !isAlreadyRegisteredError(inviteResult.error.message)) {
    throw new Error(inviteResult.error.message)
  }

  const existingUserId = await findAuthUserIdByEmail(adminClient, normalizedEmail)
  if (existingUserId) {
    return existingUserId
  }

  const createResult = await adminClient.auth.admin.createUser({
    email: normalizedEmail,
    email_confirm: false,
  })

  if (createResult.error) {
    if (!isAlreadyRegisteredError(createResult.error.message)) {
      throw new Error(createResult.error.message)
    }

    const fallbackUserId = await findAuthUserIdByEmail(adminClient, normalizedEmail)
    if (fallbackUserId) {
      return fallbackUserId
    }

    throw new Error('Unable to resolve auth user by email.')
  }

  if (!createResult.data.user?.id) {
    throw new Error('Auth user creation returned an empty user id.')
  }

  return createResult.data.user.id
}

function normalizePayload(rawBody: unknown): InviteEmployeePayload {
  if (!rawBody || typeof rawBody !== 'object') {
    return {}
  }

  return rawBody as InviteEmployeePayload
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return jsonResponse(500, { error: 'Server configuration error.' })
  }

  const authorization = request.headers.get('Authorization')
  if (!authorization) {
    return jsonResponse(401, { error: 'Missing Authorization header.' })
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authorization,
      },
    },
  })

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey)

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser()

  if (userError || !user) {
    return jsonResponse(401, { error: 'Unauthorized.' })
  }

  const { data: callerProfiles, error: callerProfileError } = await adminClient
    .from('ProfilUtilisateur')
    .select('role')
    .eq('user_id', user.id)
    .limit(1)
    .returns<Array<{ role: string }>>()

  if (callerProfileError) {
    return jsonResponse(500, { error: callerProfileError.message })
  }

  const callerRole = callerProfiles?.[0]?.role
  if (callerRole !== 'ADMIN_RH') {
    return jsonResponse(403, { error: 'Forbidden. Admin RH role required.' })
  }

  let payload: InviteEmployeePayload
  try {
    payload = normalizePayload(await request.json())
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON payload.' })
  }

  const employeId = payload.employe_id?.trim()
  const normalizedEmail = payload.email?.trim().toLowerCase()

  if (!employeId) {
    return jsonResponse(400, { error: 'employe_id is required.' })
  }

  if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
    return jsonResponse(400, { error: 'Invalid email format.' })
  }

  const { data: employeeRows, error: employeeError } = await adminClient
    .from('Employe')
    .select('id')
    .eq('id', employeId)
    .limit(1)
    .returns<EmployeRow[]>()

  if (employeeError) {
    return jsonResponse(500, { error: employeeError.message })
  }

  if (!employeeRows || employeeRows.length === 0) {
    return jsonResponse(404, { error: 'Employee not found.' })
  }

  const { data: existingProfiles, error: existingProfileError } = await adminClient
    .from('ProfilUtilisateur')
    .select('id, employe_id, user_id, role')
    .eq('employe_id', employeId)
    .limit(2)
    .returns<ProfilUtilisateurRow[]>()

  if (existingProfileError) {
    return jsonResponse(500, { error: existingProfileError.message })
  }

  if (existingProfiles && existingProfiles.length > 1) {
    return jsonResponse(500, { error: 'Data integrity issue: duplicate employee profile rows.' })
  }

  let profile = existingProfiles?.[0] ?? null

  if (!profile) {
    const { data: createdProfile, error: createProfileError } = await adminClient
      .from('ProfilUtilisateur')
      .insert({
        employe_id: employeId,
        role: 'EMPLOYE',
        user_id: null,
      })
      .select('id, employe_id, user_id, role')
      .single<ProfilUtilisateurRow>()

    if (createProfileError) {
      return jsonResponse(500, { error: createProfileError.message })
    }

    profile = createdProfile
  }

  if (!profile) {
    return jsonResponse(500, { error: 'Unable to initialize employee profile mapping.' })
  }

  if (profile.user_id) {
    const { data: linkedUserResponse, error: linkedUserError } = await adminClient.auth.admin.getUserById(
      profile.user_id,
    )

    if (linkedUserError) {
      return jsonResponse(409, {
        error: 'Account already linked to this employee.',
      })
    }

    const linkedEmail = (linkedUserResponse.user?.email ?? '').toLowerCase()

    if (linkedEmail && linkedEmail !== normalizedEmail) {
      return jsonResponse(409, { error: 'Account already linked to this employee.' })
    }

    const resendResult = await adminClient.auth.admin.inviteUserByEmail(normalizedEmail)
    if (resendResult.error && !isAlreadyRegisteredError(resendResult.error.message)) {
      return jsonResponse(400, { error: resendResult.error.message })
    }

    return jsonResponse(200, {
      employe_id: employeId,
      user_id: profile.user_id,
      email: linkedEmail || normalizedEmail,
      status: 'INVITED',
    })
  }

  let authUserId: string
  try {
    authUserId = await inviteOrResolveAuthUser(adminClient, normalizedEmail)
  } catch (error) {
    return jsonResponse(400, {
      error: error instanceof Error ? error.message : 'Unable to invite auth user.',
    })
  }

  const { data: linkedElsewhereRows, error: linkedElsewhereError } = await adminClient
    .from('ProfilUtilisateur')
    .select('employe_id')
    .eq('user_id', authUserId)
    .neq('employe_id', employeId)
    .limit(1)
    .returns<UserLookupRow[]>()

  if (linkedElsewhereError) {
    return jsonResponse(500, { error: linkedElsewhereError.message })
  }

  if (linkedElsewhereRows && linkedElsewhereRows.length > 0) {
    return jsonResponse(409, { error: 'Email already linked to another employee.' })
  }

  const { error: updateProfileError } = await adminClient
    .from('ProfilUtilisateur')
    .update({
      user_id: authUserId,
      role: 'EMPLOYE',
    })
    .eq('id', profile.id)

  if (updateProfileError) {
    return jsonResponse(500, { error: updateProfileError.message })
  }

  return jsonResponse(200, {
    employe_id: employeId,
    user_id: authUserId,
    email: normalizedEmail,
    status: 'INVITED',
  })
})
