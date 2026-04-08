import { createClient } from '@supabase/supabase-js'

import {
  EMPLOYEE_DOSSIER_FIELD_LABELS,
  EMPLOYEE_DOSSIER_LOW_CONFIDENCE_THRESHOLD,
  EMPLOYEE_DOSSIER_MAX_FILE_SIZE_BYTES,
  EMPLOYEE_DOSSIER_MIME_TYPES,
  EMPLOYEE_DOSSIER_SOURCE_FIELD_KEYS,
  type EmployeeDossierDraft,
  type EmployeeDossierExtractionResponse,
  type EmployeeDossierFieldResult,
  type EmployeeDossierFormFieldKey,
  type EmployeeDossierSourceFieldKey,
} from '../../src/types/employee-dossier-import.js'
import {
  resolveEmployeeCategorieProfessionnelleValue,
  resolveEmployeeDiplomeValue,
  resolveEmployeeNationaliteValue,
  resolveEmployeePosteValue,
  resolveEmployeeSexeValue,
  resolveEmployeeSituationFamilialeValue,
  resolveEmployeeSpecialiteValue,
  resolveEmployeeTypeContratValue,
  sanitizeEmployeeTextValue,
} from '../../src/types/employee.js'
import { getDepartmentDisplayName } from '../../src/types/department.js'

const AZURE_DOCUMENT_INTELLIGENCE_API_VERSION =
  process.env.AZURE_DOCUMENT_INTELLIGENCE_API_VERSION ?? '2024-11-30'
const AZURE_DOCUMENT_INTELLIGENCE_MODEL_ID =
  process.env.AZURE_DOCUMENT_INTELLIGENCE_MODEL_ID ?? 'prebuilt-layout'
const AZURE_DOCUMENT_INTELLIGENCE_FEATURES = 'keyValuePairs'
const ANALYZE_POLL_INTERVAL_MS = 1200
const ANALYZE_POLL_TIMEOUT_MS = 45_000
const ADMIN_ROLE = 'ADMIN_RH'

const FIELD_ALIASES: Record<EmployeeDossierSourceFieldKey, string[]> = {
  matricule: ['matricule', 'employee id', 'id employe', 'id employee'],
  nom: ['nom', 'last name', 'surname', 'family name'],
  prenom: ['prenom', 'prénom', 'first name', 'given name'],
  sexe: ['sexe', 'sex', 'genre'],
  dateNaissance: ['date de naissance', 'birth date', 'date naissance'],
  lieuNaissance: ['lieu de naissance', 'birth place', 'place of birth'],
  nationalite: ['nationalite', 'nationalité', 'nationality'],
  situationFamiliale: ['situation familiale', 'marital status', 'civil status'],
  nombreEnfants: ["nombre d'enfants", 'number of children', 'children', 'nb enfants'],
  adresse: ['adresse', 'address', 'domicile'],
  telephone: ['telephone', 'téléphone', 'phone', 'mobile', 'gsm'],
  email: ['email', 'e-mail', 'mail'],
  departement: ['departement', 'département', 'department', 'direction'],
  service: ['service', 'division', 'unit'],
  fonction: ['fonction', 'poste', 'job title', 'title', 'role', 'occupation'],
  categorieProfessionnelle: [
    'categorie professionnelle',
    'catégorie professionnelle',
    'professional category',
    'category',
  ],
  typeContrat: ['type contrat', 'type de contrat', 'contract type', 'contrat'],
  dateRecrutement: [
    'date recrutement',
    "date d'embauche",
    'date embauche',
    'hire date',
    'recruitment date',
  ],
  numeroSecuriteSociale: [
    'numero securite sociale',
    'numéro sécurité sociale',
    'social security number',
    'nss',
    'ssn',
  ],
  diplome: ['diplome', 'diplôme', 'degree', 'diploma', 'qualification'],
  specialite: ['specialite', 'spécialité', 'specialization', 'speciality', 'major'],
}

interface ExtractionEnv {
  supabaseUrl: string
  supabaseAnonKey: string
  supabaseServiceRoleKey: string
  azureEndpoint: string
  azureApiKey: string
  azureModelId: string
}

interface AzureKeyValuePair {
  confidence?: number
  key?: { content?: string | null } | null
  value?: { content?: string | null } | null
}

interface AzureAnalyzeResult {
  status?: string
  analyzeResult?: {
    content?: string | null
    keyValuePairs?: AzureKeyValuePair[] | null
  } | null
  error?: {
    message?: string | null
  } | null
}

interface CandidateFieldValue {
  keyContent: string | null
  valueContent: string | null
  confidence: number | null
}

interface DepartmentRow {
  id: string
  nom: string
  code: string | null
}

function jsonResponse<T>(body: T, status = 200): Response {
  return Response.json(body, { status })
}

function normalizeLookupKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[’`´]/g, "'")
}

function sanitizeCandidateValue(value: string | null | undefined): string | null {
  return sanitizeEmployeeTextValue(value)
}

function getServerEnv(): ExtractionEnv {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const supabaseAnonKey =
    process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const azureEndpoint = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT
  const azureApiKey = process.env.AZURE_DOCUMENT_INTELLIGENCE_API_KEY

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    throw new Error(
      'Supabase server configuration is incomplete. Set SUPABASE_SERVICE_ROLE_KEY and the project URL/anon key variables.',
    )
  }

  if (!azureEndpoint || !azureApiKey) {
    throw new Error(
      'Azure Document Intelligence is not configured. Set AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT and AZURE_DOCUMENT_INTELLIGENCE_API_KEY.',
    )
  }

  return {
    supabaseUrl,
    supabaseAnonKey,
    supabaseServiceRoleKey,
    azureEndpoint: azureEndpoint.replace(/\/+$/, ''),
    azureApiKey,
    azureModelId: AZURE_DOCUMENT_INTELLIGENCE_MODEL_ID,
  }
}

function extractBearerToken(request: Request): string | null {
  const authorizationHeader = request.headers.get('authorization')

  if (!authorizationHeader) {
    return null
  }

  const [scheme, token] = authorizationHeader.split(' ')
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return null
  }

  return token
}

async function authenticateAdminRequest(
  request: Request,
  env: ExtractionEnv,
): Promise<{ userId: string }> {
  const token = extractBearerToken(request)

  if (!token) {
    throw new Response('Unauthorized. Missing bearer token.', { status: 401 })
  }

  const authClient = createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const { data: authData, error: authError } = await authClient.auth.getUser(token)

  if (authError || !authData.user?.id) {
    throw new Response('Unauthorized. Invalid session token.', { status: 401 })
  }

  const adminClient = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const { data: roleData, error: roleError } = await adminClient
    .from('ProfilUtilisateur')
    .select('role')
    .eq('user_id', authData.user.id)
    .eq('role', ADMIN_ROLE)
    .limit(1)
    .maybeSingle<{ role: string | null }>()

  if (roleError) {
    console.error('Failed to verify OCR import role', roleError)
    throw new Response('Unable to verify role permissions.', { status: 500 })
  }

  if (!roleData?.role) {
    throw new Response('Forbidden. Admin RH role required.', { status: 403 })
  }

  return { userId: authData.user.id }
}

function isSupportedMimeType(mimeType: string): mimeType is (typeof EMPLOYEE_DOSSIER_MIME_TYPES)[number] {
  return EMPLOYEE_DOSSIER_MIME_TYPES.includes(
    mimeType as (typeof EMPLOYEE_DOSSIER_MIME_TYPES)[number],
  )
}

async function parseUpload(request: Request): Promise<File> {
  const formData = await request.formData()
  const uploadedFile = formData.get('file')

  if (!(uploadedFile instanceof File)) {
    throw new Response('A dossier file is required.', { status: 400 })
  }

  if (!isSupportedMimeType(uploadedFile.type)) {
    throw new Response('Unsupported file type. Upload a PDF, JPG, JPEG, or PNG dossier.', {
      status: 415,
    })
  }

  if (uploadedFile.size <= 0) {
    throw new Response('Uploaded file is empty.', { status: 400 })
  }

  if (uploadedFile.size > EMPLOYEE_DOSSIER_MAX_FILE_SIZE_BYTES) {
    throw new Response(
      `Uploaded file is too large. Maximum supported size is ${Math.floor(EMPLOYEE_DOSSIER_MAX_FILE_SIZE_BYTES / (1024 * 1024))} MB.`,
      { status: 413 },
    )
  }

  return uploadedFile
}

async function submitAzureAnalyzeRequest(
  file: File,
  env: ExtractionEnv,
): Promise<string> {
  const analyzeUrl = new URL(
    `${env.azureEndpoint}/documentintelligence/documentModels/${env.azureModelId}:analyze`,
  )
  analyzeUrl.searchParams.set('api-version', AZURE_DOCUMENT_INTELLIGENCE_API_VERSION)
  analyzeUrl.searchParams.set('features', AZURE_DOCUMENT_INTELLIGENCE_FEATURES)

  const response = await fetch(analyzeUrl, {
    method: 'POST',
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
      'Ocp-Apim-Subscription-Key': env.azureApiKey,
    },
    body: await file.arrayBuffer(),
  })

  if (!response.ok) {
    const message = await response.text().catch(() => '')
    console.error('Azure analyze submit failed', response.status)
    throw new Response(
      message || 'Document extraction provider rejected the uploaded dossier.',
      { status: 502 },
    )
  }

  const operationLocation = response.headers.get('operation-location')
  if (!operationLocation) {
    console.error('Azure analyze submit missing operation-location header')
    throw new Response('Document extraction provider returned an invalid response.', {
      status: 502,
    })
  }

  return operationLocation
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function pollAzureAnalyzeResult(
  operationLocation: string,
  env: ExtractionEnv,
): Promise<AzureAnalyzeResult> {
  const startedAt = Date.now()

  while (Date.now() - startedAt < ANALYZE_POLL_TIMEOUT_MS) {
    const response = await fetch(operationLocation, {
      headers: {
        'Ocp-Apim-Subscription-Key': env.azureApiKey,
      },
    })

    if (!response.ok) {
      const message = await response.text().catch(() => '')
      console.error('Azure analyze poll failed', response.status)
      throw new Response(
        message || 'Document extraction provider failed while processing the dossier.',
        { status: 502 },
      )
    }

    const result = (await response.json()) as AzureAnalyzeResult
    const status = result.status?.toLowerCase()

    if (status === 'succeeded') {
      return result
    }

    if (status === 'failed') {
      const errorMessage = result.error?.message?.trim()
      console.error('Azure analyze reported failure')
      throw new Response(
        errorMessage || 'Document extraction provider could not read the uploaded dossier.',
        { status: 502 },
      )
    }

    await delay(ANALYZE_POLL_INTERVAL_MS)
  }

  throw new Response('Document extraction timed out. Try again with a clearer dossier.', {
    status: 504,
  })
}

function collectKeyValueCandidates(
  analyzeResult: AzureAnalyzeResult['analyzeResult'],
): CandidateFieldValue[] {
  return (analyzeResult?.keyValuePairs ?? [])
    .map((pair) => ({
      keyContent: sanitizeCandidateValue(pair.key?.content ?? null),
      valueContent: sanitizeCandidateValue(pair.value?.content ?? null),
      confidence:
        typeof pair.confidence === 'number' && Number.isFinite(pair.confidence)
          ? Math.max(0, Math.min(pair.confidence, 1))
          : null,
    }))
    .filter((pair) => pair.keyContent && pair.valueContent)
}

function scoreAliasMatch(key: string, alias: string): number {
  const normalizedKey = normalizeLookupKey(key)
  const normalizedAlias = normalizeLookupKey(alias)

  if (normalizedKey === normalizedAlias) {
    return 100
  }

  if (normalizedKey.startsWith(`${normalizedAlias} `) || normalizedKey.endsWith(` ${normalizedAlias}`)) {
    return 90
  }

  if (normalizedKey.includes(normalizedAlias)) {
    return 80
  }

  if (normalizedAlias.includes(normalizedKey)) {
    return 60
  }

  return 0
}

function findBestCandidate(
  fieldKey: EmployeeDossierSourceFieldKey,
  candidates: CandidateFieldValue[],
): CandidateFieldValue | null {
  const aliases = FIELD_ALIASES[fieldKey]
  let bestMatch: { candidate: CandidateFieldValue; score: number } | null = null

  for (const candidate of candidates) {
    if (!candidate.keyContent || !candidate.valueContent) {
      continue
    }

    let bestAliasScore = 0
    for (const alias of aliases) {
      bestAliasScore = Math.max(bestAliasScore, scoreAliasMatch(candidate.keyContent, alias))
    }

    if (bestAliasScore === 0) {
      continue
    }

    if (
      !bestMatch ||
      bestAliasScore > bestMatch.score ||
      (bestAliasScore === bestMatch.score &&
        (candidate.confidence ?? 0) > (bestMatch.candidate.confidence ?? 0))
    ) {
      bestMatch = {
        candidate,
        score: bestAliasScore,
      }
    }
  }

  return bestMatch?.candidate ?? null
}

function findContentFallback(
  fieldKey: EmployeeDossierSourceFieldKey,
  content: string,
): CandidateFieldValue | null {
  if (!content) {
    return null
  }

  if (fieldKey === 'email') {
    const emailMatch = content.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
    return emailMatch
      ? {
          keyContent: 'email',
          valueContent: emailMatch[0],
          confidence: 0.45,
        }
      : null
  }

  if (fieldKey === 'telephone') {
    const phoneMatch = content.match(/(?:\+?213|0)[\s.-]*[567](?:[\s.-]*\d){8}/)
    return phoneMatch
      ? {
          keyContent: 'telephone',
          valueContent: phoneMatch[0],
          confidence: 0.4,
        }
      : null
  }

  if (fieldKey === 'matricule') {
    const matriculeMatch = content.match(/[A-Z]{2,6}-\d{3,8}/i)
    return matriculeMatch
      ? {
          keyContent: 'matricule',
          valueContent: matriculeMatch[0].toUpperCase(),
          confidence: 0.35,
        }
      : null
  }

  return null
}

function normalizeDateValue(value: string | null | undefined): string | null {
  const sanitizedValue = sanitizeCandidateValue(value)

  if (!sanitizedValue) {
    return null
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(sanitizedValue)) {
    return sanitizedValue
  }

  const match = sanitizedValue.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/)
  if (!match) {
    return null
  }

  const day = match[1].padStart(2, '0')
  const month = match[2].padStart(2, '0')
  const year = match[3]
  const isoDate = `${year}-${month}-${day}`
  const parsed = new Date(`${isoDate}T00:00:00Z`)

  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return isoDate
}

function normalizePhoneValue(value: string | null | undefined): string | null {
  const sanitizedValue = sanitizeCandidateValue(value)

  if (!sanitizedValue) {
    return null
  }

  let compactValue = sanitizedValue.replace(/[^\d+]/g, '')

  if (compactValue.startsWith('00')) {
    compactValue = `+${compactValue.slice(2)}`
  }

  if (!compactValue.startsWith('+') && compactValue.startsWith('213')) {
    compactValue = `+${compactValue}`
  }

  if (!compactValue.startsWith('+') && /^0[567]\d{8}$/.test(compactValue)) {
    compactValue = `+213${compactValue.slice(1)}`
  }

  if (/^\+213[567]\d{8}$/.test(compactValue)) {
    return compactValue
  }

  return null
}

function normalizeEmailValue(value: string | null | undefined): string | null {
  const sanitizedValue = sanitizeCandidateValue(value)?.toLowerCase() ?? null

  if (!sanitizedValue) {
    return null
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sanitizedValue) ? sanitizedValue : null
}

function normalizeIntegerString(value: string | null | undefined): string | null {
  const sanitizedValue = sanitizeCandidateValue(value)

  if (!sanitizedValue) {
    return null
  }

  const digitMatch = sanitizedValue.match(/\d+/)
  return digitMatch ? digitMatch[0] : null
}

function normalizeSimpleText(value: string | null | undefined): string | null {
  return sanitizeCandidateValue(value)
}

function matchDepartmentId(
  value: string | null | undefined,
  departments: DepartmentRow[],
): { departmentId: string | null; displayValue: string | null } {
  const sanitizedValue = sanitizeCandidateValue(value)

  if (!sanitizedValue) {
    return { departmentId: null, displayValue: null }
  }

  const normalizedValue = normalizeLookupKey(sanitizedValue)

  const matchedDepartment = departments.find((department) => {
    const candidates = [
      department.nom,
      department.code ?? '',
      getDepartmentDisplayName(department.nom) ?? '',
    ]

    return candidates.some((candidate) => {
      const normalizedCandidate = normalizeLookupKey(candidate)
      return (
        normalizedCandidate === normalizedValue ||
        normalizedCandidate.includes(normalizedValue) ||
        normalizedValue.includes(normalizedCandidate)
      )
    })
  })

  if (!matchedDepartment) {
    return { departmentId: null, displayValue: null }
  }

  return {
    departmentId: matchedDepartment.id,
    displayValue: getDepartmentDisplayName(matchedDepartment.nom) ?? matchedDepartment.nom,
  }
}

async function listDepartments(env: ExtractionEnv): Promise<DepartmentRow[]> {
  const adminClient = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const { data, error } = await adminClient
    .from('Departement')
    .select('id, nom, code')
    .returns<DepartmentRow[]>()

  if (error) {
    console.error('Failed to load departments for OCR import', error)
    throw new Response('Unable to prepare department mapping for dossier import.', {
      status: 500,
    })
  }

  return data ?? []
}

function buildMissingFieldResult(
  fieldKey: EmployeeDossierSourceFieldKey,
): EmployeeDossierFieldResult {
  return {
    key: fieldKey,
    label: EMPLOYEE_DOSSIER_FIELD_LABELS[fieldKey],
    extractedValue: null,
    normalizedValue: null,
    confidence: null,
    status: 'missing',
    mappedFormField: null,
  }
}

function buildMappedFieldResult(args: {
  fieldKey: EmployeeDossierSourceFieldKey
  candidate: CandidateFieldValue
  normalizedValue: string | null
  mappedFormField: EmployeeDossierFormFieldKey | null
}): EmployeeDossierFieldResult {
  const confidence = args.candidate.confidence
  const status: EmployeeDossierFieldResult['status'] = !args.normalizedValue
    ? 'unmapped'
    : confidence !== null && confidence < EMPLOYEE_DOSSIER_LOW_CONFIDENCE_THRESHOLD
      ? 'low_confidence'
      : 'imported'

  return {
    key: args.fieldKey,
    label: EMPLOYEE_DOSSIER_FIELD_LABELS[args.fieldKey],
    extractedValue: args.candidate.valueContent,
    normalizedValue: args.normalizedValue,
    confidence,
    status,
    mappedFormField: args.normalizedValue ? args.mappedFormField : null,
  }
}

function dedupeWarnings(warnings: string[]): string[] {
  return [...new Set(warnings.filter((warning) => warning.trim().length > 0))]
}

function finalizeDraftValue(
  draft: EmployeeDossierDraft,
  fieldKey: EmployeeDossierFormFieldKey,
  value: string | null,
): void {
  if (!value) {
    return
  }

  draft[fieldKey] = value
}

function mapCandidateToDraft(
  fieldKey: EmployeeDossierSourceFieldKey,
  candidate: CandidateFieldValue | null,
  draft: EmployeeDossierDraft,
  departments: DepartmentRow[],
  warnings: string[],
): EmployeeDossierFieldResult {
  if (!candidate?.valueContent) {
    return buildMissingFieldResult(fieldKey)
  }

  switch (fieldKey) {
    case 'matricule': {
      const normalizedValue = normalizeSimpleText(candidate.valueContent)?.toUpperCase() ?? null
      finalizeDraftValue(draft, 'matricule', normalizedValue)
      return buildMappedFieldResult({
        fieldKey,
        candidate,
        normalizedValue,
        mappedFormField: 'matricule',
      })
    }

    case 'nom': {
      const normalizedValue = normalizeSimpleText(candidate.valueContent)
      finalizeDraftValue(draft, 'nom', normalizedValue)
      return buildMappedFieldResult({
        fieldKey,
        candidate,
        normalizedValue,
        mappedFormField: 'nom',
      })
    }

    case 'prenom': {
      const normalizedValue = normalizeSimpleText(candidate.valueContent)
      finalizeDraftValue(draft, 'prenom', normalizedValue)
      return buildMappedFieldResult({
        fieldKey,
        candidate,
        normalizedValue,
        mappedFormField: 'prenom',
      })
    }

    case 'sexe': {
      const normalizedValue = resolveEmployeeSexeValue(candidate.valueContent)
      if (!normalizedValue) {
        warnings.push('Sex was extracted but could not be matched to the existing form options.')
      }

      finalizeDraftValue(draft, 'sexe', normalizedValue)
      return buildMappedFieldResult({
        fieldKey,
        candidate,
        normalizedValue,
        mappedFormField: 'sexe',
      })
    }

    case 'dateNaissance': {
      const normalizedValue = normalizeDateValue(candidate.valueContent)
      if (!normalizedValue) {
        warnings.push('Birth date was extracted but could not be normalized to YYYY-MM-DD.')
      }

      finalizeDraftValue(draft, 'dateNaissance', normalizedValue)
      return buildMappedFieldResult({
        fieldKey,
        candidate,
        normalizedValue,
        mappedFormField: 'dateNaissance',
      })
    }

    case 'lieuNaissance': {
      const normalizedValue = normalizeSimpleText(candidate.valueContent)
      finalizeDraftValue(draft, 'lieuNaissance', normalizedValue)
      return buildMappedFieldResult({
        fieldKey,
        candidate,
        normalizedValue,
        mappedFormField: 'lieuNaissance',
      })
    }

    case 'nationalite': {
      const normalizedValue = resolveEmployeeNationaliteValue(candidate.valueContent)
      if (!normalizedValue) {
        warnings.push('Nationality was extracted but could not be matched to the existing form options.')
      }

      finalizeDraftValue(draft, 'nationalite', normalizedValue)
      return buildMappedFieldResult({
        fieldKey,
        candidate,
        normalizedValue,
        mappedFormField: 'nationalite',
      })
    }

    case 'situationFamiliale': {
      const normalizedValue = resolveEmployeeSituationFamilialeValue(candidate.valueContent)
      if (!normalizedValue) {
        warnings.push('Marital status was extracted but could not be matched to the existing form options.')
      }

      finalizeDraftValue(draft, 'situationFamiliale', normalizedValue)
      return buildMappedFieldResult({
        fieldKey,
        candidate,
        normalizedValue,
        mappedFormField: 'situationFamiliale',
      })
    }

    case 'nombreEnfants': {
      const normalizedValue = normalizeIntegerString(candidate.valueContent)
      finalizeDraftValue(draft, 'nombreEnfants', normalizedValue)
      return buildMappedFieldResult({
        fieldKey,
        candidate,
        normalizedValue,
        mappedFormField: 'nombreEnfants',
      })
    }

    case 'adresse': {
      const normalizedValue = normalizeSimpleText(candidate.valueContent)
      finalizeDraftValue(draft, 'adresse', normalizedValue)
      return buildMappedFieldResult({
        fieldKey,
        candidate,
        normalizedValue,
        mappedFormField: 'adresse',
      })
    }

    case 'telephone': {
      const normalizedValue = normalizePhoneValue(candidate.valueContent)
      if (!normalizedValue) {
        warnings.push('Phone number was extracted but could not be normalized to the required +213 format.')
      }

      finalizeDraftValue(draft, 'telephone', normalizedValue)
      return buildMappedFieldResult({
        fieldKey,
        candidate,
        normalizedValue,
        mappedFormField: 'telephone',
      })
    }

    case 'email': {
      const normalizedValue = normalizeEmailValue(candidate.valueContent)
      if (!normalizedValue) {
        warnings.push('Email was extracted but could not be validated.')
      }

      finalizeDraftValue(draft, 'email', normalizedValue)
      return buildMappedFieldResult({
        fieldKey,
        candidate,
        normalizedValue,
        mappedFormField: 'email',
      })
    }

    case 'departement': {
      const departmentMatch = matchDepartmentId(candidate.valueContent, departments)
      if (!departmentMatch.departmentId) {
        warnings.push('Department was extracted but could not be matched to an existing department record.')
      }

      finalizeDraftValue(draft, 'departementId', departmentMatch.departmentId)
      return buildMappedFieldResult({
        fieldKey,
        candidate,
        normalizedValue: departmentMatch.displayValue,
        mappedFormField: 'departementId',
      })
    }

    case 'service': {
      warnings.push('Service was extracted for review but is not stored in the current employee create form.')
      return buildMappedFieldResult({
        fieldKey,
        candidate,
        normalizedValue: null,
        mappedFormField: null,
      })
    }

    case 'fonction': {
      const normalizedValue = resolveEmployeePosteValue(candidate.valueContent)
      if (!normalizedValue) {
        warnings.push('Function / job title was extracted but could not be matched to the current job-title options.')
      }

      finalizeDraftValue(draft, 'poste', normalizedValue)
      return buildMappedFieldResult({
        fieldKey,
        candidate,
        normalizedValue,
        mappedFormField: 'poste',
      })
    }

    case 'categorieProfessionnelle': {
      const normalizedValue = resolveEmployeeCategorieProfessionnelleValue(
        candidate.valueContent,
      )
      if (!normalizedValue) {
        warnings.push('Professional category was extracted but could not be matched to the current form options.')
      }

      finalizeDraftValue(draft, 'categorieProfessionnelle', normalizedValue)
      return buildMappedFieldResult({
        fieldKey,
        candidate,
        normalizedValue,
        mappedFormField: 'categorieProfessionnelle',
      })
    }

    case 'typeContrat': {
      const normalizedValue = resolveEmployeeTypeContratValue(candidate.valueContent)
      if (!normalizedValue) {
        warnings.push('Contract type was extracted but could not be matched to the current form options.')
      }

      finalizeDraftValue(draft, 'typeContrat', normalizedValue)
      return buildMappedFieldResult({
        fieldKey,
        candidate,
        normalizedValue,
        mappedFormField: 'typeContrat',
      })
    }

    case 'dateRecrutement': {
      const normalizedValue = normalizeDateValue(candidate.valueContent)
      if (!normalizedValue) {
        warnings.push('Hire date was extracted but could not be normalized to YYYY-MM-DD.')
      }

      finalizeDraftValue(draft, 'dateRecrutement', normalizedValue)
      return buildMappedFieldResult({
        fieldKey,
        candidate,
        normalizedValue,
        mappedFormField: 'dateRecrutement',
      })
    }

    case 'numeroSecuriteSociale': {
      const normalizedValue = normalizeSimpleText(candidate.valueContent)
      finalizeDraftValue(draft, 'numeroSecuriteSociale', normalizedValue)
      return buildMappedFieldResult({
        fieldKey,
        candidate,
        normalizedValue,
        mappedFormField: 'numeroSecuriteSociale',
      })
    }

    case 'diplome': {
      const normalizedValue = resolveEmployeeDiplomeValue(candidate.valueContent)
      if (!normalizedValue) {
        warnings.push('Degree / diploma was extracted but could not be matched to the current form options.')
      }

      finalizeDraftValue(draft, 'diplome', normalizedValue)
      return buildMappedFieldResult({
        fieldKey,
        candidate,
        normalizedValue,
        mappedFormField: 'diplome',
      })
    }

    case 'specialite': {
      const normalizedValue = resolveEmployeeSpecialiteValue(candidate.valueContent)
      if (!normalizedValue) {
        warnings.push('Specialization was extracted but could not be matched to the current form options.')
      }

      finalizeDraftValue(draft, 'specialite', normalizedValue)
      return buildMappedFieldResult({
        fieldKey,
        candidate,
        normalizedValue,
        mappedFormField: 'specialite',
      })
    }
  }
}

function buildExtractionResponse(
  analyzeResult: AzureAnalyzeResult,
  departments: DepartmentRow[],
): EmployeeDossierExtractionResponse {
  const draft: EmployeeDossierDraft = {}
  const warnings: string[] = []
  const candidates = collectKeyValueCandidates(analyzeResult.analyzeResult)
  const content = analyzeResult.analyzeResult?.content ?? ''

  const fields = Object.fromEntries(
    EMPLOYEE_DOSSIER_SOURCE_FIELD_KEYS.map((fieldKey) => {
      const bestCandidate =
        findBestCandidate(fieldKey, candidates) ?? findContentFallback(fieldKey, content)

      return [fieldKey, mapCandidateToDraft(fieldKey, bestCandidate, draft, departments, warnings)]
    }),
  ) as Record<EmployeeDossierSourceFieldKey, EmployeeDossierFieldResult>

  const importedFieldCount = Object.values(fields).filter(
    (field) => field.status === 'imported' || field.status === 'low_confidence',
  ).length

  if (importedFieldCount === 0) {
    warnings.push('No supported employee fields could be safely extracted from this dossier. Continue with manual entry.')
  }

  return {
    provider: 'azure-document-intelligence',
    modelId: AZURE_DOCUMENT_INTELLIGENCE_MODEL_ID,
    extractedAt: new Date().toISOString(),
    draft,
    fields,
    warnings: dedupeWarnings(warnings),
  }
}

export async function handleEmployeeDossierExtractRequest(
  request: Request,
): Promise<Response> {
  try {
    if (request.method !== 'POST') {
      return new Response('Method not allowed.', {
        status: 405,
        headers: {
          Allow: 'POST',
        },
      })
    }

    const env = getServerEnv()
    await authenticateAdminRequest(request, env)
    const uploadedFile = await parseUpload(request)
    const departments = await listDepartments(env)
    const operationLocation = await submitAzureAnalyzeRequest(uploadedFile, env)
    const analyzeResult = await pollAzureAnalyzeResult(operationLocation, env)
    const response = buildExtractionResponse(analyzeResult, departments)

    return jsonResponse(response)
  } catch (error) {
    if (error instanceof Response) {
      return error
    }

    console.error('Employee dossier extract endpoint failed', error)
    return jsonResponse(
      {
        error: 'Employee dossier extraction failed unexpectedly. Continue with manual entry.',
      },
      500,
    )
  }
}

