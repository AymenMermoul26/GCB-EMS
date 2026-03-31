import type { LucideIcon } from 'lucide-react'
import type { PropsWithChildren } from 'react'

import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { CompanyLogo } from '@/components/common/company-logo'
import { env } from '@/config/env'
import { cn } from '@/lib/utils'

type AuthLayoutTheme = 'recovery' | 'reset'

interface AuthLayoutProps extends PropsWithChildren {
  badge: string
  title: string
  description: string
  heroBadge: string
  heroTitle: string
  heroDescription: string
  heroHighlights: string[]
  heroIcon: LucideIcon
  theme?: AuthLayoutTheme
}

const AUTH_LAYOUT_THEMES: Record<
  AuthLayoutTheme,
  {
    heroGradientClass: string
    glowClass: string
    heroBadgeClass: string
    heroPanelClass: string
    heroIconSurfaceClass: string
    formHaloClass: string
    formBadgeClass: string
  }
> = {
  recovery: {
    heroGradientClass:
      'bg-[linear-gradient(140deg,rgba(15,23,42,0.98)_8%,rgba(88,28,10,0.96)_54%,rgba(249,115,22,0.84)_100%)]',
    glowClass:
      'bg-[radial-gradient(circle_at_14%_20%,rgba(251,191,36,0.26),transparent_30%),radial-gradient(circle_at_82%_18%,rgba(249,115,22,0.32),transparent_34%),radial-gradient(circle_at_72%_80%,rgba(255,255,255,0.08),transparent_28%)]',
    heroBadgeClass:
      'border-amber-200/35 bg-amber-300/12 text-amber-50 backdrop-blur-md',
    heroPanelClass:
      'border-white/12 bg-white/8 shadow-[0_24px_70px_-40px_rgba(249,115,22,0.9)]',
    heroIconSurfaceClass: 'border-amber-200/25 bg-amber-300/14 text-amber-100',
    formHaloClass:
      'bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.18),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(251,191,36,0.16),transparent_34%)]',
    formBadgeClass: 'border-amber-200/70 bg-amber-50 text-amber-900',
  },
  reset: {
    heroGradientClass:
      'bg-[linear-gradient(140deg,rgba(15,23,42,0.99)_8%,rgba(30,64,175,0.94)_54%,rgba(14,165,233,0.84)_100%)]',
    glowClass:
      'bg-[radial-gradient(circle_at_14%_18%,rgba(56,189,248,0.26),transparent_30%),radial-gradient(circle_at_82%_18%,rgba(96,165,250,0.32),transparent_34%),radial-gradient(circle_at_72%_82%,rgba(255,255,255,0.08),transparent_28%)]',
    heroBadgeClass:
      'border-sky-200/30 bg-sky-300/12 text-sky-50 backdrop-blur-md',
    heroPanelClass:
      'border-white/12 bg-white/8 shadow-[0_24px_70px_-40px_rgba(59,130,246,0.9)]',
    heroIconSurfaceClass: 'border-sky-200/25 bg-sky-300/14 text-sky-100',
    formHaloClass:
      'bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.15),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.16),transparent_34%)]',
    formBadgeClass: 'border-sky-200/70 bg-sky-50 text-sky-900',
  },
}

export function AuthLayout({
  badge,
  title,
  description,
  heroBadge,
  heroTitle,
  heroDescription,
  heroHighlights,
  heroIcon: HeroIcon,
  theme = 'recovery',
  children,
}: AuthLayoutProps) {
  const themeConfig = AUTH_LAYOUT_THEMES[theme]

  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-slate-950">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_32%),linear-gradient(180deg,#020617_0%,#0f172a_100%)]" />
      <div className="relative mx-auto flex min-h-[100dvh] max-w-[92rem] box-border items-center px-4 py-4 sm:px-6 lg:px-8 [@media(min-width:1024px)_and_(max-height:860px)]:py-3 [@media(min-width:1024px)_and_(max-height:760px)]:py-2">
        <div className="grid w-full gap-4 lg:grid-cols-[minmax(0,470px)_minmax(0,1fr)] lg:items-center [@media(min-width:1024px)_and_(max-height:860px)]:gap-3 [@media(min-width:1024px)_and_(max-height:760px)]:gap-2.5">
          <section className="order-1 lg:order-1">
            <div className="relative lg:w-full">
              <div
                className={cn(
                  'absolute inset-0 rounded-[28px] blur-2xl',
                  themeConfig.formHaloClass,
                )}
              />

              <Card className="relative border-white/70 bg-white/92 shadow-[0_30px_90px_-46px_rgba(15,23,42,0.75)] backdrop-blur-xl [@media(min-width:1024px)_and_(max-height:860px)]:rounded-[26px]">
                <CardHeader className="space-y-3 pb-2 [@media(min-width:1024px)_and_(max-height:860px)]:space-y-2.5 [@media(min-width:1024px)_and_(max-height:860px)]:p-5 [@media(min-width:1024px)_and_(max-height:860px)]:pb-2 [@media(min-width:1024px)_and_(max-height:760px)]:space-y-2 [@media(min-width:1024px)_and_(max-height:760px)]:p-4 [@media(min-width:1024px)_and_(max-height:760px)]:pb-1.5">
                  <div className="flex items-center justify-between gap-4">
                    <CompanyLogo
                      className="items-center"
                      imageClassName="h-11 w-11 rounded-xl [@media(min-width:1024px)_and_(max-height:760px)]:h-9 [@media(min-width:1024px)_and_(max-height:760px)]:w-9"
                    />
                    <Badge
                      variant="secondary"
                      className={cn(
                        'rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] [@media(min-width:1024px)_and_(max-height:760px)]:px-2 [@media(min-width:1024px)_and_(max-height:760px)]:py-0.5 [@media(min-width:1024px)_and_(max-height:760px)]:text-[10px]',
                        themeConfig.formBadgeClass,
                      )}
                    >
                      {badge}
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    <CardTitle className="text-[1.82rem] tracking-tight text-slate-950 sm:text-[2rem] [@media(min-width:1024px)_and_(max-height:860px)]:text-[1.7rem] [@media(min-width:1024px)_and_(max-height:760px)]:text-[1.55rem]">
                      {title}
                    </CardTitle>
                    <CardDescription className="text-sm leading-6 text-slate-600 [@media(min-width:1024px)_and_(max-height:860px)]:leading-5.5 [@media(min-width:1024px)_and_(max-height:760px)]:text-[13px] [@media(min-width:1024px)_and_(max-height:760px)]:leading-5">
                      {description}
                    </CardDescription>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3.5 [@media(min-width:1024px)_and_(max-height:860px)]:space-y-3 [@media(min-width:1024px)_and_(max-height:860px)]:px-5 [@media(min-width:1024px)_and_(max-height:860px)]:pb-5 [@media(min-width:1024px)_and_(max-height:760px)]:space-y-2.5 [@media(min-width:1024px)_and_(max-height:760px)]:px-4 [@media(min-width:1024px)_and_(max-height:760px)]:pb-4">
                  {children}
                </CardContent>
              </Card>
            </div>
          </section>

          <section className="order-2 lg:order-2">
            <article className="relative min-h-[320px] overflow-hidden rounded-[32px] border border-white/10 shadow-[0_36px_120px_-54px_rgba(15,23,42,0.95)] [@media(min-width:1024px)_and_(max-height:860px)]:min-h-[300px] [@media(min-width:1024px)_and_(max-height:760px)]:min-h-[280px]">
              <div className={cn('absolute inset-0', themeConfig.heroGradientClass)} />
              <div className={cn('absolute inset-0', themeConfig.glowClass)} />
              <div className="absolute inset-0 bg-[linear-gradient(145deg,rgba(255,255,255,0.08),transparent_30%,rgba(255,255,255,0.03))]" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_20%)]" />

              <div className="relative z-10 flex h-full flex-col gap-5 p-5 text-white sm:p-6 xl:p-7 [@media(min-width:1024px)_and_(max-height:860px)]:gap-4 [@media(min-width:1024px)_and_(max-height:860px)]:p-4 [@media(min-width:1024px)_and_(max-height:760px)]:gap-3 [@media(min-width:1024px)_and_(max-height:760px)]:p-3.5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="inline-flex max-w-[420px] items-center gap-3 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-md">
                    <CompanyLogo
                      withName={false}
                      imageClassName="h-10 w-10 rounded-xl"
                      className="shrink-0"
                    />
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/60">
                        GCB EMS
                      </p>
                      <p className="text-sm font-medium leading-5 text-white/92">
                        {env.VITE_APP_NAME}
                      </p>
                    </div>
                  </div>

                  <Badge
                    className={cn(
                      'rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em]',
                      themeConfig.heroBadgeClass,
                    )}
                  >
                    {heroBadge}
                  </Badge>
                </div>

                <div className="grid flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.98fr)] lg:items-center [@media(min-width:1024px)_and_(max-height:860px)]:gap-3 [@media(min-width:1024px)_and_(max-height:760px)]:gap-2.5">
                  <div className="space-y-5 [@media(min-width:1024px)_and_(max-height:860px)]:space-y-4 [@media(min-width:1024px)_and_(max-height:760px)]:space-y-3">
                    <div className="space-y-4">
                      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-white/62">
                        Account recovery
                      </p>
                      <h1 className="max-w-2xl text-[1.95rem] font-semibold leading-tight sm:text-[2.2rem] xl:text-[2.6rem] xl:leading-[1.06] [@media(min-width:1024px)_and_(max-height:860px)]:text-[1.75rem] [@media(min-width:1024px)_and_(max-height:760px)]:text-[1.55rem]">
                        {heroTitle}
                      </h1>
                      <p className="max-w-xl text-sm leading-7 text-white/78 sm:text-base [@media(min-width:1024px)_and_(max-height:860px)]:leading-6 [@media(min-width:1024px)_and_(max-height:760px)]:text-[13px] [@media(min-width:1024px)_and_(max-height:760px)]:leading-5">
                        {heroDescription}
                      </p>
                    </div>

                    <div className="grid gap-2 md:grid-cols-3 lg:grid-cols-3 2xl:grid-cols-1 [@media(min-width:1024px)_and_(max-height:860px)]:gap-1.5 [@media(min-width:1024px)_and_(max-height:760px)]:gap-1.5">
                      {heroHighlights.map((highlight) => (
                        <div
                          key={highlight}
                          className={cn(
                            'rounded-2xl border px-4 py-3 text-sm leading-5 backdrop-blur-md [@media(min-width:1024px)_and_(max-height:860px)]:rounded-xl [@media(min-width:1024px)_and_(max-height:860px)]:px-3 [@media(min-width:1024px)_and_(max-height:860px)]:py-2.5 [@media(min-width:1024px)_and_(max-height:760px)]:px-2.5 [@media(min-width:1024px)_and_(max-height:760px)]:py-2 [@media(min-width:1024px)_and_(max-height:760px)]:text-[13px] [@media(min-width:1024px)_and_(max-height:760px)]:leading-4.5',
                            themeConfig.heroPanelClass,
                          )}
                        >
                          {highlight}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div
                    className={cn(
                      'rounded-[28px] border p-4 backdrop-blur-xl [@media(min-width:1024px)_and_(max-height:860px)]:p-3.5 [@media(min-width:1024px)_and_(max-height:760px)]:rounded-[24px] [@media(min-width:1024px)_and_(max-height:760px)]:p-3',
                      themeConfig.heroPanelClass,
                    )}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/60">
                          Recovery guidance
                        </p>
                        <h2 className="text-2xl font-semibold text-white [@media(min-width:1024px)_and_(max-height:860px)]:text-xl [@media(min-width:1024px)_and_(max-height:760px)]:text-lg">
                          Protected flow
                        </h2>
                        <p className="text-sm leading-6 text-white/72 [@media(min-width:1024px)_and_(max-height:860px)]:leading-5 [@media(min-width:1024px)_and_(max-height:760px)]:text-[13px] [@media(min-width:1024px)_and_(max-height:760px)]:leading-4.5">
                          Password recovery stays secure, clear, and guided from request to reset.
                        </p>
                      </div>

                      <div
                        className={cn(
                          'rounded-[22px] border p-3 backdrop-blur-md',
                          themeConfig.heroIconSurfaceClass,
                        )}
                      >
                        <HeroIcon className="h-7 w-7" />
                      </div>
                    </div>

                    <div className="mt-3 grid gap-2 sm:grid-cols-3 [@media(min-width:1024px)_and_(max-height:860px)]:mt-2.5 [@media(min-width:1024px)_and_(max-height:860px)]:gap-1.5 [@media(min-width:1024px)_and_(max-height:760px)]:mt-2 [@media(min-width:1024px)_and_(max-height:760px)]:gap-1.5">
                      <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3.5 backdrop-blur-md">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">
                          Request
                        </p>
                        <p className="mt-3 text-sm font-semibold text-white [@media(min-width:1024px)_and_(max-height:860px)]:mt-2.5 [@media(min-width:1024px)_and_(max-height:760px)]:mt-2">
                          Secure email recovery
                        </p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3.5 backdrop-blur-md">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">
                          Session
                        </p>
                        <p className="mt-3 text-sm font-semibold text-white [@media(min-width:1024px)_and_(max-height:860px)]:mt-2.5 [@media(min-width:1024px)_and_(max-height:760px)]:mt-2">
                          Link validation first
                        </p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3.5 backdrop-blur-md">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">
                          Return
                        </p>
                        <p className="mt-3 text-sm font-semibold text-white [@media(min-width:1024px)_and_(max-height:860px)]:mt-2.5 [@media(min-width:1024px)_and_(max-height:760px)]:mt-2">
                          Back to sign-in after reset
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </article>
          </section>
        </div>
      </div>
    </main>
  )
}
