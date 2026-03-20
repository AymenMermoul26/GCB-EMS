import type { PropsWithChildren } from 'react'

import { PayrollSidebar, PayrollSidebarMobile } from '@/components/layout/payroll/PayrollSidebar'
import { env } from '@/config/env'

interface PayrollLayoutProps extends PropsWithChildren {
  title: string
  subtitle: string
  onSignOut: () => Promise<void> | void
  userEmail?: string | null
}

export function PayrollLayout({
  title,
  subtitle,
  onSignOut,
  userEmail,
  children,
}: PayrollLayoutProps) {
  return (
    <div className="min-h-screen bg-slate-100/70">
      <div className="mx-auto flex max-w-[1700px] gap-3 p-3 lg:gap-4 lg:p-4">
        <PayrollSidebar
          onSignOut={onSignOut}
          userEmail={userEmail}
          className="hidden lg:sticky lg:top-4 lg:flex lg:h-[calc(100vh-2rem)]"
        />

        <div className="flex min-h-[calc(100vh-2rem)] flex-1 flex-col overflow-hidden rounded-[28px] border border-white/70 bg-white/90 shadow-[0_30px_65px_-35px_rgba(15,23,42,0.62)] backdrop-blur supports-[backdrop-filter]:bg-white/75">
          <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
            <div className="flex min-h-16 items-center justify-between gap-3 px-4 sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <PayrollSidebarMobile
                  onSignOut={onSignOut}
                  userEmail={userEmail}
                  className="lg:hidden"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{env.VITE_APP_NAME}</p>
                  <p className="truncate text-xs text-muted-foreground">Payroll workspace</p>
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-x-hidden p-4 sm:p-6 lg:p-8">
            <div className="mb-6 max-w-3xl space-y-1 sm:mb-8">
              <h1 className="text-2xl font-semibold text-slate-950 sm:text-3xl">{title}</h1>
              <p className="text-sm leading-6 text-muted-foreground">{subtitle}</p>
            </div>
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}
