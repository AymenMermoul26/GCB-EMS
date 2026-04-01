import {
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileText,
  Loader2,
  Search,
  XCircle,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert'
import {
  EmptyState,
  ErrorState,
  SearchEmptyState,
} from '@/components/common/page-state'
import {
  BRAND_BUTTON_CLASS_NAME,
  PageHeader,
  SURFACE_CARD_CLASS_NAME,
} from '@/components/common/page-header'
import { StatusBadge } from '@/components/common/status-badge'
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
import { ROUTES } from '@/constants/routes'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { useI18n } from '@/hooks/use-i18n'
import { useRole } from '@/hooks/use-role'
import { DashboardLayout } from '@/layouts/dashboard-layout'
import { cn } from '@/lib/utils'
import { useMyRequestsQuery } from '@/services/requestsService'
import type { DemandeStatut, ModificationRequest } from '@/types/modification-request'
import {
  formatModificationRequestFieldValue,
  getRequestFieldLabel,
} from '@/utils/modification-requests'

type StatusFilter = 'ALL' | DemandeStatut

function getStatusMeta(
  status: DemandeStatut,
  t: ReturnType<typeof useI18n>['t'],
): {
  label: string
  icon: typeof Clock3
  tone: 'success' | 'warning' | 'danger'
} {
  if (status === 'ACCEPTEE') {
    return {
      label: t('status.modification.ACCEPTEE'),
      icon: CheckCircle2,
      tone: 'success',
    }
  }

  if (status === 'REJETEE') {
    return {
      label: t('status.modification.REJETEE'),
      icon: XCircle,
      tone: 'danger',
    }
  }

  return {
    label: t('status.modification.EN_ATTENTE'),
    icon: Clock3,
    tone: 'warning',
  }
}

function getRequestSurfaceClass(status: DemandeStatut): string {
  if (status === 'ACCEPTEE') {
    return 'border-emerald-200 bg-emerald-50/70 hover:bg-emerald-50'
  }

  if (status === 'REJETEE') {
    return 'border-rose-200 bg-rose-50/80 hover:bg-rose-50'
  }

  return 'border-amber-200 bg-amber-50/90 hover:bg-amber-100/80'
}

function formatDateTime(
  value: string | null,
  locale: string,
  emptyValue: string,
): string {
  if (!value) {
    return emptyValue
  }
  return new Date(value).toLocaleString(locale)
}

function buildRequestSummary(
  request: ModificationRequest,
  t: ReturnType<typeof useI18n>['t'],
  locale: string,
): string {
  const fieldLabel = getRequestFieldLabel(request.champCible, t)
  const oldValue = formatModificationRequestFieldValue(
    request.champCible,
    request.ancienneValeur,
    { emptyValue: t('common.notSet'), locale },
  )
  const newValue = formatModificationRequestFieldValue(
    request.champCible,
    request.nouvelleValeur,
    { emptyValue: t('common.notSet'), locale },
  )
  return `${fieldLabel}: ${oldValue} -> ${newValue}`
}

function matchesSearch(
  request: ModificationRequest,
  term: string,
  t: ReturnType<typeof useI18n>['t'],
  locale: string,
): boolean {
  if (!term) {
    return true
  }

  const normalized = term.toLowerCase()
  const summary = buildRequestSummary(request, t, locale).toLowerCase()
  const motif = (request.motif ?? '').toLowerCase()
  const field = getRequestFieldLabel(request.champCible, t).toLowerCase()
  const status = request.statutDemande.toLowerCase()

  return (
    summary.includes(normalized) ||
    motif.includes(normalized) ||
    field.includes(normalized) ||
    status.includes(normalized)
  )
}

function matchesStatus(request: ModificationRequest, statusFilter: StatusFilter): boolean {
  if (statusFilter === 'ALL') {
    return true
  }
  return request.statutDemande === statusFilter
}

export function EmployeeRequestsPage() {
  const { employeId } = useRole()
  const { t, locale, isRTL } = useI18n()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [selectedRequest, setSelectedRequest] = useState<ModificationRequest | null>(null)

  const debouncedSearch = useDebouncedValue(search, 350)
  const requestsQuery = useMyRequestsQuery(employeId, 1, 50)

  const requests = useMemo(() => requestsQuery.data?.items ?? [], [requestsQuery.data?.items])
  const pendingCount = useMemo(
    () => requests.filter((request) => request.statutDemande === 'EN_ATTENTE').length,
    [requests],
  )

  const filteredRequests = useMemo(
    () =>
      requests.filter(
        (request) =>
          matchesStatus(request, statusFilter) &&
          matchesSearch(request, debouncedSearch.trim(), t, locale),
      ),
    [debouncedSearch, locale, requests, statusFilter, t],
  )

  const isFiltered = statusFilter !== 'ALL' || debouncedSearch.trim().length > 0

  return (
    <DashboardLayout
      title={t('employee.requests.title')}
      subtitle={t('employee.requests.subtitle')}
    >
      <PageHeader
        title={t('employee.requests.title')}
        description={t('employee.requests.subtitle')}
        className="sticky top-16 z-20 mb-6"
        badges={
          <>
            <StatusBadge tone="neutral" emphasis="outline">
              {t('common.notifications')}: {requestsQuery.data?.total ?? requests.length}
            </StatusBadge>
            <StatusBadge tone="warning" emphasis="solid">
              {t('status.modification.EN_ATTENTE')} {pendingCount}
            </StatusBadge>
          </>
        }
        actions={
          <>
            <div className="relative min-w-[220px]">
              <Search
                className={cn(
                  'pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground',
                  isRTL ? 'right-3' : 'left-3',
                )}
              />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('employee.requests.searchPlaceholder')}
                className={cn(isRTL ? 'pr-9' : 'pl-9')}
                aria-label={t('employee.requests.searchAria')}
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as StatusFilter)}
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder={t('employee.requests.filterPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t('employee.requests.allStatuses')}</SelectItem>
                <SelectItem value="EN_ATTENTE">{t('status.modification.EN_ATTENTE')}</SelectItem>
                <SelectItem value="ACCEPTEE">{t('status.modification.ACCEPTEE')}</SelectItem>
                <SelectItem value="REJETEE">{t('status.modification.REJETEE')}</SelectItem>
              </SelectContent>
            </Select>
            <Button asChild className={BRAND_BUTTON_CLASS_NAME}>
              <Link to={`${ROUTES.EMPLOYEE_PROFILE_MANAGE}#requests`}>
                {t('actions.newRequest')}
              </Link>
            </Button>
          </>
        }
      />

      <Alert className="mb-4 border-slate-200 bg-slate-50">
        <AlertTitle>{t('employee.requests.reviewWorkflowTitle')}</AlertTitle>
        <AlertDescription>
          {t('employee.requests.reviewWorkflowDescription')}
        </AlertDescription>
      </Alert>

      <Card className={SURFACE_CARD_CLASS_NAME}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t('employee.requests.historyTitle')}</CardTitle>
          <CardDescription>
            {t('employee.requests.historyDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {requestsQuery.isPending ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : null}

          {requestsQuery.isError ? (
            <ErrorState
              surface="plain"
              title={t('employee.requests.loadErrorTitle')}
              description={t('employee.requests.loadErrorDescription')}
              message={requestsQuery.error.message}
              onRetry={() => void requestsQuery.refetch()}
            />
          ) : null}

          {!requestsQuery.isPending && !requestsQuery.isError ? (
            filteredRequests.length === 0 ? (
              requests.length === 0 ? (
                <EmptyState
                  surface="plain"
                  title={t('employee.requests.emptyTitle')}
                  description={t('employee.requests.emptyDescription')}
                  actions={
                    <Button
                      asChild
                      className="border-0 bg-gradient-to-br from-[#ff6b35] to-[#ffc947] text-white shadow-sm hover:shadow-md"
                    >
                      <Link to={`${ROUTES.EMPLOYEE_PROFILE_MANAGE}#requests`}>
                        {t('employee.requests.createRequest')}
                      </Link>
                    </Button>
                  }
                />
              ) : (
                <SearchEmptyState
                  surface="plain"
                  title={t('employee.requests.searchEmptyTitle')}
                  description={t('employee.requests.searchEmptyDescription')}
                  actions={
                    isFiltered ? (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSearch('')
                          setStatusFilter('ALL')
                        }}
                      >
                        {t('actions.clearFilters')}
                      </Button>
                    ) : null
                  }
                />
              )
            ) : (
              <>
                <div className="hidden overflow-x-auto md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('employee.requests.submitted')}</TableHead>
                        <TableHead>{t('employee.requests.summary')}</TableHead>
                        <TableHead>{t('employee.requests.filterPlaceholder')}</TableHead>
                        <TableHead>{t('employee.requests.reviewed')}</TableHead>
                        <TableHead className="text-right">{t('employee.requests.actions')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRequests.map((request) => {
                        const statusMeta = getStatusMeta(request.statutDemande, t)
                        const StatusIcon = statusMeta.icon
                        return (
                          <TableRow
                            key={request.id}
                            className={cn('cursor-pointer transition-colors', getRequestSurfaceClass(request.statutDemande))}
                            onClick={() => setSelectedRequest(request)}
                          >
                            <TableCell>{formatDateTime(request.createdAt, locale, t('common.notReviewed'))}</TableCell>
                            <TableCell className="max-w-[420px]">
                              <p className="line-clamp-2 text-sm text-slate-800">
                                {buildRequestSummary(request, t, locale)}
                              </p>
                            </TableCell>
                            <TableCell>
                              <StatusBadge tone={statusMeta.tone} emphasis="solid">
                                <StatusIcon className={cn('h-3.5 w-3.5', isRTL ? 'ml-1' : 'mr-1')} />
                                {statusMeta.label}
                              </StatusBadge>
                            </TableCell>
                            <TableCell>{formatDateTime(request.traiteAt, locale, t('common.notReviewed'))}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  setSelectedRequest(request)
                                }}
                              >
                                {t('employee.requests.viewDetails')}
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>

                <div className="space-y-3 md:hidden">
                  {filteredRequests.map((request) => {
                    const statusMeta = getStatusMeta(request.statutDemande, t)
                    const StatusIcon = statusMeta.icon
                    return (
                      <button
                        key={request.id}
                        type="button"
                        onClick={() => setSelectedRequest(request)}
                        className={cn(
                          'w-full rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--brand-primary))]',
                          getRequestSurfaceClass(request.statutDemande),
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs text-muted-foreground">
                              {formatDateTime(request.createdAt, locale, t('common.notReviewed'))}
                            </p>
                            <p className="mt-1 line-clamp-2 text-sm text-slate-800">
                              {buildRequestSummary(request, t, locale)}
                            </p>
                          </div>
                          <StatusBadge tone={statusMeta.tone} emphasis="solid">
                            <StatusIcon className={cn('h-3.5 w-3.5', isRTL ? 'ml-1' : 'mr-1')} />
                            {statusMeta.label}
                          </StatusBadge>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </>
            )
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={Boolean(selectedRequest)} onOpenChange={(open) => !open && setSelectedRequest(null)}>
        <DialogContent className="max-w-xl">
          {selectedRequest ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {t('employee.requests.detailsTitle')}
                    <StatusBadge
                    tone={getStatusMeta(selectedRequest.statutDemande, t).tone}
                    emphasis="solid"
                  >
                    {getStatusMeta(selectedRequest.statutDemande, t).label}
                  </StatusBadge>
                </DialogTitle>
                <DialogDescription>
                  {t('employee.requests.submittedOn', {
                    value: formatDateTime(selectedRequest.createdAt, locale, t('common.notReviewed')),
                  })}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    {t('employee.requests.summary')}
                  </p>
                  <p className="mt-1 text-sm text-slate-800">
                    {buildRequestSummary(selectedRequest, t, locale)}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      {t('employee.requests.targetField')}
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-900">
                      {getRequestFieldLabel(selectedRequest.champCible, t)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      {t('employee.requests.reviewedOn')}
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-900">
                      {formatDateTime(selectedRequest.traiteAt, locale, t('common.notReviewed'))}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    {t('employee.requests.currentValue')}
                  </p>
                  <p className="mt-1 text-sm text-slate-800">
                    {formatModificationRequestFieldValue(
                      selectedRequest.champCible,
                      selectedRequest.ancienneValeur,
                      { emptyValue: t('common.notSet'), locale },
                    )}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    {t('employee.requests.requestedValue')}
                  </p>
                  <p className="mt-1 text-sm text-slate-800">
                    {formatModificationRequestFieldValue(
                      selectedRequest.champCible,
                      selectedRequest.nouvelleValeur,
                      { emptyValue: t('common.notSet'), locale },
                    )}
                  </p>
                </div>

                {selectedRequest.motif ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      {t('employee.requests.requestNote')}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">
                      {selectedRequest.motif}
                    </p>
                  </div>
                ) : null}

                {selectedRequest.statutDemande === 'ACCEPTEE' && selectedRequest.traiteAt ? (
                  <Alert className="border-emerald-300 bg-emerald-50 text-emerald-900">
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertTitle>{t('status.modification.ACCEPTEE')}</AlertTitle>
                    <AlertDescription>
                      {t('employee.requests.reviewedOn')} {formatDateTime(selectedRequest.traiteAt, locale, t('common.notReviewed'))}.
                    </AlertDescription>
                  </Alert>
                ) : null}

                {selectedRequest.statutDemande === 'REJETEE' ? (
                  <Alert className="border-rose-500 bg-rose-600 text-white">
                    <XCircle className="h-4 w-4" />
                    <AlertTitle>{t('status.modification.REJETEE')}</AlertTitle>
                    <AlertDescription>
                      {selectedRequest.commentaireTraitement?.trim()
                        ? t('employee.requests.rejectedReason', {
                            value: selectedRequest.commentaireTraitement,
                          })
                        : t('employee.requests.noRejectionReason')}
                    </AlertDescription>
                  </Alert>
                ) : null}
              </div>

              <DialogFooter className="mt-2">
                <Button variant="outline" onClick={() => setSelectedRequest(null)}>
                  {t('actions.close')}
                </Button>
                <Button asChild variant="outline">
                  <Link to={`${ROUTES.EMPLOYEE_PROFILE_MANAGE}#requests`}>
                    <FileText className={cn('h-4 w-4', isRTL ? 'ml-2' : 'mr-2')} />
                    {t('actions.newRequest')}
                    <ExternalLink className={cn('h-4 w-4', isRTL ? 'mr-2' : 'ml-2')} />
                  </Link>
                </Button>
              </DialogFooter>
            </>
          ) : (
            <div className="py-10 text-center text-sm text-muted-foreground">
              <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" />
              {t('employee.requests.loading')}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
