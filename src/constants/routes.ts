export const ROUTES = {
  ROOT: '/',
  LOGIN: '/login',
  ADMIN: '/admin',
  ADMIN_EMPLOYEES: '/admin/employees',
  EMPLOYEE: '/employee',
  EMPLOYEE_PROFILE: '/employee/profile',
  PUBLIC_PROFILE_BASE: '/p',
} as const

export const getPublicProfileRoute = (token: string) =>
  `${ROUTES.PUBLIC_PROFILE_BASE}/${token}`
