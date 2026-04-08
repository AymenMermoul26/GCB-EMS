export const EMPLOYEE_DOSSIER_SOURCE_FIELD_KEYS = [
  'matricule',
  'nom',
  'prenom',
  'sexe',
  'dateNaissance',
  'lieuNaissance',
  'nationalite',
  'situationFamiliale',
  'nombreEnfants',
  'adresse',
  'telephone',
  'email',
  'departement',
  'service',
  'fonction',
  'categorieProfessionnelle',
  'typeContrat',
  'dateRecrutement',
  'numeroSecuriteSociale',
  'diplome',
  'specialite',
] as const

export type EmployeeDossierSourceFieldKey =
  (typeof EMPLOYEE_DOSSIER_SOURCE_FIELD_KEYS)[number]

export const EMPLOYEE_DOSSIER_FORM_FIELD_KEYS = [
  'matricule',
  'nom',
  'prenom',
  'sexe',
  'dateNaissance',
  'lieuNaissance',
  'nationalite',
  'situationFamiliale',
  'nombreEnfants',
  'adresse',
  'telephone',
  'email',
  'departementId',
  'poste',
  'categorieProfessionnelle',
  'typeContrat',
  'dateRecrutement',
  'numeroSecuriteSociale',
  'diplome',
  'specialite',
] as const

export type EmployeeDossierFormFieldKey =
  (typeof EMPLOYEE_DOSSIER_FORM_FIELD_KEYS)[number]

export type EmployeeDossierFieldStatus =
  | 'imported'
  | 'low_confidence'
  | 'missing'
  | 'unmapped'

export interface EmployeeDossierFieldResult {
  key: EmployeeDossierSourceFieldKey
  label: string
  extractedValue: string | null
  normalizedValue: string | null
  confidence: number | null
  status: EmployeeDossierFieldStatus
  mappedFormField: EmployeeDossierFormFieldKey | null
}

export type EmployeeDossierDraft = Partial<
  Record<EmployeeDossierFormFieldKey, string>
>

export interface EmployeeDossierExtractionResponse {
  provider: 'azure-document-intelligence'
  modelId: string
  extractedAt: string
  draft: EmployeeDossierDraft
  fields: Record<EmployeeDossierSourceFieldKey, EmployeeDossierFieldResult>
  warnings: string[]
}

export const EMPLOYEE_DOSSIER_FIELD_LABELS: Record<
  EmployeeDossierSourceFieldKey,
  string
> = {
  matricule: 'Employee ID',
  nom: 'Last Name',
  prenom: 'First Name',
  sexe: 'Sex',
  dateNaissance: 'Birth Date',
  lieuNaissance: 'Birth Place',
  nationalite: 'Nationality',
  situationFamiliale: 'Marital Status',
  nombreEnfants: 'Number of Children',
  adresse: 'Address',
  telephone: 'Phone',
  email: 'Email',
  departement: 'Department',
  service: 'Service',
  fonction: 'Function / Job Title',
  categorieProfessionnelle: 'Professional Category',
  typeContrat: 'Contract Type',
  dateRecrutement: 'Hire Date',
  numeroSecuriteSociale: 'Social Security Number',
  diplome: 'Degree / Diploma',
  specialite: 'Specialization',
}

export const EMPLOYEE_DOSSIER_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
] as const

export const EMPLOYEE_DOSSIER_ACCEPT_ATTRIBUTE =
  '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png'

export const EMPLOYEE_DOSSIER_MAX_FILE_SIZE_BYTES = 4 * 1024 * 1024
export const EMPLOYEE_DOSSIER_LOW_CONFIDENCE_THRESHOLD = 0.75

export function formatEmployeeDossierFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`
  }

  const kiloBytes = bytes / 1024
  if (kiloBytes < 1024) {
    return `${kiloBytes.toFixed(1)} KB`
  }

  return `${(kiloBytes / 1024).toFixed(1)} MB`
}

