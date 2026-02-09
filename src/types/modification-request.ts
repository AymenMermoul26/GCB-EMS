export type DemandeStatut = 'EN_ATTENTE' | 'ACCEPTEE' | 'REJETEE'

export type ModificationRequestField =
  | 'poste'
  | 'email'
  | 'telephone'
  | 'photo_url'
  | 'nom'
  | 'prenom'

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

export const MODIFICATION_REQUEST_FIELD_OPTIONS: Array<{
  key: ModificationRequestField
  label: string
}> = [
  { key: 'poste', label: 'Poste' },
  { key: 'email', label: 'Email' },
  { key: 'telephone', label: 'Telephone' },
  { key: 'photo_url', label: 'Photo URL' },
  { key: 'nom', label: 'Nom' },
  { key: 'prenom', label: 'Prenom' },
]

