import { ArrowLeft, AlertTriangle, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'

import { PageHeader, SURFACE_CARD_CLASS_NAME } from '@/components/common/page-header'
import { ChangePasswordCard } from '@/components/security/ChangePasswordCard'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ROUTES } from '@/constants/routes'
import { useAuth } from '@/hooks/use-auth'
import { useI18n } from '@/hooks/use-i18n'
import { DashboardLayout } from '@/layouts/dashboard-layout'
import { cn } from '@/lib/utils'

export function EmployeeSecurityPage() {
  const { mustChangePassword } = useAuth()
  const { isRTL, t } = useI18n()

  return (
    <DashboardLayout
      title={t('security.title')}
      subtitle={t('security.employeeSubtitle')}
    >
      {mustChangePassword ? (
        <Alert className="mb-4 border-amber-300 bg-amber-50 text-amber-900">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{t('security.actionRequiredTitle')}</AlertTitle>
          <AlertDescription>
            {t('security.actionRequiredDescription')}
          </AlertDescription>
        </Alert>
      ) : null}

      <PageHeader
        title={t('security.title')}
        description={t('security.employeeSubtitle')}
        className="sticky top-16 z-20 mb-6"
        actions={
          <Button asChild variant="outline">
            <Link to={ROUTES.EMPLOYEE_PROFILE}>
              <ArrowLeft className={cn('h-4 w-4', isRTL ? 'ml-2 rotate-180' : 'mr-2')} />
              {t('actions.backToProfile')}
            </Link>
          </Button>
        }
      />

      <div className="mx-auto w-full max-w-3xl space-y-6">
        <ChangePasswordCard
          className="rounded-2xl border border-slate-200/80 shadow-sm"
          title={t('actions.changePassword')}
          description={
            mustChangePassword
              ? t('security.actionRequiredDescription')
              : t('security.changePasswordDescription')
          }
        />

        <Card className={SURFACE_CARD_CLASS_NAME}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-slate-600" />
              {t('security.tipsTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-slate-700">
              <li className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                {t('security.tips.strongPassword')}
              </li>
              <li className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                {t('security.tips.neverShare')}
              </li>
              <li className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                {t('security.tips.rotatePassword')}
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
