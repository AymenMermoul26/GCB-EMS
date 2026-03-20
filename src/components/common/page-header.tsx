import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export const BRAND_BUTTON_CLASS_NAME =
  'border-0 bg-gradient-to-br from-[#ff6b35] to-[#ffc947] text-white shadow-sm transition-all hover:brightness-95 hover:shadow-md'

export const SURFACE_CARD_CLASS_NAME =
  'rounded-2xl border border-slate-200/80 shadow-sm'

export const SURFACE_PANEL_CLASS_NAME =
  'rounded-2xl border border-slate-200/80 bg-white shadow-sm'

interface PageHeaderProps {
  title: string
  description: string
  badges?: ReactNode
  actions?: ReactNode
  backAction?: ReactNode
  children?: ReactNode
  className?: string
  actionsClassName?: string
  titleClassName?: string
}

export function PageHeader({
  title,
  description,
  badges,
  actions,
  backAction,
  children,
  className,
  actionsClassName,
  titleClassName,
}: PageHeaderProps) {
  return (
    <section
      className={cn(
        'overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/80 sm:p-5',
        className,
      )}
    >
      <div className="mb-3 h-1.5 w-24 rounded-full bg-gradient-to-br from-[#ff6b35] to-[#ffc947]" />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-2">
          {backAction ? <div>{backAction}</div> : null}

          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2
                className={cn(
                  'text-2xl font-semibold tracking-tight text-slate-950 sm:text-[1.75rem]',
                  titleClassName,
                )}
              >
                {title}
              </h2>
              {badges}
            </div>
            <p className="max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
          </div>
        </div>

        {actions ? (
          <div
            className={cn(
              'flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap lg:w-auto lg:justify-end',
              actionsClassName,
            )}
          >
            {actions}
          </div>
        ) : null}
      </div>

      {children ? <div className="mt-5">{children}</div> : null}
    </section>
  )
}
