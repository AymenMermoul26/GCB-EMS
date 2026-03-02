export const ROUTES = {
  ROOT: '/',
  LOGIN: '/login',
  ADMIN: '/admin',
  ADMIN_EMPLOYEES: '/admin/employees',
  ADMIN_EMPLOYEES_NEW: '/admin/employees/new',
  ADMIN_DEPARTMENTS: '/admin/departments',
  ADMIN_REQUESTS: '/admin/requests',
  ADMIN_AUDIT: '/admin/audit',
  EMPLOYEE: '/employee',
  EMPLOYEE_PROFILE: '/employee/profile',
  EMPLOYEE_PROFILE_MANAGE: '/employee/profile/manage',
  EMPLOYEE_MY_QR: '/employee/my-qr',
  EMPLOYEE_REQUESTS: '/employee/requests',
  EMPLOYEE_SECURITY: '/employee/security',
  NOTIFICATIONS: '/notifications',
  PUBLIC_PROFILE_BASE: '/p',
} as const

export const getPublicProfileRoute = (token: string) =>
  `${ROUTES.PUBLIC_PROFILE_BASE}/${token}`

export const getAdminEmployeeRoute = (employeeId: string) =>
  `${ROUTES.ADMIN_EMPLOYEES}/${employeeId}`
