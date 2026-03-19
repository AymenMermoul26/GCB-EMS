import { APP_ROLES } from '@/constants/roles'

import { RoleRoute } from '@/components/guards/role-route'

export function PayrollRoute() {
  return (
    <RoleRoute
      allowedRoles={[APP_ROLES.PAYROLL_AGENT]}
      loadingLabel="Authorizing payroll access..."
    />
  )
}
