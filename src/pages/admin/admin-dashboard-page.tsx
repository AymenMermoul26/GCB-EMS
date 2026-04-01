import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Building2,
  ClipboardList,
  FileClock,
  LayoutDashboard,
  Mail,
  Plus,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  UserMinus,
  Users,
} from 'lucide-react'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { BRAND_BUTTON_CLASS_NAME, PageHeader } from '@/components/common/page-header'
import { ErrorState } from '@/components/common/page-state'
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
import { ROUTES, getAdminEmployeeRoute } from '@/constants/routes'
import { useAuth } from '@/hooks/use-auth'
import { useI18n } from '@/hooks/use-i18n'
import type { TranslateFn } from '@/i18n/messages'
import { DashboardLayout } from '@/layouts/dashboard-layout'
import { cn } from '@/lib/utils'
import { useAdminDashboardQuery } from '@/services/adminDashboardService'
import type { AuditLogItem } from '@/types/audit-log'
import type { DemandeStatut, ModificationRequest } from '@/types/modification-request'
import { getEmployeePosteLabel } from '@/types/employee'
import { formatRelativeTime } from '@/utils/date'
import { getRequestFieldLabel } from '@/utils/modification-requests'

const KPI_CARD_STYLES = {
  totalEmployees: {
    icon: Users,
    accent:
      'bg-[linear-gradient(135deg,rgba(255,107,53,0.16),rgba(255,201,71,0.24))] text-[rgb(var(--brand-primary))]',
    helperKey: 'admin.dashboard.kpi.totalEmployees',
  },
  activeEmployees: {
    icon: UserCheck,
    accent: 'bg-emerald-100 text-emerald-700',
    helperKey: 'admin.dashboard.kpi.activeEmployees',
  },
  inactiveEmployees: {
    icon: UserMinus,
    accent: 'bg-slate-200 text-slate-700',
    helperKey: 'admin.dashboard.kpi.inactiveEmployees',
  },
  pendingRequests: {
    icon: ClipboardList,
    accent: 'bg-amber-100 text-amber-700',
    helperKey: 'admin.dashboard.kpi.pendingRequests',
  },
  departmentsCount: {
    icon: Building2,
    accent: 'bg-sky-100 text-sky-700',
    helperKey: 'admin.dashboard.kpi.departmentsCount',
  },
  unreadNotifications: {
    icon: Bell,
    accent: 'bg-rose-100 text-rose-700',
    helperKey: 'admin.dashboard.kpi.unreadNotifications',
  },
  invitesSentRecent: {
    icon: Mail,
    accent: 'bg-orange-100 text-orange-700',
    helperKey: 'admin.dashboard.kpi.invitesSentRecent',
  },
  inviteFailuresRecent: {
    icon: AlertTriangle,
    accent: 'bg-rose-100 text-rose-700',
    helperKey: 'admin.dashboard.kpi.inviteFailuresRecent',
  },
} as const

function formatDateTime(value: string, locale: string): string {
  return new Date(value).toLocaleString(locale)
}

function getActivityLabel(action: string, t: TranslateFn): string {
  const key = `audit.actions.${action}`
  const translated = t(key)
  return translated === key ? action.replaceAll('_', ' ') : translated
}

function getActivityBadgeClass(action: string): string {
  switch (action) {
    case 'EMPLOYEE_ACTIVATED':
    case 'REQUEST_APPROVED':
    case 'VISIBILITY_UPDATED':
      return 'border-transparent bg-emerald-100 text-emerald-700'
    case 'EMPLOYEE_INVITE_SENT':
    case 'EMPLOYEE_SHEET_EMAIL_SENT':
      return 'border-transparent bg-orange-100 text-orange-700'
    case 'EMPLOYEE_INVITE_ACCEPTED':
      return 'border-transparent bg-emerald-100 text-emerald-700'
    case 'EMPLOYEE_SHEET_EXPORTED':
    case 'QR_GENERATED':
    case 'QR_REGENERATED':
    case 'QR_REFRESH_COMPLETED':
    case 'PAYROLL_EXPORT_GENERATED':
    case 'PAYROLL_PERIOD_CREATED':
    case 'PAYROLL_RUN_CREATED':
    case 'PAYSLIP_REQUEST_STATUS_UPDATED':
    case 'PAYSLIP_DOCUMENT_DOWNLOADED':
      return 'border-transparent bg-sky-100 text-sky-700'
    case 'PAYROLL_EXPORT_PRINT_INITIATED':
    case 'PAYROLL_CALCULATION_STARTED':
    case 'PAYROLL_RUN_UPDATED':
    case 'PAYSLIP_REQUEST_CREATED':
      return 'border-transparent bg-amber-100 text-amber-700'
    case 'PAYROLL_CALCULATION_COMPLETED':
    case 'PAYROLL_RUN_FINALIZED':
    case 'PAYROLL_PAYSLIP_PUBLISHED':
    case 'PAYSLIP_REQUEST_FULFILLED':
    case 'PAYSLIP_DOCUMENT_PUBLISHED':
      return 'border-transparent bg-emerald-100 text-emerald-700'
    case 'PAYSLIP_DOCUMENT_VIEWED':
      return 'border-transparent bg-slate-100 text-slate-700'
    case 'PUBLIC_PROFILE_VIEWED':
      return 'border-transparent bg-emerald-100 text-emerald-700'
    case 'REQUEST_REJECTED':
    case 'EMPLOYEE_DEACTIVATED':
    case 'EMPLOYEE_INVITE_FAILED':
    case 'EMPLOYEE_SHEET_EMAIL_FAILED':
    case 'QR_REVOKED':
    case 'PAYROLL_CALCULATION_FAILED':
      return 'border-transparent bg-rose-100 text-rose-700'
    case 'REQUEST_SUBMITTED':
    case 'QR_REFRESH_REQUIRED_CREATED':
      return 'border-transparent bg-amber-100 text-amber-700'
    case 'EMPLOYEE_SHEET_PREVIEWED':
      return 'border-transparent bg-slate-100 text-slate-700'
    default:
      return 'border-transparent bg-slate-100 text-slate-700'
  }
}

function getInviteStatusBadgeClass(status: 'sent' | 'failed' | 'accepted'): string {
  if (status === 'failed') {
    return 'border-transparent bg-rose-100 text-rose-700'
  }

  if (status === 'accepted') {
    return 'border-transparent bg-emerald-100 text-emerald-700'
  }

  return 'border-transparent bg-orange-100 text-orange-700'
}

function getInviteStatusLabel(
  status: 'sent' | 'failed' | 'accepted',
  t: TranslateFn,
): string {
  return t(`status.invite.${status}`)
}

function getRequestStatusClass(status: DemandeStatut): string {
  switch (status) {
    case 'EN_ATTENTE':
      return 'border-transparent bg-amber-100 text-amber-700'
    case 'ACCEPTEE':
      return 'border-transparent bg-emerald-100 text-emerald-700'
    case 'REJETEE':
      return 'border-transparent bg-rose-100 text-rose-700'
    default:
      return 'border-transparent bg-slate-100 text-slate-700'
  }
}

function getRequestStatusLabel(status: DemandeStatut, t: TranslateFn): string {
  return t(`status.modification.${status}`)
}

function formatRequestSummary(
  request: ModificationRequest,
  t: TranslateFn,
): string {
  const fieldLabel = getRequestFieldLabel(request.champCible, t)
  const nextValue = request.nouvelleValeur?.trim() || t('common.noValueProvided')
  return `${fieldLabel}: ${nextValue}`
}

function getActivityHref(item: AuditLogItem): string | null {
  if (item.targetType === 'Employe' && item.targetId) {
    return getAdminEmployeeRoute(item.targetId)
  }

  if (item.targetType === 'DemandeModification') {
    return ROUTES.ADMIN_REQUESTS
  }

  return null
}

function SectionError({
  message,
  title,
}: {
  message?: string
  title: string
}) {
  if (!message) {
    return null
  }

  return (
    <Alert className="rounded-2xl border-amber-200 bg-amber-50 text-amber-900">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  )
}

function KpiSkeletonCard() {
  return (
    <Card className="rounded-2xl border border-slate-200/80 shadow-sm">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-11 w-11 rounded-2xl" />
        </div>
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-4 w-40" />
      </CardContent>
    </Card>
  )
}

function DistributionBar({
  label,
  value,
  total,
  helper,
}: {
  label: string
  value: number
  total: number
  helper: string
}) {
  const percentage = total > 0 ? Math.max(6, Math.round((value / total) * 100)) : 0

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-900">{label}</p>
          <p className="text-xs text-slate-500">{helper}</p>
        </div>
        <span className="text-sm font-semibold text-slate-700">{value}</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100">
        <div
          className="h-2 rounded-full bg-gradient-to-r from-[#ff6b35] to-[#ffc947]"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

function QuickActionButton({
  title,
  description,
  onClick,
  isRTL = false,
  primary = false,
}: {
  title: string
  description: string
  onClick: () => void
  isRTL?: boolean
  primary?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition-all duration-200',
        primary
          ? 'border-transparent bg-gradient-to-br from-[#ff6b35] to-[#ffc947] text-white shadow-[0_18px_34px_-22px_rgba(255,107,53,0.95)] hover:brightness-95'
          : 'border-slate-200 bg-white hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm',
      )}
    >
      <div>
        <p className={cn('text-sm font-semibold', primary ? 'text-white' : 'text-slate-900')}>
          {title}
        </p>
        <p className={cn('text-xs', primary ? 'text-white/85' : 'text-slate-500')}>
          {description}
        </p>
      </div>
      <ArrowRight
        className={cn('h-4 w-4', primary ? 'text-white' : 'text-slate-400', isRTL && 'rotate-180')}
      />
    </button>
  )
}

function ActivityItemRow({
  item,
  onOpen,
  t,
  locale,
}: {
  item: AuditLogItem
  onOpen: (href: string) => void
  t: TranslateFn
  locale: string
}) {
  const href = getActivityHref(item)
  const actionLabel = getActivityLabel(item.action, t)

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-slate-900">{actionLabel}</p>
            <Badge className={getActivityBadgeClass(item.action)}>{actionLabel}</Badge>
          </div>
          <p className="text-sm text-slate-600">{item.targetLabel}</p>
          <p className="text-xs text-slate-500">
            {t('admin.dashboard.sections.activityRow.byActor', { value: item.actorLabel })}
          </p>
        </div>
        {href ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => onOpen(href)}>
            {t('admin.dashboard.sections.activityRow.openButton')}
          </Button>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span>{item.detailsPreview}</span>
        <span title={formatDateTime(item.createdAt, locale)}>
          {formatRelativeTime(item.createdAt, locale)}
        </span>
      </div>
    </div>
  )
}

function RecentInviteItemRow({
  item,
  onOpenEmployee,
  t,
  locale,
}: {
  item: {
    id: string
    employeeId: string | null
    employeeName: string
    recipientEmail: string
    status: 'sent' | 'failed' | 'accepted'
    triggerSource: 'invite' | 'resend_invite' | null
    createdAt: string
    failureReason?: string
  }
  onOpenEmployee?: () => void
  t: TranslateFn
  locale: string
}) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-slate-900">{item.employeeName}</p>
            <Badge className={getInviteStatusBadgeClass(item.status)}>
              {getInviteStatusLabel(item.status, t)}
            </Badge>
            {item.triggerSource === 'resend_invite' ? (
              <Badge variant="outline" className="border-orange-200 bg-orange-50 text-orange-800">
                {t('admin.dashboard.sections.recentInvites.resendBadge')}
              </Badge>
            ) : null}
          </div>
          <p className="text-sm text-slate-600">{item.recipientEmail}</p>
          {item.failureReason ? (
            <p className="line-clamp-2 text-xs text-rose-700">{item.failureReason}</p>
          ) : item.status === 'accepted' ? (
            <p className="text-xs text-emerald-700">
              {t('admin.dashboard.sections.recentInvites.firstLoginCompleted')}
            </p>
          ) : (
            <p className="text-xs text-slate-500">
              {item.triggerSource === 'resend_invite'
                ? t('admin.dashboard.sections.recentInvites.resendRecorded')
                : t('admin.dashboard.sections.recentInvites.auditEvent')}
            </p>
          )}
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <span className="text-xs text-slate-500" title={formatDateTime(item.createdAt, locale)}>
            {formatRelativeTime(item.createdAt, locale)}
          </span>
          {onOpenEmployee ? (
            <Button type="button" variant="outline" size="sm" onClick={onOpenEmployee}>
              {t('admin.dashboard.sections.activityRow.openEmployee')}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function RecentPayrollActivityRow({
  item,
  onOpenEmployee,
  t,
  locale,
}: {
  item: {
    id: string
    action: string
    actionLabel: string
    tone: 'slate' | 'emerald' | 'amber' | 'rose' | 'sky' | 'orange'
    actorLabel: string
    targetLabel: string
    employeeId: string | null
    employeeName: string | null
    rowCount: number | null
    format: string | null
    fileName: string | null
    summary: string
    createdAt: string
  }
  onOpenEmployee?: () => void
  t: TranslateFn
  locale: string
}) {
  const actionLabel = getActivityLabel(item.action, t)

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-slate-900">
              {item.employeeName ?? item.targetLabel}
            </p>
            <Badge className={getActivityBadgeClass(item.action)}>{actionLabel}</Badge>
          </div>
          <p className="text-sm text-slate-600">{item.summary}</p>
          <p className="text-xs text-slate-500">
            {t('admin.dashboard.sections.activityRow.byActor', { value: item.actorLabel })}
            {item.rowCount !== null
              ? ` • ${t('admin.dashboard.sections.activityRow.rowCount', {
                  count: item.rowCount,
                })}`
              : ''}
            {item.fileName ? ` • ${item.fileName}` : item.format ? ` • ${item.format}` : ''}
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <span className="text-xs text-slate-500" title={formatDateTime(item.createdAt, locale)}>
            {formatRelativeTime(item.createdAt, locale)}
          </span>
          {onOpenEmployee ? (
            <Button type="button" variant="outline" size="sm" onClick={onOpenEmployee}>
              {t('admin.dashboard.sections.activityRow.openEmployee')}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export function AdminDashboardPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { t, locale, isRTL } = useI18n()
  const dashboardQuery = useAdminDashboardQuery(user?.id)

  const dashboard = dashboardQuery.data
  const maxDepartmentEmployeeCount = useMemo(() => {
    if (!dashboard || dashboard.departmentDistribution.length === 0) {
      return 0
    }

    return Math.max(...dashboard.departmentDistribution.map((item) => item.employeeCount))
  }, [dashboard])

  const totalRequests = dashboard?.requestOverview.total ?? 0
  const pendingRequestPercent =
    totalRequests > 0
      ? Math.round((dashboard!.requestOverview.pending / totalRequests) * 100)
      : 0
  const approvedRequestPercent =
    totalRequests > 0
      ? Math.round((dashboard!.requestOverview.approved / totalRequests) * 100)
      : 0
  const rejectedRequestPercent =
    totalRequests > 0
      ? Math.round((dashboard!.requestOverview.rejected / totalRequests) * 100)
      : 0

  if (!user?.id || (dashboardQuery.isPending && !dashboard)) {
    return (
      <DashboardLayout
        title={t('admin.dashboard.title')}
        subtitle={t('admin.dashboard.subtitle')}
      >
        <div className="space-y-6">
          <Card className="rounded-2xl border border-slate-200/80 shadow-sm">
            <CardContent className="flex flex-col gap-4 p-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-3">
                <Skeleton className="h-8 w-44" />
                <Skeleton className="h-4 w-80" />
                <Skeleton className="h-1.5 w-24" />
              </div>
              <div className="flex gap-3">
                <Skeleton className="h-10 w-24" />
                <Skeleton className="h-10 w-32" />
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <KpiSkeletonCard key={`kpi-skeleton-${index}`} />
            ))}
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.55fr_1fr]">
            <Card className="rounded-2xl border border-slate-200/80 shadow-sm">
              <CardContent className="space-y-4 p-6">
                <Skeleton className="h-5 w-52" />
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={`distribution-skeleton-${index}`} className="space-y-2">
                    <div className="flex justify-between gap-3">
                      <Skeleton className="h-4 w-44" />
                      <Skeleton className="h-4 w-10" />
                    </div>
                    <Skeleton className="h-2 w-full" />
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card className="rounded-2xl border border-slate-200/80 shadow-sm">
                <CardContent className="space-y-4 p-6">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
              <Card className="rounded-2xl border border-slate-200/80 shadow-sm">
                <CardContent className="space-y-3 p-6">
                  <Skeleton className="h-5 w-32" />
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Skeleton
                      key={`quick-action-skeleton-${index}`}
                      className="h-14 w-full rounded-2xl"
                    />
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (dashboardQuery.isError && !dashboard) {
    return (
      <DashboardLayout
        title={t('admin.dashboard.title')}
        subtitle={t('admin.dashboard.subtitle')}
      >
        <ErrorState
          title={t('admin.dashboard.loadErrorTitle')}
          description={t('admin.dashboard.loadErrorDescription')}
          message={dashboardQuery.error.message}
          icon={AlertTriangle}
          onRetry={() => void dashboardQuery.refetch()}
        />
      </DashboardLayout>
    )
  }

  if (!dashboard) {
    return null
  }

  return (
    <DashboardLayout
      title={t('admin.dashboard.title')}
      subtitle={t('admin.dashboard.subtitle')}
    >
      <div className="space-y-6">
        <PageHeader
          title={t('admin.dashboard.headerTitle')}
          description={t('admin.dashboard.headerDescription')}
          badges={
            <Badge className="border-transparent bg-orange-100 text-orange-700">
              <LayoutDashboard className={cn('h-3.5 w-3.5', isRTL ? 'ml-1.5' : 'mr-1.5')} />
              {t('admin.dashboard.badge')}
            </Badge>
          }
          actions={
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => void dashboardQuery.refetch()}
                disabled={dashboardQuery.isFetching}
              >
                <RefreshCw
                  className={cn(
                    'h-4 w-4',
                    isRTL ? 'ml-2' : 'mr-2',
                    dashboardQuery.isFetching && 'animate-spin',
                  )}
                />
                {t('actions.refresh')}
              </Button>
              <Button
                type="button"
                className={BRAND_BUTTON_CLASS_NAME}
                onClick={() => navigate(ROUTES.ADMIN_EMPLOYEES_NEW)}
              >
                <Plus className={cn('h-4 w-4', isRTL ? 'ml-2' : 'mr-2')} />
                {t('actions.addEmployee')}
              </Button>
            </>
          }
        />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              key: 'totalEmployees',
              title: t('admin.dashboard.kpi.totalEmployeesLabel'),
              value: dashboard.kpis.totalEmployees,
            },
            {
              key: 'activeEmployees',
              title: t('admin.dashboard.kpi.activeEmployeesLabel'),
              value: dashboard.kpis.activeEmployees,
            },
            {
              key: 'inactiveEmployees',
              title: t('admin.dashboard.kpi.inactiveEmployeesLabel'),
              value: dashboard.kpis.inactiveEmployees,
            },
            {
              key: 'pendingRequests',
              title: t('admin.dashboard.kpi.pendingRequestsLabel'),
              value: dashboard.kpis.pendingRequests,
            },
            {
              key: 'departmentsCount',
              title: t('admin.dashboard.kpi.departmentsCountLabel'),
              value: dashboard.kpis.departmentsCount,
            },
            {
              key: 'unreadNotifications',
              title: t('admin.dashboard.kpi.unreadNotificationsLabel'),
              value: dashboard.kpis.unreadNotifications,
            },
            {
              key: 'invitesSentRecent',
              title: t('admin.dashboard.kpi.invitesSentRecentLabel'),
              value: dashboard.kpis.invitesSentRecent,
            },
            {
              key: 'inviteFailuresRecent',
              title: t('admin.dashboard.kpi.inviteFailuresRecentLabel'),
              value: dashboard.kpis.inviteFailuresRecent,
            },
          ].map((item) => {
            const style = KPI_CARD_STYLES[item.key as keyof typeof KPI_CARD_STYLES]
            const Icon = style.icon

            return (
              <Card key={item.key} className="rounded-2xl border border-slate-200/80 shadow-sm">
                <CardContent className="space-y-4 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-slate-500">{item.title}</p>
                      <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                        {item.value}
                      </p>
                    </div>
                    <div
                      className={cn(
                        'flex h-11 w-11 items-center justify-center rounded-2xl',
                        style.accent,
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                  <p className="text-sm text-slate-500">{t(style.helperKey)}</p>
                </CardContent>
              </Card>
            )
          })}
        </div>

        <SectionError
          message={dashboard.sectionErrors.overview}
          title={t('admin.dashboard.partialDataUnavailable')}
        />

        <div className="grid gap-6 xl:grid-cols-[1.55fr_1fr]">
          <div className="space-y-6">
            <Card className="rounded-2xl border border-slate-200/80 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-semibold">
                  {t('admin.dashboard.sections.departmentDistribution.title')}
                </CardTitle>
                <CardDescription>
                  {t('admin.dashboard.sections.departmentDistribution.description')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {dashboard.departmentDistribution.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-6 text-center">
                    <p className="text-sm font-medium text-slate-900">
                      {t('admin.dashboard.sections.departmentDistribution.emptyTitle')}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {t('admin.dashboard.sections.departmentDistribution.emptyDescription')}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {dashboard.departmentDistribution.slice(0, 7).map((item) => (
                      <DistributionBar
                        key={item.id}
                        label={item.name}
                        value={item.employeeCount}
                        total={maxDepartmentEmployeeCount}
                        helper={t(
                          'admin.dashboard.sections.departmentDistribution.activeEmployees',
                          {
                            count: item.activeCount,
                          },
                        )}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-slate-200/80 shadow-sm">
              <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                <div>
                  <CardTitle className="text-base font-semibold">
                    {t('admin.dashboard.sections.recentActivity.title')}
                  </CardTitle>
                  <CardDescription>
                    {t('admin.dashboard.sections.recentActivity.description')}
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(ROUTES.ADMIN_AUDIT)}
                >
                  {t('admin.dashboard.quickActions.viewAuditLog.title')}
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <SectionError
                  message={dashboard.sectionErrors.recentActivity}
                  title={t('admin.dashboard.partialDataUnavailable')}
                />
                {dashboard.recentActivity.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-6 text-center">
                    <p className="text-sm font-medium text-slate-900">
                      {t('admin.dashboard.sections.recentActivity.emptyTitle')}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {t('admin.dashboard.sections.recentActivity.emptyDescription')}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {dashboard.recentActivity.map((item) => (
                      <ActivityItemRow
                        key={item.id}
                        item={item}
                        onOpen={(href) => navigate(href)}
                        t={t}
                        locale={locale}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="rounded-2xl border border-slate-200/80 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-semibold">
                  {t('admin.dashboard.sections.requestOverview.title')}
                </CardTitle>
                <CardDescription>
                  {t('admin.dashboard.sections.requestOverview.description')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {totalRequests === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-6 text-center">
                    <p className="text-sm font-medium text-slate-900">
                      {t('admin.dashboard.sections.requestOverview.emptyTitle')}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {t('admin.dashboard.sections.requestOverview.emptyDescription')}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                      <div className="rounded-2xl border border-amber-200/80 bg-amber-50 p-4">
                        <p className="text-xs font-medium uppercase tracking-[0.14em] text-amber-700">
                          {t('status.common.pending')}
                        </p>
                        <p className="mt-2 text-2xl font-semibold text-amber-900">
                          {dashboard.requestOverview.pending}
                        </p>
                        <p className="mt-1 text-xs text-amber-700">
                          {t('admin.dashboard.sections.requestOverview.pendingPercent', {
                            value: pendingRequestPercent,
                          })}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50 p-4">
                        <p className="text-xs font-medium uppercase tracking-[0.14em] text-emerald-700">
                          {t('status.common.approved')}
                        </p>
                        <p className="mt-2 text-2xl font-semibold text-emerald-900">
                          {dashboard.requestOverview.approved}
                        </p>
                        <p className="mt-1 text-xs text-emerald-700">
                          {t('admin.dashboard.sections.requestOverview.approvedPercent', {
                            value: approvedRequestPercent,
                          })}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-rose-200/80 bg-rose-50 p-4">
                        <p className="text-xs font-medium uppercase tracking-[0.14em] text-rose-700">
                          {t('status.common.rejected')}
                        </p>
                        <p className="mt-2 text-2xl font-semibold text-rose-900">
                          {dashboard.requestOverview.rejected}
                        </p>
                        <p className="mt-1 text-xs text-rose-700">
                          {t('admin.dashboard.sections.requestOverview.rejectedPercent', {
                            value: rejectedRequestPercent,
                          })}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <DistributionBar
                        label={t('admin.dashboard.sections.requestOverview.pendingReviewTitle')}
                        value={dashboard.requestOverview.pending}
                        total={totalRequests}
                        helper={t('admin.dashboard.sections.requestOverview.pendingReviewDescription')}
                      />
                      <DistributionBar
                        label={t('admin.dashboard.sections.requestOverview.approvedTitle')}
                        value={dashboard.requestOverview.approved}
                        total={totalRequests}
                        helper={t('admin.dashboard.sections.requestOverview.approvedDescription')}
                      />
                      <DistributionBar
                        label={t('admin.dashboard.sections.requestOverview.rejectedTitle')}
                        value={dashboard.requestOverview.rejected}
                        total={totalRequests}
                        helper={t('admin.dashboard.sections.requestOverview.rejectedDescription')}
                      />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-slate-200/80 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-semibold">
                  {t('admin.dashboard.sections.qrSummary.title')}
                </CardTitle>
                <CardDescription>
                  {t('admin.dashboard.sections.qrSummary.description')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                  <span className="text-sm text-slate-600">
                    {t('admin.dashboard.sections.qrSummary.activeQrEmployees')}
                  </span>
                  <span className="text-lg font-semibold text-slate-900">
                    {dashboard.qrSummary.activeQrEmployees}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                  <span className="text-sm text-slate-600">
                    {t('admin.dashboard.sections.qrSummary.employeesWithoutActiveQr')}
                  </span>
                  <span className="text-lg font-semibold text-slate-900">
                    {dashboard.qrSummary.employeesWithoutActiveQr}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                  <span className="text-sm text-slate-600">
                    {t('admin.dashboard.sections.qrSummary.needsQrRefresh')}
                  </span>
                  <span className="text-lg font-semibold text-slate-900">
                    {dashboard.qrSummary.needsQrRefresh}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                  <span className="text-sm text-slate-600">
                    {t('admin.dashboard.sections.qrSummary.publicProfileViewsRecent')}
                  </span>
                  <span className="text-lg font-semibold text-slate-900">
                    {dashboard.qrSummary.publicProfileViewsRecent}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-slate-200/80 shadow-sm">
              <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                <div>
                  <CardTitle className="text-base font-semibold">
                    {t('admin.dashboard.sections.recentInvites.title')}
                  </CardTitle>
                  <CardDescription>
                    {t('admin.dashboard.sections.recentInvites.description')}
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(ROUTES.ADMIN_AUDIT)}
                >
                  {t('admin.dashboard.quickActions.viewAuditLog.title')}
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <SectionError
                  message={dashboard.sectionErrors.recentInvites}
                  title={t('admin.dashboard.partialDataUnavailable')}
                />
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl border border-orange-200/80 bg-orange-50 px-4 py-3">
                    <p className="text-xs font-medium uppercase tracking-[0.14em] text-orange-700">
                      {t('status.invite.sent')}
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-orange-900">
                      {dashboard.inviteLifecycleSummary.sent}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-amber-200/80 bg-amber-50 px-4 py-3">
                    <p className="text-xs font-medium uppercase tracking-[0.14em] text-amber-700">
                      {t('admin.dashboard.sections.recentInvites.resendCount')}
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-amber-900">
                      {dashboard.inviteLifecycleSummary.resend}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50 px-4 py-3">
                    <p className="text-xs font-medium uppercase tracking-[0.14em] text-emerald-700">
                      {t('status.invite.accepted')}
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-emerald-900">
                      {dashboard.inviteLifecycleSummary.accepted}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-rose-200/80 bg-rose-50 px-4 py-3">
                    <p className="text-xs font-medium uppercase tracking-[0.14em] text-rose-700">
                      {t('status.invite.failed')}
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-rose-900">
                      {dashboard.inviteLifecycleSummary.failed}
                    </p>
                  </div>
                </div>
                {dashboard.recentInvites.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-6 text-center">
                    <p className="text-sm font-medium text-slate-900">
                      {t('admin.dashboard.sections.recentInvites.emptyTitle')}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {t('admin.dashboard.sections.recentInvites.emptyDescription')}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {dashboard.recentInvites.map((item) => (
                      <RecentInviteItemRow
                        key={item.id}
                        item={item}
                        onOpenEmployee={
                          item.employeeId
                            ? () => navigate(getAdminEmployeeRoute(item.employeeId as string))
                            : undefined
                        }
                        t={t}
                        locale={locale}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-slate-200/80 shadow-sm">
              <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                <div>
                  <CardTitle className="text-base font-semibold">
                    {t('admin.dashboard.recentPayrollActivity.title')}
                  </CardTitle>
                  <CardDescription>
                    {t('admin.dashboard.recentPayrollActivity.description')}
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(ROUTES.ADMIN_AUDIT)}
                >
                  {t('admin.dashboard.quickActions.viewAuditLog.title')}
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <SectionError
                  message={dashboard.sectionErrors.recentPayrollActivity}
                  title={t('admin.dashboard.partialDataUnavailable')}
                />
                {dashboard.recentPayrollActivity.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-6 text-center">
                    <p className="text-sm font-medium text-slate-900">
                      {t('admin.dashboard.recentPayrollActivity.emptyTitle')}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {t('admin.dashboard.recentPayrollActivity.emptyDescription')}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {dashboard.recentPayrollActivity.map((item) => (
                      <RecentPayrollActivityRow
                        key={item.id}
                        item={item}
                        onOpenEmployee={
                          item.employeeId
                            ? () => navigate(getAdminEmployeeRoute(item.employeeId as string))
                            : undefined
                        }
                        t={t}
                        locale={locale}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-slate-200/80 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-semibold">
                  {t('admin.dashboard.quickActions.title')}
                </CardTitle>
                <CardDescription>
                  {t('admin.dashboard.quickActions.description')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <QuickActionButton
                  title={t('admin.dashboard.quickActions.addEmployee.title')}
                  description={t('admin.dashboard.quickActions.addEmployee.description')}
                  onClick={() => navigate(ROUTES.ADMIN_EMPLOYEES_NEW)}
                  isRTL={isRTL}
                  primary
                />
                <QuickActionButton
                  title={t('admin.dashboard.quickActions.viewRequests.title')}
                  description={t('admin.dashboard.quickActions.viewRequests.description')}
                  onClick={() => navigate(ROUTES.ADMIN_REQUESTS)}
                  isRTL={isRTL}
                />
                <QuickActionButton
                  title={t('admin.dashboard.quickActions.manageDepartments.title')}
                  description={t('admin.dashboard.quickActions.manageDepartments.description')}
                  onClick={() => navigate(ROUTES.ADMIN_DEPARTMENTS)}
                  isRTL={isRTL}
                />
                <QuickActionButton
                  title={t('admin.dashboard.quickActions.openNotifications.title')}
                  description={t('admin.dashboard.quickActions.openNotifications.description')}
                  onClick={() => navigate(ROUTES.NOTIFICATIONS)}
                  isRTL={isRTL}
                />
                <QuickActionButton
                  title={t('admin.dashboard.quickActions.viewAuditLog.title')}
                  description={t('admin.dashboard.quickActions.viewAuditLog.description')}
                  onClick={() => navigate(ROUTES.ADMIN_AUDIT)}
                  isRTL={isRTL}
                />
                <QuickActionButton
                  title={t('admin.dashboard.quickActions.openMonitoring.title')}
                  description={t('admin.dashboard.quickActions.openMonitoring.description')}
                  onClick={() => navigate(ROUTES.ADMIN_MONITORING)}
                  isRTL={isRTL}
                />
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-slate-200/80 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-semibold">
                  {t('admin.dashboard.attention.title')}
                </CardTitle>
                <CardDescription>{t('admin.dashboard.attention.description')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {dashboard.alerts.length === 0 ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
                    <div className="flex items-start gap-3">
                      <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold">
                          {t('admin.dashboard.attention.emptyTitle')}
                        </p>
                        <p className="mt-1 text-sm text-emerald-800">
                          {t('admin.dashboard.attention.emptyDescription')}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  dashboard.alerts.map((alertItem) => (
                    <button
                      key={alertItem.id}
                      type="button"
                      onClick={() => alertItem.href && navigate(alertItem.href)}
                      className={cn(
                        'w-full rounded-2xl border p-4 text-left transition-colors',
                        alertItem.tone === 'warning'
                          ? 'border-amber-200 bg-amber-50 hover:bg-amber-100/70'
                          : 'border-slate-200 bg-slate-50 hover:bg-slate-100',
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {alertItem.title}
                          </p>
                          <p className="mt-1 text-sm text-slate-600">
                            {alertItem.description}
                          </p>
                        </div>
                        <ArrowRight
                          className={cn(
                            'mt-0.5 h-4 w-4 shrink-0 text-slate-400',
                            isRTL && 'rotate-180',
                          )}
                        />
                      </div>
                    </button>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <Card className="rounded-2xl border border-slate-200/80 shadow-sm">
            <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
              <div>
                <CardTitle className="text-base font-semibold">
                  {t('admin.dashboard.recentRequests.title')}
                </CardTitle>
                <CardDescription>
                  {t('admin.dashboard.recentRequests.description')}
                </CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => navigate(ROUTES.ADMIN_REQUESTS)}
              >
                {t('actions.review')}
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <SectionError
                message={dashboard.sectionErrors.recentRequests}
                title={t('admin.dashboard.partialDataUnavailable')}
              />
              {dashboard.recentRequests.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-6 text-center">
                  <p className="text-sm font-medium text-slate-900">
                    {t('admin.dashboard.recentRequests.emptyTitle')}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {t('admin.dashboard.recentRequests.emptyDescription')}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {dashboard.recentRequests.map((request) => {
                    const employeeName =
                      `${request.employePrenom ?? ''} ${request.employeNom ?? ''}`.trim() ||
                      request.employeMatricule ||
                      request.employeId

                    return (
                      <div
                        key={request.id}
                        className="rounded-2xl border border-slate-200/80 bg-white p-4"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-slate-900">
                                {employeeName}
                              </p>
                              <Badge className={getRequestStatusClass(request.statutDemande)}>
                                {getRequestStatusLabel(request.statutDemande, t)}
                              </Badge>
                            </div>
                            <p className="line-clamp-2 text-sm text-slate-600">
                              {formatRequestSummary(request, t)}
                            </p>
                            <p
                              className="text-xs text-slate-500"
                              title={formatDateTime(request.createdAt, locale)}
                            >
                              {t('admin.dashboard.recentRequests.submitted', {
                                value: formatRelativeTime(request.createdAt, locale),
                              })}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(ROUTES.ADMIN_REQUESTS)}
                          >
                            {t('actions.review')}
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

            <Card className="rounded-2xl border border-slate-200/80 shadow-sm">
              <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                <div>
                  <CardTitle className="text-base font-semibold">
                    {t('admin.dashboard.recentEmployees.title')}
                  </CardTitle>
                  <CardDescription>
                    {t('admin.dashboard.recentEmployees.description')}
                  </CardDescription>
                </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => navigate(ROUTES.ADMIN_EMPLOYEES)}
              >
                {t('actions.viewAll')}
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {dashboard.recentEmployees.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-6 text-center">
                  <p className="text-sm font-medium text-slate-900">
                    {t('admin.dashboard.recentEmployees.emptyTitle')}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {t('admin.dashboard.recentEmployees.emptyDescription')}
                  </p>
                </div>
              ) : (
                dashboard.recentEmployees.map((employee) => (
                  <button
                    key={employee.id}
                    type="button"
                    onClick={() => navigate(getAdminEmployeeRoute(employee.id))}
                    className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 text-left transition-colors hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {employee.fullName}
                        </p>
                        <Badge
                          variant={employee.isActive ? 'secondary' : 'outline'}
                          className={employee.isActive ? 'bg-emerald-100 text-emerald-700' : ''}
                        >
                          {employee.isActive ? t('status.common.active') : t('status.common.inactive')}
                        </Badge>
                      </div>
                      <p className="mt-1 truncate text-sm text-slate-600">
                        {getEmployeePosteLabel(employee.poste) ??
                          t('admin.dashboard.recentEmployees.noJobTitle')}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span>{employee.departmentName}</span>
                        <span>•</span>
                        <span>{employee.matricule}</span>
                        <span>•</span>
                        <span title={formatDateTime(employee.createdAt, locale)}>
                          {formatRelativeTime(employee.createdAt, locale)}
                        </span>
                      </div>
                    </div>
                    <ArrowRight
                      className={cn('h-4 w-4 shrink-0 text-slate-400', isRTL && 'rotate-180')}
                    />
                  </button>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-500">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <FileClock className="h-4 w-4" />
              <span>
                {t('admin.dashboard.footer.derivedFrom')}
              </span>
            </div>
            <span>
              {dashboardQuery.isFetching
                ? t('admin.dashboard.footer.refreshing')
                : t('admin.dashboard.footer.autoRefresh')}
            </span>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}


