import { Home, RefreshCw, ShieldAlert } from 'lucide-react'
import { Link } from 'react-router-dom'

import { ErrorPageShell } from '@/components/common/error-page-shell'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/hooks/use-i18n'
import { useRecoveryRoute } from '@/hooks/use-recovery-route'
import { cn } from '@/lib/utils'

interface ServerErrorPageProps {
  onRetry?: () => void
}

export function ServerErrorPage({ onRetry }: ServerErrorPageProps) {
  const { t, isRTL } = useI18n()
  const { recoveryRoute, primaryActionLabel } = useRecoveryRoute()

  const handleRetry = () => {
    if (onRetry) {
      onRetry()
      return
    }

    window.location.reload()
  }

  return (
    <ErrorPageShell
      code="500"
      badgeLabel={t('errors.server.badge')}
      icon={<ShieldAlert className="h-4 w-4" aria-hidden />}
      title={t('errors.server.title')}
      description={t('errors.server.description')}
      actions={
        <>
          <Button
            type="button"
            className="bg-gradient-to-br from-[#ff6b35] to-[#ffc947] text-white shadow-sm transition hover:opacity-95 hover:shadow-md"
            onClick={handleRetry}
          >
            <RefreshCw className={cn('h-4 w-4', isRTL ? 'ml-2' : 'mr-2')} aria-hidden />
            {t('common.retry')}
          </Button>
          <Button variant="outline" asChild>
            <Link to={recoveryRoute}>
              <Home className={cn('h-4 w-4', isRTL ? 'ml-2' : 'mr-2')} aria-hidden />
              {primaryActionLabel}
            </Link>
          </Button>
        </>
      }
    />
  )
}
