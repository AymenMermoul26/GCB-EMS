import { Navigate, Outlet } from 'react-router-dom'

import { FullScreenLoader } from '@/components/common/full-screen-loader'
import { APP_ROLES } from '@/constants/roles'
import { ROUTES } from '@/constants/routes'
import { useAuth } from '@/hooks/use-auth'

export function AdminRoute() {
  const { isAuthenticated, isLoading, role } = useAuth()

  if (isLoading) {
    return <FullScreenLoader label="Authorizing admin access..." />
  }

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} replace />
  }

  if (!role) {
    return <Navigate to={ROUTES.LOGIN} replace />
  }

  if (role !== APP_ROLES.ADMIN_RH) {
    return <Navigate to={ROUTES.EMPLOYEE_PROFILE} replace />
  }

  return <Outlet />
}
