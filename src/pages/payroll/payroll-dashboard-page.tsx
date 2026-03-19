import { ArrowRight, Building2, Eye, ShieldCheck, Users } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'

import { ErrorState, PageStateSkeleton } from '@/components/common/page-state'
import {
  BRAND_BUTTON_CLASS_NAME,
  PageHeader,
  SURFACE_CARD_CLASS_NAME,
} from '@/components/common/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ROUTES } from '@/constants/routes'
import { useAuth } from '@/hooks/use-auth'
import { PayrollLayout } from '@/layouts/payroll-layout'
import { usePayrollEmployeesQuery } from '@/services/payrollEmployeesService'

function formatMetricValue(value: number | null): string {
  return value === null ? '\u2014' : String(value)
}

export function PayrollDashboardPage() {
  const { signOut, user } = useAuth()
  const payrollEmployeesQuery = usePayrollEmployeesQuery()

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
        description="This module provides controlled, read-only access to payroll-relevant employee information without payroll calculations or HR administration actions."
        className="mb-6"
        actions={
          <Button asChild className={BRAND_BUTTON_CLASS_NAME}>
            <Link to={ROUTES.PAYROLL_EMPLOYEES}>
              Open employees
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
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

          <Card className={`${SURFACE_CARD_CLASS_NAME} mt-6`}>
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
                The employee directory is the first controlled data surface for future payroll
                exports, notifications, and document workflows.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </PayrollLayout>
  )
}
