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
  emailDeliveryType: InviteEmailDeliveryType
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

function normalizeText(value: string | null | undefined): string | null {
  const normalized = value?.trim()
  return normalized && normalized.length > 0 ? normalized : null
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
  provider?: 'gmail_api' | 'supabase_auth'
}): Promise<{ logged: boolean; warning?: string }> {
  const timestamp = new Date().toISOString()
  const detailsJson: Record<string, unknown> = {
    recipient_email: params.recipientEmail,
    employee_id: params.employee.id,
    employee_name: getEmployeeFullName(params.employee),
    matricule: params.employee.matricule,
    email_type: 'employee_invite',
    trigger_source: params.triggerSource,
    provider: params.provider ?? 'gmail_api',
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

async function createOrResolveAuthUser(
  adminClient: ReturnType<typeof createClient>,
  normalizedEmail: string,
): Promise<InviteResolutionResult> {
  const existingUserId = await findAuthUserIdByEmail(adminClient, normalizedEmail)
  if (existingUserId) {
    return {
      userId: existingUserId,
      emailDeliveryType: 'magiclink',
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
        emailDeliveryType: 'magiclink',
      }
    }

    throw new InviteFlowError('Unable to resolve auth user by email.')
  }

  if (!createResult.data.user?.id) {
    throw new InviteFlowError('Auth user creation returned an empty user id.')
  }

  return {
    userId: createResult.data.user.id,
    emailDeliveryType: 'invite',
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

function sanitizeHeaderValue(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim()
}

function base64UrlEncodeText(value: string): string {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  const chunkSize = 0x8000

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize)
    binary += String.fromCharCode(...chunk)
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function buildRawMimeMessage(params: {
  from: string
  to: string
  subject: string
  html: string
  replyTo?: string | null
}): string {
  const headers = [
    `From: ${sanitizeHeaderValue(params.from)}`,
    `To: ${sanitizeHeaderValue(params.to)}`,
    `Subject: ${sanitizeHeaderValue(params.subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
  ]

  if (params.replyTo) {
    headers.push(`Reply-To: ${sanitizeHeaderValue(params.replyTo)}`)
  }

  return `${headers.join('\r\n')}\r\n\r\n${params.html}`
}

async function getGmailAccessToken(params: {
  clientId: string
  clientSecret: string
  refreshToken: string
}): Promise<string> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: params.clientId,
      client_secret: params.clientSecret,
      refresh_token: params.refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  let parsedBody: Record<string, unknown> | null = null
  try {
    parsedBody = (await response.json()) as Record<string, unknown> | null
  } catch {
    parsedBody = null
  }

  if (!response.ok) {
    const message =
      typeof parsedBody?.error_description === 'string'
        ? parsedBody.error_description
        : typeof parsedBody?.error === 'string'
          ? parsedBody.error
          : 'Could not obtain a Gmail API access token.'
    throw new InviteFlowError(message, true)
  }

  const accessToken =
    typeof parsedBody?.access_token === 'string' ? parsedBody.access_token : null

  if (!accessToken) {
    throw new InviteFlowError('Gmail API access token response was invalid.', true)
  }

  return accessToken
}

async function sendEmailViaGmail(params: {
  clientId: string
  clientSecret: string
  refreshToken: string
  senderEmail: string
  replyTo?: string | null
  recipientEmail: string
  subject: string
  html: string
}): Promise<void> {
  const accessToken = await getGmailAccessToken({
    clientId: params.clientId,
    clientSecret: params.clientSecret,
    refreshToken: params.refreshToken,
  })

  const rawMessage = buildRawMimeMessage({
    from: params.senderEmail,
    to: params.recipientEmail,
    subject: params.subject,
    html: params.html,
    replyTo: params.replyTo,
  })

  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      raw: base64UrlEncodeText(rawMessage),
    }),
  })

  if (!response.ok) {
    let failureReason = 'Invite email delivery failed through Gmail API.'

    try {
      const body = (await response.json()) as Record<string, unknown> | null
      const errorObject =
        body && typeof body.error === 'object' && body.error !== null
          ? (body.error as Record<string, unknown>)
          : null
      const bodyMessage =
        typeof errorObject?.message === 'string'
          ? errorObject.message
          : typeof body?.error === 'string'
            ? body.error
            : null

      if (bodyMessage) {
        failureReason = bodyMessage
      }
    } catch {
      // Ignore JSON parsing failure and keep the generic Gmail failure reason.
    }

    throw new InviteFlowError(failureReason, true)
  }
}

async function generateEmployeeAccessLink(params: {
  adminClient: ReturnType<typeof createClient>
  email: string
  deliveryType: InviteEmailDeliveryType
  redirectTo?: string
}): Promise<string> {
  const { data, error } = await params.adminClient.auth.admin.generateLink({
    type: params.deliveryType,
    email: params.email,
    options: params.redirectTo ? { redirectTo: params.redirectTo } : undefined,
  })

  if (error) {
    throw new InviteFlowError(error.message, true)
  }

  const actionLink = data.properties?.action_link?.trim()
  if (!actionLink) {
    throw new InviteFlowError('Invite link generation returned an empty action link.', true)
  }

  return actionLink
}

function applyRedirectToActionLink(actionLink: string, redirectTo?: string): string {
  if (!redirectTo) {
    return actionLink
  }

  try {
    const parsedLink = new URL(actionLink)
    parsedLink.searchParams.set('redirect_to', redirectTo)
    return parsedLink.toString()
  } catch {
    return actionLink
  }
}

function buildInviteEmailSubject(params: {
  employee: EmployeRow
  deliveryType: InviteEmailDeliveryType
}): string {
  const fullName = getEmployeeFullName(params.employee)

  if (params.deliveryType === 'invite') {
    return `Activate your GCB EMS account${fullName ? `, ${fullName}` : ''}`
  }

  return `Your GCB EMS access link${fullName ? `, ${fullName}` : ''}`
}

function renderInviteEmailHtml(params: {
  employee: EmployeRow
  actionLink: string
  deliveryType: InviteEmailDeliveryType
  redirectTo?: string
}): string {
  const fullName = getEmployeeFullName(params.employee)
  const intro =
    params.deliveryType === 'invite'
      ? 'Your employee account has been prepared in GCB EMS. Use the secure link below to sign in for the first time.'
      : 'Use the secure link below to access your GCB EMS account.'
  const nextStep =
    params.deliveryType === 'invite'
      ? 'After sign-in, you will be asked to set a strong password before continuing.'
      : 'If your account still requires a password update, the app will guide you to the security step after sign-in.'

  return `<!DOCTYPE html>
<html lang="en">
  <body style="margin:0;padding:24px;background:#f6f7fb;font-family:Arial,sans-serif;color:#0f172a;">
    <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:18px;overflow:hidden;">
      <div style="padding:24px 28px;background:linear-gradient(135deg,#10172d 0%,#1b2442 100%);color:#ffffff;">
        <div style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;opacity:0.75;">GCB EMS</div>
        <h1 style="margin:12px 0 0;font-size:28px;line-height:1.2;">Employee account access</h1>
      </div>
      <div style="padding:28px;">
        <p style="margin:0 0 16px;font-size:16px;line-height:1.7;">Hello${fullName ? ` ${fullName}` : ''},</p>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.7;">${intro}</p>
        <p style="margin:0 0 24px;font-size:15px;line-height:1.7;">${nextStep}</p>
        <div style="margin:0 0 24px;">
          <a href="${sanitizeHeaderValue(params.actionLink)}" style="display:inline-block;background:#f97316;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:12px;">Open GCB EMS</a>
        </div>
        <p style="margin:0 0 12px;font-size:13px;line-height:1.7;color:#475569;">If the button does not open, use this secure link:</p>
        <p style="margin:0 0 20px;font-size:13px;line-height:1.7;word-break:break-all;">
          <a href="${sanitizeHeaderValue(params.actionLink)}" style="color:#2563eb;text-decoration:underline;">${sanitizeHeaderValue(params.actionLink)}</a>
        </p>
        ${
          params.redirectTo
            ? `<p style="margin:0;font-size:12px;line-height:1.7;color:#64748b;">Expected app destination after verification: ${sanitizeHeaderValue(params.redirectTo)}</p>`
            : ''
        }
      </div>
    </div>
  </body>
</html>`
}

async function sendEmployeeAccessEmail(params: {
  adminClient: ReturnType<typeof createClient>
  recipientEmail: string
  employee: EmployeRow
  deliveryType: InviteEmailDeliveryType
  redirectTo?: string
}): Promise<void> {
  const gmailClientId = normalizeText(Deno.env.get('GMAIL_OAUTH_CLIENT_ID'))
  const gmailClientSecret = normalizeText(Deno.env.get('GMAIL_OAUTH_CLIENT_SECRET'))
  const gmailRefreshToken = normalizeText(Deno.env.get('GMAIL_OAUTH_REFRESH_TOKEN'))
  const gmailSenderEmail = normalizeText(Deno.env.get('GMAIL_SENDER_EMAIL'))
  const inviteReplyTo =
    normalizeText(Deno.env.get('INVITE_EMAIL_REPLY_TO')) ??
    normalizeText(Deno.env.get('DOCUMENT_EMAIL_REPLY_TO'))

  if (!gmailClientId || !gmailClientSecret || !gmailRefreshToken || !gmailSenderEmail) {
    throw new InviteFlowError(
      'Invite email delivery requires Gmail API configuration. Set GMAIL_OAUTH_CLIENT_ID, GMAIL_OAUTH_CLIENT_SECRET, GMAIL_OAUTH_REFRESH_TOKEN, and GMAIL_SENDER_EMAIL.',
      true,
    )
  }

  const actionLink = await generateEmployeeAccessLink({
    adminClient: params.adminClient,
    email: params.recipientEmail,
    deliveryType: params.deliveryType,
    redirectTo: params.redirectTo,
  })
  const safeActionLink = applyRedirectToActionLink(actionLink, params.redirectTo)

  await sendEmailViaGmail({
    clientId: gmailClientId,
    clientSecret: gmailClientSecret,
    refreshToken: gmailRefreshToken,
    senderEmail: gmailSenderEmail,
    replyTo: inviteReplyTo,
    recipientEmail: params.recipientEmail,
    subject: buildInviteEmailSubject({
      employee: params.employee,
      deliveryType: params.deliveryType,
    }),
    html: renderInviteEmailHtml({
      employee: params.employee,
      actionLink: safeActionLink,
      deliveryType: params.deliveryType,
      redirectTo: params.redirectTo,
    }),
  })
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
    const emailSent = true
    const emailDeliveryType: InviteEmailDeliveryType = 'magiclink'

    try {
      await sendEmployeeAccessEmail({
        adminClient,
        recipientEmail: normalizedEmail,
        employee,
        deliveryType: emailDeliveryType,
        redirectTo: inviteRedirectTo,
      })
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
    inviteResolution = await createOrResolveAuthUser(
      adminClient,
      normalizedEmail,
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
  const emailSent = true
  const emailDeliveryType = inviteResolution.emailDeliveryType

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

  try {
    await sendEmployeeAccessEmail({
      adminClient,
      recipientEmail: normalizedEmail,
      employee,
      deliveryType: emailDeliveryType,
      redirectTo: inviteRedirectTo,
    })
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
      emailDeliveryType,
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
  return jsonResponse(200, {
    employe_id: employeId,
    user_id: authUserId,
    email: normalizedEmail,
    status: 'INVITED',
    email_sent: emailSent,
    ...(emailDeliveryType ? { email_delivery_type: emailDeliveryType } : {}),
    must_change_password: true,
    ...(auditResult.logged !== undefined ? { audit_logged: auditResult.logged } : {}),
    ...(auditResult.warning ? { warning: auditResult.warning } : {}),
  })
})
