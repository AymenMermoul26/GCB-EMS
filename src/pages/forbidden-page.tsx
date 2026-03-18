import { ArrowLeft, Home, ShieldAlert } from 'lucide-react'
import { Link } from 'react-router-dom'

import { ErrorPageShell } from '@/components/common/error-page-shell'
import { Button } from '@/components/ui/button'
import { useRecoveryRoute } from '@/hooks/use-recovery-route'

export function ForbiddenPage() {
  const { recoveryRoute, primaryActionLabel, goBack } = useRecoveryRoute()

  return (
    <ErrorPageShell
      code="403"
      badgeLabel="Forbidden"
      icon={<ShieldAlert className="h-4 w-4" aria-hidden />}
      title="Access denied"
      description="You do not have permission to view this page."
      actions={
        <>
          <Button
            asChild
            className="bg-gradient-to-br from-[#ff6b35] to-[#ffc947] text-white shadow-sm transition hover:opacity-95 hover:shadow-md"
          >
            <Link to={recoveryRoute}>
              <Home className="mr-2 h-4 w-4" aria-hidden />
              {primaryActionLabel}
            </Link>
          </Button>
          <Button variant="outline" onClick={goBack}>
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
            Go back
          </Button>
        </>
      }
    />
  )
}
