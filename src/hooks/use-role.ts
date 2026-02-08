import { APP_ROLES } from '@/constants/roles'
import { useAuth } from '@/hooks/use-auth'

export function useRole() {
  const { role, employeId, isLoading } = useAuth()

  return {
    role,
    employeId,
    isLoading,
    isAdmin: role === APP_ROLES.ADMIN_RH,
    isEmployee: role === APP_ROLES.EMPLOYE,
  }
}
