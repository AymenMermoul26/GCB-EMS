import { ArrowRight, Eye, ShieldCheck, Users } from 'lucide-react'
import { Link } from 'react-router-dom'

import { BRAND_BUTTON_CLASS_NAME, PageHeader, SURFACE_CARD_CLASS_NAME } from '@/components/common/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ROUTES } from '@/constants/routes'
import { useAuth } from '@/hooks/use-auth'
import { PayrollLayout } from '@/layouts/payroll-layout'

const FOUNDATION_CARDS = [
  {
    title: 'Controlled Role Access',
    description: 'Payroll users are isolated to payroll-only routes and do not inherit HR admin permissions.',
    icon: ShieldCheck,
  },
  {
    title: 'Read-only Foundation',
    description: 'This module is prepared for consultation workflows without salary, tax, or document automation logic.',
    icon: Eye,
  },
  {
    title: 'Employee Access Ready',
    description: 'A dedicated payroll employees area is in place for the next read-only employee access iteration.',
    icon: Users,
  },
] as const

export function PayrollDashboardPage() {
  const { signOut, user } = useAuth()

  return (
    <PayrollLayout
      title="Payroll Service"
      subtitle="Read-only access to payroll-relevant employee information."
      onSignOut={signOut}
      userEmail={user?.email ?? null}
    >
      <PageHeader
        title="Payroll Service"
        description="This module establishes the secure route, role, and workspace foundation for future payroll-connected employee consultation."
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

      <div className="grid gap-4 md:grid-cols-3">
        {FOUNDATION_CARDS.map((item) => {
          const Icon = item.icon
          return (
            <Card key={item.title} className={SURFACE_CARD_CLASS_NAME}>
              <CardHeader className="space-y-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                  <Icon className="h-5 w-5" />
                </div>
                <CardTitle className="text-base font-semibold text-slate-950">{item.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-6 text-slate-600">{item.description}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card className={`${SURFACE_CARD_CLASS_NAME} mt-6`}>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Not implemented yet</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-600">
          <p>Salary calculations, deductions, taxes, payslips, and attendance-linked payroll logic are intentionally out of scope for this step.</p>
          <p>This foundation only prepares secure routing, navigation, and a dedicated workspace for future payroll development.</p>
        </CardContent>
      </Card>
    </PayrollLayout>
  )
}
