import { ArrowLeft, Home, ShieldAlert } from 'lucide-react'
import { Link } from 'react-router-dom'

import { ErrorPageShell } from '@/components/common/error-page-shell'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/hooks/use-i18n'
import { useRecoveryRoute } from '@/hooks/use-recovery-route'
import { cn } from '@/lib/utils'

export function ForbiddenPage() {
  const { t, isRTL } = useI18n()
  const { recoveryRoute, primaryActionLabel, goBack } = useRecoveryRoute()

  return (
    <ErrorPageShell
      code="403"
      badgeLabel={t('errors.forbidden.badge')}
      icon={<ShieldAlert className="h-4 w-4" aria-hidden />}
      title={t('errors.forbidden.title')}
      description={t('errors.forbidden.description')}
      actions={
        <>
          <Button
            asChild
            className="bg-gradient-to-br from-[#ff6b35] to-[#ffc947] text-white shadow-sm transition hover:opacity-95 hover:shadow-md"
          >
            <Link to={recoveryRoute}>
              <Home className={cn('h-4 w-4', isRTL ? 'ml-2' : 'mr-2')} aria-hidden />
              {primaryActionLabel}
            </Link>
          </Button>
          <Button variant="outline" onClick={goBack}>
            <ArrowLeft className={cn('h-4 w-4', isRTL ? 'ml-2 rotate-180' : 'mr-2')} aria-hidden />
            {t('actions.goBack')}
          </Button>
        </>
      }
    />
  )
}
