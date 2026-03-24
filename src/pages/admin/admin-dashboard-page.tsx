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
import { DashboardLayout } from '@/layouts/dashboard-layout'
import { cn } from '@/lib/utils'
import { useAdminDashboardQuery } from '@/services/adminDashboardService'
import type { AuditLogItem } from '@/types/audit-log'
import type { DemandeStatut, ModificationRequest } from '@/types/modification-request'
import { getEmployeePosteLabel } from '@/types/employee'
import { REQUEST_FIELD_LABELS } from '@/utils/modification-requests'

const KPI_CARD_STYLES = {
  totalEmployees: {
    icon: Users,
    accent:
      'bg-[linear-gradient(135deg,rgba(255,107,53,0.16),rgba(255,201,71,0.24))] text-[rgb(var(--brand-primary))]',
    helper: 'Current registered employees',
  },
  activeEmployees: {
    icon: UserCheck,
    accent: 'bg-emerald-100 text-emerald-700',
    helper: 'Employees with active accounts',
  },
  inactiveEmployees: {
    icon: UserMinus,
    accent: 'bg-slate-200 text-slate-700',
    helper: 'Inactive employee records',
  },
  pendingRequests: {
    icon: ClipboardList,
    accent: 'bg-amber-100 text-amber-700',
    helper: 'Awaiting HR review',
  },
  departmentsCount: {
    icon: Building2,
    accent: 'bg-sky-100 text-sky-700',
    helper: 'Configured departments',
  },
  unreadNotifications: {
    icon: Bell,
    accent: 'bg-rose-100 text-rose-700',
    helper: 'Unread admin notifications',
  },
  invitesSentRecent: {
    icon: Mail,
    accent: 'bg-orange-100 text-orange-700',
    helper: 'Initial employee invite emails sent in the last 7 days',
  },
  inviteFailuresRecent: {
    icon: AlertTriangle,
    accent: 'bg-rose-100 text-rose-700',
    helper: 'Invite delivery failures in the last 7 days',
  },
} as const

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
    return `${absMinutes} minute${absMinutes === 1 ? '' : 's'} ${diffMinutes >= 0 ? 'from now' : 'ago'}`
  }

  const diffHours = Math.round(diffMinutes / 60)
  const absHours = Math.abs(diffHours)
  if (absHours < 24) {
    return `${absHours} hour${absHours === 1 ? '' : 's'} ${diffHours >= 0 ? 'from now' : 'ago'}`
  }

  const diffDays = Math.round(diffHours / 24)
  const absDays = Math.abs(diffDays)
  return `${absDays} day${absDays === 1 ? '' : 's'} ${diffDays >= 0 ? 'from now' : 'ago'}`
}

function getActivityLabel(action: string): string {
  switch (action) {
    case 'EMPLOYEE_ACTIVATED':
      return 'Employee activated'
    case 'EMPLOYEE_CREATED':
      return 'Employee created'
    case 'EMPLOYEE_UPDATED':
      return 'Employee updated'
    case 'EMPLOYEE_DEACTIVATED':
      return 'Employee deactivated'
    case 'EMPLOYEE_INVITE_SENT':
      return 'Invite email sent'
    case 'EMPLOYEE_INVITE_FAILED':
      return 'Invite delivery failed'
    case 'EMPLOYEE_INVITE_ACCEPTED':
      return 'Invite accepted'
    case 'EMPLOYEE_SHEET_PREVIEWED':
      return 'Sheet previewed'
    case 'EMPLOYEE_SHEET_EXPORTED':
      return 'Sheet exported'
    case 'EMPLOYEE_SHEET_EMAIL_SENT':
      return 'Sheet email sent'
    case 'EMPLOYEE_SHEET_EMAIL_FAILED':
      return 'Sheet email failed'
    case 'PAYROLL_EXPORT_GENERATED':
      return 'Payroll export generated'
    case 'PAYROLL_EXPORT_PRINT_INITIATED':
      return 'Payroll sheet print started'
    case 'PAYROLL_PERIOD_CREATED':
      return 'Payroll period created'
    case 'PAYROLL_RUN_CREATED':
      return 'Payroll run created'
    case 'PAYROLL_CALCULATION_STARTED':
      return 'Payroll calculation started'
    case 'PAYROLL_CALCULATION_COMPLETED':
      return 'Payroll calculation completed'
    case 'PAYROLL_CALCULATION_FAILED':
      return 'Payroll calculation failed'
    case 'PAYROLL_RUN_UPDATED':
      return 'Payroll run updated'
    case 'PAYROLL_RUN_FINALIZED':
      return 'Payroll run finalized'
    case 'PAYROLL_PAYSLIP_PUBLISHED':
      return 'Payslip published'
    case 'PAYSLIP_REQUEST_CREATED':
      return 'Payslip request created'
    case 'PAYSLIP_REQUEST_STATUS_UPDATED':
      return 'Payslip request updated'
    case 'PAYSLIP_REQUEST_FULFILLED':
      return 'Payslip request fulfilled'
    case 'PAYSLIP_DOCUMENT_PUBLISHED':
      return 'Payslip document published'
    case 'PAYSLIP_DOCUMENT_VIEWED':
      return 'Payslip document viewed'
    case 'PAYSLIP_DOCUMENT_DOWNLOADED':
      return 'Payslip document downloaded'
    case 'EMPLOYEE_SELF_UPDATED':
      return 'Employee self-updated'
    case 'REQUEST_SUBMITTED':
      return 'Request submitted'
    case 'REQUEST_APPROVED':
      return 'Request approved'
    case 'REQUEST_REJECTED':
      return 'Request rejected'
    case 'QR_GENERATED':
      return 'QR generated'
    case 'QR_REGENERATED':
      return 'QR regenerated'
    case 'QR_REVOKED':
      return 'QR revoked'
    case 'QR_REFRESH_REQUIRED_CREATED':
      return 'QR refresh required'
    case 'QR_REFRESH_COMPLETED':
      return 'QR refresh completed'
    case 'VISIBILITY_UPDATED':
      return 'Visibility updated'
    case 'PUBLIC_PROFILE_VIEWED':
      return 'Public profile viewed'
    default:
      return action.replaceAll('_', ' ')
  }
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

function getInviteStatusLabel(status: 'sent' | 'failed' | 'accepted'): string {
  if (status === 'failed') {
    return 'Failed'
  }

  if (status === 'accepted') {
    return 'Accepted'
  }

  return 'Sent'
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

function getRequestStatusLabel(status: DemandeStatut): string {
  switch (status) {
    case 'EN_ATTENTE':
      return 'Pending'
    case 'ACCEPTEE':
      return 'Approved'
    case 'REJETEE':
      return 'Rejected'
    default:
      return status
  }
}

function formatRequestSummary(request: ModificationRequest): string {
  const fieldLabel = REQUEST_FIELD_LABELS[request.champCible]
  const nextValue = request.nouvelleValeur?.trim() || 'No value provided'
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

function SectionError({ message }: { message?: string }) {
  if (!message) {
    return null
  }

  return (
    <Alert className="rounded-2xl border-amber-200 bg-amber-50 text-amber-900">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Partial data unavailable</AlertTitle>
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
  primary = false,
}: {
  title: string
  description: string
  onClick: () => void
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
      <ArrowRight className={cn('h-4 w-4', primary ? 'text-white' : 'text-slate-400')} />
    </button>
  )
}

function ActivityItemRow({
  item,
  onOpen,
}: {
  item: AuditLogItem
  onOpen: (href: string) => void
}) {
  const href = getActivityHref(item)

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-slate-900">{getActivityLabel(item.action)}</p>
            <Badge className={getActivityBadgeClass(item.action)}>{item.action}</Badge>
          </div>
          <p className="text-sm text-slate-600">{item.targetLabel}</p>
          <p className="text-xs text-slate-500">By {item.actorLabel}</p>
        </div>
        {href ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => onOpen(href)}>
            Open
          </Button>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span>{item.detailsPreview}</span>
        <span title={formatDateTime(item.createdAt)}>{formatRelativeDate(item.createdAt)}</span>
      </div>
    </div>
  )
}

function RecentInviteItemRow({
  item,
  onOpenEmployee,
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
}) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-slate-900">{item.employeeName}</p>
            <Badge className={getInviteStatusBadgeClass(item.status)}>
              {getInviteStatusLabel(item.status)}
            </Badge>
            {item.triggerSource === 'resend_invite' ? (
              <Badge variant="outline" className="border-orange-200 bg-orange-50 text-orange-800">
                Resend
              </Badge>
            ) : null}
          </div>
          <p className="text-sm text-slate-600">{item.recipientEmail}</p>
          {item.failureReason ? (
            <p className="line-clamp-2 text-xs text-rose-700">{item.failureReason}</p>
          ) : item.status === 'accepted' ? (
            <p className="text-xs text-emerald-700">
              Employee completed first-login password setup.
            </p>
          ) : (
            <p className="text-xs text-slate-500">
              {item.triggerSource === 'resend_invite'
                ? 'Invite resend attempt recorded'
                : 'Employee invite audit event'}
            </p>
          )}
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <span className="text-xs text-slate-500" title={formatDateTime(item.createdAt)}>
            {formatRelativeDate(item.createdAt)}
          </span>
          {onOpenEmployee ? (
            <Button type="button" variant="outline" size="sm" onClick={onOpenEmployee}>
              Open employee
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
}) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-slate-900">
              {item.employeeName ?? item.targetLabel}
            </p>
            <Badge className={getActivityBadgeClass(item.action)}>{item.actionLabel}</Badge>
          </div>
          <p className="text-sm text-slate-600">{item.summary}</p>
          <p className="text-xs text-slate-500">
            By {item.actorLabel}
            {item.rowCount !== null ? ` • ${item.rowCount} row${item.rowCount === 1 ? '' : 's'}` : ''}
            {item.fileName ? ` • ${item.fileName}` : item.format ? ` • ${item.format}` : ''}
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <span className="text-xs text-slate-500" title={formatDateTime(item.createdAt)}>
            {formatRelativeDate(item.createdAt)}
          </span>
          {onOpenEmployee ? (
            <Button type="button" variant="outline" size="sm" onClick={onOpenEmployee}>
              Open employee
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
      <DashboardLayout title="Dashboard" subtitle="Operational overview for HR administration.">
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
      <DashboardLayout title="Dashboard" subtitle="Operational overview for HR administration.">
        <ErrorState
          title="Failed to load dashboard"
          description="We couldn't load the HR dashboard right now."
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
    <DashboardLayout title="Dashboard" subtitle="Operational overview for HR administration.">
      <div className="space-y-6">
        <PageHeader
          title="System Dashboard"
          description="Track workforce activity, pending operations, and the administrative items that need attention."
          badges={
            <Badge className="border-transparent bg-orange-100 text-orange-700">
              <LayoutDashboard className="mr-1.5 h-3.5 w-3.5" />
              Admin command center
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
                  className={cn('mr-2 h-4 w-4', dashboardQuery.isFetching && 'animate-spin')}
                />
                Refresh
              </Button>
              <Button
                type="button"
                className={BRAND_BUTTON_CLASS_NAME}
                onClick={() => navigate(ROUTES.ADMIN_EMPLOYEES_NEW)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Employee
              </Button>
            </>
          }
        />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              key: 'totalEmployees',
              title: 'Total Employees',
              value: dashboard.kpis.totalEmployees,
              helper: KPI_CARD_STYLES.totalEmployees.helper,
            },
            {
              key: 'activeEmployees',
              title: 'Active Employees',
              value: dashboard.kpis.activeEmployees,
              helper: KPI_CARD_STYLES.activeEmployees.helper,
            },
            {
              key: 'inactiveEmployees',
              title: 'Inactive Employees',
              value: dashboard.kpis.inactiveEmployees,
              helper: KPI_CARD_STYLES.inactiveEmployees.helper,
            },
            {
              key: 'pendingRequests',
              title: 'Pending Requests',
              value: dashboard.kpis.pendingRequests,
              helper: KPI_CARD_STYLES.pendingRequests.helper,
            },
            {
              key: 'departmentsCount',
              title: 'Departments',
              value: dashboard.kpis.departmentsCount,
              helper: KPI_CARD_STYLES.departmentsCount.helper,
            },
            {
              key: 'unreadNotifications',
              title: 'Unread Notifications',
              value: dashboard.kpis.unreadNotifications,
              helper: KPI_CARD_STYLES.unreadNotifications.helper,
            },
            {
              key: 'invitesSentRecent',
              title: 'Invites Sent',
              value: dashboard.kpis.invitesSentRecent,
              helper: KPI_CARD_STYLES.invitesSentRecent.helper,
            },
            {
              key: 'inviteFailuresRecent',
              title: 'Invite Failures',
              value: dashboard.kpis.inviteFailuresRecent,
              helper: KPI_CARD_STYLES.inviteFailuresRecent.helper,
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
                  <p className="text-sm text-slate-500">{item.helper}</p>
                </CardContent>
              </Card>
            )
          })}
        </div>

        <SectionError message={dashboard.sectionErrors.overview} />

        <div className="grid gap-6 xl:grid-cols-[1.55fr_1fr]">
          <div className="space-y-6">
            <Card className="rounded-2xl border border-slate-200/80 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-semibold">
                  Employee distribution by department
                </CardTitle>
                <CardDescription>
                  Live employee counts grouped by configured departments.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {dashboard.departmentDistribution.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-6 text-center">
                    <p className="text-sm font-medium text-slate-900">
                      No employee distribution available
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Create employees and assign departments to populate this widget.
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
                        helper={`${item.activeCount} active employee${
                          item.activeCount === 1 ? '' : 's'
                        }`}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-slate-200/80 shadow-sm">
              <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                <div>
                  <CardTitle className="text-base font-semibold">Recent activity</CardTitle>
                  <CardDescription>
                    Latest administrative actions from the audit trail.
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(ROUTES.ADMIN_AUDIT)}
                >
                  View audit log
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <SectionError message={dashboard.sectionErrors.recentActivity} />
                {dashboard.recentActivity.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-6 text-center">
                    <p className="text-sm font-medium text-slate-900">No recent activity</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Audit log events will appear here as admins manage the system.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {dashboard.recentActivity.map((item) => (
                      <ActivityItemRow
                        key={item.id}
                        item={item}
                        onOpen={(href) => navigate(href)}
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
                <CardTitle className="text-base font-semibold">Requests overview</CardTitle>
                <CardDescription>
                  Current status split for employee change requests.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {totalRequests === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-6 text-center">
                    <p className="text-sm font-medium text-slate-900">No requests yet</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Submitted employee requests will appear here.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                      <div className="rounded-2xl border border-amber-200/80 bg-amber-50 p-4">
                        <p className="text-xs font-medium uppercase tracking-[0.14em] text-amber-700">
                          Pending
                        </p>
                        <p className="mt-2 text-2xl font-semibold text-amber-900">
                          {dashboard.requestOverview.pending}
                        </p>
                        <p className="mt-1 text-xs text-amber-700">
                          {pendingRequestPercent}% of all requests
                        </p>
                      </div>
                      <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50 p-4">
                        <p className="text-xs font-medium uppercase tracking-[0.14em] text-emerald-700">
                          Approved
                        </p>
                        <p className="mt-2 text-2xl font-semibold text-emerald-900">
                          {dashboard.requestOverview.approved}
                        </p>
                        <p className="mt-1 text-xs text-emerald-700">
                          {approvedRequestPercent}% of all requests
                        </p>
                      </div>
                      <div className="rounded-2xl border border-rose-200/80 bg-rose-50 p-4">
                        <p className="text-xs font-medium uppercase tracking-[0.14em] text-rose-700">
                          Rejected
                        </p>
                        <p className="mt-2 text-2xl font-semibold text-rose-900">
                          {dashboard.requestOverview.rejected}
                        </p>
                        <p className="mt-1 text-xs text-rose-700">
                          {rejectedRequestPercent}% of all requests
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <DistributionBar
                        label="Pending review"
                        value={dashboard.requestOverview.pending}
                        total={totalRequests}
                        helper="Awaiting HR decision"
                      />
                      <DistributionBar
                        label="Approved requests"
                        value={dashboard.requestOverview.approved}
                        total={totalRequests}
                        helper="Already applied or accepted"
                      />
                      <DistributionBar
                        label="Rejected requests"
                        value={dashboard.requestOverview.rejected}
                        total={totalRequests}
                        helper="Closed without changes"
                      />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-slate-200/80 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-semibold">QR status summary</CardTitle>
                <CardDescription>
                  Operational view of employee public-profile QR readiness.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                  <span className="text-sm text-slate-600">Employees with active QR</span>
                  <span className="text-lg font-semibold text-slate-900">
                    {dashboard.qrSummary.activeQrEmployees}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                  <span className="text-sm text-slate-600">Employees missing active QR</span>
                  <span className="text-lg font-semibold text-slate-900">
                    {dashboard.qrSummary.employeesWithoutActiveQr}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                  <span className="text-sm text-slate-600">QR refresh alerts</span>
                  <span className="text-lg font-semibold text-slate-900">
                    {dashboard.qrSummary.needsQrRefresh}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                  <span className="text-sm text-slate-600">Recent public profile views</span>
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
                    Recent invite lifecycle activity
                  </CardTitle>
                  <CardDescription>
                    Latest employee invite sends, resend attempts, acceptances, and failures from the audit trail.
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(ROUTES.ADMIN_AUDIT)}
                >
                  View audit log
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <SectionError message={dashboard.sectionErrors.recentInvites} />
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl border border-orange-200/80 bg-orange-50 px-4 py-3">
                    <p className="text-xs font-medium uppercase tracking-[0.14em] text-orange-700">
                      Sent
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-orange-900">
                      {dashboard.inviteLifecycleSummary.sent}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-amber-200/80 bg-amber-50 px-4 py-3">
                    <p className="text-xs font-medium uppercase tracking-[0.14em] text-amber-700">
                      Resends
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-amber-900">
                      {dashboard.inviteLifecycleSummary.resend}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50 px-4 py-3">
                    <p className="text-xs font-medium uppercase tracking-[0.14em] text-emerald-700">
                      Accepted
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-emerald-900">
                      {dashboard.inviteLifecycleSummary.accepted}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-rose-200/80 bg-rose-50 px-4 py-3">
                    <p className="text-xs font-medium uppercase tracking-[0.14em] text-rose-700">
                      Failed
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-rose-900">
                      {dashboard.inviteLifecycleSummary.failed}
                    </p>
                  </div>
                </div>
                {dashboard.recentInvites.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-6 text-center">
                    <p className="text-sm font-medium text-slate-900">No recent invite emails</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Invite sends, resend attempts, acceptances, and failures from the last 7 days will appear here.
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
                    Recent payroll activity
                  </CardTitle>
                  <CardDescription>
                    Recent payroll processing, request, and document actions visible to admins.
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(ROUTES.ADMIN_AUDIT)}
                >
                  View audit log
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <SectionError message={dashboard.sectionErrors.recentPayrollActivity} />
                {dashboard.recentPayrollActivity.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-6 text-center">
                    <p className="text-sm font-medium text-slate-900">
                      No recent payroll activity
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Payroll processing, payslip requests, and payslip document actions will appear here.
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
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-slate-200/80 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-semibold">Quick actions</CardTitle>
                <CardDescription>
                  Jump directly into the most common admin workflows.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <QuickActionButton
                  title="Add employee"
                  description="Create a new employee record and account"
                  onClick={() => navigate(ROUTES.ADMIN_EMPLOYEES_NEW)}
                  primary
                />
                <QuickActionButton
                  title="View requests"
                  description="Review employee modification requests"
                  onClick={() => navigate(ROUTES.ADMIN_REQUESTS)}
                />
                <QuickActionButton
                  title="Manage departments"
                  description="Maintain department metadata"
                  onClick={() => navigate(ROUTES.ADMIN_DEPARTMENTS)}
                />
                <QuickActionButton
                  title="Open notifications"
                  description="Check recent alerts and reminders"
                  onClick={() => navigate(ROUTES.NOTIFICATIONS)}
                />
                <QuickActionButton
                  title="View audit log"
                  description="Review administrative activity history"
                  onClick={() => navigate(ROUTES.ADMIN_AUDIT)}
                />
                <QuickActionButton
                  title="Open monitoring"
                  description="Inspect operational and delivery signals"
                  onClick={() => navigate(ROUTES.ADMIN_MONITORING)}
                />
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-slate-200/80 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-semibold">Attention needed</CardTitle>
                <CardDescription>Operational items worth reviewing next.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {dashboard.alerts.length === 0 ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
                    <div className="flex items-start gap-3">
                      <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold">No urgent admin alerts</p>
                        <p className="mt-1 text-sm text-emerald-800">
                          The system currently has no high-priority operational issues detected
                          by the dashboard.
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
                        <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
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
                <CardTitle className="text-base font-semibold">Recent requests</CardTitle>
                <CardDescription>
                  Latest employee change submissions waiting in the system.
                </CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => navigate(ROUTES.ADMIN_REQUESTS)}
              >
                Review queue
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <SectionError message={dashboard.sectionErrors.recentRequests} />
              {dashboard.recentRequests.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-6 text-center">
                  <p className="text-sm font-medium text-slate-900">No recent requests</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Employees have not submitted any modification requests yet.
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
                                {getRequestStatusLabel(request.statutDemande)}
                              </Badge>
                            </div>
                            <p className="line-clamp-2 text-sm text-slate-600">
                              {formatRequestSummary(request)}
                            </p>
                            <p
                              className="text-xs text-slate-500"
                              title={formatDateTime(request.createdAt)}
                            >
                              Submitted {formatRelativeDate(request.createdAt)}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(ROUTES.ADMIN_REQUESTS)}
                          >
                            Review
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
                  Recently added employees
                </CardTitle>
                <CardDescription>
                  Newest employee records in the current environment.
                </CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => navigate(ROUTES.ADMIN_EMPLOYEES)}
              >
                View all
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {dashboard.recentEmployees.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-6 text-center">
                  <p className="text-sm font-medium text-slate-900">No employees yet</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Create your first employee to populate the directory.
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
                          {employee.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <p className="mt-1 truncate text-sm text-slate-600">
                        {getEmployeePosteLabel(employee.poste) ?? 'No job title assigned'}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span>{employee.departmentName}</span>
                        <span>•</span>
                        <span>{employee.matricule}</span>
                        <span>•</span>
                        <span title={formatDateTime(employee.createdAt)}>
                          {formatRelativeDate(employee.createdAt)}
                        </span>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />
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
                Dashboard metrics are derived from live employees, departments, requests,
                notifications, audit activity, payroll workflow signals, and active QR tokens.
              </span>
            </div>
            <span>
              {dashboardQuery.isFetching
                ? 'Refreshing data...'
                : 'Data refreshes automatically every minute.'}
            </span>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}


