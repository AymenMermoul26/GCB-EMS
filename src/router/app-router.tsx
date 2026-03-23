import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { AppErrorBoundary } from '@/components/common/app-error-boundary'
import { AdminRoute } from '@/components/guards/admin-route'
import { EmployeeRoute } from '@/components/guards/employee-route'
import { FullScreenLoader } from '@/components/common/full-screen-loader'
import { PayrollRoute } from '@/components/guards/payroll-route'
import { ProtectedRoute } from '@/components/guards/protected-route'
import { RequirePasswordChange } from '@/components/guards/require-password-change'
import { RoleRoute } from '@/components/guards/role-route'
import { APP_ROLES } from '@/constants/roles'
import { ROUTES } from '@/constants/routes'
import { useAuth } from '@/hooks/use-auth'
import { AuditLogPage } from '@/pages/admin/AuditLogPage'
import { AdminDashboardPage } from '@/pages/admin/admin-dashboard-page'
import { AdminEmployeeCreatePage } from '@/pages/admin/admin-employee-create-page'
import { AdminEmployeeDetailPage } from '@/pages/admin/admin-employee-detail-page'
import { AdminMonitoringPage } from '@/pages/admin/admin-monitoring-page'
import { AdminRequestsPage } from '@/pages/admin/admin-requests-page'
import { EmployeesListPage } from '@/pages/admin/EmployeesList'
import { DepartmentsPage } from '@/pages/admin/DepartmentsPage'
import { LoginPage } from '@/pages/auth/login-page'
import { EmployeePayslipsPage } from '@/pages/employee/employee-payslips-page'
import { EmployeeProfileManagePage } from '@/pages/employee/employee-profile-manage-page'
import { EmployeeProfilePage } from '@/pages/employee/employee-profile-page'
import { EmployeeMyQrPage } from '@/pages/employee/employee-my-qr-page'
import { EmployeeRequestsPage } from '@/pages/employee/employee-requests-page'
import { EmployeeSecurityPage } from '@/pages/employee/employee-security-page'
import { ForbiddenPage } from '@/pages/forbidden-page'
import { NotFoundPage } from '@/pages/not-found-page'
import { NotificationsPage } from '@/pages/notifications-page'
import { PayrollDashboardPage } from '@/pages/payroll/payroll-dashboard-page'
import { PayrollCompensationPage } from '@/pages/payroll/payroll-compensation-page'
import { PayrollEmployeeDetailPage } from '@/pages/payroll/payroll-employee-detail-page'
import { PayrollEmployeesPage } from '@/pages/payroll/payroll-employees-page'
import { PayrollExportsPage } from '@/pages/payroll/payroll-exports-page'
import { PayrollNotificationsPage } from '@/pages/payroll/payroll-notifications-page'
import { PayrollEmployeeSheetPage } from '@/pages/payroll/payroll-employee-sheet-page'
import { PayrollProcessingPage } from '@/pages/payroll/payroll-processing-page'
import { PayrollPayslipRequestsPage } from '@/pages/payroll/payroll-payslip-requests-page'
import { PayrollRunDetailPage } from '@/pages/payroll/payroll-run-detail-page'
import { PayrollSecurityPage } from '@/pages/payroll/payroll-security-page'
import { PublicProfilePage } from '@/pages/public/public-profile-page'
import { ServerErrorPage } from '@/pages/server-error-page'

function HomeRedirect() {
  const { user, role, isLoading } = useAuth()

  if (isLoading) {
    return <FullScreenLoader label="Initializing..." />
  }

  if (!user) {
    return <Navigate to={ROUTES.LOGIN} replace />
  }

  if (!role) {
    return <Navigate to={ROUTES.LOGIN} replace />
  }

  if (role === APP_ROLES.ADMIN_RH) {
    return <Navigate to={ROUTES.ADMIN_DASHBOARD} replace />
  }

  if (role === APP_ROLES.PAYROLL_AGENT) {
    return <Navigate to={ROUTES.PAYROLL_DASHBOARD} replace />
  }

  return <Navigate to={ROUTES.EMPLOYEE_PROFILE} replace />
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <AppErrorBoundary>
        <Routes>
          <Route path={ROUTES.ROOT} element={<HomeRedirect />} />
          <Route path={ROUTES.LOGIN} element={<LoginPage />} />
          <Route path={ROUTES.FORBIDDEN} element={<ForbiddenPage />} />
          <Route path={ROUTES.SERVER_ERROR} element={<ServerErrorPage />} />
          <Route path={`${ROUTES.PUBLIC_PROFILE_BASE}/:token`} element={<PublicProfilePage />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<RequirePasswordChange />}>
              <Route element={<AdminRoute />}>
                <Route path={ROUTES.ADMIN} element={<Navigate to={ROUTES.ADMIN_DASHBOARD} replace />} />
                <Route path={ROUTES.ADMIN_DASHBOARD} element={<AdminDashboardPage />} />
                <Route path={ROUTES.ADMIN_MONITORING} element={<AdminMonitoringPage />} />
                <Route path={ROUTES.ADMIN_EMPLOYEES_NEW} element={<AdminEmployeeCreatePage />} />
                <Route path={`${ROUTES.ADMIN_EMPLOYEES}/:id`} element={<AdminEmployeeDetailPage />} />
                <Route path={ROUTES.ADMIN_EMPLOYEES} element={<EmployeesListPage />} />
                <Route path={ROUTES.ADMIN_DEPARTMENTS} element={<DepartmentsPage />} />
                <Route path={ROUTES.ADMIN_REQUESTS} element={<AdminRequestsPage />} />
                <Route path={ROUTES.ADMIN_AUDIT} element={<AuditLogPage />} />
              </Route>

              <Route element={<EmployeeRoute />}>
                <Route path={ROUTES.EMPLOYEE} element={<Navigate to={ROUTES.EMPLOYEE_PROFILE} replace />} />
                <Route path={ROUTES.EMPLOYEE_PROFILE} element={<EmployeeProfilePage />} />
                <Route path={ROUTES.EMPLOYEE_PROFILE_MANAGE} element={<EmployeeProfileManagePage />} />
                <Route path={ROUTES.EMPLOYEE_MY_QR} element={<EmployeeMyQrPage />} />
                <Route path={ROUTES.EMPLOYEE_REQUESTS} element={<EmployeeRequestsPage />} />
                <Route path={ROUTES.EMPLOYEE_PAYSLIPS} element={<EmployeePayslipsPage />} />
                <Route path={ROUTES.EMPLOYEE_SECURITY} element={<EmployeeSecurityPage />} />
              </Route>

              <Route element={<PayrollRoute />}>
                <Route path={ROUTES.PAYROLL} element={<Navigate to={ROUTES.PAYROLL_DASHBOARD} replace />} />
                <Route path={ROUTES.PAYROLL_DASHBOARD} element={<PayrollDashboardPage />} />
                <Route path={ROUTES.PAYROLL_COMPENSATION} element={<PayrollCompensationPage />} />
                <Route path={ROUTES.PAYROLL_PROCESSING} element={<PayrollProcessingPage />} />
                <Route path={ROUTES.PAYROLL_PAYSLIP_REQUESTS} element={<PayrollPayslipRequestsPage />} />
                <Route path={`${ROUTES.PAYROLL_RUNS}/:id`} element={<PayrollRunDetailPage />} />
                <Route path={`${ROUTES.PAYROLL_EMPLOYEES}/:id/sheet`} element={<PayrollEmployeeSheetPage />} />
                <Route path={`${ROUTES.PAYROLL_EMPLOYEES}/:id`} element={<PayrollEmployeeDetailPage />} />
                <Route path={ROUTES.PAYROLL_EMPLOYEES} element={<PayrollEmployeesPage />} />
                <Route path={ROUTES.PAYROLL_EXPORTS} element={<PayrollExportsPage />} />
                <Route path={ROUTES.PAYROLL_NOTIFICATIONS} element={<PayrollNotificationsPage />} />
                <Route path={ROUTES.PAYROLL_SECURITY} element={<PayrollSecurityPage />} />
              </Route>

              <Route
                element={
                  <RoleRoute
                    allowedRoles={[APP_ROLES.ADMIN_RH, APP_ROLES.EMPLOYE]}
                    loadingLabel="Authorizing notifications access..."
                  />
                }
              >
                <Route path={ROUTES.NOTIFICATIONS} element={<NotificationsPage />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AppErrorBoundary>
    </BrowserRouter>
  )
}
