export type DemandeStatut = 'EN_ATTENTE' | 'ACCEPTEE' | 'REJETEE'

export type ModificationRequestFieldGroup =
  | 'identity'
  | 'contact'
  | 'personal'
  | 'organization'
  | 'education_career'

export type ModificationRequestFieldInputType =
  | 'text'
  | 'email'
  | 'tel'
  | 'url'
  | 'date'
  | 'number'
  | 'textarea'
  | 'select'

export type ModificationRequestField =
  | 'poste'
  | 'email'
  | 'telephone'
  | 'photo_url'
  | 'nom'
  | 'prenom'
  | 'regional_branch'
  | 'sexe'
  | 'date_naissance'
  | 'lieu_naissance'
  | 'nationalite'
  | 'situation_familiale'
  | 'nombre_enfants'
  | 'adresse'
  | 'diplome'
  | 'specialite'
  | 'universite'
  | 'historique_postes'

export interface ModificationRequest {
  id: string
  employeId: string
  demandeurUserId: string | null
  champCible: ModificationRequestField
  ancienneValeur: string | null
  nouvelleValeur: string | null
  motif: string | null
  statutDemande: DemandeStatut
  traiteParUserId: string | null
  traiteAt: string | null
  commentaireTraitement: string | null
  createdAt: string
  updatedAt: string
  employeNom?: string | null
  employePrenom?: string | null
  employeMatricule?: string | null
  employeDepartementId?: string | null
  employeDepartementNom?: string | null
}

export interface SubmitModificationRequestPayload {
  employeId: string
  champCible: ModificationRequestField
  ancienneValeur?: string | null
  nouvelleValeur?: string | null
  motif?: string | null
}

export interface ListMyRequestsParams {
  employeId: string
  page?: number
  pageSize?: number
}

export interface ListRequestsForAdminParams {
  statut?: DemandeStatut
  employeId?: string
  departementId?: string
  page?: number
  pageSize?: number
}

export interface RequestsListResponse {
  items: ModificationRequest[]
  total: number
  page: number
  pageSize: number
}

export interface RequestDecisionPayload {
  id: string
  comment?: string
}

export interface ModificationRequestFieldOption {
  key: ModificationRequestField
  label: string
  group: ModificationRequestFieldGroup
  inputType: ModificationRequestFieldInputType
}

export const MODIFICATION_REQUEST_FIELD_KEYS = [
  'poste',
  'email',
  'telephone',
  'photo_url',
  'nom',
  'prenom',
  'regional_branch',
  'sexe',
  'date_naissance',
  'lieu_naissance',
  'nationalite',
  'situation_familiale',
  'nombre_enfants',
  'adresse',
  'diplome',
  'specialite',
  'universite',
  'historique_postes',
] as const satisfies readonly ModificationRequestField[]

export function isModificationRequestField(value: string): value is ModificationRequestField {
  return MODIFICATION_REQUEST_FIELD_KEYS.includes(value as ModificationRequestField)
}

export const MODIFICATION_REQUEST_FIELD_OPTIONS: ModificationRequestFieldOption[] = [
  { key: 'nom', label: 'Last Name', group: 'identity', inputType: 'text' },
  { key: 'prenom', label: 'First Name', group: 'identity', inputType: 'text' },
  { key: 'sexe', label: 'Sex', group: 'identity', inputType: 'select' },
  { key: 'date_naissance', label: 'Birth Date', group: 'identity', inputType: 'date' },
  { key: 'lieu_naissance', label: 'Birth Place', group: 'identity', inputType: 'text' },
  { key: 'nationalite', label: 'Nationality', group: 'identity', inputType: 'select' },
  { key: 'email', label: 'Email', group: 'contact', inputType: 'email' },
  { key: 'telephone', label: 'Phone', group: 'contact', inputType: 'tel' },
  { key: 'photo_url', label: 'Photo URL', group: 'contact', inputType: 'url' },
  { key: 'adresse', label: 'Address', group: 'personal', inputType: 'text' },
  {
    key: 'situation_familiale',
    label: 'Marital Status',
    group: 'personal',
    inputType: 'select',
  },
  {
    key: 'nombre_enfants',
    label: 'Number of Children',
    group: 'personal',
    inputType: 'number',
  },
  {
    key: 'regional_branch',
    label: 'Regional Branch',
    group: 'organization',
    inputType: 'select',
  },
  { key: 'poste', label: 'Job Title', group: 'organization', inputType: 'select' },
  { key: 'diplome', label: 'Degree', group: 'education_career', inputType: 'select' },
  {
    key: 'specialite',
    label: 'Specialization',
    group: 'education_career',
    inputType: 'select',
  },
  { key: 'universite', label: 'University', group: 'education_career', inputType: 'select' },
  {
    key: 'historique_postes',
    label: 'Career History',
    group: 'education_career',
    inputType: 'textarea',
  },
]
