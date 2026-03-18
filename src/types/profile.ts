import type { AppRole } from '@/constants/roles'
import type { EmployeeVisibilityFieldKey } from '@/types/visibility'

export interface ProfilUtilisateur {
  id: string
  userId: string
  employeId: string
  role: AppRole
  createdAt: string
  updatedAt: string
}

export type PublicProfileFieldKey = EmployeeVisibilityFieldKey

export const PUBLIC_PROFILE_FIELD_KEYS: PublicProfileFieldKey[] = [
  'nom',
  'prenom',
  'poste',
  'email',
  'telephone',
  'photo_url',
  'departement',
  'matricule',
]

export interface PublicProfile {
  nom?: string | null
  prenom?: string | null
  poste?: string | null
  email?: string | null
  telephone?: string | null
  photo_url?: string | null
  departement?: string | null
  matricule?: string | null
}

export type PublicProfileStatus = 'valid' | 'invalid_or_revoked' | 'expired'

export interface PublicProfileResult {
  status: PublicProfileStatus
  profile: PublicProfile | null
}

export interface PublicProfileRpcResult {
  status: 'VALID' | 'INVALID_OR_REVOKED' | 'EXPIRED'
  profile: PublicProfile | null
}
