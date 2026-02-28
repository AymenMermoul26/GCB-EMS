import {
  CalendarDays,
  Eye,
  Filter,
  MoreHorizontal,
  RefreshCw,
  Search,
  ShieldAlert,
} from 'lucide-react'
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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

const ACTION_OPTIONS: Array<{ value: AuditAction | 'ALL'; label: string }> = [
  { value: 'ALL', label: 'All actions' },
  { value: 'EMPLOYEE_CREATED', label: 'EMPLOYEE_CREATED' },
  { value: 'EMPLOYEE_UPDATED', label: 'EMPLOYEE_UPDATED' },
  { value: 'EMPLOYEE_DEACTIVATED', label: 'EMPLOYEE_DEACTIVATED' },
  { value: 'REQUEST_SUBMITTED', label: 'REQUEST_SUBMITTED' },
  { value: 'REQUEST_APPROVED', label: 'REQUEST_APPROVED' },
  { value: 'REQUEST_REJECTED', label: 'REQUEST_REJECTED' },
  { value: 'QR_REGENERATED', label: 'QR_REGENERATED' },
  { value: 'QR_REVOKED', label: 'QR_REVOKED' },
  { value: 'VISIBILITY_UPDATED', label: 'VISIBILITY_UPDATED' },
  { value: 'EMPLOYEE_SELF_UPDATED', label: 'EMPLOYEE_SELF_UPDATED' },
]

function shortId(value: string | null): string {
  if (!value) {
    return '-'
  }

  return value.length > 8 ? `${value.slice(0, 8)}...` : value
}

function actionLabel(action: string): string {
  return action.replaceAll('_', ' ')
}

function actionBadgeClass(action: string): string {
  const criticalActions = new Set([
    'EMPLOYEE_DEACTIVATED',
    'REQUEST_REJECTED',
    'QR_REVOKED',
  ])
  const warningActions = new Set([
    'REQUEST_SUBMITTED',
    'VISIBILITY_UPDATED',
    'QR_REGENERATED',
  ])

  if (criticalActions.has(action)) {
    return 'border-transparent bg-rose-100 text-rose-700'
  }

  if (warningActions.has(action)) {
    return 'border-transparent bg-amber-100 text-amber-800'
  }

  return 'border-transparent bg-slate-100 text-slate-700'
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
  const visibleItems = useMemo(() => {
    const term = debouncedQuickSearch.trim().toLowerCase()
    return items.filter((log) => {
      if (actorFilter !== 'ALL' && log.actorLabel !== actorFilter) {
        return false
      }

      if (!term) {
        return true
      }

      const target = [
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
  }, [actorFilter, debouncedQuickSearch, items])

  const hasActiveFilters =
    action !== 'ALL' ||
    dateFrom.length > 0 ||
    dateTo.length > 0 ||
    targetSearch.trim().length > 0 ||
    quickSearch.trim().length > 0 ||
    actorFilter !== 'ALL' ||
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
    setPage(1)
    setPageSize(20)
    setIsFilterDialogOpen(false)
  }

  return (
    <DashboardLayout title="Audit Log" subtitle="Track sensitive actions and security events.">
      <div className="sticky top-2 z-20 mb-6 rounded-2xl border bg-white/95 p-4 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Audit Log</h1>
              {auditLogQuery.isPending ? (
                <Skeleton className="h-6 w-24 rounded-full" />
              ) : (
                <Badge variant="secondary" className="rounded-full">
                  {total} total
                </Badge>
              )}
              {!auditLogQuery.isPending ? (
                <Badge variant="outline" className="rounded-full">
                  {visibleItems.length} shown
                </Badge>
              ) : null}
            </div>
            <p className="text-sm text-muted-foreground">
              Track sensitive actions and security events.
            </p>
          </div>

          <div className="flex w-full flex-col gap-2 sm:flex-row xl:w-auto">
            {auditLogQuery.isPending ? (
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
                    placeholder="Search by action, actor, employee..."
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
                  <RefreshCw className={cn('mr-2 h-4 w-4', auditLogQuery.isFetching && 'animate-spin')} />
                  Refresh
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {auditLogQuery.isError ? (
        <Alert variant="destructive" className="mb-6">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Failed to load audit log</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>{auditLogQuery.error.message}</p>
            <Button variant="outline" size="sm" onClick={() => void auditLogQuery.refetch()}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
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
                          <TableCell>{new Date(log.createdAt).toLocaleString()}</TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <Badge className={actionBadgeClass(log.action)}>
                                {actionLabel(log.action)}
                              </Badge>
                              <p className="font-mono text-xs text-muted-foreground">{log.action}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className="text-sm">{log.actorLabel}</p>
                            <p className="font-mono text-xs text-muted-foreground">{shortId(log.actorUserId)}</p>
                          </TableCell>
                          <TableCell>
                            <p className="text-sm">{log.targetLabel}</p>
                            <p className="font-mono text-xs text-muted-foreground">
                              {log.targetType} - {shortId(log.targetId)}
                            </p>
                          </TableCell>
                          <TableCell>
                            <p className="line-clamp-2 text-xs text-muted-foreground">
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
              <div className="flex justify-center py-8">
                <div className="w-full max-w-lg rounded-2xl border border-dashed bg-muted/20 p-8 text-center">
                  <h3 className="text-lg font-semibold text-slate-900">
                    {hasActiveFilters ? 'No results' : 'No audit events'}
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {hasActiveFilters
                      ? 'Try changing your filters and search criteria.'
                      : 'Audit events will appear here when actions occur.'}
                  </p>
                  {hasActiveFilters ? (
                    <Button type="button" variant="outline" className="mt-5" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  ) : null}
                </div>
              </div>
            )
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={isFilterDialogOpen} onOpenChange={setIsFilterDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Filter audit log</DialogTitle>
            <DialogDescription>Narrow the event stream by action, actor, date, and target.</DialogDescription>
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
                placeholder="Search target employee (matricule, nom, prenom)"
                value={targetSearch}
                onChange={(event) => {
                  setTargetSearch(event.target.value)
                  setPage(1)
                }}
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
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
              Full event metadata for the selected audit entry.
            </DialogDescription>
          </DialogHeader>
          {selectedLog ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Action</p>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge className={actionBadgeClass(selectedLog.action)}>
                      {actionLabel(selectedLog.action)}
                    </Badge>
                    <span className="font-mono text-xs text-muted-foreground">{selectedLog.action}</span>
                  </div>
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
                  <p className="font-mono text-xs text-muted-foreground">
                    {selectedLog.targetType} - {selectedLog.targetId ?? '-'}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border">
                <div className="border-b px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Details JSON
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
