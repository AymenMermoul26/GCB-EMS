export type TestRole = 'admin' | 'payroll' | 'employee'

export interface RoleCredentials {
  email: string
  password: string
}

interface RoleUserConfig {
  envEmailKey: string
  envPasswordKey: string
}

const ROLE_USERS: Record<TestRole, RoleUserConfig> = {
  admin: {
    envEmailKey: 'E2E_ADMIN_EMAIL',
    envPasswordKey: 'E2E_ADMIN_PASSWORD',
  },
  payroll: {
    envEmailKey: 'E2E_PAYROLL_EMAIL',
    envPasswordKey: 'E2E_PAYROLL_PASSWORD',
  },
  employee: {
    envEmailKey: 'E2E_EMPLOYEE_EMAIL',
    envPasswordKey: 'E2E_EMPLOYEE_PASSWORD',
  },
}

export function hasRoleCredentials(role: TestRole): boolean {
  const config = ROLE_USERS[role]
  return Boolean(process.env[config.envEmailKey] && process.env[config.envPasswordKey])
}

export function getRoleCredentials(role: TestRole): RoleCredentials {
  const config = ROLE_USERS[role]
  const email = process.env[config.envEmailKey]
  const password = process.env[config.envPasswordKey]

  if (!email || !password) {
    throw new Error(
      `Missing E2E credentials for ${role}. Set ${config.envEmailKey} and ${config.envPasswordKey}.`,
    )
  }

  return { email, password }
}
