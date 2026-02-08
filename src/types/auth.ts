import type { Session, User } from '@supabase/supabase-js'

import type { AppRole } from '@/constants/roles'

export interface RoleInfo {
  role: AppRole
  employeId: string
}

export interface AuthState {
  session: Session | null
  user: User | null
  role: AppRole | null
  employeId: string | null
  isLoading: boolean
  isAuthenticated: boolean
}
