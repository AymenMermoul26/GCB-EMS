import { APP_ROLES } from '@/constants/roles'
import { RoleRoute } from '@/components/guards/role-route'

export function EmployeeRoute() {
  return (
    <RoleRoute
      allowedRoles={[APP_ROLES.EMPLOYE]}
      loadingLabel="Authorizing employee access..."
    />
  )
}
