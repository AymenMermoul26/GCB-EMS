export type TokenStatut = 'ACTIF' | 'REVOQUE'

export interface TokenQR {
  id: string
  employeId: string
  token: string
  statutToken: TokenStatut
  expiresAt: string | null
  createdAt: string
  updatedAt: string
}
