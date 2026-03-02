import { AlertCircle, Info } from 'lucide-react'

import { MyQrCard } from '@/components/employee/MyQrCard'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useRole } from '@/hooks/use-role'
import { DashboardLayout } from '@/layouts/dashboard-layout'

export function EmployeeMyQrPage() {
  const { employeId } = useRole()

  return (
    <DashboardLayout
      title="My QR Code"
      subtitle="Share your verified public profile securely."
    >
      <section className="mb-5 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-3 h-1 w-28 rounded-full bg-gradient-to-br from-[#ff6b35] to-[#ffc947]" />
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-slate-900">Public Profile QR</h2>
          <p className="text-sm text-slate-600">
            Use this QR code to share your public profile. Only fields approved by HR are visible.
          </p>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <MyQrCard employeId={employeId} className="mt-0 rounded-2xl border-slate-200/80 shadow-sm" />

        <Card className="rounded-2xl border-slate-200/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Usage Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-700">
            <Alert className="border-slate-200 bg-slate-50">
              <Info className="h-4 w-4" />
              <AlertTitle>Public-safe sharing</AlertTitle>
              <AlertDescription>
                Your QR link points to your public profile page and respects HR visibility settings.
              </AlertDescription>
            </Alert>
            <Alert className="border-amber-300 bg-amber-50 text-amber-900">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>No active token?</AlertTitle>
              <AlertDescription>
                If your QR token is missing, expired, or revoked, contact HR to regenerate it.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
