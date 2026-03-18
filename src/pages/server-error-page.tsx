import { Home, RefreshCw, ShieldAlert } from 'lucide-react'
import { Link } from 'react-router-dom'

import { ErrorPageShell } from '@/components/common/error-page-shell'
import { Button } from '@/components/ui/button'
import { useRecoveryRoute } from '@/hooks/use-recovery-route'

interface ServerErrorPageProps {
  onRetry?: () => void
}

export function ServerErrorPage({ onRetry }: ServerErrorPageProps) {
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
      badgeLabel="Application error"
      icon={<ShieldAlert className="h-4 w-4" aria-hidden />}
      title="Something went wrong"
      description="An unexpected error occurred while loading this page."
      actions={
        <>
          <Button
            type="button"
            className="bg-gradient-to-br from-[#ff6b35] to-[#ffc947] text-white shadow-sm transition hover:opacity-95 hover:shadow-md"
            onClick={handleRetry}
          >
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
            Retry
          </Button>
          <Button variant="outline" asChild>
            <Link to={recoveryRoute}>
              <Home className="mr-2 h-4 w-4" aria-hidden />
              {primaryActionLabel}
            </Link>
          </Button>
        </>
      }
    />
  )
}
