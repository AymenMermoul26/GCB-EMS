import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Clock3,
  FileClock,
  Mail,
  QrCode,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react'
import { type CSSProperties, type ReactNode, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ROUTES, getAdminEmployeeRoute } from '@/constants/routes'
import { DashboardLayout } from '@/layouts/dashboard-layout'
import { cn } from '@/lib/utils'
import { useMonitoringDashboardQuery } from '@/services/monitoringDashboardService'
import type {
  MonitoringCategory,
  MonitoringDashboardData,
  MonitoringMetricItem,
  MonitoringPeriod,
  MonitoringRecentEvent,
  MonitoringRecentInviteItem,
  MonitoringTimelinePoint,
  MonitoringTone,
} from '@/types/monitoring-dashboard'

const PERIOD_OPTIONS: Array<{ value: MonitoringPeriod; label: string }> = [
  { value: 'TODAY', label: 'Today' },
  { value: 'LAST_7_DAYS', label: 'Last 7 days' },
  { value: 'LAST_30_DAYS', label: 'Last 30 days' },
]

const CATEGORY_OPTIONS: Array<{ value: MonitoringCategory; label: string }> = [
  { value: 'ALL', label: 'All event types' },
  { value: 'employee', label: 'Employee events' },
  { value: 'request', label: 'Request events' },
  { value: 'qr', label: 'QR events' },
  { value: 'email', label: 'Email events' },
  { value: 'security', label: 'Security / auth events' },
  { value: 'visibility', label: 'Visibility events' },
  { value: 'system', label: 'System events' },
]

const KPI_CARD_CONFIG = {
  totalEvents: {
    title: 'Total Events',
    icon: Activity,
    accent:
      'bg-[linear-gradient(135deg,rgba(255,107,53,0.16),rgba(255,201,71,0.24))] text-[rgb(var(--brand-primary))]',
  },
  qrEvents: {
    title: 'QR Events',
    icon: QrCode,
    accent: 'bg-sky-100 text-sky-700',
  },
  emailEvents: {
    title: 'Email Events',
    icon: Mail,
    accent: 'bg-orange-100 text-orange-700',
  },
  securityEvents: {
    title: 'Security / Auth',
    icon: ShieldAlert,
    accent: 'bg-rose-100 text-rose-700',
  },
  failedEvents: {
    title: 'Failed / Error',
    icon: AlertTriangle,
    accent: 'bg-rose-100 text-rose-700',
  },
  criticalEvents: {
    title: 'Critical Actions',
    icon: ShieldCheck,
    accent: 'bg-amber-100 text-amber-700',
  },
} as const

function toneBadgeClass(tone: MonitoringTone): string {
  switch (tone) {
    case 'emerald':
      return 'border-transparent bg-emerald-100 text-emerald-800'
    case 'amber':
      return 'border-transparent bg-amber-100 text-amber-800'
    case 'rose':
      return 'border-transparent bg-rose-100 text-rose-700'
    case 'sky':
      return 'border-transparent bg-sky-100 text-sky-800'
    case 'orange':
      return 'border-transparent bg-orange-100 text-orange-800'
    default:
      return 'border-transparent bg-slate-100 text-slate-700'
  }
}

function toneBarClass(tone: MonitoringTone): string {
  switch (tone) {
    case 'emerald':
      return 'bg-emerald-500'
    case 'amber':
      return 'bg-amber-500'
    case 'rose':
      return 'bg-rose-500'
    case 'sky':
      return 'bg-sky-500'
    case 'orange':
      return 'bg-orange-500'
    default:
      return 'bg-slate-500'
  }
}

function tonePanelClass(tone: 'info' | 'warning' | 'danger' | 'positive'): string {
  switch (tone) {
    case 'danger':
      return 'border-rose-200 bg-rose-50 hover:bg-rose-100/70'
    case 'warning':
      return 'border-amber-200 bg-amber-50 hover:bg-amber-100/70'
    case 'positive':
      return 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100/70'
    default:
      return 'border-slate-200 bg-slate-50 hover:bg-slate-100'
  }
}

function inviteStatusBadgeClass(status: 'sent' | 'failed'): string {
  return status === 'failed'
    ? 'border-transparent bg-rose-100 text-rose-700'
    : 'border-transparent bg-orange-100 text-orange-800'
}

function inviteStatusLabel(status: 'sent' | 'failed'): string {
  return status === 'failed' ? 'Failed' : 'Sent'
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString()
}

function formatRelativeDate(value: string): string {
  const now = Date.now()
  const target = new Date(value).getTime()
  const diffMs = target - now
  const diffMinutes = Math.round(diffMs / 60000)
  const absMinutes = Math.abs(diffMinutes)

  if (absMinutes < 1) {
    return 'Just now'
  }

  if (absMinutes < 60) {
    return `${absMinutes} minute${absMinutes === 1 ? '' : 's'} ${
      diffMinutes >= 0 ? 'from now' : 'ago'
    }`
  }

  const diffHours = Math.round(diffMinutes / 60)
  const absHours = Math.abs(diffHours)
  if (absHours < 24) {
    return `${absHours} hour${absHours === 1 ? '' : 's'} ${
      diffHours >= 0 ? 'from now' : 'ago'
    }`
  }

  const diffDays = Math.round(diffHours / 24)
  const absDays = Math.abs(diffDays)
  return `${absDays} day${absDays === 1 ? '' : 's'} ${diffDays >= 0 ? 'from now' : 'ago'}`
}

function periodHelperText(period: MonitoringPeriod): string {
  switch (period) {
    case 'TODAY':
      return 'today'
    case 'LAST_7_DAYS':
      return 'in the last 7 days'
    case 'LAST_30_DAYS':
      return 'in the last 30 days'
    default:
      return 'in the selected period'
  }
}

function EmptyWidget({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-8 text-center">
      <p className="text-sm font-medium text-slate-900">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </div>
  )
}

function MonitoringPageSkeleton() {
  return (
    <DashboardLayout
      title="Monitoring Dashboard"
      subtitle="Summarized technical view of tracked system activity."
    >
      <div className="space-y-6">
        <Card className="rounded-2xl border border-slate-200/80 shadow-sm">
          <CardContent className="flex flex-col gap-4 p-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3">
              <Skeleton className="h-6 w-32 rounded-full" />
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-80" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:flex">
              <Skeleton className="h-10 w-full sm:w-40" />
              <Skeleton className="h-10 w-full sm:w-44" />
              <Skeleton className="h-10 w-full sm:w-28" />
              <Skeleton className="h-10 w-full sm:w-32" />
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Card
              key={`monitoring-kpi-${index}`}
              className="rounded-2xl border border-slate-200/80 shadow-sm"
            >
              <CardContent className="space-y-4 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-9 w-20" />
                  </div>
                  <Skeleton className="h-11 w-11 rounded-2xl" />
                </div>
                <Skeleton className="h-4 w-40" />
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.65fr_0.95fr]">
          <ChartSkeleton titleWidth="w-48" />
          <ChartSkeleton titleWidth="w-40" compact />
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <ChartSkeleton titleWidth="w-36" />
          <ChartSkeleton titleWidth="w-32" />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.3fr_0.95fr]">
          <ChartSkeleton titleWidth="w-44" />
          <div className="space-y-6">
            <ChartSkeleton titleWidth="w-40" compact />
            <ChartSkeleton titleWidth="w-44" compact />
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

function ChartSkeleton({
  titleWidth,
  compact = false,
}: {
  titleWidth: string
  compact?: boolean
}) {
  return (
    <Card className="rounded-2xl border border-slate-200/80 shadow-sm">
      <CardHeader className="space-y-2">
        <Skeleton className={cn('h-5', titleWidth)} />
        <Skeleton className="h-4 w-64" />
      </CardHeader>
      <CardContent className={cn('space-y-4', compact ? 'min-h-[240px]' : 'min-h-[320px]')}>
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="h-4 w-44" />
      </CardContent>
    </Card>
  )
}

function KpiCard({
  title,
  value,
  helper,
  icon,
  accentClass,
}: {
  title: string
  value: number
  helper: string
  icon: ReactNode
  accentClass: string
}) {
  return (
    <Card className="rounded-2xl border border-slate-200/80 shadow-sm">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-500">{title}</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
          </div>
          <div
            className={cn('flex h-11 w-11 items-center justify-center rounded-2xl', accentClass)}
          >
            {icon}
          </div>
        </div>
        <p className="text-sm text-slate-500">{helper}</p>
      </CardContent>
    </Card>
  )
}
function ActivityTimelineChart({
  data,
}: {
  data: MonitoringTimelinePoint[]
}) {
  const chartWidth = 760
  const chartHeight = 250
  const padding = { top: 18, right: 16, bottom: 32, left: 8 }
  const innerWidth = chartWidth - padding.left - padding.right
  const innerHeight = chartHeight - padding.top - padding.bottom
  const maxValue = Math.max(...data.map((point) => point.total), 1)
  const maxCritical = Math.max(...data.map((point) => point.critical), 0)

  if (data.every((point) => point.total === 0)) {
    return (
      <EmptyWidget
        title="No tracked activity"
        description="Activity spikes and usage patterns will appear here once events are recorded."
      />
    )
  }

  const buildX = (index: number) =>
    data.length === 1
      ? padding.left + innerWidth / 2
      : padding.left + (index / (data.length - 1)) * innerWidth

  const totalPoints = data.map((point, index) => ({
    x: buildX(index),
    y: padding.top + innerHeight - (point.total / maxValue) * innerHeight,
    label: point.fullLabel,
    value: point.total,
  }))

  const criticalPoints = data.map((point, index) => ({
    x: buildX(index),
    y:
      padding.top + innerHeight -
      (point.critical / Math.max(maxCritical, 1)) * innerHeight,
    label: point.fullLabel,
    value: point.critical,
  }))

  const totalLinePath = totalPoints
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ')

  const totalAreaPath = [
    `M ${totalPoints[0].x} ${padding.top + innerHeight}`,
    ...totalPoints.map((point) => `L ${point.x} ${point.y}`),
    `L ${totalPoints[totalPoints.length - 1].x} ${padding.top + innerHeight}`,
    'Z',
  ].join(' ')

  const criticalLinePath =
    maxCritical > 0
      ? criticalPoints
          .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
          .join(' ')
      : null

  const yAxisSteps = Array.from({ length: 4 }, (_, index) => {
    const ratio = index / 3
    const y = padding.top + ratio * innerHeight
    const label = Math.round(maxValue - ratio * maxValue)
    return { y, label }
  })

  const labelStep = data.length > 12 ? Math.ceil(data.length / 8) : 1

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[rgb(var(--brand-primary))]" />
          Total events
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-rose-500" />
          Critical events
        </span>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="h-[260px] w-full">
          <defs>
            <linearGradient id="monitoring-total-fill" x1="0%" x2="0%" y1="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(255, 107, 53, 0.38)" />
              <stop offset="100%" stopColor="rgba(255, 201, 71, 0.04)" />
            </linearGradient>
          </defs>

          {yAxisSteps.map((step) => (
            <g key={`grid-${step.label}`}>
              <line
                x1={padding.left}
                x2={padding.left + innerWidth}
                y1={step.y}
                y2={step.y}
                stroke="rgba(148, 163, 184, 0.18)"
                strokeDasharray="5 5"
              />
              <text
                x={padding.left + innerWidth - 4}
                y={step.y - 6}
                textAnchor="end"
                className="fill-slate-400 text-[10px]"
              >
                {step.label}
              </text>
            </g>
          ))}

          <path d={totalAreaPath} fill="url(#monitoring-total-fill)" />
          <path
            d={totalLinePath}
            fill="none"
            stroke="rgb(var(--brand-primary))"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="3"
          />

          {criticalLinePath ? (
            <path
              d={criticalLinePath}
              fill="none"
              stroke="#f43f5e"
              strokeDasharray="6 4"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
          ) : null}

          {totalPoints.map((point, index) => (
            <g key={`point-${data[index].key}`}>
              <circle
                cx={point.x}
                cy={point.y}
                r="4"
                fill="white"
                stroke="rgb(var(--brand-primary))"
                strokeWidth="2"
              >
                <title>{`${point.label}: ${point.value} events`}</title>
              </circle>
            </g>
          ))}
        </svg>
      </div>

      <div
        className="grid gap-2 text-[11px] text-slate-500"
        style={{
          gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))`,
        }}
      >
        {data.map((point, index) => (
          <span
            key={point.key}
            className={cn(
              'truncate text-center',
              index % labelStep !== 0 && index !== data.length - 1 && 'opacity-0',
            )}
            title={point.fullLabel}
          >
            {point.label}
          </span>
        ))}
      </div>
    </div>
  )
}

function DistributionDonut({
  data,
  total,
}: {
  data: MonitoringDashboardData['categoryDistribution']
  total: number
}) {
  if (total === 0 || data.length === 0) {
    return (
      <EmptyWidget
        title="No distribution yet"
        description="Event categories will appear once tracked activity is available."
      />
    )
  }

  const segments = data.reduce(
    (result, item) => {
      const start = result.progress
      const nextProgress = start + (item.value / total) * 360

      return {
        progress: nextProgress,
        segments: [...result.segments, `${item.color} ${start}deg ${nextProgress}deg`],
      }
    },
    {
      progress: 0,
      segments: [] as string[],
    },
  ).segments

  const donutStyle: CSSProperties = {
    background: `conic-gradient(${segments.join(', ')})`,
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
      <div className="mx-auto">
        <div
          className="relative h-52 w-52 rounded-full shadow-[inset_0_1px_4px_rgba(15,23,42,0.08)]"
          style={donutStyle}
        >
          <div className="absolute inset-[24%] flex flex-col items-center justify-center rounded-full bg-white shadow-[inset_0_1px_3px_rgba(15,23,42,0.08)]">
            <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Events</span>
            <span className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{total}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-3">
        {data.map((item) => {
          const percentage = total > 0 ? Math.round((item.value / total) * 100) : 0

          return (
            <div key={item.key} className="rounded-2xl border border-slate-200 bg-white p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: item.color }}
                    aria-hidden="true"
                  />
                  <span className="text-sm font-medium text-slate-900">{item.label}</span>
                </div>
                <span className="text-sm font-semibold text-slate-700">{item.value}</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">{percentage}% of tracked events</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function MetricBars({
  items,
  emptyTitle,
  emptyDescription,
}: {
  items: MonitoringMetricItem[]
  emptyTitle: string
  emptyDescription: string
}) {
  const maxValue = Math.max(...items.map((item) => item.value), 0)

  if (maxValue === 0) {
    return <EmptyWidget title={emptyTitle} description={emptyDescription} />
  }

  return (
    <div className="space-y-4">
      {items.map((item) => {
        const width =
          maxValue > 0 && item.value > 0
            ? Math.max(10, Math.round((item.value / maxValue) * 100))
            : 0

        return (
          <div key={item.key} className="space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900">{item.label}</p>
                <p className="text-xs text-slate-500">{item.helper}</p>
              </div>
              <span className="text-sm font-semibold text-slate-700">{item.value}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100">
              <div
                className={cn(
                  'h-2 rounded-full transition-[width] duration-300',
                  toneBarClass(item.tone),
                )}
                style={{ width: `${width}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function RecentInviteActivityList({
  items,
  onOpenEmployee,
}: {
  items: MonitoringRecentInviteItem[]
  onOpenEmployee: (employeeId: string) => void
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">Recent invite activity</p>
          <p className="text-xs text-slate-500">
            Latest invite-email sends and failures in the selected view.
          </p>
        </div>
        <Badge variant="outline" className="rounded-full">
          {items.length} shown
        </Badge>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-4 text-center">
          <p className="text-sm font-medium text-slate-900">No invite-specific activity</p>
          <p className="mt-1 text-sm text-slate-500">
            Invite sends and failures will appear here when they fall inside the selected filters.
          </p>
        </div>
      ) : (
        items.map((item) => (
          <div key={item.id} className="rounded-2xl border border-slate-200/80 bg-white p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-slate-900">{item.employeeName}</p>
                  <Badge className={inviteStatusBadgeClass(item.status)}>
                    {inviteStatusLabel(item.status)}
                  </Badge>
                </div>
                <p className="text-sm text-slate-600">{item.recipientEmail}</p>
                {item.failureReason ? (
                  <p className="line-clamp-2 text-xs text-rose-700">{item.failureReason}</p>
                ) : (
                  <p className="text-xs text-slate-500">Invite email audit event</p>
                )}
              </div>
              <div className="flex flex-col items-start gap-2 sm:items-end">
                <span className="text-xs text-slate-500" title={formatDateTime(item.createdAt)}>
                  {formatRelativeDate(item.createdAt)}
                </span>
                {item.employeeId ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onOpenEmployee(item.employeeId as string)}
                  >
                    Open employee
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  )
}

function RecentCriticalEventRow({
  item,
  onOpenEmployee,
}: {
  item: MonitoringRecentEvent
  onOpenEmployee?: () => void
}) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={toneBadgeClass(item.tone)}>{item.actionLabel}</Badge>
            <Badge variant="outline" className="text-[11px]">
              {item.categoryLabel}
            </Badge>
          </div>
          <p className="text-sm font-semibold text-slate-900">{item.targetLabel}</p>
          <p className="line-clamp-2 text-sm text-slate-600">{item.detailsPreview}</p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>By {item.actorLabel}</span>
            <span>•</span>
            <span title={formatDateTime(item.createdAt)}>{formatRelativeDate(item.createdAt)}</span>
          </div>
        </div>
        {onOpenEmployee ? (
          <Button type="button" size="sm" variant="outline" onClick={onOpenEmployee}>
            Open employee
          </Button>
        ) : null}
      </div>
    </div>
  )
}

function MonitoringInsights({
  dashboard,
  onOpenAudit,
}: {
  dashboard: MonitoringDashboardData
  onOpenAudit: () => void
}) {
  return (
    <div className="space-y-6">
      <Card className="rounded-2xl border border-slate-200/80 shadow-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="text-base font-semibold">Attention needed</CardTitle>
          <CardDescription>
            High-signal items derived from the current monitoring window.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {dashboard.attentionItems.length === 0 ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold">No urgent monitoring alerts</p>
                  <p className="mt-1 text-sm text-emerald-800">
                    The selected period does not contain high-attention failures or unresolved QR signals.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            dashboard.attentionItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={onOpenAudit}
                className={cn(
                  'w-full rounded-2xl border p-4 text-left transition-colors',
                  tonePanelClass(item.tone),
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                    <p className="mt-1 text-sm text-slate-600">{item.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="rounded-full">
                      {item.count}
                    </Badge>
                    <ArrowRight className="h-4 w-4 text-slate-400" />
                  </div>
                </div>
              </button>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border border-slate-200/80 shadow-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="text-base font-semibold">Top active event types</CardTitle>
          <CardDescription>
            Most frequent action codes in the current monitoring period.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {dashboard.topActions.length === 0 ? (
            <EmptyWidget
              title="No action frequency yet"
              description="Top event types will appear once logs accumulate."
            />
          ) : (
            dashboard.topActions.map((item) => (
              <div key={item.action} className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-slate-900">{item.label}</p>
                      <Badge className={toneBadgeClass(item.tone)}>{item.categoryLabel}</Badge>
                    </div>
                    <p className="mt-1 font-mono text-xs text-slate-500">{item.action}</p>
                  </div>
                  <span className="text-sm font-semibold text-slate-700">{item.count}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100">
                  <div
                    className={cn('h-2 rounded-full', toneBarClass(item.tone))}
                    style={{
                      width: `${Math.max(
                        10,
                        Math.round((item.count / dashboard.topActions[0].count) * 100),
                      )}%`,
                    }}
                  />
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
export function AdminMonitoringPage() {
  const navigate = useNavigate()
  const [period, setPeriod] = useState<MonitoringPeriod>('LAST_7_DAYS')
  const [category, setCategory] = useState<MonitoringCategory>('ALL')

  const dashboardQuery = useMonitoringDashboardQuery({ period, category })
  const dashboard = dashboardQuery.data

  const hasActiveFilters = period !== 'LAST_7_DAYS' || category !== 'ALL'
  const selectedCategoryLabel = useMemo(
    () => CATEGORY_OPTIONS.find((option) => option.value === category)?.label ?? 'All event types',
    [category],
  )

  const peakTimelinePoint = useMemo(() => {
    if (!dashboard || dashboard.activityTimeline.length === 0) {
      return null
    }

    return dashboard.activityTimeline.reduce((currentPeak, point) =>
      point.total > currentPeak.total ? point : currentPeak,
    )
  }, [dashboard])

  if (dashboardQuery.isPending && !dashboard) {
    return <MonitoringPageSkeleton />
  }

  if (dashboardQuery.isError && !dashboard) {
    return (
      <DashboardLayout
        title="Monitoring Dashboard"
        subtitle="Summarized technical view of tracked system activity."
      >
        <Alert variant="destructive" className="rounded-2xl">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Failed to load monitoring dashboard</AlertTitle>
          <AlertDescription className="mt-2 flex flex-wrap items-center gap-3">
            <span>{dashboardQuery.error.message}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void dashboardQuery.refetch()}
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      </DashboardLayout>
    )
  }

  if (!dashboard) {
    return null
  }

  const periodText = periodHelperText(dashboard.period)

  return (
    <DashboardLayout
      title="Monitoring Dashboard"
      subtitle="Summarized technical view of tracked system activity."
    >
      <div className="space-y-6">
        <div className="sticky top-2 z-20 rounded-2xl border bg-white/95 p-4 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/80">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-medium text-orange-700">
                <Activity className="h-3.5 w-3.5" />
                Technical monitoring
              </div>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
                    Monitoring Dashboard
                  </h2>
                  <Badge variant="secondary" className="rounded-full">
                    {dashboard.filteredEvents} visible
                  </Badge>
                  {category !== 'ALL' ? (
                    <Badge variant="outline" className="rounded-full">
                      {selectedCategoryLabel}
                    </Badge>
                  ) : null}
                </div>
                <p className="max-w-3xl text-sm text-slate-600">
                  Track recent audit, QR, email, and security-related signals without leaving the admin workspace.
                </p>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  <span>{dashboard.rangeLabel}</span>
                  <span>•</span>
                  <span>{dashboard.totalAvailableEvents} total events in scope</span>
                  <span>•</span>
                  <span>
                    {dashboardQuery.isFetching ? 'Refreshing live data...' : 'Auto-refresh every minute'}
                  </span>
                </div>
              </div>
              <div className="h-1.5 w-24 rounded-full bg-gradient-to-br from-[#ff6b35] to-[#ffc947]" />
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:flex">
              <Select value={period} onValueChange={(value) => setPeriod(value as MonitoringPeriod)}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Period" />
                </SelectTrigger>
                <SelectContent>
                  {PERIOD_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={category} onValueChange={(value) => setCategory(value as MonitoringCategory)}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Event type" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {hasActiveFilters ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setPeriod('LAST_7_DAYS')
                    setCategory('ALL')
                  }}
                >
                  Reset
                </Button>
              ) : null}

              <Button
                type="button"
                variant="outline"
                disabled={dashboardQuery.isFetching}
                onClick={() => void dashboardQuery.refetch()}
              >
                <RefreshCw
                  className={cn('mr-2 h-4 w-4', dashboardQuery.isFetching && 'animate-spin')}
                />
                Refresh
              </Button>

              <Button type="button" variant="outline" onClick={() => navigate(ROUTES.ADMIN_AUDIT)}>
                <FileClock className="mr-2 h-4 w-4" />
                Audit Log
              </Button>
            </div>
          </div>
        </div>

        {dashboard.filteredEvents === 0 ? (
          <Alert className="rounded-2xl border border-slate-200 bg-slate-50 text-slate-800">
            <Clock3 className="h-4 w-4" />
            <AlertTitle>No tracked events for this view</AlertTitle>
            <AlertDescription className="flex flex-wrap items-center gap-3">
              <span>Change the time window or event filter to inspect a broader set of activity.</span>
              {hasActiveFilters ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setPeriod('LAST_7_DAYS')
                    setCategory('ALL')
                  }}
                >
                  Reset filters
                </Button>
              ) : null}
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <KpiCard
            title={KPI_CARD_CONFIG.totalEvents.title}
            value={dashboard.kpis.totalEvents}
            helper={`Events recorded ${periodText}`}
            icon={<Activity className="h-5 w-5" />}
            accentClass={KPI_CARD_CONFIG.totalEvents.accent}
          />
          <KpiCard
            title={KPI_CARD_CONFIG.qrEvents.title}
            value={dashboard.kpis.qrEvents}
            helper={`Recent QR lifecycle actions ${periodText}`}
            icon={<QrCode className="h-5 w-5" />}
            accentClass={KPI_CARD_CONFIG.qrEvents.accent}
          />
          <KpiCard
            title={KPI_CARD_CONFIG.emailEvents.title}
            value={dashboard.kpis.emailEvents}
            helper={`Tracked email operations ${periodText}`}
            icon={<Mail className="h-5 w-5" />}
            accentClass={KPI_CARD_CONFIG.emailEvents.accent}
          />
          <KpiCard
            title={KPI_CARD_CONFIG.securityEvents.title}
            value={dashboard.kpis.securityEvents}
            helper={
              dashboard.hasSecuritySignals
                ? `Security-related events ${periodText}`
                : 'No auth-specific events tracked in this window'
            }
            icon={<ShieldAlert className="h-5 w-5" />}
            accentClass={KPI_CARD_CONFIG.securityEvents.accent}
          />
          <KpiCard
            title={KPI_CARD_CONFIG.failedEvents.title}
            value={dashboard.kpis.failedEvents}
            helper={`Failed or error events ${periodText}`}
            icon={<AlertTriangle className="h-5 w-5" />}
            accentClass={KPI_CARD_CONFIG.failedEvents.accent}
          />
          <KpiCard
            title={KPI_CARD_CONFIG.criticalEvents.title}
            value={dashboard.kpis.criticalEvents}
            helper="High-attention actions derived from the audit stream"
            icon={<ShieldCheck className="h-5 w-5" />}
            accentClass={KPI_CARD_CONFIG.criticalEvents.accent}
          />
        </div>
        <div className="grid gap-6 xl:grid-cols-[1.65fr_0.95fr]">
          <Card className="rounded-2xl border border-slate-200/80 shadow-sm">
            <CardHeader className="space-y-2">
              <CardTitle className="text-base font-semibold">System activity over time</CardTitle>
              <CardDescription>
                Logged event volume over {dashboard.rangeLabel.toLowerCase()}.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-3">
                <CompactStat
                  label="Peak activity"
                  value={peakTimelinePoint?.total ?? 0}
                  helper={peakTimelinePoint?.fullLabel ?? 'No peak recorded'}
                />
                <CompactStat
                  label="Critical windows"
                  value={dashboard.activityTimeline.filter((point) => point.critical > 0).length}
                  helper="Buckets containing critical events"
                />
                <CompactStat
                  label="Email spikes"
                  value={Math.max(...dashboard.activityTimeline.map((point) => point.email), 0)}
                  helper="Highest email event count in one bucket"
                />
              </div>
              <ActivityTimelineChart data={dashboard.activityTimeline} />
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-slate-200/80 shadow-sm">
            <CardHeader className="space-y-2">
              <CardTitle className="text-base font-semibold">Event type distribution</CardTitle>
              <CardDescription>
                Category mix derived from real audit action groupings.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DistributionDonut
                data={dashboard.categoryDistribution}
                total={dashboard.kpis.totalEvents}
              />
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card className="rounded-2xl border border-slate-200/80 shadow-sm">
            <CardHeader className="space-y-2">
              <CardTitle className="text-base font-semibold">QR activity</CardTitle>
              <CardDescription>
                Generated from the QR lifecycle actions already stored in the audit log.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MetricBars
                items={dashboard.qrActivity}
                emptyTitle="No QR events"
                emptyDescription="QR generation, revocation, and refresh activity will appear here."
              />
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-slate-200/80 shadow-sm">
            <CardHeader className="space-y-2">
              <CardTitle className="text-base font-semibold">Email activity</CardTitle>
              <CardDescription>
                Invite and information-sheet delivery activity tracked by backend audit events.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <MetricBars
                items={dashboard.emailActivity}
                emptyTitle="No email events"
                emptyDescription="Tracked invite and information-sheet email activity will appear here."
              />
              <div className="border-t border-slate-200 pt-5">
                <RecentInviteActivityList
                  items={dashboard.recentInviteEvents}
                  onOpenEmployee={(employeeId) => navigate(getAdminEmployeeRoute(employeeId))}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.3fr_0.95fr]">
          <Card className="rounded-2xl border border-slate-200/80 shadow-sm">
            <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
              <div className="space-y-1">
                <CardTitle className="text-base font-semibold">Recent critical events</CardTitle>
                <CardDescription>
                  Latest high-attention actions from the current monitoring window.
                </CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => navigate(ROUTES.ADMIN_AUDIT)}
              >
                Open audit log
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {dashboard.sectionErrors.recentCriticalEvents ? (
                <Alert className="rounded-2xl border-amber-200 bg-amber-50 text-amber-900">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Partial detail lookup unavailable</AlertTitle>
                  <AlertDescription>{dashboard.sectionErrors.recentCriticalEvents}</AlertDescription>
                </Alert>
              ) : null}

              {dashboard.recentCriticalEvents.length === 0 ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold">No critical events</p>
                      <p className="mt-1 text-sm text-emerald-800">
                        This view currently contains no flagged deactivations, failures, revocations, or rejected actions.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {dashboard.recentCriticalEvents.map((item) => (
                    <RecentCriticalEventRow
                      key={item.id}
                      item={item}
                      onOpenEmployee={
                        item.targetType === 'Employe' && item.targetId
                          ? () => navigate(getAdminEmployeeRoute(item.targetId as string))
                          : undefined
                      }
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <MonitoringInsights
            dashboard={dashboard}
            onOpenAudit={() => navigate(ROUTES.ADMIN_AUDIT)}
          />
        </div>

        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-500">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <FileClock className="h-4 w-4" />
              <span>
                Monitoring data is derived from real audit log events, including QR lifecycle and backend email tracking entries.
              </span>
            </div>
            <span>
              {dashboardQuery.isFetching
                ? 'Refreshing data...'
                : `Viewing ${dashboard.rangeLabel.toLowerCase()}.`}
            </span>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

function CompactStat({
  label,
  value,
  helper,
}: {
  label: string
  value: number
  helper: string
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{helper}</p>
    </div>
  )
}
