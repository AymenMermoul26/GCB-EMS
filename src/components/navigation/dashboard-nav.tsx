import { NavLink } from 'react-router-dom'

import { APP_ROLES, type AppRole } from '@/constants/roles'
import { ROUTES } from '@/constants/routes'
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
  if (role === APP_ROLES.ADMIN_RH) {
    return (
      <nav className="flex items-center gap-2">
        <NavLink to={ROUTES.ADMIN_EMPLOYEES} className={linkClassName}>
          Employees
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
