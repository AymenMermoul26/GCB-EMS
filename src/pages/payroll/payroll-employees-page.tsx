import { ArrowLeft, Search, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'

import { EmptyState } from '@/components/common/page-state'
import { PageHeader, SURFACE_CARD_CLASS_NAME } from '@/components/common/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ROUTES } from '@/constants/routes'
import { useAuth } from '@/hooks/use-auth'
import { PayrollLayout } from '@/layouts/payroll-layout'

export function PayrollEmployeesPage() {
  const { signOut, user } = useAuth()

  return (
    <PayrollLayout
      title="Payroll Employees"
      subtitle="Foundation route for controlled payroll employee access."
      onSignOut={signOut}
      userEmail={user?.email ?? null}
    >
      <PageHeader
        title="Payroll Employees"
        description="This route is reserved for the upcoming read-only payroll employee directory and controlled payroll-relevant field access."
        className="mb-6"
        actions={
          <Button asChild variant="outline">
            <Link to={ROUTES.PAYROLL_DASHBOARD}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to dashboard
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.9fr]">
        <Card className={SURFACE_CARD_CLASS_NAME}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Search className="h-4 w-4 text-slate-600" />
              Planned next step
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-600">
            <p>The next implementation step will introduce a read-only employee list with payroll-safe search and filtering.</p>
            <p>That work will be added on top of this payroll-only route and access boundary.</p>
          </CardContent>
        </Card>

        <Card className={SURFACE_CARD_CLASS_NAME}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <ShieldCheck className="h-4 w-4 text-slate-600" />
              Access principle
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-6 text-slate-600">
            Payroll access remains read-only and limited to a controlled subset of employee information in future steps.
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <EmptyState
          title="Payroll employee access is ready for the next iteration"
          description="The route, layout, and role protection are in place. The controlled employee directory has not been implemented in this foundation step."
        />
      </div>
    </PayrollLayout>
  )
}
