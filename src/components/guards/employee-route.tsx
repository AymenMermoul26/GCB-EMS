import { Navigate, Outlet } from 'react-router-dom'

import { FullScreenLoader } from '@/components/common/full-screen-loader'
import { APP_ROLES } from '@/constants/roles'
import { ROUTES } from '@/constants/routes'
import { useAuth } from '@/hooks/use-auth'

export function EmployeeRoute() {
  const { isAuthenticated, isLoading, role } = useAuth()

  if (isLoading) {
    return <FullScreenLoader label="Authorizing employee access..." />
  }

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} replace />
  }

  if (!role) {
    return <Navigate to={ROUTES.LOGIN} replace />
  }

  if (role !== APP_ROLES.EMPLOYE) {
    return <Navigate to={ROUTES.ADMIN_EMPLOYEES} replace />
  }

  return <Outlet />
}
