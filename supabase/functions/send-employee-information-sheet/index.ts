import { createClient } from 'npm:@supabase/supabase-js@2'

interface SendEmployeeInformationSheetPayload {
  employe_id?: string
  recipient_email?: string
}

interface EmployeeDocumentRow {
  id: string
  departement_id: string | null
  regional_branch: string | null
  matricule: string
  nom: string
  prenom: string
  sexe: string | null
  date_naissance: string | null
  lieu_naissance: string | null
  nationalite: string | null
  situation_familiale: string | null
  nombre_enfants: number | null
  adresse: string | null
  poste: string | null
  categorie_professionnelle: string | null
  type_contrat: string | null
  date_recrutement: string | null
  email: string | null
  telephone: string | null
  photo_url: string | null
  is_active: boolean
}

interface DepartmentRow {
  nom: string | null
}

const GMAIL_DOMAIN = 'gmail.com'

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

function normalizePayload(rawBody: unknown): SendEmployeeInformationSheetPayload {
  if (!rawBody || typeof rawBody !== 'object') {
    return {}
  }

  return rawBody as SendEmployeeInformationSheetPayload
}

function normalizeText(value: string | null | undefined): string | null {
  const normalized = value?.trim()
  return normalized && normalized.length > 0 ? normalized : null
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function isAllowedGmailRecipient(value: string): boolean {
  const normalized = value.trim().toLowerCase()
  if (!isValidEmail(normalized)) {
    return false
  }

  const [, domain = ''] = normalized.split('@')
  return domain === GMAIL_DOMAIN
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
    throw new Error(message)
  }

  const accessToken =
    typeof parsedBody?.access_token === 'string' ? parsedBody.access_token : null

  if (!accessToken) {
    throw new Error('Gmail API access token response was invalid.')
  }

  return accessToken
}

async function sendEmployeeInformationSheetViaGmail(params: {
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
    let failureReason = 'Document email delivery failed through Gmail API.'

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
      // Ignore JSON parsing failure and fall back to generic message.
    }

    throw new Error(failureReason)
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

function formatDisplayValue(value: string | null | undefined, fallback = '-'): string {
  return escapeHtml(normalizeText(value) ?? fallback)
}

function formatDateValue(value: string | null | undefined): string {
  if (!value) {
    return '-'
  }

  return escapeHtml(
    new Intl.DateTimeFormat('en-GB', {
      dateStyle: 'medium',
    }).format(new Date(`${value}T00:00:00`)),
  )
}

function formatNumberValue(value: number | null | undefined): string {
  return value === null || value === undefined ? '-' : escapeHtml(String(value))
}

function getEmployeeFullName(employee: Pick<EmployeeDocumentRow, 'prenom' | 'nom'>): string {
  return `${employee.prenom} ${employee.nom}`.replace(/\s+/g, ' ').trim()
}

function getSexLabel(value: string | null): string {
  switch (value) {
    case 'M':
      return 'Male'
    case 'F':
      return 'Female'
    default:
      return value ?? '-'
  }
}

function getContractTypeLabel(value: string | null): string {
  switch (value) {
    case 'CDI':
      return 'Permanent (CDI)'
    case 'CDD':
      return 'Fixed-term (CDD)'
    default:
      return value ?? '-'
  }
}

function getProfessionalCategoryLabel(value: string | null): string {
  switch (value) {
    case 'Cadre':
      return 'Executive'
    case 'Agent':
      return 'Agent'
    default:
      return value ?? '-'
  }
}

function getMaritalStatusLabel(value: string | null): string {
  switch (value) {
    case 'Célibataire':
    case 'CÃ©libataire':
      return 'Single'
    case 'Marié(e)':
    case 'MariÃ©(e)':
      return 'Married'
    case 'Divorcé(e)':
    case 'DivorcÃ©(e)':
      return 'Divorced'
    case 'Veuf(ve)':
      return 'Widowed'
    default:
      return value ?? '-'
  }
}

function buildSubject(employee: EmployeeDocumentRow): string {
  const fullName = getEmployeeFullName(employee)
  return `Employee Information Sheet | ${fullName} (${employee.matricule})`
}

function renderField(label: string, value: string): string {
  return `
    <div style="border:1px solid #e2e8f0;border-radius:16px;background:#f8fafc;padding:14px 16px;">
      <p style="margin:0;font-size:11px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:#64748b;">${escapeHtml(label)}</p>
      <p style="margin:6px 0 0;font-size:14px;font-weight:600;color:#0f172a;">${value}</p>
    </div>
  `
}

function renderEmployeeInformationSheetEmail(params: {
  employee: EmployeeDocumentRow
  departmentName: string | null
  generatedAt: string
  logoUrl?: string | null
}): string {
  const { employee, departmentName, generatedAt, logoUrl } = params
  const fullName = getEmployeeFullName(employee)
  const safeDepartment = formatDisplayValue(departmentName)
  const safeRegionalBranch = formatDisplayValue(employee.regional_branch)
  const status = employee.is_active ? 'Active' : 'Inactive'
  const logoBlock = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="GCB logo" style="height:64px;width:64px;object-fit:contain;" />`
    : ''

  return `
    <div style="margin:0;padding:24px;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a;">
      <div style="max-width:860px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:24px;overflow:hidden;box-shadow:0 18px 40px -24px rgba(15,23,42,0.18);">
        <div style="height:6px;background:linear-gradient(135deg,#ff6b35,#ffc947);"></div>
        <div style="padding:32px 40px;">
          <header style="display:flex;justify-content:space-between;gap:24px;align-items:flex-start;border-bottom:1px solid #e2e8f0;padding-bottom:24px;">
            <div style="display:flex;gap:16px;align-items:center;">
              ${logoBlock}
              <div>
                <p style="margin:0;font-size:14px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">LA SOCIETE NATIONALE DE GENIE-CIVIL & BATIMENT</p>
                <h1 style="margin:12px 0 0;font-size:30px;line-height:1.1;">Employee Information Sheet</h1>
                <p style="margin:8px 0 0;font-size:14px;color:#64748b;">Generated on ${escapeHtml(generatedAt)}</p>
              </div>
            </div>
            <span style="display:inline-flex;align-items:center;border-radius:999px;background:#f1f5f9;color:#334155;padding:8px 12px;font-size:13px;font-weight:600;">Controlled administrative use</span>
          </header>

          <section style="display:grid;grid-template-columns:190px minmax(0,1fr);gap:32px;padding-top:32px;">
            <div style="border:1px solid #e2e8f0;border-radius:24px;background:#f8fafc;overflow:hidden;min-height:220px;display:flex;align-items:center;justify-content:center;">
              ${
                employee.photo_url
                  ? `<img src="${escapeHtml(employee.photo_url)}" alt="${escapeHtml(fullName)}" style="width:100%;height:220px;object-fit:cover;" />`
                  : `<div style="font-size:48px;font-weight:700;color:#64748b;">${escapeHtml(employee.prenom.charAt(0).toUpperCase() + employee.nom.charAt(0).toUpperCase())}</div>`
              }
            </div>
            <div style="display:flex;flex-direction:column;gap:20px;">
              <div>
                <p style="margin:0;font-size:12px;font-weight:600;letter-spacing:0.2em;text-transform:uppercase;color:#64748b;">Employee identity</p>
                <h2 style="margin:12px 0 0;font-size:40px;line-height:1.1;">${escapeHtml(fullName)}</h2>
                <p style="margin:12px 0 0;font-size:18px;color:#475569;">${formatDisplayValue(employee.poste, 'Job title not set')}</p>
              </div>
              <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;">
                ${renderField('Employee ID', escapeHtml(employee.matricule))}
                ${renderField('Department', safeDepartment)}
                ${renderField('Regional branch', safeRegionalBranch)}
                ${renderField('Status', escapeHtml(status))}
                ${renderField('Contract type', formatDisplayValue(getContractTypeLabel(employee.type_contrat)))}
              </div>
            </div>
          </section>

          <section style="padding-top:32px;">
            <h3 style="margin:0;font-size:16px;">Identity & Contact</h3>
            <p style="margin:8px 0 0;font-size:14px;color:#64748b;">Core identity and contact information included in the employee information sheet.</p>
            <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:16px;">
              ${renderField('Full name', escapeHtml(fullName))}
              ${renderField('Sex', formatDisplayValue(getSexLabel(employee.sexe)))}
              ${renderField('Birth date', formatDateValue(employee.date_naissance))}
              ${renderField('Birth place', formatDisplayValue(employee.lieu_naissance))}
              ${renderField('Nationality', formatDisplayValue(employee.nationalite))}
              ${renderField('Phone', formatDisplayValue(employee.telephone))}
              ${renderField('Email', formatDisplayValue(employee.email))}
              ${renderField('Address', formatDisplayValue(employee.adresse))}
            </div>
          </section>

          <section style="padding-top:32px;">
            <h3 style="margin:0;font-size:16px;">Employment Information</h3>
            <p style="margin:8px 0 0;font-size:14px;color:#64748b;">Operational employment details relevant to the employee record.</p>
            <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:16px;">
              ${renderField('Department', safeDepartment)}
              ${renderField('Regional branch', safeRegionalBranch)}
              ${renderField('Job title', formatDisplayValue(employee.poste))}
              ${renderField('Professional category', formatDisplayValue(getProfessionalCategoryLabel(employee.categorie_professionnelle)))}
              ${renderField('Contract type', formatDisplayValue(getContractTypeLabel(employee.type_contrat)))}
              ${renderField('Hire date', formatDateValue(employee.date_recrutement))}
              ${renderField('Status', escapeHtml(status))}
            </div>
          </section>

          <section style="padding-top:32px;">
            <h3 style="margin:0;font-size:16px;">Administrative Information</h3>
            <p style="margin:8px 0 0;font-size:14px;color:#64748b;">Civil and administrative fields approved for this controlled sheet.</p>
            <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:16px;">
              ${renderField('Marital status', formatDisplayValue(getMaritalStatusLabel(employee.situation_familiale)))}
              ${renderField('Number of children', formatNumberValue(employee.nombre_enfants))}
              ${renderField('Address', formatDisplayValue(employee.adresse))}
              ${renderField('Generated from', 'GCB Employee Management System')}
            </div>
          </section>

          <footer style="margin-top:32px;padding-top:20px;border-top:1px solid #e2e8f0;font-size:13px;color:#64748b;">
            Employee information sheet. Internal HR notes, social security numbers, QR settings, public-profile visibility, audit metadata, and workflow controls are intentionally excluded from this document.
          </footer>
        </div>
      </div>
    </div>
  `
}

async function insertDocumentAuditLog(params: {
  adminClient: ReturnType<typeof createClient>
  actorUserId: string
  action: 'EMPLOYEE_SHEET_EMAIL_SENT' | 'EMPLOYEE_SHEET_EMAIL_FAILED'
  employee: EmployeeDocumentRow
  recipientEmail: string
  provider?: string
  failureReason?: string
}): Promise<{ logged: boolean; warning?: string }> {
  const timestamp = new Date().toISOString()
  const detailsJson: Record<string, unknown> = {
    document_type: 'EMPLOYEE_INFORMATION_SHEET',
    channel: 'email',
    provider: params.provider ?? 'none',
    recipient_email: params.recipientEmail,
    employee_id: params.employee.id,
    employee_name: getEmployeeFullName(params.employee),
    matricule: params.employee.matricule,
    status: params.action === 'EMPLOYEE_SHEET_EMAIL_SENT' ? 'sent' : 'failed',
    delivery_mode: 'html_email',
  }

  if (params.action === 'EMPLOYEE_SHEET_EMAIL_SENT') {
    detailsJson.sent_at = timestamp
  } else {
    detailsJson.failed_at = timestamp
    detailsJson.failure_reason =
      params.failureReason ?? 'Employee information sheet email could not be sent.'
  }

  const { error } = await params.adminClient.from('audit_log').insert({
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
        params.action === 'EMPLOYEE_SHEET_EMAIL_SENT'
          ? 'Document email sent, but audit logging could not be completed.'
          : 'Document email failed, and the audit event could not be recorded.',
    }
  }

  return { logged: true }
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
  const documentLogoUrl = normalizeText(Deno.env.get('DOCUMENT_LOGO_URL'))

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

  const { data: callerProfiles, error: callerProfileError } = await adminClient
    .from('ProfilUtilisateur')
    .select('role')
    .eq('user_id', caller.id)
    .limit(1)
    .returns<Array<{ role: string }>>()

  if (callerProfileError) {
    return jsonResponse(500, { error: callerProfileError.message })
  }

  const callerRole = callerProfiles?.[0]?.role
  if (callerRole !== 'ADMIN_RH') {
    return jsonResponse(403, { error: 'Forbidden. Admin RH role required.' })
  }

  let payload: SendEmployeeInformationSheetPayload
  try {
    payload = normalizePayload(await request.json())
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON payload.' })
  }

  const employeId = normalizeText(payload.employe_id)
  const recipientEmail = normalizeText(payload.recipient_email)?.toLowerCase() ?? null

  if (!employeId) {
    return jsonResponse(400, { error: 'employe_id is required.' })
  }

  if (!recipientEmail || !isValidEmail(recipientEmail)) {
    return jsonResponse(400, { error: 'Invalid recipient email format.' })
  }

  if (!isAllowedGmailRecipient(recipientEmail)) {
    return jsonResponse(400, {
      error: 'Only Gmail recipient addresses are allowed for this document email flow.',
    })
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(500, {
      error:
        'Server configuration error. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.',
    })
  }

  const { data: employeeRows, error: employeeError } = await adminClient
    .from('Employe')
    .select(
      'id, departement_id, regional_branch, matricule, nom, prenom, sexe, date_naissance, lieu_naissance, nationalite, situation_familiale, nombre_enfants, adresse, poste, categorie_professionnelle, type_contrat, date_recrutement, email, telephone, photo_url, is_active',
    )
    .eq('id', employeId)
    .limit(1)
    .returns<EmployeeDocumentRow[]>()

  if (employeeError) {
    return jsonResponse(500, { error: employeeError.message })
  }

  const employee = employeeRows?.[0]
  if (!employee) {
    return jsonResponse(404, { error: 'Employee not found.' })
  }

  let departmentName: string | null = null
  if (employee.departement_id) {
    const { data: departmentRows, error: departmentError } = await adminClient
      .from('Departement')
      .select('nom')
      .eq('id', employee.departement_id)
      .limit(1)
      .returns<DepartmentRow[]>()

    if (departmentError) {
      return jsonResponse(500, { error: departmentError.message })
    }

    departmentName = departmentRows?.[0]?.nom ?? null
  }

  const generatedAt = new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date())

  const gmailClientId = normalizeText(Deno.env.get('GMAIL_OAUTH_CLIENT_ID'))
  const gmailClientSecret = normalizeText(Deno.env.get('GMAIL_OAUTH_CLIENT_SECRET'))
  const gmailRefreshToken = normalizeText(Deno.env.get('GMAIL_OAUTH_REFRESH_TOKEN'))
  const gmailSenderEmail = normalizeText(Deno.env.get('GMAIL_SENDER_EMAIL'))
  const emailReplyTo = normalizeText(Deno.env.get('DOCUMENT_EMAIL_REPLY_TO'))

  if (!gmailClientId || !gmailClientSecret || !gmailRefreshToken || !gmailSenderEmail) {
    const failureReason =
      'Employee information sheet email delivery requires Gmail API configuration. Set GMAIL_OAUTH_CLIENT_ID, GMAIL_OAUTH_CLIENT_SECRET, GMAIL_OAUTH_REFRESH_TOKEN, and GMAIL_SENDER_EMAIL.'

    const auditResult = await insertDocumentAuditLog({
      adminClient,
      actorUserId: caller.id,
      action: 'EMPLOYEE_SHEET_EMAIL_FAILED',
      employee,
      recipientEmail,
      provider: 'gmail_api',
      failureReason,
    })

    return jsonResponse(503, {
      error: failureReason,
      employe_id: employee.id,
      recipient_email: recipientEmail,
      audit_logged: auditResult.logged,
      ...(auditResult.warning ? { warning: auditResult.warning } : {}),
    })
  }

  const subject = buildSubject(employee)
  const html = renderEmployeeInformationSheetEmail({
    employee,
    departmentName,
    generatedAt,
    logoUrl: documentLogoUrl,
  })

  try {
    await sendEmployeeInformationSheetViaGmail({
      clientId: gmailClientId,
      clientSecret: gmailClientSecret,
      refreshToken: gmailRefreshToken,
      senderEmail: gmailSenderEmail,
      replyTo: emailReplyTo,
      recipientEmail,
      subject,
      html,
    })
  } catch (error) {
    const failureReason =
      error instanceof Error && error.message.trim().length > 0
        ? error.message
        : 'Document email delivery failed through Gmail API.'

    const auditResult = await insertDocumentAuditLog({
      adminClient,
      actorUserId: caller.id,
      action: 'EMPLOYEE_SHEET_EMAIL_FAILED',
      employee,
      recipientEmail,
      provider: 'gmail_api',
      failureReason,
    })

    return jsonResponse(502, {
      error: failureReason,
      employe_id: employee.id,
      recipient_email: recipientEmail,
      audit_logged: auditResult.logged,
      ...(auditResult.warning ? { warning: auditResult.warning } : {}),
    })
  }

  const auditResult = await insertDocumentAuditLog({
    adminClient,
    actorUserId: caller.id,
    action: 'EMPLOYEE_SHEET_EMAIL_SENT',
    employee,
    recipientEmail,
    provider: 'gmail_api',
  })

  return jsonResponse(200, {
    employe_id: employee.id,
    recipient_email: recipientEmail,
    status: 'SENT',
    audit_logged: auditResult.logged,
    ...(auditResult.warning ? { warning: auditResult.warning } : {}),
  })
})

