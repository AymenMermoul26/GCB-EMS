import { AlertTriangle, ArrowLeft, Home } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import gcbLogo from '@/assets/brand/gcb-logo.svg'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { APP_ROLES } from '@/constants/roles'
import { ROUTES } from '@/constants/routes'
import { useAuth } from '@/hooks/use-auth'

export function NotFoundPage() {
  const navigate = useNavigate()
  const { role, user, isLoading } = useAuth()

  const dashboardRoute = useMemo(() => {
    if (isLoading) {
      return ROUTES.ROOT
    }

    if (role === APP_ROLES.ADMIN_RH) {
      return ROUTES.ADMIN_EMPLOYEES
    }

    if (role === APP_ROLES.EMPLOYE) {
      return ROUTES.EMPLOYEE_PROFILE
    }

    return ROUTES.LOGIN
  }, [isLoading, role])

  const primaryButtonLabel = user ? 'Go to dashboard' : 'Go to login'

  const handleGoBack = () => {
    if (window.history.length > 1) {
      navigate(-1)
      return
    }

    navigate(dashboardRoute, { replace: true })
  }

  return (
    <main className="min-h-screen bg-slate-100/70 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl items-center justify-center">
        <Card className="w-full overflow-hidden rounded-3xl border-slate-200/80 shadow-xl shadow-slate-200/70">
          <div className="grid lg:grid-cols-2">
            <div className="relative overflow-hidden bg-gradient-to-br from-[#ff6b35] to-[#ffc947] p-8 text-white sm:p-10">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.3),transparent_45%)]" />
              <div className="relative flex h-full flex-col justify-between gap-8">
                <div className="inline-flex w-fit items-center gap-3 rounded-full bg-white/20 px-4 py-2 backdrop-blur-sm">
                  <img
                    src={gcbLogo}
                    alt="GCB logo"
                    className="h-8 w-8 rounded-md bg-white/20 p-1"
                  />
                  <span className="text-sm font-semibold tracking-wide">GCB EMS</span>
                </div>

                <div>
                  <p className="text-7xl font-extrabold leading-none tracking-tight sm:text-8xl">404</p>
                  <p className="mt-3 text-sm text-white/90 sm:text-base">
                    Requested page is not available in the current route map.
                  </p>
                </div>

                <div className="inline-flex w-fit items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-sm">
                  <AlertTriangle className="h-4 w-4" aria-hidden />
                  Route not found
                </div>
              </div>
            </div>

            <CardContent className="flex flex-col justify-center p-8 sm:p-10">
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">Page not found</h1>
              <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
                The page you&apos;re looking for doesn&apos;t exist or was moved.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button
                  asChild
                  className="bg-gradient-to-br from-[#ff6b35] to-[#ffc947] text-white shadow-sm transition hover:opacity-95 hover:shadow-md"
                >
                  <Link to={dashboardRoute}>
                    <Home className="mr-2 h-4 w-4" aria-hidden />
                    {primaryButtonLabel}
                  </Link>
                </Button>

                <Button variant="outline" onClick={handleGoBack}>
                  <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
                  Go back
                </Button>
              </div>
            </CardContent>
          </div>
        </Card>
      </div>
    </main>
  )
}
