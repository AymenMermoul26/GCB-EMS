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
  const isOnEmployeeProfile = location.pathname.startsWith(ROUTES.EMPLOYEE_PROFILE)

  if (isEmployee && mustChangePassword && !isOnEmployeeProfile) {
    return <Navigate to={`${ROUTES.EMPLOYEE_PROFILE_MANAGE}#security`} replace />
  }

  return <Outlet />
}
