import type { PropsWithChildren } from 'react'

import { CompanyLogo } from '@/components/common/company-logo'
import { env } from '@/config/env'

export function AuthLayout({ children }: PropsWithChildren) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <section className="w-full max-w-md space-y-4">
        <CompanyLogo className="justify-center" imageClassName="h-14 w-14" />
        {children}
      </section>
      <p className="fixed bottom-4 text-xs text-muted-foreground">{env.VITE_APP_NAME}</p>
    </main>
  )
}
