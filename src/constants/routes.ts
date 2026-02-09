export const ROUTES = {
  ROOT: '/',
  LOGIN: '/login',
  ADMIN: '/admin',
  ADMIN_EMPLOYEES: '/admin/employees',
  ADMIN_EMPLOYEES_NEW: '/admin/employees/new',
  ADMIN_REQUESTS: '/admin/requests',
  EMPLOYEE: '/employee',
  EMPLOYEE_PROFILE: '/employee/profile',
  PUBLIC_PROFILE_BASE: '/p',
} as const

export const getPublicProfileRoute = (token: string) =>
  `${ROUTES.PUBLIC_PROFILE_BASE}/${token}`

export const getAdminEmployeeRoute = (employeeId: string) =>
  `${ROUTES.ADMIN_EMPLOYEES}/${employeeId}`
