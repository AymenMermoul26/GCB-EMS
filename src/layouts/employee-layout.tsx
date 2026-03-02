import type { PropsWithChildren } from 'react'

import {
  EmployeeSidebar,
  EmployeeSidebarMobile,
} from '@/components/layout/employee/EmployeeSidebar'
import { NotificationsMenu } from '@/components/navigation/notifications-menu'
import { env } from '@/config/env'

interface EmployeeLayoutProps extends PropsWithChildren {
  title: string
  subtitle: string
  onSignOut: () => Promise<void> | void
  userEmail?: string | null
}

export function EmployeeLayout({
  title,
  subtitle,
  onSignOut,
  userEmail,
  children,
}: EmployeeLayoutProps) {
  return (
    <div className="min-h-screen bg-slate-100/70">
      <div className="mx-auto flex max-w-[1700px] gap-3 p-3 lg:gap-4 lg:p-4">
        <EmployeeSidebar
          onSignOut={onSignOut}
          userEmail={userEmail}
          className="hidden lg:sticky lg:top-4 lg:flex lg:h-[calc(100vh-2rem)]"
        />

        <div className="flex min-h-[calc(100vh-2rem)] flex-1 flex-col overflow-hidden rounded-[28px] border border-white/70 bg-white/90 shadow-[0_30px_65px_-35px_rgba(15,23,42,0.62)] backdrop-blur supports-[backdrop-filter]:bg-white/75">
          <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
            <div className="flex min-h-16 items-center justify-between gap-3 px-4 sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <EmployeeSidebarMobile
                  onSignOut={onSignOut}
                  userEmail={userEmail}
                  className="lg:hidden"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{env.VITE_APP_NAME}</p>
                  <p className="truncate text-xs text-muted-foreground">Employee workspace</p>
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
