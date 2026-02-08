export type DemandeStatut = 'EN_ATTENTE' | 'ACCEPTEE' | 'REJETEE'

export interface ModificationRequest {
  id: string
  employeId: string
  demandeurUserId: string | null
  champCible: string
  ancienneValeur: string | null
  nouvelleValeur: string | null
  motif: string | null
  statutDemande: DemandeStatut
  traiteParUserId: string | null
  traiteAt: string | null
  commentaireTraitement: string | null
  createdAt: string
  updatedAt: string
}

export interface SubmitModificationRequestPayload {
  employeId: string
  champCible: string
  ancienneValeur?: string | null
  nouvelleValeur?: string | null
  motif?: string | null
}

export interface ListRequestsForAdminParams {
  statut?: DemandeStatut
  employeId?: string
  page?: number
  pageSize?: number
}

export interface RequestsListResponse {
  items: ModificationRequest[]
  total: number
  page: number
  pageSize: number
}
