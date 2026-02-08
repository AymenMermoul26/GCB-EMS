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
