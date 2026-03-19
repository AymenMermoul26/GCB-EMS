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
  const isPayrollAgent = role === APP_ROLES.PAYROLL_AGENT
  const isOnSecurityPage = location.pathname === ROUTES.EMPLOYEE_SECURITY
  const isOnPayrollSecurityPage = location.pathname === ROUTES.PAYROLL_SECURITY

  if (isEmployee && mustChangePassword && !isOnSecurityPage) {
    return (
      <Navigate
        to={ROUTES.EMPLOYEE_SECURITY}
        replace
        state={{ from: location }}
      />
    )
  }

  if (isPayrollAgent && mustChangePassword && !isOnPayrollSecurityPage) {
    return (
      <Navigate
        to={ROUTES.PAYROLL_SECURITY}
        replace
        state={{ from: location }}
      />
    )
  }

  return <Outlet />
}
