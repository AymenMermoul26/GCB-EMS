import {
  ArrowRight,
  Bell,
  Building2,
  Eye,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'

import {
  EmptyState,
  ErrorState,
  PageStateSkeleton,
  SectionSkeleton,
} from '@/components/common/page-state'
import {
  BRAND_BUTTON_CLASS_NAME,
  PageHeader,
  SURFACE_CARD_CLASS_NAME,
} from '@/components/common/page-header'
import { StatusBadge } from '@/components/common/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ROUTES } from '@/constants/routes'
import { useAuth } from '@/hooks/use-auth'
import { PayrollLayout } from '@/layouts/payroll-layout'
import { usePayrollEmployeesQuery } from '@/services/payrollEmployeesService'
import {
  formatPayrollChangedFieldsPreview,
  getPayrollNotificationCategoryMeta,
  useMyPayrollNotificationsQuery,
  useUnreadPayrollNotificationsCountQuery,
} from '@/services/payrollNotificationsService'

function formatMetricValue(value: number | null): string {
  return value === null ? '\u2014' : String(value)
}

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString()
}

export function PayrollDashboardPage() {
  const { signOut, user } = useAuth()
  const payrollEmployeesQuery = usePayrollEmployeesQuery()
  const payrollNotificationsQuery = useMyPayrollNotificationsQuery(user?.id, { limit: 4 })
  const unreadPayrollNotificationsCountQuery = useUnreadPayrollNotificationsCountQuery(user?.id)

  const activeEmployeesCount = useMemo(() => {
    if (!payrollEmployeesQuery.data) {
      return null
    }

    return payrollEmployeesQuery.data.filter((employee) => employee.isActive).length
  }, [payrollEmployeesQuery.data])

  const departmentCoverageCount = useMemo(() => {
    if (!payrollEmployeesQuery.data) {
      return null
    }

    return new Set(
      payrollEmployeesQuery.data
        .map((employee) => employee.departementId)
        .filter((departementId) => departementId && departementId.length > 0),
    ).size
  }, [payrollEmployeesQuery.data])

  const metrics = [
    {
      title: 'Accessible employees',
      description: 'Employees currently visible to payroll consultation.',
      value: payrollEmployeesQuery.data?.length ?? null,
      icon: Users,
    },
    {
      title: 'Active employees',
      description: 'Active employee records inside the payroll scope.',
      value: activeEmployeesCount,
      icon: ShieldCheck,
    },
    {
      title: 'Department coverage',
      description: 'Departments represented in payroll consultation.',
      value: departmentCoverageCount,
      icon: Building2,
    },
  ] as const

  return (
    <PayrollLayout
      title="Payroll Service"
      subtitle="Read-only access to payroll-relevant employee information."
      onSignOut={signOut}
      userEmail={user?.email ?? null}
    >
      <PageHeader
        title="Payroll Service"
        description="This module provides controlled, read-only access to payroll-relevant employee information and HR change signals without payroll calculations or HR administration actions."
        className="mb-6"
        badges={
          <StatusBadge tone="neutral" emphasis="outline">
            {unreadPayrollNotificationsCountQuery.data ?? 0} unread changes
          </StatusBadge>
        }
        actions={
          <>
            <Button asChild variant="outline">
              <Link to={ROUTES.PAYROLL_NOTIFICATIONS}>
                View changes
                <Bell className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild className={BRAND_BUTTON_CLASS_NAME}>
              <Link to={ROUTES.PAYROLL_EMPLOYEES}>
                Open employees
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </>
        }
      />

      {payrollEmployeesQuery.isPending ? (
        <PageStateSkeleton variant="cards" count={3} />
      ) : payrollEmployeesQuery.isError ? (
        <ErrorState
          title="Could not load payroll scope"
          description="We couldn't load payroll employee metrics right now."
          message={payrollEmployeesQuery.error.message}
          onRetry={() => void payrollEmployeesQuery.refetch()}
        />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            {metrics.map((item) => {
              const Icon = item.icon

              return (
                <Card key={item.title} className={SURFACE_CARD_CLASS_NAME}>
                  <CardHeader className="space-y-3 pb-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                      <Icon className="h-5 w-5" />
                    </div>
                    <CardTitle className="text-base font-semibold text-slate-950">
                      {item.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-semibold text-slate-950">
                      {formatMetricValue(item.value)}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {item.description}
                    </p>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <Card className={SURFACE_CARD_CLASS_NAME}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <Eye className="h-4 w-4 text-slate-600" />
                  Current scope
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm leading-6 text-slate-600">
                <p>
                  Payroll access is consultation-only. This workspace intentionally excludes
                  salary calculations, payslips, deductions, taxes, QR management, and internal
                  HR notes.
                </p>
                <p>
                  The employee directory and payroll change feed are the controlled data surfaces
                  prepared for future exports, notifications, and document workflows.
                </p>
              </CardContent>
            </Card>

            <Card className={SURFACE_CARD_CLASS_NAME}>
              <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <Bell className="h-4 w-4 text-slate-600" />
                  Recent HR changes relevant to payroll
                </CardTitle>
                <Button asChild variant="ghost" size="sm">
                  <Link to={ROUTES.PAYROLL_NOTIFICATIONS}>Open feed</Link>
                </Button>
              </CardHeader>
              <CardContent>
                {payrollNotificationsQuery.isPending ? (
                  <SectionSkeleton lines={4} />
                ) : payrollNotificationsQuery.isError ? (
                  <ErrorState
                    surface="plain"
                    align="left"
                    title="Could not load payroll change signals"
                    description="We couldn't load the latest HR changes right now."
                    message={payrollNotificationsQuery.error.message}
                    onRetry={() => void payrollNotificationsQuery.refetch()}
                  />
                ) : payrollNotificationsQuery.data && payrollNotificationsQuery.data.length > 0 ? (
                  <div className="space-y-3">
                    {payrollNotificationsQuery.data.map((item) => {
                      const categoryMeta = getPayrollNotificationCategoryMeta(item.category)
                      const changedFieldsPreview = formatPayrollChangedFieldsPreview(
                        item.changedFields,
                        2,
                      )

                      return (
                        <div
                          key={item.id}
                          className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusBadge tone={categoryMeta.tone}>{categoryMeta.label}</StatusBadge>
                            {!item.isRead ? <StatusBadge tone="brand">Unread</StatusBadge> : null}
                          </div>
                          <p className="mt-3 text-sm font-semibold text-slate-950">
                            {item.employeeName ?? 'Employee change'}
                          </p>
                          <p className="mt-1 text-sm leading-6 text-slate-600">{item.summary}</p>
                          {changedFieldsPreview ? (
                            <p className="mt-2 text-xs text-slate-500">
                              Changed fields: {changedFieldsPreview}
                            </p>
                          ) : null}
                          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                            <p className="text-xs text-slate-500">
                              {formatTimestamp(item.createdAt)}
                            </p>
                            {item.link ? (
                              <Button asChild size="sm" variant="outline">
                                <Link to={item.link}>
                                  Open employee
                                  <ArrowRight className="ml-2 h-4 w-4" />
                                </Link>
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <EmptyState
                    surface="plain"
                    align="left"
                    title="No payroll changes yet"
                    description="Payroll-relevant HR changes will appear here once they are recorded."
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </PayrollLayout>
  )
}
