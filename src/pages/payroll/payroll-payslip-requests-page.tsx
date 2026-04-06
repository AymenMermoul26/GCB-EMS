import {
  ExternalLink,
  FileText,
  Loader2,
  Search,
  ShieldCheck,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import {
  EmptyState,
  ErrorState,
  PageStateSkeleton,
  SearchEmptyState,
} from '@/components/common/page-state'
import {
  BRAND_BUTTON_CLASS_NAME,
  PageHeader,
  SURFACE_CARD_CLASS_NAME,
} from '@/components/common/page-header'
import { StatusBadge } from '@/components/common/status-badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { PayslipWorkflowTimeline } from '@/components/payroll/payslip-workflow-timeline'
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
import { Textarea } from '@/components/ui/textarea'
import {
  getPayrollEmployeeRoute,
} from '@/constants/routes'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { useAuth } from '@/hooks/use-auth'
import { useI18n } from '@/hooks/use-i18n'
import { PayrollLayout } from '@/layouts/payroll-layout'
import { cn } from '@/lib/utils'
import {
  createPayslipRequestCanonicalDocumentAccessDescriptor,
  createPayslipRequestDeliveredDocumentAccessDescriptor,
  downloadPayslipDocument,
  openPayslipDocument,
  useFulfillPayslipRequestMutation,
  usePayrollPayslipRequestsQuery,
  useUpdatePayslipRequestStatusMutation,
} from '@/services/payslipRequestsService'
import type {
  PayrollPayslipRequestItem,
  PayslipRequestStatus,
  PayslipRequestStatusFilter,
} from '@/types/payroll'
import {
  buildPayslipRequestTimelineSource,
  getPayslipDocumentRepresentationModeLabel,
  getPayslipRequestStatusMeta,
  getPayrollProcessingStatusMeta,
} from '@/types/payroll'

function formatTimestamp(value: string | null | undefined, locale: string): string {
  if (!value) {
    return '\u2014'
  }

  return new Date(value).toLocaleString(locale)
}

function formatDateRange(start: string, end: string, locale: string): string {
  return `${new Date(`${start}T00:00:00`).toLocaleDateString(locale)} - ${new Date(`${end}T00:00:00`).toLocaleDateString(locale)}`
}

function SummaryCard({
  title,
  value,
  helper,
}: {
  title: string
  value: number
  helper: string
}) {
  return (
    <Card className={SURFACE_CARD_CLASS_NAME}>
      <CardContent className="space-y-3 p-5">
        <p className="text-sm font-medium text-slate-600">{title}</p>
        <p className="text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
        <p className="text-sm leading-6 text-slate-600">{helper}</p>
      </CardContent>
    </Card>
  )
}

function buildEmployeeName(request: PayrollPayslipRequestItem): string {
  return `${request.employePrenom} ${request.employeNom}`.trim()
}

function PayslipRequestRow({
  request,
  onOpen,
}: {
  request: PayrollPayslipRequestItem
  onOpen: (request: PayrollPayslipRequestItem) => void
}) {
  const { t, locale } = useI18n()
  const statusMeta = getPayslipRequestStatusMeta(request.status, t)

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-slate-950">{buildEmployeeName(request)}</p>
            <StatusBadge tone={statusMeta.tone}>{statusMeta.label}</StatusBadge>
            <StatusBadge tone="neutral" emphasis="outline">
              {request.employeMatricule}
            </StatusBadge>
            <StatusBadge tone="neutral" emphasis="outline">
              {request.payrollPeriodCode}
            </StatusBadge>
          </div>

          <p className="mt-2 text-sm text-slate-600">
            {request.payrollPeriodLabel} | {formatDateRange(request.periodStart, request.periodEnd, locale)}
          </p>

          <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
            <span>{request.departementNom ?? '\u2014'}</span>
            <span>{request.employeEmail ?? '\u2014'}</span>
            <span>
              {t('payroll.payslipRequests.row.submittedAt', {
                value: formatTimestamp(request.createdAt, locale),
              })}
            </span>
          </div>

          {request.requestNote ? (
            <p className="mt-3 text-sm leading-6 text-slate-600">{request.requestNote}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to={getPayrollEmployeeRoute(request.employeId)}>
              {t('actions.openEmployee')}
            </Link>
          </Button>
          <Button type="button" size="sm" onClick={() => onOpen(request)}>
            {t('actions.review')}
          </Button>
        </div>
      </div>
    </div>
  )
}

function canReviewRequest(status: PayslipRequestStatus): boolean {
  return status === 'PENDING' || status === 'IN_REVIEW'
}

function sortPayslipRequests(requests: PayrollPayslipRequestItem[]) {
  return [...requests].sort((left, right) => right.createdAt.localeCompare(left.createdAt))
}

function canDeliverRequestDocument(request: PayrollPayslipRequestItem): boolean {
  return Boolean(request.canonicalPayslipId && request.canonicalDocumentReady)
}

function formatFileSize(value: number | null | undefined): string {
  if (value === null || value === undefined || value <= 0) {
    return '\u2014'
  }

  if (value >= 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(2)} MB`
  }

  if (value >= 1024) {
    return `${(value / 1024).toFixed(1)} KB`
  }

  return `${value} B`
}

export function PayrollPayslipRequestsPage() {
  const { signOut, user } = useAuth()
  const { t, locale, isRTL } = useI18n()
  const [searchInput, setSearchInput] = useState('')
  const [statusFilter, setStatusFilter] = useState<PayslipRequestStatusFilter>('ALL')
  const [selectedRequest, setSelectedRequest] = useState<PayrollPayslipRequestItem | null>(null)
  const [reviewNote, setReviewNote] = useState('')
  const [activeDocumentActionKey, setActiveDocumentActionKey] = useState<string | null>(null)

  const debouncedSearch = useDebouncedValue(searchInput, 350)
  const requestsQuery = usePayrollPayslipRequestsQuery(user?.id, {
    status: statusFilter,
    search: debouncedSearch,
  })

  const requests = sortPayslipRequests(requestsQuery.data ?? [])
  const pendingCount = requests.filter((request) => request.status === 'PENDING').length
  const inReviewCount = requests.filter((request) => request.status === 'IN_REVIEW').length
  const fulfilledCount = requests.filter((request) => request.status === 'FULFILLED').length
  const rejectedCount = requests.filter((request) => request.status === 'REJECTED').length

  useEffect(() => {
    if (!selectedRequest?.id || !requestsQuery.data) {
      return
    }

    const refreshedRequest = requestsQuery.data.find(
      (request) => request.id === selectedRequest.id,
    )

    if (!refreshedRequest) {
      return
    }

    setSelectedRequest((current) => {
      if (!current || current.id !== refreshedRequest.id) {
        return current
      }

      return refreshedRequest
    })
  }, [requestsQuery.data, selectedRequest?.id])

  const updateStatusMutation = useUpdatePayslipRequestStatusMutation(user?.id, {
    onSuccess: (_, variables) => {
      toast.success(t('payroll.payslipRequests.feedback.statusUpdated'))
      if (variables.status === 'IN_REVIEW') {
        const reviewedAt = new Date().toISOString()
        setSelectedRequest((current) =>
          current
            ? {
                ...current,
                status: 'IN_REVIEW',
                reviewNote: reviewNote.trim().length > 0 ? reviewNote.trim() : current.reviewNote,
                reviewedAt,
                updatedAt: reviewedAt,
              }
            : current,
        )
      }
    },
  })

  const fulfillRequestMutation = useFulfillPayslipRequestMutation(user?.id, {
    onSuccess: () => {
      toast.success(t('payroll.payslipRequests.feedback.fulfilled'))
      setSelectedRequest(null)
      setReviewNote('')
    },
  })

  const isFiltered = statusFilter !== 'ALL' || debouncedSearch.trim().length > 0

  const handleOpenRequest = (request: PayrollPayslipRequestItem) => {
    setSelectedRequest(request)
    setReviewNote(request.reviewNote ?? '')
  }

  const handleMoveToInReview = async () => {
    if (!selectedRequest) {
      return
    }

    try {
      await updateStatusMutation.mutateAsync({
        requestId: selectedRequest.id,
        status: 'IN_REVIEW',
        reviewNote,
      })
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('payroll.payslipRequests.feedback.statusUpdateError'),
      )
    }
  }

  const handleReject = async () => {
    if (!selectedRequest) {
      return
    }

    if (reviewNote.trim().length === 0) {
      toast.error(t('payroll.payslipRequests.feedback.rejectNoteRequired'))
      return
    }

    try {
      await updateStatusMutation.mutateAsync({
        requestId: selectedRequest.id,
        status: 'REJECTED',
        reviewNote,
      })
      setSelectedRequest(null)
      setReviewNote('')
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('payroll.payslipRequests.feedback.rejectError'),
      )
    }
  }

  const handleFulfill = async () => {
    if (!selectedRequest) {
      return
    }

    if (!selectedRequest.canonicalSourcePayrollRunEmployeId) {
      toast.error(t('payroll.payslipRequests.feedback.fulfillWithoutResult'))
      return
    }

    if (!canDeliverRequestDocument(selectedRequest)) {
      toast.error(t('payroll.payslipRequests.feedback.fulfillWithoutDocument'))
      return
    }

    try {
      await fulfillRequestMutation.mutateAsync({
        requestId: selectedRequest.id,
        reviewNote,
      })
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('payroll.payslipRequests.feedback.fulfillError'),
      )
    }
  }

  const handleOpenDocument = async (
    actionKey: string,
    descriptor: ReturnType<typeof createPayslipRequestCanonicalDocumentAccessDescriptor> | null,
    failureMessage: string,
  ) => {
    if (!descriptor) {
      return
    }

    setActiveDocumentActionKey(actionKey)

    try {
      await openPayslipDocument(descriptor)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : failureMessage)
    } finally {
      setActiveDocumentActionKey(null)
    }
  }

  const handleDownloadDocument = async (
    actionKey: string,
    descriptor: ReturnType<typeof createPayslipRequestCanonicalDocumentAccessDescriptor> | null,
    failureMessage: string,
  ) => {
    if (!descriptor) {
      return
    }

    setActiveDocumentActionKey(actionKey)

    try {
      await downloadPayslipDocument(descriptor)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : failureMessage)
    } finally {
      setActiveDocumentActionKey(null)
    }
  }

  return (
    <PayrollLayout
      title={t('payroll.payslipRequests.title')}
      subtitle={t('payroll.payslipRequests.subtitle')}
      onSignOut={signOut}
      userEmail={user?.email ?? null}
    >
      <PageHeader
        title={t('payroll.payslipRequests.title')}
        description={t('payroll.payslipRequests.headerDescription')}
        className="mb-6"
        badges={
          <>
            <StatusBadge tone="brand">{t('payroll.payslipRequests.workflowBadge')}</StatusBadge>
            <StatusBadge tone="neutral" emphasis="outline">
              {t('payroll.payslipRequests.deliveryBadge')}
            </StatusBadge>
          </>
        }
        actions={
          <>
            <div className="relative min-w-[220px]">
              <Search
                className={cn(
                  'pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400',
                  isRTL ? 'right-3' : 'left-3',
                )}
              />
              <Input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder={t('payroll.payslipRequests.searchPlaceholder')}
                className={cn(isRTL ? 'pr-9' : 'pl-9')}
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as PayslipRequestStatusFilter)}
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder={t('payroll.payslipRequests.filterPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t('payroll.payslipRequests.allStatuses')}</SelectItem>
                <SelectItem value="PENDING">{t('status.payslipRequest.PENDING')}</SelectItem>
                <SelectItem value="IN_REVIEW">{t('status.payslipRequest.IN_REVIEW')}</SelectItem>
                <SelectItem value="FULFILLED">{t('status.payslipRequest.FULFILLED')}</SelectItem>
                <SelectItem value="REJECTED">{t('status.payslipRequest.REJECTED')}</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
      />

      {requestsQuery.isPending && !requestsQuery.data ? (
        <PageStateSkeleton variant="list" count={5} />
      ) : requestsQuery.isError ? (
        <ErrorState
          title={t('payroll.payslipRequests.queue.loadErrorTitle')}
          description={t('payroll.payslipRequests.queue.loadErrorDescription')}
          message={requestsQuery.error.message}
          onRetry={() => void requestsQuery.refetch()}
        />
      ) : (
        <>
          <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              title={t('payroll.payslipRequests.summaries.pendingTitle')}
              value={pendingCount}
              helper={t('payroll.payslipRequests.summaries.pendingHelper')}
            />
            <SummaryCard
              title={t('payroll.payslipRequests.summaries.inReviewTitle')}
              value={inReviewCount}
              helper={t('payroll.payslipRequests.summaries.inReviewHelper')}
            />
            <SummaryCard
              title={t('payroll.payslipRequests.summaries.fulfilledTitle')}
              value={fulfilledCount}
              helper={t('payroll.payslipRequests.summaries.fulfilledHelper')}
            />
            <SummaryCard
              title={t('payroll.payslipRequests.summaries.rejectedTitle')}
              value={rejectedCount}
              helper={t('payroll.payslipRequests.summaries.rejectedHelper')}
            />
          </div>

          <Card className={`${SURFACE_CARD_CLASS_NAME} mb-6`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-950">
                <ShieldCheck className="h-4 w-4 text-slate-600" />
                {t('payroll.payslipRequests.boundary.title')}
              </CardTitle>
              <CardDescription>
                {t('payroll.payslipRequests.boundary.description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-6 text-slate-600">
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
                {t('payroll.payslipRequests.boundary.itemOne')}
              </div>
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
                {t('payroll.payslipRequests.boundary.itemTwo')}
              </div>
            </CardContent>
          </Card>

          <Card className={SURFACE_CARD_CLASS_NAME}>
            <CardHeader>
              <CardTitle className="text-base font-semibold text-slate-950">
                {t('payroll.payslipRequests.queue.title')}
              </CardTitle>
              <CardDescription>
                {t('payroll.payslipRequests.queue.description')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {requests.length === 0 ? (
                isFiltered ? (
                  <SearchEmptyState
                    surface="plain"
                    align="left"
                    title={t('payroll.payslipRequests.queue.searchEmptyTitle')}
                    description={t('payroll.payslipRequests.queue.searchEmptyDescription')}
                    actions={
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSearchInput('')
                          setStatusFilter('ALL')
                        }}
                      >
                        {t('actions.clearFilters')}
                      </Button>
                    }
                  />
                ) : (
                  <EmptyState
                    surface="plain"
                    align="left"
                    title={t('payroll.payslipRequests.queue.emptyTitle')}
                    description={t('payroll.payslipRequests.queue.emptyDescription')}
                  />
                )
              ) : (
                <div className="space-y-3">
                  {requests.map((request) => (
                    <PayslipRequestRow
                      key={request.id}
                      request={request}
                      onOpen={handleOpenRequest}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Dialog
        open={Boolean(selectedRequest)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedRequest(null)
            setReviewNote('')
          }
        }}
      >
        <DialogContent className="sm:max-w-3xl">
          {selectedRequest ? (
            <>
              <DialogHeader>
                <DialogTitle>{t('payroll.payslipRequests.dialog.title')}</DialogTitle>
                <DialogDescription>
                  {t('payroll.payslipRequests.dialog.description')}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
                  <p className="text-sm font-semibold text-slate-950">{t('common.workflowTimeline')}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {t('payroll.payslipRequests.dialog.timelineDescription')}
                  </p>
                    <PayslipWorkflowTimeline
                      className="mt-4"
                      source={buildPayslipRequestTimelineSource({
                        status: selectedRequest.status,
                        createdAt: selectedRequest.createdAt,
                        reviewedAt: selectedRequest.reviewedAt,
                        canonicalPayslipPublishedAt: selectedRequest.canonicalPayslipPublishedAt,
                        canonicalDocumentReady: selectedRequest.canonicalDocumentReady,
                        documentPublishedAt: selectedRequest.documentPublishedAt,
                        fulfilledAt: selectedRequest.fulfilledAt,
                      })}
                    />
                  </div>

                <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-950">
                        {buildEmployeeName(selectedRequest)}
                      </p>
                      <StatusBadge tone={getPayslipRequestStatusMeta(selectedRequest.status, t).tone}>
                        {getPayslipRequestStatusMeta(selectedRequest.status, t).label}
                      </StatusBadge>
                    </div>
                    <div className="mt-3 space-y-1 text-sm text-slate-600">
                      <p>{t('employee.profile.fields.employeeId')}: {selectedRequest.employeMatricule}</p>
                      <p>{t('common.email')}: {selectedRequest.employeEmail ?? '\u2014'}</p>
                      <p>{t('common.department')}: {selectedRequest.departementNom ?? '\u2014'}</p>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button asChild variant="outline" size="sm">
                        <Link to={getPayrollEmployeeRoute(selectedRequest.employeId)}>
                          {t('actions.openEmployee')}
                        </Link>
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
                    <p className="text-sm font-semibold text-slate-950">
                      {selectedRequest.payrollPeriodLabel}
                    </p>
                    <p className="mt-2 text-sm text-slate-600">
                      {selectedRequest.payrollPeriodCode} |{' '}
                      {formatDateRange(selectedRequest.periodStart, selectedRequest.periodEnd, locale)}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                      <span>{t('common.submitted')} {formatTimestamp(selectedRequest.createdAt, locale)}</span>
                      <span>{t('common.reviewed')} {formatTimestamp(selectedRequest.reviewedAt, locale)}</span>
                      <span>{t('common.fulfilled')} {formatTimestamp(selectedRequest.fulfilledAt, locale)}</span>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      {t('payroll.payslipRequests.dialog.employeeNote')}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-700">
                      {selectedRequest.requestNote ?? t('common.noNoteProvided')}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        {t('payroll.payslipRequests.dialog.canonicalRecordTitle')}
                      </p>
                      {selectedRequest.canonicalPayslipStatus ? (
                        <StatusBadge
                          tone={getPayrollProcessingStatusMeta(selectedRequest.canonicalPayslipStatus, t).tone}
                          emphasis="outline"
                        >
                          {getPayrollProcessingStatusMeta(selectedRequest.canonicalPayslipStatus, t).label}
                        </StatusBadge>
                      ) : null}
                    </div>
                    <div className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                      {selectedRequest.canonicalPayslipId ? (
                        <>
                          <p>
                            {t('payroll.payslipRequests.dialog.canonicalLinkedDescription')}
                          </p>
                          {selectedRequest.canonicalDocumentFileName ? (
                            <p className="break-all text-xs text-slate-500">
                              {selectedRequest.canonicalDocumentFileName}
                            </p>
                          ) : null}
                          <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                            <span>
                              {t('common.published')} {formatTimestamp(selectedRequest.canonicalPayslipPublishedAt, locale)}
                            </span>
                            <span>
                              {t('common.size')} {formatFileSize(selectedRequest.canonicalDocumentFileSizeBytes)}
                            </span>
                            <span>
                              {selectedRequest.canonicalDocumentContentType ?? 'application/pdf'}
                            </span>
                          </div>
                          {selectedRequest.canonicalDocumentReady &&
                          createPayslipRequestCanonicalDocumentAccessDescriptor(selectedRequest) ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={Boolean(activeDocumentActionKey)}
                                onClick={() =>
                                  void handleOpenDocument(
                                    `${selectedRequest.id}:canonical-open`,
                                    createPayslipRequestCanonicalDocumentAccessDescriptor(
                                      selectedRequest,
                                    ),
                                    t('payroll.payslipRequests.feedback.openGeneratedError'),
                                  )
                                }
                              >
                                {activeDocumentActionKey === `${selectedRequest.id}:canonical-open` ? (
                                  <Loader2 className={cn('h-4 w-4 animate-spin', isRTL ? 'ml-2' : 'mr-2')} />
                                ) : (
                                  <ExternalLink className={cn('h-4 w-4', isRTL ? 'ml-2' : 'mr-2')} />
                                )}
                                {t('actions.open')}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                disabled={Boolean(activeDocumentActionKey)}
                                onClick={() =>
                                  void handleDownloadDocument(
                                    `${selectedRequest.id}:canonical-download`,
                                    createPayslipRequestCanonicalDocumentAccessDescriptor(
                                      selectedRequest,
                                    ),
                                    t('payroll.payslipRequests.feedback.downloadGeneratedError'),
                                  )
                                }
                              >
                                {activeDocumentActionKey ===
                                `${selectedRequest.id}:canonical-download` ? (
                                  <Loader2 className={cn('h-4 w-4 animate-spin', isRTL ? 'ml-2' : 'mr-2')} />
                                ) : (
                                  <FileText className={cn('h-4 w-4', isRTL ? 'ml-2' : 'mr-2')} />
                                )}
                                {t('actions.download')}
                              </Button>
                            </div>
                          ) : null}
                          <p className="text-xs text-slate-500">
                            {selectedRequest.canonicalDocumentRepresentationMode
                              ? getPayslipDocumentRepresentationModeLabel(
                                  selectedRequest.canonicalDocumentRepresentationMode,
                                  t,
                                )
                              : t('payroll.payslipRequests.dialog.noDocumentRepresentation')}
                          </p>
                        </>
                      ) : selectedRequest.canonicalSourcePayrollRunEmployeId ? (
                        <p>{t('payroll.payslipRequests.dialog.canonicalResultReadyDescription')}</p>
                      ) : (
                        <p className="text-amber-800">{t('payroll.payslipRequests.dialog.noPublishedResult')}</p>
                      )}
                    </div>
                  </div>

                  {selectedRequest.documentId &&
                  selectedRequest.documentStoragePath &&
                  selectedRequest.documentFileName ? (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                      <p className="text-sm font-semibold text-emerald-950">
                        {t('payroll.payslipRequests.dialog.deliveredDocumentTitle')}
                      </p>
                      <p className="mt-2 text-sm text-emerald-900">
                        {selectedRequest.documentFileName}
                      </p>
                      <p className="mt-2 text-xs text-emerald-800">
                        {t('common.published')} {formatTimestamp(selectedRequest.documentPublishedAt, locale)}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={Boolean(activeDocumentActionKey)}
                          onClick={() =>
                            void handleOpenDocument(
                              `${selectedRequest.id}:delivered-open`,
                              createPayslipRequestDeliveredDocumentAccessDescriptor(
                                selectedRequest,
                              ),
                              t('payroll.payslipRequests.feedback.openDeliveredError'),
                            )
                          }
                        >
                          {activeDocumentActionKey === `${selectedRequest.id}:delivered-open` ? (
                            <Loader2 className={cn('h-4 w-4 animate-spin', isRTL ? 'ml-2' : 'mr-2')} />
                          ) : (
                            <ExternalLink className={cn('h-4 w-4', isRTL ? 'ml-2' : 'mr-2')} />
                          )}
                          {t('actions.open')} {t('common.file')}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          disabled={Boolean(activeDocumentActionKey)}
                          onClick={() =>
                            void handleDownloadDocument(
                              `${selectedRequest.id}:delivered-download`,
                              createPayslipRequestDeliveredDocumentAccessDescriptor(
                                selectedRequest,
                              ),
                              t('payroll.payslipRequests.feedback.downloadDeliveredError'),
                            )
                          }
                        >
                          {activeDocumentActionKey ===
                          `${selectedRequest.id}:delivered-download` ? (
                            <Loader2 className={cn('h-4 w-4 animate-spin', isRTL ? 'ml-2' : 'mr-2')} />
                          ) : (
                            <FileText className={cn('h-4 w-4', isRTL ? 'ml-2' : 'mr-2')} />
                          )}
                          {t('actions.download')} {t('common.file')}
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="payslipRequestReviewNote">{t('payroll.payslipRequests.dialog.reviewNote')}</Label>
                    <Textarea
                      id="payslipRequestReviewNote"
                      value={reviewNote}
                      onChange={(event) => setReviewNote(event.target.value)}
                      placeholder={t('payroll.payslipRequests.dialog.reviewNotePlaceholder')}
                      rows={6}
                      disabled={!canReviewRequest(selectedRequest.status)}
                    />
                  </div>

                  {canReviewRequest(selectedRequest.status) ? (
                    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 text-sm text-slate-700">
                      {canDeliverRequestDocument(selectedRequest)
                        ? t('payroll.payslipRequests.dialog.availableForDelivery')
                        : selectedRequest.canonicalSourcePayrollRunEmployeId
                          ? t('payroll.payslipRequests.dialog.waitingForDocument')
                          : t('payroll.payslipRequests.dialog.waitingForPublication')}
                    </div>
                  ) : null}

                  {!canReviewRequest(selectedRequest.status) ? (
                    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 text-sm text-slate-600">
                      {t('payroll.payslipRequests.dialog.closedDescription')}
                    </div>
                  ) : !selectedRequest.canonicalSourcePayrollRunEmployeId ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                      {t('payroll.payslipRequests.dialog.deliveryDisabledUntilPublication')}
                    </div>
                  ) : !canDeliverRequestDocument(selectedRequest) ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                      {t('payroll.payslipRequests.dialog.deliveryDisabledUntilDocument')}
                    </div>
                  ) : null}
                </div>
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  disabled={updateStatusMutation.isPending || fulfillRequestMutation.isPending}
                  onClick={() => setSelectedRequest(null)}
                >
                  {t('actions.close')}
                </Button>

                {selectedRequest.status === 'PENDING' ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={updateStatusMutation.isPending || fulfillRequestMutation.isPending}
                    onClick={() => void handleMoveToInReview()}
                  >
                    {updateStatusMutation.isPending ? (
                      <Loader2 className={cn('h-4 w-4 animate-spin', isRTL ? 'ml-2' : 'mr-2')} />
                    ) : null}
                    {t('actions.markInReview')}
                  </Button>
                ) : null}

                {canReviewRequest(selectedRequest.status) ? (
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={updateStatusMutation.isPending || fulfillRequestMutation.isPending}
                    onClick={() => void handleReject()}
                  >
                    {updateStatusMutation.isPending ? (
                      <Loader2 className={cn('h-4 w-4 animate-spin', isRTL ? 'ml-2' : 'mr-2')} />
                    ) : null}
                    {t('actions.reject')}
                  </Button>
                ) : null}

                {canReviewRequest(selectedRequest.status) ? (
                  <Button
                    type="button"
                    className={BRAND_BUTTON_CLASS_NAME}
                    disabled={
                      updateStatusMutation.isPending ||
                      fulfillRequestMutation.isPending ||
                      !canDeliverRequestDocument(selectedRequest)
                    }
                    onClick={() => void handleFulfill()}
                  >
                    {fulfillRequestMutation.isPending ? (
                      <Loader2 className={cn('h-4 w-4 animate-spin', isRTL ? 'ml-2' : 'mr-2')} />
                    ) : (
                      <FileText className={cn('h-4 w-4', isRTL ? 'ml-2' : 'mr-2')} />
                    )}
                    {t('actions.deliverAvailablePayslip')}
                  </Button>
                ) : null}
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </PayrollLayout>
  )
}
