import { createClient } from 'npm:@supabase/supabase-js@2'

interface InviteEmployeePayload {
  employe_id?: string
  email?: string
  trigger_source?: string
}

interface ProfilUtilisateurRow {
  id: string
  employe_id: string
  user_id: string | null
  role: string
}

interface EmployeRow {
  id: string
  matricule: string
  nom: string
  prenom: string
}

interface UserLookupRow {
  employe_id: string
}

interface NotificationLookupRow {
  id: string
}

interface InviteResolutionResult {
  userId: string
  emailSent: boolean
  emailDeliveryType?: InviteEmailDeliveryType
  requiresExistingUserAccessEmail?: boolean
}

type InviteTriggerSource = 'invite' | 'resend_invite'
type InviteEmailDeliveryType = 'invite' | 'magiclink'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}

const SECURITY_NOTIFICATION_TITLE = 'Security'
const SECURITY_NOTIFICATION_BODY = 'Welcome! Please change your password to a strong one.'
const SECURITY_NOTIFICATION_LINK = '/employee/security'

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

class InviteFlowError extends Error {
  readonly shouldLogEmailFailure: boolean

  constructor(message: string, shouldLogEmailFailure = false) {
    super(message)
    this.name = 'InviteFlowError'
    this.shouldLogEmailFailure = shouldLogEmailFailure
  }
}

function normalizeTriggerSource(value: string | undefined): InviteTriggerSource {
  const normalized = value?.trim().toLowerCase()
  return normalized === 'resend_invite' ? 'resend_invite' : 'invite'
}

function getEmployeeFullName(employee: EmployeRow): string {
  return `${employee.prenom} ${employee.nom}`.replace(/\s+/g, ' ').trim()
}

async function insertInviteAuditLog(params: {
  adminClient: ReturnType<typeof createClient>
  actorUserId: string
  action: 'EMPLOYEE_INVITE_SENT' | 'EMPLOYEE_INVITE_FAILED'
  employee: EmployeRow
  recipientEmail: string
  triggerSource: InviteTriggerSource
  emailDeliveryType?: InviteEmailDeliveryType
  authUserId?: string | null
  mustChangePassword?: boolean
  failureReason?: string
}): Promise<{ logged: boolean; warning?: string }> {
  const timestamp = new Date().toISOString()
  const detailsJson: Record<string, unknown> = {
    recipient_email: params.recipientEmail,
    employee_id: params.employee.id,
    employee_name: getEmployeeFullName(params.employee),
    matricule: params.employee.matricule,
    email_type: 'employee_invite',
    trigger_source: params.triggerSource,
    provider: 'supabase_auth',
    status: params.action === 'EMPLOYEE_INVITE_SENT' ? 'sent' : 'failed',
  }

  if (params.emailDeliveryType) {
    detailsJson.delivery_type = params.emailDeliveryType
  }

  if (params.authUserId) {
    detailsJson.auth_user_id = params.authUserId
  }

  if (params.mustChangePassword !== undefined) {
    detailsJson.must_change_password = params.mustChangePassword
  }

  if (params.action === 'EMPLOYEE_INVITE_SENT') {
    detailsJson.sent_at = timestamp
  } else {
    detailsJson.failed_at = timestamp
    detailsJson.failure_reason = params.failureReason ?? 'Invite email could not be sent.'
  }

  const { error } = await params.adminClient
    .from('audit_log')
    .insert({
      actor_user_id: params.actorUserId,
      action: params.action,
      target_type: 'Employe',
      target_id: params.employee.id,
      details_json: detailsJson,
    })

  if (error) {
    console.error(`Failed to insert audit_log row for ${params.action}:`, error.message)

    return {
      logged: false,
      warning:
        params.action === 'EMPLOYEE_INVITE_SENT'
          ? 'Invite email sent, but audit logging could not be completed.'
          : 'Invite email failed, and the audit event could not be recorded.',
    }
  }

  return { logged: true }
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
  redirectTo?: string,
): Promise<InviteResolutionResult> {
  const inviteResult = await adminClient.auth.admin.inviteUserByEmail(
    normalizedEmail,
    redirectTo ? { redirectTo } : undefined,
  )

  if (!inviteResult.error && inviteResult.data.user?.id) {
    return {
      userId: inviteResult.data.user.id,
      emailSent: true,
      emailDeliveryType: 'invite',
    }
  }

  if (inviteResult.error && !isAlreadyRegisteredError(inviteResult.error.message)) {
    throw new InviteFlowError(inviteResult.error.message, true)
  }

  const existingUserId = await findAuthUserIdByEmail(adminClient, normalizedEmail)
  if (existingUserId) {
    return {
      userId: existingUserId,
      emailSent: false,
      emailDeliveryType: 'magiclink',
      requiresExistingUserAccessEmail: true,
    }
  }

  const createResult = await adminClient.auth.admin.createUser({
    email: normalizedEmail,
    email_confirm: false,
  })

  if (createResult.error) {
    if (!isAlreadyRegisteredError(createResult.error.message)) {
      throw new InviteFlowError(createResult.error.message)
    }

    const fallbackUserId = await findAuthUserIdByEmail(adminClient, normalizedEmail)
    if (fallbackUserId) {
      return {
        userId: fallbackUserId,
        emailSent: false,
        emailDeliveryType: 'magiclink',
        requiresExistingUserAccessEmail: true,
      }
    }

    throw new InviteFlowError('Unable to resolve auth user by email.')
  }

  if (!createResult.data.user?.id) {
    throw new InviteFlowError('Auth user creation returned an empty user id.')
  }

  return {
    userId: createResult.data.user.id,
    emailSent: false,
    emailDeliveryType: 'magiclink',
    requiresExistingUserAccessEmail: true,
  }
}

async function sendExistingUserAccessEmail(
  adminClient: ReturnType<typeof createClient>,
  normalizedEmail: string,
  redirectTo?: string,
): Promise<void> {
  const { error } = await adminClient.auth.signInWithOtp({
    email: normalizedEmail,
    options: {
      shouldCreateUser: false,
      ...(redirectTo ? { emailRedirectTo: redirectTo } : {}),
    },
  })

  if (error) {
    throw new InviteFlowError(error.message, true)
  }
}

function normalizePayload(rawBody: unknown): InviteEmployeePayload {
  if (!rawBody || typeof rawBody !== 'object') {
    return {}
  }

  return rawBody as InviteEmployeePayload
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  return value as Record<string, unknown>
}

function readMustChangePasswordFlag(value: unknown): boolean {
  return value === true
}

async function ensureMustChangePasswordMetadata(
  adminClient: ReturnType<typeof createClient>,
  userId: string,
): Promise<boolean> {
  const { data, error } = await adminClient.auth.admin.getUserById(userId)
  if (error) {
    throw new Error(error.message)
  }

  const appMetadata = asRecord(data.user?.app_metadata)
  if (readMustChangePasswordFlag(appMetadata.must_change_password)) {
    return true
  }

  const { error: updateError } = await adminClient.auth.admin.updateUserById(userId, {
    app_metadata: {
      ...appMetadata,
      must_change_password: true,
    },
  })

  if (updateError) {
    throw new Error(updateError.message)
  }

  return true
}

async function ensureSecurityNotification(
  adminClient: ReturnType<typeof createClient>,
  userId: string,
): Promise<void> {
  const { data: existingRows, error: lookupError } = await adminClient
    .from('notifications')
    .select('id')
    .eq('user_id', userId)
    .eq('title', SECURITY_NOTIFICATION_TITLE)
    .eq('body', SECURITY_NOTIFICATION_BODY)
    .eq('link', SECURITY_NOTIFICATION_LINK)
    .limit(1)
    .returns<NotificationLookupRow[]>()

  if (lookupError) {
    throw new Error(lookupError.message)
  }

  if (existingRows && existingRows.length > 0) {
    return
  }

  const { error: insertError } = await adminClient.from('notifications').insert({
    user_id: userId,
    title: SECURITY_NOTIFICATION_TITLE,
    body: SECURITY_NOTIFICATION_BODY,
    link: SECURITY_NOTIFICATION_LINK,
    is_read: false,
  })

  if (insertError) {
    throw new Error(insertError.message)
  }
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

function normalizeUrlValue(value: string | null | undefined): string | null {
  const raw = value?.trim()
  if (!raw) {
    return null
  }

  try {
    const parsed = new URL(raw)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null
    }

    return parsed.toString().replace(/\/$/, '')
  } catch {
    return null
  }
}

function buildLoginRedirectUrl(baseUrl: string | null | undefined): string | null {
  const normalizedBase = normalizeUrlValue(baseUrl)
  if (!normalizedBase) {
    return null
  }

  try {
    return new URL('/login', normalizedBase).toString()
  } catch {
    return null
  }
}

function resolveInviteRedirectUrl(request: Request): string | undefined {
  const configuredRedirect =
    normalizeUrlValue(Deno.env.get('INVITE_REDIRECT_URL')) ??
    buildLoginRedirectUrl(Deno.env.get('APP_BASE_URL'))

  if (configuredRedirect) {
    return configuredRedirect
  }

  const originHeader = buildLoginRedirectUrl(request.headers.get('origin'))
  if (originHeader) {
    return originHeader
  }

  const refererHeader = request.headers.get('referer')?.trim()
  if (refererHeader) {
    try {
      const refererOrigin = buildLoginRedirectUrl(new URL(refererHeader).origin)
      if (refererOrigin) {
        return refererOrigin
      }
    } catch {
      // Ignore malformed referer and fall back to Supabase project defaults.
    }
  }

  return undefined
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return jsonResponse(500, { error: 'Server configuration error.' })
  }

  const authorizationHeader = request.headers.get('Authorization')
  const accessToken = extractBearerToken(authorizationHeader)
  if (!accessToken) {
    return jsonResponse(401, { error: 'Missing Authorization header.' })
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey)
  const inviteRedirectTo = resolveInviteRedirectUrl(request)

  const {
    data: userData,
    error: userError,
  } = await adminClient.auth.getUser(accessToken)

  const user = userData.user

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
  const triggerSource = normalizeTriggerSource(payload.trigger_source)

  if (!employeId) {
    return jsonResponse(400, { error: 'employe_id is required.' })
  }

  if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
    return jsonResponse(400, { error: 'Invalid email format.' })
  }

  const { data: employeeRows, error: employeeError } = await adminClient
    .from('Employe')
    .select('id, matricule, nom, prenom')
    .eq('id', employeId)
    .limit(1)
    .returns<EmployeRow[]>()

  if (employeeError) {
    return jsonResponse(500, { error: employeeError.message })
  }

  if (!employeeRows || employeeRows.length === 0) {
    return jsonResponse(404, { error: 'Employee not found.' })
  }

  const employee = employeeRows[0]

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

    const linkedAppMetadata = asRecord(linkedUserResponse.user?.app_metadata)
    const linkedMustChangePassword = readMustChangePasswordFlag(linkedAppMetadata.must_change_password)
    let auditLogged: boolean | undefined
    let warning: string | undefined
    let emailSent = false
    let emailDeliveryType: InviteEmailDeliveryType | undefined

    try {
      await sendExistingUserAccessEmail(
        adminClient,
        normalizedEmail,
        inviteRedirectTo,
      )
      emailSent = true
      emailDeliveryType = 'magiclink'
    } catch (error) {
      const failureMessage =
        error instanceof Error ? error.message : 'Unable to send account access email.'

      const auditResult = await insertInviteAuditLog({
        adminClient,
        actorUserId: user.id,
        action: 'EMPLOYEE_INVITE_FAILED',
        employee,
        recipientEmail: normalizedEmail,
        triggerSource,
        emailDeliveryType: 'magiclink',
        authUserId: profile.user_id,
        mustChangePassword: linkedMustChangePassword,
        failureReason: failureMessage,
      })

      return jsonResponse(400, {
        error: failureMessage,
        audit_logged: auditResult.logged,
        ...(auditResult.warning ? { warning: auditResult.warning } : {}),
      })
    }

    if (emailSent) {
      const auditResult = await insertInviteAuditLog({
        adminClient,
        actorUserId: user.id,
        action: 'EMPLOYEE_INVITE_SENT',
        employee,
        recipientEmail: normalizedEmail,
        triggerSource,
        emailDeliveryType,
        authUserId: profile.user_id,
        mustChangePassword: linkedMustChangePassword,
      })
      auditLogged = auditResult.logged
      warning = auditResult.warning
    }

    if (linkedMustChangePassword) {
      try {
        await ensureSecurityNotification(adminClient, profile.user_id)
      } catch (error) {
        return jsonResponse(500, {
          error: error instanceof Error ? error.message : 'Unable to enqueue security notification.',
        })
      }
    }

    return jsonResponse(200, {
      employe_id: employeId,
      user_id: profile.user_id,
      email: linkedEmail || normalizedEmail,
      status: 'INVITED',
      email_sent: emailSent,
      ...(emailDeliveryType ? { email_delivery_type: emailDeliveryType } : {}),
      must_change_password: linkedMustChangePassword,
      ...(auditLogged !== undefined ? { audit_logged: auditLogged } : {}),
      ...(warning ? { warning } : {}),
    })
  }

  let inviteResolution: InviteResolutionResult
  try {
    inviteResolution = await inviteOrResolveAuthUser(
      adminClient,
      normalizedEmail,
      inviteRedirectTo,
    )
  } catch (error) {
    if (error instanceof InviteFlowError && error.shouldLogEmailFailure) {
      const auditResult = await insertInviteAuditLog({
        adminClient,
        actorUserId: user.id,
        action: 'EMPLOYEE_INVITE_FAILED',
        employee,
        recipientEmail: normalizedEmail,
        triggerSource,
        failureReason: error.message,
      })

      return jsonResponse(400, {
        error: error.message,
        audit_logged: auditResult.logged,
        ...(auditResult.warning ? { warning: auditResult.warning } : {}),
      })
    }

    return jsonResponse(400, {
      error: error instanceof Error ? error.message : 'Unable to invite auth user.',
    })
  }

  const authUserId = inviteResolution.userId
  let auditLogged: boolean | undefined
  let warning: string | undefined
  let emailSent = inviteResolution.emailSent
  let emailDeliveryType = inviteResolution.emailDeliveryType

  if (inviteResolution.emailSent) {
    const auditResult = await insertInviteAuditLog({
      adminClient,
      actorUserId: user.id,
      action: 'EMPLOYEE_INVITE_SENT',
      employee,
      recipientEmail: normalizedEmail,
      triggerSource,
      emailDeliveryType,
      authUserId,
      mustChangePassword: true,
    })
    auditLogged = auditResult.logged
    warning = auditResult.warning
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

  try {
    await ensureMustChangePasswordMetadata(adminClient, authUserId)
    await ensureSecurityNotification(adminClient, authUserId)
  } catch (error) {
    return jsonResponse(500, {
      error: error instanceof Error ? error.message : 'Unable to apply invite security settings.',
    })
  }

  if (inviteResolution.requiresExistingUserAccessEmail) {
    try {
      await sendExistingUserAccessEmail(
        adminClient,
        normalizedEmail,
        inviteRedirectTo,
      )
      emailSent = true
      emailDeliveryType = 'magiclink'
    } catch (error) {
      const failureMessage =
        error instanceof Error ? error.message : 'Unable to send account access email.'
      const auditResult = await insertInviteAuditLog({
        adminClient,
        actorUserId: user.id,
        action: 'EMPLOYEE_INVITE_FAILED',
        employee,
        recipientEmail: normalizedEmail,
        triggerSource,
        emailDeliveryType: 'magiclink',
        authUserId,
        mustChangePassword: true,
        failureReason: failureMessage,
      })

      return jsonResponse(400, {
        error: failureMessage,
        audit_logged: auditResult.logged,
        ...(auditResult.warning ? { warning: auditResult.warning } : {}),
      })
    }

    const auditResult = await insertInviteAuditLog({
      adminClient,
      actorUserId: user.id,
      action: 'EMPLOYEE_INVITE_SENT',
      employee,
      recipientEmail: normalizedEmail,
      triggerSource,
      emailDeliveryType,
      authUserId,
      mustChangePassword: true,
    })
    auditLogged = auditResult.logged
    warning = auditResult.warning
  }

  return jsonResponse(200, {
    employe_id: employeId,
    user_id: authUserId,
    email: normalizedEmail,
    status: 'INVITED',
    email_sent: emailSent,
    ...(emailDeliveryType ? { email_delivery_type: emailDeliveryType } : {}),
    must_change_password: true,
    ...(auditLogged !== undefined ? { audit_logged: auditLogged } : {}),
    ...(warning ? { warning } : {}),
  })
})
