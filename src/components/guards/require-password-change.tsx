import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { FullScreenLoader } from '@/components/common/full-screen-loader'
import { APP_ROLES } from '@/constants/roles'
import { ROUTES } from '@/constants/routes'
import { useAuth } from '@/hooks/use-auth'

export function RequirePasswordChange() {
  const { isLoading, role, mustChangePassword } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return <FullScreenLoader label="Applying security checks..." />
  }

  const isEmployee = role === APP_ROLES.EMPLOYE
  const isOnSecurityPage = location.pathname === ROUTES.EMPLOYEE_SECURITY

  if (isEmployee && mustChangePassword && !isOnSecurityPage) {
    return <Navigate to={ROUTES.EMPLOYEE_SECURITY} replace />
  }

  return <Outlet />
}
