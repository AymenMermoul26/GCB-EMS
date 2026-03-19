import { AlertCircle, Info } from 'lucide-react'

import { MyQrCard } from '@/components/employee/MyQrCard'
import { PageHeader, SURFACE_CARD_CLASS_NAME } from '@/components/common/page-header'
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
      <PageHeader
        title="Public Profile QR"
        description="Use this QR code to share your public profile. Only fields approved by HR are visible."
        className="mb-5"
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <MyQrCard employeId={employeId} className="mt-0 rounded-2xl border-slate-200/80 shadow-sm" />

        <Card className={SURFACE_CARD_CLASS_NAME}>
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
