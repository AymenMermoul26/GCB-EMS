import {
  Activity,
  AlertTriangle,
  CalendarDays,
  Eye,
  Filter,
  MoreHorizontal,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { EmptyState, ErrorState, SearchEmptyState } from '@/components/common/page-state'
import { PageHeader } from '@/components/common/page-header'
import { StatusBadge } from '@/components/common/status-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getAdminEmployeeRoute } from '@/constants/routes'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { DashboardLayout } from '@/layouts/dashboard-layout'
import { cn } from '@/lib/utils'
import { useAuditLogQuery } from '@/services/auditLogService'
import type { AuditAction, AuditLogItem } from '@/types/audit-log'

interface ActionPresentation {
  label: string
  category: string
  tone: 'slate' | 'emerald' | 'amber' | 'rose' | 'sky' | 'orange'
  critical?: boolean
}

const ACTION_PRESENTATION: Record<string, ActionPresentation> = {
  EMPLOYEE_ACTIVATED: {
    label: 'Employee Activated',
    category: 'Employee',
    tone: 'emerald',
  },
  EMPLOYEE_CREATED: {
    label: 'Employee Created',
    category: 'Employee',
    tone: 'sky',
  },
  EMPLOYEE_UPDATED: {
    label: 'Employee Updated',
    category: 'Employee',
    tone: 'slate',
  },
  EMPLOYEE_DEACTIVATED: {
    label: 'Employee Deactivated',
    category: 'Employee',
    tone: 'rose',
    critical: true,
  },
  EMPLOYEE_INVITE_SENT: {
    label: 'Invite Email Sent',
    category: 'Communication',
    tone: 'orange',
  },
  EMPLOYEE_INVITE_FAILED: {
    label: 'Invite Email Failed',
    category: 'Communication',
    tone: 'rose',
    critical: true,
  },
  EMPLOYEE_INVITE_ACCEPTED: {
    label: 'Invite Accepted',
    category: 'Communication',
    tone: 'emerald',
  },
  EMPLOYEE_SHEET_PREVIEWED: {
    label: 'Sheet Previewed',
    category: 'Document',
    tone: 'slate',
  },
  EMPLOYEE_SHEET_EXPORTED: {
    label: 'Sheet Exported',
    category: 'Document',
    tone: 'sky',
  },
  EMPLOYEE_SHEET_EMAIL_SENT: {
    label: 'Sheet Email Sent',
    category: 'Communication',
    tone: 'orange',
  },
  EMPLOYEE_SHEET_EMAIL_FAILED: {
    label: 'Sheet Email Failed',
    category: 'Communication',
    tone: 'rose',
    critical: true,
  },
  EMPLOYEE_SELF_UPDATED: {
    label: 'Employee Self Updated',
    category: 'Employee',
    tone: 'amber',
  },
  REQUEST_SUBMITTED: {
    label: 'Request Submitted',
    category: 'Request',
    tone: 'amber',
  },
  REQUEST_APPROVED: {
    label: 'Request Approved',
    category: 'Request',
    tone: 'emerald',
  },
  REQUEST_REJECTED: {
    label: 'Request Rejected',
    category: 'Request',
    tone: 'rose',
    critical: true,
  },
  QR_GENERATED: {
    label: 'QR Generated',
    category: 'QR',
    tone: 'sky',
  },
  QR_REGENERATED: {
    label: 'QR Regenerated',
    category: 'QR',
    tone: 'sky',
  },
  QR_REVOKED: {
    label: 'QR Revoked',
    category: 'QR',
    tone: 'rose',
    critical: true,
  },
  QR_REFRESH_COMPLETED: {
    label: 'QR Refresh Completed',
    category: 'QR',
    tone: 'emerald',
  },
  QR_REFRESH_REQUIRED_CREATED: {
    label: 'QR Refresh Required',
    category: 'QR',
    tone: 'amber',
    critical: true,
  },
  VISIBILITY_UPDATED: {
    label: 'Visibility Updated',
    category: 'Public Profile',
    tone: 'slate',
  },
  PUBLIC_PROFILE_VISIBILITY_REQUEST_SUBMITTED: {
    label: 'Visibility Request Submitted',
    category: 'Public Profile',
    tone: 'amber',
  },
  PUBLIC_PROFILE_VISIBILITY_REQUEST_IN_REVIEW: {
    label: 'Visibility Request In Review',
    category: 'Public Profile',
    tone: 'slate',
  },
  PUBLIC_PROFILE_VISIBILITY_REQUEST_APPROVED: {
    label: 'Visibility Request Approved',
    category: 'Public Profile',
    tone: 'emerald',
  },
  PUBLIC_PROFILE_VISIBILITY_REQUEST_REJECTED: {
    label: 'Visibility Request Rejected',
    category: 'Public Profile',
    tone: 'rose',
    critical: true,
  },
  PAYROLL_EXPORT_REQUESTED: {
    label: 'Payroll Export Requested',
    category: 'Payroll',
    tone: 'amber',
  },
  PAYROLL_EXPORT_GENERATED: {
    label: 'Payroll Export Generated',
    category: 'Payroll',
    tone: 'sky',
  },
  PAYROLL_EXPORT_PRINT_INITIATED: {
    label: 'Payroll Sheet Print Initiated',
    category: 'Payroll',
    tone: 'amber',
  },
  PAYROLL_PERIOD_CREATED: {
    label: 'Payroll Period Created',
    category: 'Payroll',
    tone: 'sky',
  },
  PAYROLL_RUN_CREATED: {
    label: 'Payroll Run Created',
    category: 'Payroll',
    tone: 'sky',
  },
  PAYROLL_CALCULATION_STARTED: {
    label: 'Payroll Calculation Started',
    category: 'Payroll',
    tone: 'amber',
  },
  PAYROLL_CALCULATION_COMPLETED: {
    label: 'Payroll Calculation Completed',
    category: 'Payroll',
    tone: 'emerald',
  },
  PAYROLL_CALCULATION_FAILED: {
    label: 'Payroll Calculation Failed',
    category: 'Payroll',
    tone: 'rose',
    critical: true,
  },
  PAYROLL_RUN_UPDATED: {
    label: 'Payroll Run Updated',
    category: 'Payroll',
    tone: 'amber',
  },
  PAYROLL_RUN_FINALIZED: {
    label: 'Payroll Run Finalized',
    category: 'Payroll',
    tone: 'emerald',
  },
  PAYROLL_PAYSLIP_PUBLISHED: {
    label: 'Payslip Published',
    category: 'Payroll',
    tone: 'emerald',
  },
  PAYSLIP_REQUEST_CREATED: {
    label: 'Payslip Request Created',
    category: 'Payroll',
    tone: 'amber',
  },
  PAYSLIP_REQUEST_STATUS_UPDATED: {
    label: 'Payslip Request Updated',
    category: 'Payroll',
    tone: 'sky',
  },
  PAYSLIP_REQUEST_FULFILLED: {
    label: 'Payslip Request Fulfilled',
    category: 'Payroll',
    tone: 'emerald',
  },
  PAYSLIP_DOCUMENT_PUBLISHED: {
    label: 'Payslip Document Published',
    category: 'Payroll',
    tone: 'emerald',
  },
  PAYSLIP_DOCUMENT_VIEWED: {
    label: 'Payslip Document Viewed',
    category: 'Payroll',
    tone: 'slate',
  },
  PAYSLIP_DOCUMENT_DOWNLOADED: {
    label: 'Payslip Document Downloaded',
    category: 'Payroll',
    tone: 'sky',
  },
  PUBLIC_PROFILE_VIEWED: {
    label: 'Public Profile Viewed',
    category: 'QR',
    tone: 'emerald',
  },
}

const ACTION_OPTIONS: Array<{ value: AuditAction | 'ALL'; label: string }> = [
  { value: 'ALL', label: 'All actions' },
  { value: 'EMPLOYEE_ACTIVATED', label: 'Employee Activated' },
  { value: 'EMPLOYEE_CREATED', label: 'Employee Created' },
  { value: 'EMPLOYEE_UPDATED', label: 'Employee Updated' },
  { value: 'EMPLOYEE_DEACTIVATED', label: 'Employee Deactivated' },
  { value: 'EMPLOYEE_INVITE_SENT', label: 'Invite Email Sent' },
  { value: 'EMPLOYEE_INVITE_FAILED', label: 'Invite Email Failed' },
  { value: 'EMPLOYEE_INVITE_ACCEPTED', label: 'Invite Accepted' },
  { value: 'EMPLOYEE_SHEET_PREVIEWED', label: 'Sheet Previewed' },
  { value: 'EMPLOYEE_SHEET_EXPORTED', label: 'Sheet Exported' },
  { value: 'EMPLOYEE_SHEET_EMAIL_SENT', label: 'Sheet Email Sent' },
  { value: 'EMPLOYEE_SHEET_EMAIL_FAILED', label: 'Sheet Email Failed' },
  { value: 'EMPLOYEE_SELF_UPDATED', label: 'Employee Self Updated' },
  { value: 'REQUEST_SUBMITTED', label: 'Request Submitted' },
  { value: 'REQUEST_APPROVED', label: 'Request Approved' },
  { value: 'REQUEST_REJECTED', label: 'Request Rejected' },
  { value: 'QR_GENERATED', label: 'QR Generated' },
  { value: 'QR_REGENERATED', label: 'QR Regenerated' },
  { value: 'QR_REVOKED', label: 'QR Revoked' },
  { value: 'QR_REFRESH_COMPLETED', label: 'QR Refresh Completed' },
  { value: 'QR_REFRESH_REQUIRED_CREATED', label: 'QR Refresh Required' },
  { value: 'VISIBILITY_UPDATED', label: 'Visibility Updated' },
  { value: 'PUBLIC_PROFILE_VISIBILITY_REQUEST_SUBMITTED', label: 'Visibility Request Submitted' },
  { value: 'PUBLIC_PROFILE_VISIBILITY_REQUEST_IN_REVIEW', label: 'Visibility Request In Review' },
  { value: 'PUBLIC_PROFILE_VISIBILITY_REQUEST_APPROVED', label: 'Visibility Request Approved' },
  { value: 'PUBLIC_PROFILE_VISIBILITY_REQUEST_REJECTED', label: 'Visibility Request Rejected' },
  { value: 'PAYROLL_EXPORT_REQUESTED', label: 'Payroll Export Requested' },
  { value: 'PAYROLL_EXPORT_GENERATED', label: 'Payroll Export Generated' },
  { value: 'PAYROLL_EXPORT_PRINT_INITIATED', label: 'Payroll Sheet Print Initiated' },
  { value: 'PAYROLL_PERIOD_CREATED', label: 'Payroll Period Created' },
  { value: 'PAYROLL_RUN_CREATED', label: 'Payroll Run Created' },
  { value: 'PAYROLL_CALCULATION_STARTED', label: 'Payroll Calculation Started' },
  { value: 'PAYROLL_CALCULATION_COMPLETED', label: 'Payroll Calculation Completed' },
  { value: 'PAYROLL_CALCULATION_FAILED', label: 'Payroll Calculation Failed' },
  { value: 'PAYROLL_RUN_UPDATED', label: 'Payroll Run Updated' },
  { value: 'PAYROLL_RUN_FINALIZED', label: 'Payroll Run Finalized' },
  { value: 'PAYROLL_PAYSLIP_PUBLISHED', label: 'Payslip Published' },
  { value: 'PAYSLIP_REQUEST_CREATED', label: 'Payslip Request Created' },
  { value: 'PAYSLIP_REQUEST_STATUS_UPDATED', label: 'Payslip Request Updated' },
  { value: 'PAYSLIP_REQUEST_FULFILLED', label: 'Payslip Request Fulfilled' },
  { value: 'PAYSLIP_DOCUMENT_PUBLISHED', label: 'Payslip Document Published' },
  { value: 'PAYSLIP_DOCUMENT_VIEWED', label: 'Payslip Document Viewed' },
  { value: 'PAYSLIP_DOCUMENT_DOWNLOADED', label: 'Payslip Document Downloaded' },
  { value: 'PUBLIC_PROFILE_VIEWED', label: 'Public Profile Viewed' },
]

function shortId(value: string | null): string {
  if (!value) {
    return '-'
  }

  return value.length > 8 ? `${value.slice(0, 8)}...` : value
}

function getActionPresentation(action: string): ActionPresentation {
  return (
    ACTION_PRESENTATION[action] ?? {
      label: action
        .replaceAll('_', ' ')
        .toLowerCase()
        .replace(/\b\w/g, (character) => character.toUpperCase()),
      category: 'System',
      tone: 'slate',
    }
  )
}

function actionBadgeClass(action: string): string {
  switch (getActionPresentation(action).tone) {
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

function formatFieldLabel(value: string): string {
  return value
    .replaceAll('_', ' ')
    .replaceAll('-', ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function formatMetadataValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '-'
  }

  if (typeof value === 'string') {
    const normalized = value.trim()
    return normalized.length > 0 ? normalized : '-'
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item : JSON.stringify(item)))
      .join(', ')
  }

  return JSON.stringify(value, null, 2)
}

function getMetadataEntries(detailsJson: Record<string, unknown>) {
  return Object.entries(detailsJson).map(([key, value]) => ({
    key,
    label: formatFieldLabel(key),
    formattedValue: formatMetadataValue(value),
    multiline: Array.isArray(value) || (value !== null && typeof value === 'object'),
  }))
}

function getEntityLabel(targetType: string): string {
  if (targetType === 'Employe') {
    return 'Employee'
  }

  if (targetType === 'DemandeModification') {
    return 'Request'
  }

  if (targetType === 'TokenQR') {
    return 'QR Token'
  }

  if (targetType === 'employee_visibility') {
    return 'Visibility'
  }

  if (targetType === 'PublicProfileVisibilityRequest') {
    return 'Visibility request'
  }

  if (targetType === 'payroll_export') {
    return 'Payroll export'
  }

  if (targetType === 'PayrollPeriod') {
    return 'Payroll period'
  }

  if (targetType === 'PayrollRun') {
    return 'Payroll run'
  }

  if (targetType === 'Payslip') {
    return 'Payslip'
  }

  if (targetType === 'PayslipRequest') {
    return 'Payslip request'
  }

  if (targetType === 'PayslipDelivery') {
    return 'Payslip delivery'
  }

  return targetType
}

function isCriticalAction(action: string): boolean {
  return getActionPresentation(action).critical === true
}

function hasEmployeeTarget(log: AuditLogItem): boolean {
  return log.targetType === 'Employe' && Boolean(log.targetId)
}

export function AuditLogPage() {
  const navigate = useNavigate()
  const [action, setAction] = useState<AuditAction | 'ALL'>('ALL')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [targetSearch, setTargetSearch] = useState('') // server-side employee target filter
  const [quickSearch, setQuickSearch] = useState('') // client-side action/actor/target search
  const [actorFilter, setActorFilter] = useState<string>('ALL')
  const [entityFilter, setEntityFilter] = useState<string>('ALL')
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null)

  const debouncedTargetSearch = useDebouncedValue(targetSearch, 400)
  const debouncedQuickSearch = useDebouncedValue(quickSearch, 300)
  const filters = useMemo(
    () => ({
      action,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      targetEmployeeSearch: debouncedTargetSearch || undefined,
      page,
      pageSize,
    }),
    [action, dateFrom, dateTo, debouncedTargetSearch, page, pageSize],
  )

  const auditLogQuery = useAuditLogQuery(filters)
  const items = useMemo(() => auditLogQuery.data?.items ?? [], [auditLogQuery.data?.items])
  const total = auditLogQuery.data?.total ?? 0
  const actorOptions = useMemo(
    () => ['ALL', ...new Set(items.map((item) => item.actorLabel))],
    [items],
  )
  const entityOptions = useMemo(
    () => ['ALL', ...new Set(items.map((item) => item.targetType))],
    [items],
  )
  const visibleItems = useMemo(() => {
    const term = debouncedQuickSearch.trim().toLowerCase()
    return items.filter((log) => {
      if (actorFilter !== 'ALL' && log.actorLabel !== actorFilter) {
        return false
      }

      if (entityFilter !== 'ALL' && log.targetType !== entityFilter) {
        return false
      }

      if (!term) {
        return true
      }

      const target = [
        getActionPresentation(log.action).label,
        getActionPresentation(log.action).category,
        log.action,
        log.actorLabel,
        log.targetLabel,
        log.targetType,
        log.targetId ?? '',
        log.detailsPreview,
      ]
        .join(' ')
        .toLowerCase()

      return target.includes(term)
    })
  }, [actorFilter, debouncedQuickSearch, entityFilter, items])

  const criticalItems = useMemo(
    () => visibleItems.filter((item) => isCriticalAction(item.action)).slice(0, 4),
    [visibleItems],
  )
  const todayCount = useMemo(
    () =>
      visibleItems.filter((item) => {
        const now = new Date()
        const candidate = new Date(item.createdAt)

        return (
          candidate.getFullYear() === now.getFullYear() &&
          candidate.getMonth() === now.getMonth() &&
          candidate.getDate() === now.getDate()
        )
      }).length,
    [visibleItems],
  )
  const actorCount = useMemo(
    () => new Set(visibleItems.map((item) => item.actorLabel)).size,
    [visibleItems],
  )

  const hasActiveFilters =
    action !== 'ALL' ||
    dateFrom.length > 0 ||
    dateTo.length > 0 ||
    targetSearch.trim().length > 0 ||
    quickSearch.trim().length > 0 ||
    actorFilter !== 'ALL' ||
    entityFilter !== 'ALL' ||
    pageSize !== 20

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = total === 0 ? 0 : Math.min(page * pageSize, total)

  const clearFilters = () => {
    setAction('ALL')
    setDateFrom('')
    setDateTo('')
    setTargetSearch('')
    setQuickSearch('')
    setActorFilter('ALL')
    setEntityFilter('ALL')
    setPage(1)
    setPageSize(20)
    setIsFilterDialogOpen(false)
  }

  return (
    <DashboardLayout title="Audit Log" subtitle="Track sensitive actions and security events.">
      <PageHeader
        title="Audit Log"
        description="Track sensitive actions and security events."
        className="sticky top-2 z-20 mb-6"
        badges={
          auditLogQuery.isPending ? (
            <Skeleton className="h-6 w-24 rounded-full" />
          ) : (
            <>
              <StatusBadge tone="neutral">{total} total</StatusBadge>
              <StatusBadge tone="info" emphasis="outline">
                {visibleItems.length} shown
              </StatusBadge>
            </>
          )
        }
        actions={
          auditLogQuery.isPending ? (
            <>
              <Skeleton className="h-10 w-full sm:w-72" />
              <Skeleton className="h-10 w-full sm:w-28" />
              <Skeleton className="h-10 w-full sm:w-28" />
            </>
          ) : (
            <>
              <div className="relative w-full sm:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={quickSearch}
                  onChange={(event) => setQuickSearch(event.target.value)}
                  placeholder="Search by action, actor, or employee..."
                  className="pl-9"
                  aria-label="Search audit log"
                />
              </div>
              <Button type="button" variant="outline" onClick={() => setIsFilterDialogOpen(true)}>
                <Filter className="mr-2 h-4 w-4" />
                Filters
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={auditLogQuery.isFetching}
                onClick={() => void auditLogQuery.refetch()}
              >
                <RefreshCw
                  className={cn('mr-2 h-4 w-4', auditLogQuery.isFetching && 'animate-spin')}
                />
                Refresh
              </Button>
            </>
          )
        }
      />

      {auditLogQuery.isError ? (
        <ErrorState
          className="mb-6"
          title="Failed to load audit log"
          description="We couldn't load audit events right now."
          message={auditLogQuery.error.message}
          icon={ShieldAlert}
          onRetry={() => void auditLogQuery.refetch()}
        />
      ) : null}

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Visible Events"
          value={auditLogQuery.isPending ? null : visibleItems.length}
          helper="Current rows after search and local filters"
          icon={<Activity className="h-5 w-5" />}
          accentClass="bg-[linear-gradient(135deg,rgba(255,107,53,0.16),rgba(255,201,71,0.24))] text-[rgb(var(--brand-primary))]"
        />
        <SummaryCard
          title="Today"
          value={auditLogQuery.isPending ? null : todayCount}
          helper="Events from today in the current view"
          icon={<ShieldCheck className="h-5 w-5" />}
          accentClass="bg-emerald-100 text-emerald-700"
        />
        <SummaryCard
          title="Critical Events"
          value={auditLogQuery.isPending ? null : criticalItems.length}
          helper="High-attention actions in the current view"
          icon={<AlertTriangle className="h-5 w-5" />}
          accentClass="bg-rose-100 text-rose-700"
        />
        <SummaryCard
          title="Actors"
          value={auditLogQuery.isPending ? null : actorCount}
          helper="Distinct actors in the visible result set"
          icon={<Users className="h-5 w-5" />}
          accentClass="bg-sky-100 text-sky-700"
        />
      </div>

      {criticalItems.length > 0 && !auditLogQuery.isPending ? (
        <Card className="mb-6 rounded-2xl border border-slate-200/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Recent critical events</CardTitle>
            <CardDescription>
              High-attention actions from the current filtered view.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {criticalItems.map((log) => {
              const presentation = getActionPresentation(log.action)

              return (
                <button
                  key={log.id}
                  type="button"
                  onClick={() => setSelectedLog(log)}
                  className="rounded-2xl border border-slate-200 bg-white p-4 text-left transition-colors hover:bg-slate-50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={actionBadgeClass(log.action)}>{presentation.label}</Badge>
                        <span className="text-xs text-slate-500">{presentation.category}</span>
                      </div>
                      <p className="mt-2 text-sm font-medium text-slate-900">{log.targetLabel}</p>
                      <p className="mt-1 line-clamp-2 text-sm text-slate-600">{log.detailsPreview}</p>
                    </div>
                    <Eye className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  </div>
                  <p className="mt-3 text-xs text-slate-500">{new Date(log.createdAt).toLocaleString()}</p>
                </button>
              )
            })}
          </CardContent>
        </Card>
      ) : null}

      <Card className="rounded-2xl border border-slate-200/80 shadow-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="text-base font-semibold">Events</CardTitle>
          <CardDescription>
            Audit entries are read-only and ordered newest first.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {auditLogQuery.isPending ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[180px]">Timestamp</TableHead>
                    <TableHead className="min-w-[200px]">Action</TableHead>
                    <TableHead className="min-w-[220px]">Actor</TableHead>
                    <TableHead className="min-w-[240px]">Target</TableHead>
                    <TableHead className="min-w-[260px]">Summary</TableHead>
                    <TableHead className="w-[80px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 10 }).map((_, index) => (
                    <TableRow key={`audit-skeleton-${index}`}>
                      <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-56" /></TableCell>
                      <TableCell><Skeleton className="ml-auto h-8 w-8 rounded-md" /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}

          {!auditLogQuery.isPending && !auditLogQuery.isError ? (
            visibleItems.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[180px]">Timestamp</TableHead>
                        <TableHead className="min-w-[200px]">Action</TableHead>
                        <TableHead className="min-w-[220px]">Actor</TableHead>
                        <TableHead className="min-w-[240px]">Target</TableHead>
                        <TableHead className="min-w-[260px]">Summary</TableHead>
                        <TableHead className="w-[80px] text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleItems.map((log) => (
                        <TableRow key={log.id} className="hover:bg-muted/30">
                          <TableCell>
                            <div className="space-y-1">
                              <p className="text-sm font-medium text-slate-900">
                                {new Date(log.createdAt).toLocaleString()}
                              </p>
                              <p className="font-mono text-xs text-slate-500">{shortId(log.id)}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge className={actionBadgeClass(log.action)}>
                                  {getActionPresentation(log.action).label}
                                </Badge>
                                <Badge variant="outline" className="text-[11px]">
                                  {getActionPresentation(log.action).category}
                                </Badge>
                              </div>
                              <p className="font-mono text-xs text-muted-foreground">{log.action}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className="text-sm font-medium text-slate-900">{log.actorLabel}</p>
                            <p className="font-mono text-xs text-muted-foreground">{shortId(log.actorUserId)}</p>
                          </TableCell>
                          <TableCell>
                            <p className="text-sm font-medium text-slate-900">{log.targetLabel}</p>
                            <p className="text-xs text-muted-foreground">
                              {getEntityLabel(log.targetType)}
                              {log.targetId ? ` | ${shortId(log.targetId)}` : ''}
                            </p>
                          </TableCell>
                          <TableCell>
                            <p className="line-clamp-2 text-sm text-muted-foreground">
                              {log.detailsPreview}
                            </p>
                          </TableCell>
                          <TableCell className="text-right">
                            <AuditRowActions
                              log={log}
                              onView={() => setSelectedLog(log)}
                              onOpenEmployee={
                                hasEmployeeTarget(log)
                                  ? () => navigate(getAdminEmployeeRoute(log.targetId as string))
                                  : undefined
                              }
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Showing {from}-{to} of {total}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === 1 || auditLogQuery.isFetching}
                      onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    >
                      Prev
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={to >= total || auditLogQuery.isFetching}
                      onClick={() => setPage((prev) => prev + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <>
                {hasActiveFilters ? (
                  <SearchEmptyState
                    surface="plain"
                    className="py-8"
                    title="No audit events found"
                    description="Try changing your filters or search criteria."
                    actions={
                      <Button type="button" variant="outline" onClick={clearFilters}>
                        Clear filters
                      </Button>
                    }
                  />
                ) : (
                  <EmptyState
                    surface="plain"
                    className="py-8"
                    title="No audit events yet"
                    description="Audit events will appear here when tracked actions occur."
                  />
                )}
              </>
            )
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={isFilterDialogOpen} onOpenChange={setIsFilterDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Filter audit log</DialogTitle>
            <DialogDescription>
              Narrow the event stream by action, actor, entity, date, and target employee.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="audit-action-filter">Action type</Label>
              <Select
                value={action}
                onValueChange={(value) => {
                  setAction(value as AuditAction | 'ALL')
                  setPage(1)
                }}
              >
                <SelectTrigger id="audit-action-filter">
                  <SelectValue placeholder="Action type" />
                </SelectTrigger>
                <SelectContent>
                  {ACTION_OPTIONS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="audit-date-from">Date from</Label>
              <Input
                id="audit-date-from"
                type="date"
                value={dateFrom}
                onChange={(event) => {
                  setDateFrom(event.target.value)
                  setPage(1)
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="audit-date-to">Date to</Label>
              <Input
                id="audit-date-to"
                type="date"
                value={dateTo}
                onChange={(event) => {
                  setDateTo(event.target.value)
                  setPage(1)
                }}
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="audit-target-search">Target employee</Label>
              <Input
                id="audit-target-search"
                placeholder="Search target employee by employee ID, first name, or last name"
                value={targetSearch}
                onChange={(event) => {
                  setTargetSearch(event.target.value)
                  setPage(1)
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="audit-actor-filter">Actor</Label>
              <Select value={actorFilter} onValueChange={(value) => setActorFilter(value)}>
                <SelectTrigger id="audit-actor-filter">
                  <SelectValue placeholder="Actor" />
                </SelectTrigger>
                <SelectContent>
                  {actorOptions.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item === 'ALL' ? 'All actors' : item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="audit-entity-filter">Entity</Label>
              <Select value={entityFilter} onValueChange={(value) => setEntityFilter(value)}>
                <SelectTrigger id="audit-entity-filter">
                  <SelectValue placeholder="Entity" />
                </SelectTrigger>
                <SelectContent>
                  {entityOptions.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item === 'ALL' ? 'All entities' : getEntityLabel(item)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="audit-page-size">Page size</Label>
              <Select
                value={String(pageSize)}
                onValueChange={(value) => {
                  setPageSize(Number(value))
                  setPage(1)
                }}
              >
                <SelectTrigger id="audit-page-size">
                  <SelectValue placeholder="Page size" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={clearFilters}>
              Clear filters
            </Button>
            <Button
              type="button"
              className="bg-gradient-to-br from-[#ff6b35] to-[#ffc947] text-white shadow-sm transition-all hover:brightness-95 hover:shadow-md"
              onClick={() => setIsFilterDialogOpen(false)}
            >
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selectedLog)} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              Audit Details
            </DialogTitle>
            <DialogDescription>
              Review the event summary, actor, target, and recorded metadata.
            </DialogDescription>
          </DialogHeader>
          {selectedLog ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Action</p>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge className={actionBadgeClass(selectedLog.action)}>
                      {getActionPresentation(selectedLog.action).label}
                    </Badge>
                    <Badge variant="outline" className="text-[11px]">
                      {getActionPresentation(selectedLog.action).category}
                    </Badge>
                  </div>
                  <p className="mt-2 font-mono text-xs text-muted-foreground">{selectedLog.action}</p>
                </div>
                <div className="rounded-xl border p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Timestamp</p>
                  <p className="mt-2 text-sm">{new Date(selectedLog.createdAt).toLocaleString()}</p>
                </div>
                <div className="rounded-xl border p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Actor</p>
                  <p className="mt-2 text-sm">{selectedLog.actorLabel}</p>
                  <p className="font-mono text-xs text-muted-foreground">{selectedLog.actorUserId ?? '-'}</p>
                </div>
                <div className="rounded-xl border p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Target</p>
                  <p className="mt-2 text-sm">{selectedLog.targetLabel}</p>
                  <p className="text-xs text-muted-foreground">
                    {getEntityLabel(selectedLog.targetType)}
                    {selectedLog.targetId ? ` | ${selectedLog.targetId}` : ''}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border bg-slate-50/60 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Readable summary
                </p>
                <p className="mt-2 text-sm text-slate-700">{selectedLog.detailsPreview}</p>
              </div>

              {getMetadataEntries(selectedLog.detailsJson).length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {getMetadataEntries(selectedLog.detailsJson).map((entry) => (
                    <div key={entry.key} className="rounded-xl border bg-slate-50/60 p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {entry.label}
                      </p>
                      {entry.multiline ? (
                        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-slate-950 p-3 text-xs text-slate-100">
                          {entry.formattedValue}
                        </pre>
                      ) : (
                        <p className="mt-2 text-sm text-slate-800">{entry.formattedValue}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No structured metadata was recorded for this event.
                </div>
              )}

              <div className="rounded-xl border">
                <div className="border-b px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Raw JSON
                </div>
                <pre className="max-h-[360px] overflow-auto bg-slate-950 p-4 text-xs text-slate-100">
                  {JSON.stringify(selectedLog.detailsJson, null, 2)}
                </pre>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}

interface AuditRowActionsProps {
  log: AuditLogItem
  onView: () => void
  onOpenEmployee?: () => void
}

interface SummaryCardProps {
  title: string
  value: number | null
  helper: string
  icon: ReactNode
  accentClass: string
}

function SummaryCard({
  title,
  value,
  helper,
  icon,
  accentClass,
}: SummaryCardProps) {
  return (
    <Card className="rounded-2xl border border-slate-200/80 shadow-sm">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-500">{title}</p>
            {value === null ? (
              <Skeleton className="mt-2 h-8 w-20" />
            ) : (
              <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
            )}
          </div>
          <div className={cn('flex h-11 w-11 items-center justify-center rounded-2xl', accentClass)}>
            {icon}
          </div>
        </div>
        <p className="text-sm text-slate-500">{helper}</p>
      </CardContent>
    </Card>
  )
}

function AuditRowActions({ log, onView, onOpenEmployee }: AuditRowActionsProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [isOpen])

  return (
    <div ref={menuRef} className="relative inline-flex">
      <Button
        type="button"
        size="icon"
        variant="ghost"
        aria-label={`Actions for audit event ${log.id}`}
        onClick={() => setIsOpen((current) => !current)}
      >
        <MoreHorizontal className="h-4 w-4" />
      </Button>

      {isOpen ? (
        <div className="absolute right-0 top-10 z-30 w-44 rounded-lg border bg-white p-1 shadow-md">
          <AuditMenuItem
            onClick={() => {
              setIsOpen(false)
              onView()
            }}
          >
            <Eye className="mr-2 h-4 w-4" />
            View details
          </AuditMenuItem>
          {onOpenEmployee ? (
            <AuditMenuItem
              onClick={() => {
                setIsOpen(false)
                onOpenEmployee()
              }}
            >
              Open employee profile
            </AuditMenuItem>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

interface AuditMenuItemProps {
  children: ReactNode
  onClick: () => void
}

function AuditMenuItem({ children, onClick }: AuditMenuItemProps) {
  return (
    <button
      type="button"
      className="flex w-full items-center rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-muted"
      onClick={onClick}
    >
      {children}
    </button>
  )
}
