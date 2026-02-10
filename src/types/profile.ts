import type { AppRole } from '@/constants/roles'

export interface ProfilUtilisateur {
  id: string
  userId: string
  employeId: string
  role: AppRole
  createdAt: string
  updatedAt: string
}

export type PublicProfile = Record<string, string | number | boolean | null>

export type PublicProfileStatus = 'valid' | 'invalid_or_revoked' | 'expired'

export interface PublicProfileResult {
  status: PublicProfileStatus
  profile: PublicProfile | null
}
