import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { AdminRoute } from '@/components/guards/admin-route'
import { EmployeeRoute } from '@/components/guards/employee-route'
import { FullScreenLoader } from '@/components/common/full-screen-loader'
import { ProtectedRoute } from '@/components/guards/protected-route'
import { APP_ROLES } from '@/constants/roles'
import { ROUTES } from '@/constants/routes'
import { useAuth } from '@/hooks/use-auth'
import { AuditLogPage } from '@/pages/admin/AuditLogPage'
import { AdminEmployeeCreatePage } from '@/pages/admin/admin-employee-create-page'
import { AdminEmployeeDetailPage } from '@/pages/admin/admin-employee-detail-page'
import { AdminRequestsPage } from '@/pages/admin/admin-requests-page'
import { EmployeesListPage } from '@/pages/admin/EmployeesList'
import { DepartmentsPage } from '@/pages/admin/DepartmentsPage'
import { LoginPage } from '@/pages/auth/login-page'
import { EmployeeProfilePage } from '@/pages/employee/employee-profile-page'
import { NotFoundPage } from '@/pages/not-found-page'
import { NotificationsPage } from '@/pages/notifications-page'
import { PublicProfilePage } from '@/pages/public/public-profile-page'

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
    return <Navigate to={ROUTES.ADMIN_EMPLOYEES} replace />
  }

  return <Navigate to={ROUTES.EMPLOYEE_PROFILE} replace />
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path={ROUTES.ROOT} element={<HomeRedirect />} />
        <Route path={ROUTES.LOGIN} element={<LoginPage />} />
        <Route path={`${ROUTES.PUBLIC_PROFILE_BASE}/:token`} element={<PublicProfilePage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AdminRoute />}>
            <Route path={ROUTES.ADMIN} element={<Navigate to={ROUTES.ADMIN_EMPLOYEES} replace />} />
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
          </Route>

          <Route path={ROUTES.NOTIFICATIONS} element={<NotificationsPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}
