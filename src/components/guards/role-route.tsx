import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { FullScreenLoader } from '@/components/common/full-screen-loader'
import type { AppRole } from '@/constants/roles'
import { ROUTES } from '@/constants/routes'
import { useAuth } from '@/hooks/use-auth'

interface RoleRouteProps {
  allowedRoles: AppRole[]
  loadingLabel: string
}

export function RoleRoute({ allowedRoles, loadingLabel }: RoleRouteProps) {
  const location = useLocation()
  const { isAuthenticated, isLoading, role } = useAuth()

  if (isLoading) {
    return <FullScreenLoader label={loadingLabel} />
  }

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} replace state={{ from: location }} />
  }

  if (!role) {
    return <Navigate to={ROUTES.LOGIN} replace />
  }

  if (!allowedRoles.includes(role)) {
    return <Navigate to={ROUTES.FORBIDDEN} replace state={{ from: location }} />
  }

  return <Outlet />
}
