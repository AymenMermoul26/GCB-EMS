import type { PropsWithChildren } from 'react'
import { Link } from 'react-router-dom'

import { CompanyLogo } from '@/components/common/company-logo'
import { DashboardNav } from '@/components/navigation/dashboard-nav'
import { Button } from '@/components/ui/button'
import { ROUTES } from '@/constants/routes'
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
  const { role, signOut } = useAuth()

  const handleSignOut = async () => {
    await signOut()
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-background">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to={ROUTES.ROOT} className="inline-flex items-center">
              <CompanyLogo
                withName={false}
                imageClassName="h-11 w-11 rounded-none"
                className="gap-0"
              />
              <span className="ml-3 text-lg font-semibold">{env.VITE_APP_NAME}</span>
            </Link>
            {role ? <DashboardNav role={role} /> : null}
          </div>
          <Button variant="outline" onClick={handleSignOut}>
            Sign out
          </Button>
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
