import { ArrowLeft, AlertTriangle, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'

import { ChangePasswordCard } from '@/components/security/ChangePasswordCard'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ROUTES } from '@/constants/routes'
import { useAuth } from '@/hooks/use-auth'
import { DashboardLayout } from '@/layouts/dashboard-layout'

export function EmployeeSecurityPage() {
  const { mustChangePassword } = useAuth()

  return (
    <DashboardLayout
      title="Security"
      subtitle="Update your password and protect your account."
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

      <section className="sticky top-16 z-20 mb-6 rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-sm backdrop-blur">
        <div className="mb-2 h-1 w-24 rounded-full bg-gradient-to-br from-[#ff6b35] to-[#ffc947]" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-slate-900">Security</h2>
            <p className="text-sm text-slate-600">
              Update your password and protect your account.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to={ROUTES.EMPLOYEE_PROFILE}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to profile
            </Link>
          </Button>
        </div>
      </section>

      <div className="mx-auto w-full max-w-3xl space-y-6">
        <ChangePasswordCard
          className="rounded-2xl border border-slate-200/80 shadow-sm"
          title="Change Password"
          description="Use your current password and set a strong new one."
        />

        <Card className="rounded-2xl border border-slate-200/80 shadow-sm">
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
    </DashboardLayout>
  )
}
