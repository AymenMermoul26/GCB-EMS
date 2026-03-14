import { createClient } from 'npm:@supabase/supabase-js@2'

interface SendEmployeeInformationSheetPayload {
  employe_id?: string
  recipient_email?: string
  subject?: string
  custom_message?: string
  app_base_url?: string
}

interface EmployeRow {
  id: string
  matricule: string
  nom: string
  prenom: string
  poste: string | null
  email: string | null
  telephone: string | null
  is_active: boolean
  departement_id: string
  created_at: string
  updated_at: string
}

interface DepartmentRow {
  nom: string
}

interface ProfilUtilisateurRow {
  user_id: string | null
  role: string
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}

const COMPANY_NAME = 'LA SOCI\u00C9T\u00C9 NATIONALE DE G\u00C9NIE-CIVIL & B\u00C2TIMENT'
const APP_NAME = 'GCB Employee Management System'

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders,
  })
}

function errorResponse(
  status: number,
  code: string,
  error: string,
  details?: string,
) {
  return jsonResponse(status, {
    code,
    error,
    ...(details ? { details } : {}),
  })
}

function normalizePayload(rawBody: unknown): SendEmployeeInformationSheetPayload {
  if (!rawBody || typeof rawBody !== 'object' || Array.isArray(rawBody)) {
    return {}
  }

  return rawBody as SendEmployeeInformationSheetPayload
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

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : null
}

function normalizeBaseUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  if (!trimmed) {
    return null
  }

  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null
    }

    return parsed.toString().replace(/\/$/, '')
  } catch {
    return null
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function formatOptionalValue(value: string | null | undefined, fallback = 'Not set'): string {
  const normalized = normalizeOptionalText(value)
  return normalized ?? fallback
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function buildEmployeeDetailLink(baseUrl: string, employeeId: string): string {
  return `${baseUrl}/admin/employees/${employeeId}`
}

function buildEmailHtml(params: {
  recipientEmail: string
  subject: string
  customMessage: string | null
  employee: EmployeRow
  departmentName: string
  accountRole: string
  accountStatus: string
  internalLink: string
  senderEmail: string
}): string {
  const fullName = `${params.employee.prenom} ${params.employee.nom}`.replace(/\s+/g, ' ').trim()
  const rows = [
    ['Full name', fullName],
    ['Employee ID', params.employee.matricule],
    ['Job title', formatOptionalValue(params.employee.poste)],
    ['Department', params.departmentName],
    ['Professional email', formatOptionalValue(params.employee.email)],
    ['Professional phone', formatOptionalValue(params.employee.telephone)],
    ['Employee status', params.employee.is_active ? 'Active' : 'Inactive'],
    ['Account status', params.accountStatus],
    ['Account role', params.accountRole],
    ['Last updated', formatDateTime(params.employee.updated_at)],
  ]

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;background:#f8fafc;padding:24px;color:#0f172a;">
      <div style="max-width:720px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:20px;overflow:hidden;">
        <div style="height:6px;background:linear-gradient(135deg,#ff6b35,#ffc947);"></div>
        <div style="padding:32px;">
          <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#64748b;">${escapeHtml(COMPANY_NAME)}</p>
          <h1 style="margin:0;font-size:28px;line-height:1.2;color:#0f172a;">Employee Information Sheet</h1>
          <p style="margin:8px 0 0;color:#475569;">Structured internal summary for administrative review.</p>
          ${
            params.customMessage
              ? `<div style="margin-top:24px;padding:16px 18px;border:1px solid #e2e8f0;border-radius:14px;background:#f8fafc;color:#334155;"><strong style="display:block;margin-bottom:8px;">Message from ${escapeHtml(params.senderEmail)}</strong>${escapeHtml(params.customMessage)}</div>`
              : ''
          }
          <div style="margin-top:24px;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
            ${rows
              .map(
                ([label, value], index) => `
                  <div style="display:flex;justify-content:space-between;gap:24px;padding:14px 18px;background:${index % 2 === 0 ? '#ffffff' : '#f8fafc'};border-bottom:${index === rows.length - 1 ? '0' : '1px solid #e2e8f0'};">
                    <span style="font-size:13px;color:#64748b;">${escapeHtml(label)}</span>
                    <span style="font-size:13px;font-weight:600;color:#0f172a;text-align:right;">${escapeHtml(value)}</span>
                  </div>
                `,
              )
              .join('')}
          </div>
          <div style="margin-top:24px;">
            <a href="${escapeHtml(params.internalLink)}" style="display:inline-block;padding:12px 18px;border-radius:999px;background:linear-gradient(135deg,#ff6b35,#ffc947);color:#ffffff;text-decoration:none;font-weight:600;">Open internal employee record</a>
          </div>
          <p style="margin:24px 0 0;font-size:12px;color:#64748b;">
            This link requires an authenticated admin session in ${escapeHtml(APP_NAME)}.
          </p>
        </div>
      </div>
    </div>
  `
}

function buildEmailText(params: {
  customMessage: string | null
  employee: EmployeRow
  departmentName: string
  accountRole: string
  accountStatus: string
  internalLink: string
  senderEmail: string
}): string {
  const fullName = `${params.employee.prenom} ${params.employee.nom}`.replace(/\s+/g, ' ').trim()

  return [
    'Employee Information Sheet',
    COMPANY_NAME,
    '',
    params.customMessage ? `Message from ${params.senderEmail}: ${params.customMessage}` : null,
    params.customMessage ? '' : null,
    `Full name: ${fullName}`,
    `Employee ID: ${params.employee.matricule}`,
    `Job title: ${formatOptionalValue(params.employee.poste)}`,
    `Department: ${params.departmentName}`,
    `Professional email: ${formatOptionalValue(params.employee.email)}`,
    `Professional phone: ${formatOptionalValue(params.employee.telephone)}`,
    `Employee status: ${params.employee.is_active ? 'Active' : 'Inactive'}`,
    `Account status: ${params.accountStatus}`,
    `Account role: ${params.accountRole}`,
    `Last updated: ${formatDateTime(params.employee.updated_at)}`,
    '',
    `Secure internal link: ${params.internalLink}`,
    '',
    `Generated by ${APP_NAME}.`,
  ]
    .filter((line): line is string => Boolean(line))
    .join('\n')
}

async function sendEmailViaResend(params: {
  apiKey: string
  fromAddress: string
  recipientEmail: string
  subject: string
  html: string
  text: string
}): Promise<void> {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: params.fromAddress,
      to: [params.recipientEmail],
      subject: params.subject,
      html: params.html,
      text: params.text,
    }),
  })

  if (response.ok) {
    return
  }

  let errorMessage = `Email provider request failed with status ${response.status}.`
  try {
    const body = await response.json()
    const message = body?.message ?? body?.error?.message ?? body?.error
    if (typeof message === 'string' && message.trim().length > 0) {
      errorMessage = message.trim()
    }
  } catch {
    // Ignore JSON parsing errors and use fallback status message.
  }

  throw new Error(errorMessage)
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
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  const resendFromEmail = Deno.env.get('RESEND_FROM_EMAIL')

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return errorResponse(500, 'SERVER_CONFIG_ERROR', 'Server configuration error.')
  }

  if (!resendApiKey || !resendFromEmail) {
    return errorResponse(
      500,
      'EMAIL_CONFIG_MISSING',
      'Email service is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL.',
    )
  }

  const accessToken = extractBearerToken(request.headers.get('Authorization'))
  if (!accessToken) {
    return errorResponse(401, 'AUTH_MISSING', 'Missing Authorization header.')
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey)
  const { data: authData, error: authError } = await adminClient.auth.getUser(accessToken)
  const caller = authData.user

  if (authError || !caller) {
    return errorResponse(401, 'AUTH_UNAUTHORIZED', 'Unauthorized.')
  }

  const { data: callerProfiles, error: callerProfileError } = await adminClient
    .from('ProfilUtilisateur')
    .select('role')
    .eq('user_id', caller.id)
    .limit(1)
    .returns<Array<{ role: string }>>()

  if (callerProfileError) {
    return errorResponse(500, 'PROFILE_LOOKUP_FAILED', callerProfileError.message)
  }

  if (callerProfiles?.[0]?.role !== 'ADMIN_RH') {
    return errorResponse(403, 'AUTH_FORBIDDEN', 'Forbidden. Admin RH role required.')
  }

  let payload: SendEmployeeInformationSheetPayload
  try {
    payload = normalizePayload(await request.json())
  } catch {
    return errorResponse(400, 'INVALID_JSON', 'Invalid JSON payload.')
  }

  const employeId = payload.employe_id?.trim()
  const recipientEmail = payload.recipient_email?.trim().toLowerCase()
  const customMessage = normalizeOptionalText(payload.custom_message)

  if (!employeId) {
    return errorResponse(400, 'VALIDATION_ERROR', 'employe_id is required.')
  }

  if (!recipientEmail || !isValidEmail(recipientEmail)) {
    return errorResponse(400, 'VALIDATION_ERROR', 'Invalid recipient email format.')
  }

  const appBaseUrl =
    normalizeBaseUrl(Deno.env.get('APP_BASE_URL')) ??
    normalizeBaseUrl(Deno.env.get('SITE_URL')) ??
    normalizeBaseUrl(payload.app_base_url) ??
    normalizeBaseUrl(request.headers.get('origin'))

  if (!appBaseUrl) {
    return errorResponse(
      500,
      'APP_BASE_URL_MISSING',
      'Application base URL is not configured. Set APP_BASE_URL or provide a valid app_base_url.',
    )
  }

  const { data: employeeRows, error: employeeError } = await adminClient
    .from('Employe')
    .select('id, matricule, nom, prenom, poste, email, telephone, is_active, departement_id, created_at, updated_at')
    .eq('id', employeId)
    .limit(1)
    .returns<EmployeRow[]>()

  if (employeeError) {
    return errorResponse(500, 'EMPLOYEE_LOOKUP_FAILED', employeeError.message)
  }

  const employee = employeeRows?.[0]
  if (!employee) {
    return errorResponse(404, 'EMPLOYEE_NOT_FOUND', 'Employee not found.')
  }

  const { data: departmentRows, error: departmentError } = await adminClient
    .from('Departement')
    .select('nom')
    .eq('id', employee.departement_id)
    .limit(1)
    .returns<DepartmentRow[]>()

  if (departmentError) {
    return errorResponse(500, 'DEPARTMENT_LOOKUP_FAILED', departmentError.message)
  }

  const { data: profileRows, error: profileError } = await adminClient
    .from('ProfilUtilisateur')
    .select('user_id, role')
    .eq('employe_id', employee.id)
    .limit(1)
    .returns<ProfilUtilisateurRow[]>()

  if (profileError) {
    return errorResponse(500, 'PROFILE_LOOKUP_FAILED', profileError.message)
  }

  const profile = profileRows?.[0]
  const fullName = `${employee.prenom} ${employee.nom}`.replace(/\s+/g, ' ').trim()
  const subject =
    normalizeOptionalText(payload.subject) ?? `Employee Information Sheet - ${fullName}`
  const departmentName = departmentRows?.[0]?.nom?.trim() || 'Department not assigned'
  const accountRole = profile?.role?.trim() || 'Not assigned'
  const accountStatus = profile?.user_id ? 'Linked account' : 'Not linked'
  const internalLink = buildEmployeeDetailLink(appBaseUrl, employee.id)
  const senderEmail = normalizeOptionalText(caller.email) ?? 'Administrator'

  const html = buildEmailHtml({
    recipientEmail,
    subject,
    customMessage,
    employee,
    departmentName,
    accountRole,
    accountStatus,
    internalLink,
    senderEmail,
  })

  const text = buildEmailText({
    customMessage,
    employee,
    departmentName,
    accountRole,
    accountStatus,
    internalLink,
    senderEmail,
  })

  try {
    await sendEmailViaResend({
      apiKey: resendApiKey,
      fromAddress: resendFromEmail,
      recipientEmail,
      subject,
      html,
      text,
    })
  } catch (error) {
    const providerMessage =
      error instanceof Error ? error.message : 'Unable to send email through the configured provider.'
    const normalizedProviderMessage = providerMessage.toLowerCase()
    const friendlyProviderMessage =
      normalizedProviderMessage.includes('domain') && normalizedProviderMessage.includes('verified')
        ? 'Email provider rejected the configured sender domain. Verify the gcb.com domain in Resend or update RESEND_FROM_EMAIL to a verified sender address.'
        : providerMessage

    console.error('Employee information sheet email provider failure:', providerMessage)

    return errorResponse(
      502,
      'EMAIL_PROVIDER_FAILURE',
      friendlyProviderMessage,
      providerMessage,
    )
  }

  let auditLogged = true
  let warning: string | undefined

  const { error: auditError } = await adminClient
    .from('audit_log')
    .insert({
      actor_user_id: caller.id,
      action: 'EMPLOYEE_SHEET_SENT',
      target_type: 'Employe',
      target_id: employee.id,
      details_json: {
        recipient_email: recipientEmail,
        subject,
        sender_user_id: caller.id,
        sender_email: caller.email ?? null,
        internal_link: internalLink,
        sent_at: new Date().toISOString(),
      },
    })

  if (auditError) {
    auditLogged = false
    warning = 'Email sent, but audit logging could not be completed.'
    console.error('Failed to insert audit_log row for employee information sheet:', auditError.message)
  }

  return jsonResponse(200, {
    ok: true,
    employee_id: employee.id,
    recipient_email: recipientEmail,
    subject,
    link: internalLink,
    audit_logged: auditLogged,
    warning,
  })
})

