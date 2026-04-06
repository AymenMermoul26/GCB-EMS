import {
  AlertTriangle,
  Inbox,
  SearchX,
  type LucideIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'

import { useI18n } from '@/hooks/use-i18n'
import { cn } from '@/lib/utils'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { SURFACE_CARD_CLASS_NAME } from '@/components/common/page-header'

type StateSurface = 'card' | 'plain'
type SkeletonVariant = 'cards' | 'table' | 'detail' | 'list' | 'profile' | 'public-profile'

interface SharedStateProps {
  title: string
  description: string
  icon?: LucideIcon
  actions?: ReactNode
  details?: ReactNode
  className?: string
  surface?: StateSurface
  align?: 'center' | 'left'
}

interface ErrorStateProps extends SharedStateProps {
  message?: string | null
  onRetry?: () => void
  retryLabel?: string
}

interface PageStateSkeletonProps {
  variant?: SkeletonVariant
  count?: number
  className?: string
}

interface SectionSkeletonProps {
  lines?: number
  titleWidthClassName?: string
  className?: string
}

function StateSurface({
  children,
  className,
  surface,
}: {
  children: ReactNode
  className?: string
  surface: StateSurface
}) {
  if (surface === 'plain') {
    return (
      <div
        className={cn(
          'rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-6 sm:p-8',
          className,
        )}
      >
        {children}
      </div>
    )
  }

  return (
    <Card className={cn(SURFACE_CARD_CLASS_NAME, className)}>
      <CardContent className="p-6 sm:p-8">{children}</CardContent>
    </Card>
  )
}

function StateLayout({
  title,
  description,
  icon: Icon,
  actions,
  details,
  surface = 'card',
  align = 'center',
  className,
}: SharedStateProps) {
  const ResolvedIcon = Icon ?? Inbox

  return (
    <StateSurface surface={surface} className={className}>
      <div
        className={cn(
          'flex flex-col gap-4',
          align === 'center' ? 'items-center text-center' : 'items-start text-left',
        )}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
          <ResolvedIcon className="h-6 w-6" />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <p className="max-w-2xl text-sm leading-6 text-slate-600">{description}</p>
          {details ? <div className="text-sm text-slate-500">{details}</div> : null}
        </div>
        {actions ? (
          <div
            className={cn(
              'flex w-full flex-wrap gap-3',
              align === 'center' ? 'justify-center' : 'justify-start',
            )}
          >
            {actions}
          </div>
        ) : null}
      </div>
    </StateSurface>
  )
}

export function EmptyState({
  icon = Inbox,
  ...props
}: SharedStateProps) {
  return <StateLayout icon={icon} {...props} />
}

export function ErrorState({
  icon = AlertTriangle,
  message,
  onRetry,
  retryLabel,
  actions,
  ...props
}: ErrorStateProps) {
  const { t } = useI18n()
  const resolvedRetryLabel = retryLabel ?? t('common.retry')
  const composedActions =
    onRetry || actions ? (
      <>
        {onRetry ? (
          <Button type="button" variant="outline" onClick={onRetry}>
            {resolvedRetryLabel}
          </Button>
        ) : null}
        {actions}
      </>
    ) : null

  return (
    <StateLayout
      icon={icon}
      {...props}
      actions={composedActions}
      details={
        message && message.trim().length > 0 ? (
          <p className="max-w-2xl leading-6 text-slate-500">{message.trim()}</p>
        ) : null
      }
    />
  )
}

export function PageStateSkeleton({
  variant = 'cards',
  count = 6,
  className,
}: PageStateSkeletonProps) {
  if (variant === 'table') {
    return (
      <div className={cn('space-y-6', className)}>
        <Card className="rounded-2xl border border-slate-200/80 shadow-sm">
          <CardContent className="space-y-4 p-5">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-4 w-80 max-w-full" />
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-10 w-full sm:w-72" />
              <Skeleton className="h-10 w-full sm:w-28" />
              <Skeleton className="h-10 w-full sm:w-28" />
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border border-slate-200/80 shadow-sm">
          <CardContent className="space-y-3 p-5">
            {Array.from({ length: count }).map((_, index) => (
              <div key={`table-state-${index}`} className="grid gap-3 md:grid-cols-5">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    )
  }

  if (variant === 'detail') {
    return (
      <div className={cn('space-y-6', className)}>
        <Skeleton className="h-16 w-full rounded-2xl" />
        <div className="grid gap-4 lg:grid-cols-[320px,1fr]">
          <Skeleton className="h-[420px] w-full rounded-2xl" />
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={`detail-state-${index}`} className="h-48 w-full rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (variant === 'profile') {
    return (
      <div className={cn('space-y-4', className)}>
        <Skeleton className="h-24 w-full rounded-2xl" />
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <Skeleton className="h-[520px] w-full rounded-2xl" />
          <Skeleton className="h-[420px] w-full rounded-2xl" />
        </div>
      </div>
    )
  }

  if (variant === 'public-profile') {
    return (
      <div className={cn('space-y-6', className)}>
        <Card className="rounded-[28px] border border-slate-200/80 shadow-sm">
          <CardContent className="space-y-4 p-8">
            <div className="flex flex-col items-center gap-4 text-center">
              <Skeleton className="h-16 w-16 rounded-2xl" />
              <Skeleton className="h-4 w-52" />
              <Skeleton className="h-8 w-72 max-w-full" />
              <Skeleton className="h-4 w-80 max-w-full" />
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-[28px] border border-slate-200/80 shadow-sm">
          <CardContent className="p-8">
            <div className="grid gap-6 md:grid-cols-[160px,minmax(0,1fr)] md:items-center">
              <Skeleton className="mx-auto h-36 w-36 rounded-[28px] md:mx-0" />
              <div className="space-y-3">
                <Skeleton className="h-8 w-64 max-w-full" />
                <Skeleton className="h-5 w-52 max-w-full" />
                <div className="flex gap-2">
                  <Skeleton className="h-7 w-28 rounded-full" />
                  <Skeleton className="h-7 w-24 rounded-full" />
                </div>
                <Skeleton className="h-10 w-48 rounded-xl" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (variant === 'list') {
    return (
      <div className={cn('space-y-3', className)}>
        {Array.from({ length: count }).map((_, index) => (
          <Card key={`list-state-${index}`} className="rounded-2xl border border-slate-200/80 shadow-sm">
            <CardContent className="space-y-3 p-5">
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className={cn('grid gap-4 md:grid-cols-2 xl:grid-cols-3', className)}>
      {Array.from({ length: count }).map((_, index) => (
        <Card key={`card-state-${index}`} className="rounded-2xl border border-slate-200/80 shadow-sm">
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center gap-3">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-3 w-32" />
            <div className="flex gap-2 pt-1">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-8 w-20" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export function SectionSkeleton({
  lines = 3,
  titleWidthClassName = 'w-32',
  className,
}: SectionSkeletonProps) {
  return (
    <div className={cn('space-y-3', className)}>
      <Skeleton className={cn('h-5', titleWidthClassName)} />
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton key={`section-line-${index}`} className="h-10 w-full rounded-xl" />
      ))}
    </div>
  )
}

export function SearchEmptyState(props: Omit<SharedStateProps, 'icon'>) {
  return <EmptyState icon={SearchX} {...props} />
}
