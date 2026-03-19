import { ArrowLeft, AlertTriangle, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'

import { PageHeader, SURFACE_CARD_CLASS_NAME } from '@/components/common/page-header'
import { ChangePasswordCard } from '@/components/security/ChangePasswordCard'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ROUTES } from '@/constants/routes'
import { useAuth } from '@/hooks/use-auth'
import { PayrollLayout } from '@/layouts/payroll-layout'

export function PayrollSecurityPage() {
  const { mustChangePassword, signOut, user } = useAuth()

  return (
    <PayrollLayout
      title="Security"
      subtitle="Update your password and protect your payroll account."
      onSignOut={signOut}
      userEmail={user?.email ?? null}
    >
      {mustChangePassword ? (
        <Alert className="mb-4 border-amber-300 bg-amber-50 text-amber-900">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Action required</AlertTitle>
          <AlertDescription>
            You must update your password before continuing.
          </AlertDescription>
        </Alert>
      ) : null}

      <PageHeader
        title="Security"
        description="Update your password and protect your payroll account."
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

      <div className="mx-auto w-full max-w-3xl space-y-6">
        <ChangePasswordCard
          className="rounded-2xl border border-slate-200/80 shadow-sm"
          title="Change Password"
          description={
            mustChangePassword
              ? 'You must update your password before continuing.'
              : 'Use your current password and set a strong new one.'
          }
        />

        <Card className={SURFACE_CARD_CLASS_NAME}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-slate-600" />
              Security Tips
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-slate-700">
              <li className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                Use a strong password with at least 8 characters.
              </li>
              <li className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                Never share your credentials with anyone.
              </li>
              <li className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                Update your password periodically for better account protection.
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </PayrollLayout>
  )
}
