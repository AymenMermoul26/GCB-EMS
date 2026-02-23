import type { PropsWithChildren } from 'react'
import { Link } from 'react-router-dom'

import {
  AdminSidebar,
  AdminSidebarMobile,
} from '@/components/layout/admin/AdminSidebar'
import { CompanyLogo } from '@/components/common/company-logo'
import { DashboardNav } from '@/components/navigation/dashboard-nav'
import { NotificationsMenu } from '@/components/navigation/notifications-menu'
import { Button } from '@/components/ui/button'
import { ROUTES } from '@/constants/routes'
import { APP_ROLES } from '@/constants/roles'
import { env } from '@/config/env'
import { useAuth } from '@/hooks/use-auth'

interface DashboardLayoutProps extends PropsWithChildren {
  title: string
  subtitle: string
}

export function DashboardLayout({
  title,
  subtitle,
  children,
}: DashboardLayoutProps) {
  const { role, signOut, user } = useAuth()

  const handleSignOut = async () => {
    await signOut()
  }

  if (role === APP_ROLES.ADMIN_RH) {
    return (
      <div className="min-h-screen bg-slate-100/70">
        <div className="mx-auto flex max-w-[1700px] gap-3 p-3 lg:gap-4 lg:p-4">
          <AdminSidebar
            onSignOut={handleSignOut}
            userEmail={user?.email ?? null}
            className="hidden lg:sticky lg:top-4 lg:flex lg:h-[calc(100vh-2rem)]"
          />

          <div className="flex min-h-[calc(100vh-2rem)] flex-1 flex-col overflow-hidden rounded-[28px] border border-white/70 bg-white/90 shadow-[0_30px_65px_-35px_rgba(15,23,42,0.62)] backdrop-blur supports-[backdrop-filter]:bg-white/75">
            <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
              <div className="flex min-h-16 items-center justify-between gap-3 px-4 sm:px-6">
                <div className="flex min-w-0 items-center gap-3">
                  <AdminSidebarMobile
                    onSignOut={handleSignOut}
                    userEmail={user?.email ?? null}
                    className="lg:hidden"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {env.VITE_APP_NAME}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      Admin workspace
                    </p>
                  </div>
                </div>
                <NotificationsMenu />
              </div>
            </header>

            <main className="flex-1 p-4 sm:p-6 lg:p-8">
              <div className="mb-8 space-y-1">
                <h1 className="text-2xl font-semibold text-slate-950">{title}</h1>
                <p className="text-sm text-muted-foreground">{subtitle}</p>
              </div>
              {children}
            </main>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-background">
        <div className="container flex min-h-16 flex-wrap items-center justify-between gap-3 py-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3 md:gap-6">
            <Link to={ROUTES.ROOT} className="inline-flex min-w-0 items-center">
              <CompanyLogo
                withName={false}
                imageClassName="h-11 w-11 rounded-none"
                className="gap-0"
              />
              <span className="ml-3 truncate text-lg font-semibold">{env.VITE_APP_NAME}</span>
            </Link>
            {role ? <DashboardNav role={role} /> : null}
          </div>
          <div className="flex items-center gap-2">
            <NotificationsMenu />
            <Button variant="outline" onClick={handleSignOut}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-8">
        <div className="mb-8 space-y-1">
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        {children}
      </main>
    </div>
  )
}
