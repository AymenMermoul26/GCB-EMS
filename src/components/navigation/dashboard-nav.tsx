import { NavLink } from 'react-router-dom'

import { APP_ROLES, type AppRole } from '@/constants/roles'
import { ROUTES } from '@/constants/routes'
import { usePendingRequestsCountQuery } from '@/services/requestsService'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface DashboardNavProps {
  role: AppRole
}

const linkClassName = ({ isActive }: { isActive: boolean }) =>
  cn(
    'rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground',
    isActive && 'bg-accent text-accent-foreground',
  )

export function DashboardNav({ role }: DashboardNavProps) {
  const pendingRequestsCountQuery = usePendingRequestsCountQuery(role === APP_ROLES.ADMIN_RH)
  const pendingCount = pendingRequestsCountQuery.data ?? 0

  if (role === APP_ROLES.ADMIN_RH) {
    return (
      <nav className="flex items-center gap-2">
        <NavLink to={ROUTES.ADMIN_EMPLOYEES} className={linkClassName}>
          Employees
        </NavLink>
        <NavLink
          to={ROUTES.ADMIN_REQUESTS}
          className={({ isActive }) => cn(linkClassName({ isActive }), 'inline-flex items-center gap-2')}
        >
          Requests
          {pendingCount > 0 ? (
            <Badge className="border-transparent bg-red-600 text-white">{pendingCount}</Badge>
          ) : null}
        </NavLink>
      </nav>
    )
  }

  return (
    <nav className="flex items-center gap-2">
      <NavLink to={ROUTES.EMPLOYEE_PROFILE} className={linkClassName}>
        My Profile
      </NavLink>
    </nav>
  )
}
