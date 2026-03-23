export const ROUTES = {
  ROOT: '/',
  LOGIN: '/login',
  FORBIDDEN: '/forbidden',
  SERVER_ERROR: '/error',
  ADMIN: '/admin',
  ADMIN_DASHBOARD: '/admin/dashboard',
  ADMIN_MONITORING: '/admin/monitoring',
  ADMIN_EMPLOYEES: '/admin/employees',
  ADMIN_EMPLOYEES_NEW: '/admin/employees/new',
  ADMIN_DEPARTMENTS: '/admin/departments',
  ADMIN_REQUESTS: '/admin/requests',
  ADMIN_AUDIT: '/admin/audit',
  PAYROLL: '/payroll',
  PAYROLL_DASHBOARD: '/payroll/dashboard',
  PAYROLL_PROCESSING: '/payroll/processing',
  PAYROLL_COMPENSATION: '/payroll/compensation',
  PAYROLL_RUNS: '/payroll/runs',
  PAYROLL_EMPLOYEES: '/payroll/employees',
  PAYROLL_PAYSLIP_REQUESTS: '/payroll/payslip-requests',
  PAYROLL_EXPORTS: '/payroll/exports',
  PAYROLL_NOTIFICATIONS: '/payroll/notifications',
  PAYROLL_SECURITY: '/payroll/security',
  EMPLOYEE: '/employee',
  EMPLOYEE_PROFILE: '/employee/profile',
  EMPLOYEE_PROFILE_MANAGE: '/employee/profile/manage',
  EMPLOYEE_MY_QR: '/employee/my-qr',
  EMPLOYEE_REQUESTS: '/employee/requests',
  EMPLOYEE_PAYSLIPS: '/employee/payslips',
  EMPLOYEE_SECURITY: '/employee/security',
  NOTIFICATIONS: '/notifications',
  PUBLIC_PROFILE_BASE: '/p',
} as const

export const getPublicProfileRoute = (token: string) =>
  `${ROUTES.PUBLIC_PROFILE_BASE}/${token}`

export const getAdminEmployeeRoute = (employeeId: string) =>
  `${ROUTES.ADMIN_EMPLOYEES}/${employeeId}`

export const getPayrollEmployeeRoute = (employeeId: string) =>
  `${ROUTES.PAYROLL_EMPLOYEES}/${employeeId}`

export const getPayrollEmployeeSheetRoute = (employeeId: string) =>
  `${ROUTES.PAYROLL_EMPLOYEES}/${employeeId}/sheet`

export const getPayrollRunRoute = (runId: string) =>
  `${ROUTES.PAYROLL_RUNS}/${runId}`
