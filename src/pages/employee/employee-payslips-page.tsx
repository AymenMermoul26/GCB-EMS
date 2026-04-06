import {
  ArrowLeft,
  ExternalLink,
  FileText,
  FolderOpen,
  Loader2,
  ShieldCheck,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import {
  EmptyState,
  ErrorState,
  PageStateSkeleton,
  SectionSkeleton,
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
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ROUTES } from '@/constants/routes'
import { useAuth } from '@/hooks/use-auth'
import { useI18n } from '@/hooks/use-i18n'
import { DashboardLayout } from '@/layouts/dashboard-layout'
import { cn } from '@/lib/utils'
import {
  createAvailablePayslipDocumentAccessDescriptor,
  createEmployeePublishedPayslipAccessDescriptor,
  createPayslipRequestCanonicalDocumentAccessDescriptor,
  createPayslipRequestDeliveredDocumentAccessDescriptor,
  downloadPayslipDocument,
  openPayslipDocument,
  useCreatePayslipRequestMutation,
  useEmployeeAvailablePayslipDocumentsQuery,
  useEmployeePayslipRequestPeriodsQuery,
  useEmployeePayslipRequestsQuery,
} from '@/services/payslipRequestsService'
import { useEmployeePayslipsQuery } from '@/services/payrollProcessingService'
import type {
  AvailablePayslipDocumentItem,
  EmployeePayslipListItem,
  EmployeePayslipRequestItem,
  PayslipRequestPeriodOption,
} from '@/types/payroll'
import {
  buildPayslipRequestTimelineSource,
  buildPublishedPayslipTimelineSource,
  getPayslipDocumentSourceLabel,
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

function formatFileSize(value: number | null): string {
  if (value === null || value <= 0) {
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

function SummaryCard({
  title,
  value,
  helper,
}: {
  title: string
  value: string
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

function RequestRow({
  request,
  activeActionKey,
  onOpenDocument,
  onDownloadDocument,
}: {
  request: EmployeePayslipRequestItem
  activeActionKey: string | null
  onOpenDocument: (request: EmployeePayslipRequestItem) => Promise<void>
  onDownloadDocument: (request: EmployeePayslipRequestItem) => Promise<void>
}) {
  const { t, locale, isRTL } = useI18n()
  const statusMeta = getPayslipRequestStatusMeta(request.status, t)
  const canonicalPayslipStatusMeta = request.canonicalPayslipStatus
    ? getPayrollProcessingStatusMeta(request.canonicalPayslipStatus, t)
    : null
  const representationModeLabel = request.canonicalDocumentRepresentationMode
    ? getPayslipDocumentRepresentationModeLabel(request.canonicalDocumentRepresentationMode, t)
    : null
  const deliveredDescriptor = createPayslipRequestDeliveredDocumentAccessDescriptor(request)
  const canonicalDescriptor = createPayslipRequestCanonicalDocumentAccessDescriptor(request)
  const primaryDescriptor = deliveredDescriptor ?? canonicalDescriptor
  const hasDeliveredDocument = Boolean(deliveredDescriptor)
  const isOpening = activeActionKey === `${request.id}:open`
  const isDownloading = activeActionKey === `${request.id}:download`
  const fileName = hasDeliveredDocument ? request.documentFileName : request.canonicalDocumentFileName
  const fileSizeBytes = hasDeliveredDocument ? null : request.canonicalDocumentFileSizeBytes

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-slate-950">{request.payrollPeriodLabel}</p>
            <StatusBadge tone={statusMeta.tone}>{statusMeta.label}</StatusBadge>
            <StatusBadge tone="neutral" emphasis="outline">
              {request.payrollPeriodCode}
            </StatusBadge>
          </div>

          <p className="mt-2 text-sm text-slate-600">
            {formatDateRange(request.periodStart, request.periodEnd, locale)}
          </p>

          <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
            <span>
              {t('common.submitted')} {formatTimestamp(request.createdAt, locale)}
            </span>
            <span>
              {t('common.reviewed')} {formatTimestamp(request.reviewedAt, locale)}
            </span>
            <span>
              {t('common.fulfilled')} {formatTimestamp(request.fulfilledAt, locale)}
            </span>
          </div>

            <div className="mt-4">
              <PayslipWorkflowTimeline
                source={buildPayslipRequestTimelineSource({
                  status: request.status,
                  createdAt: request.createdAt,
                  reviewedAt: request.reviewedAt,
                  canonicalPayslipPublishedAt: request.canonicalPayslipPublishedAt,
                  canonicalDocumentReady: request.canonicalDocumentReady,
                  documentPublishedAt: request.documentPublishedAt,
                  fulfilledAt: request.fulfilledAt,
                })}
              />
            </div>

          {request.requestNote ? (
            <div className="mt-3 rounded-xl border border-slate-200/80 bg-white p-3 text-sm leading-6 text-slate-700">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {t('employee.payslips.requestRow.requestNote')}
              </p>
              <p className="mt-2">{request.requestNote}</p>
            </div>
          ) : null}

          {request.reviewNote ? (
            <div className="mt-3 rounded-xl border border-slate-200/80 bg-white p-3 text-sm leading-6 text-slate-700">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {t('employee.payslips.requestRow.reviewNote')}
              </p>
              <p className="mt-2">{request.reviewNote}</p>
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3 text-sm text-slate-600 lg:w-[300px]">
          {hasDeliveredDocument ? (
            <>
              <p className="font-medium text-slate-900">
                {t('employee.payslips.requestRow.deliveredDocumentTitle')}
              </p>
              <p className="mt-1 break-all">{request.documentFileName}</p>
              <p className="mt-2 text-xs text-slate-500">
                {t('employee.payslips.requestRow.deliveredPublished', {
                  value: formatTimestamp(request.documentPublishedAt, locale),
                })}
              </p>
            </>
          ) : request.canonicalPayslipId ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-slate-900">
                  {t('employee.payslips.requestRow.canonicalDocumentTitle')}
                </p>
                {canonicalPayslipStatusMeta ? (
                  <StatusBadge tone={canonicalPayslipStatusMeta.tone} emphasis="outline">
                    {canonicalPayslipStatusMeta.label}
                  </StatusBadge>
                ) : null}
              </div>
              <p className="mt-2">
                {request.canonicalDocumentReady
                  ? t('employee.payslips.requestRow.canonicalAvailable')
                  : t('employee.payslips.requestRow.canonicalPending')}
              </p>
              {fileName ? <p className="mt-2 break-all text-xs text-slate-500">{fileName}</p> : null}
              {fileSizeBytes ? (
                <p className="mt-1 text-xs text-slate-500">
                  {t('common.size')} {formatFileSize(fileSizeBytes)}
                </p>
              ) : null}
              {representationModeLabel ? (
                <p className="mt-2 text-xs text-slate-500">{representationModeLabel}</p>
              ) : null}
              <p className="mt-2 text-xs text-slate-500">
                {t('common.published')} {formatTimestamp(request.canonicalPayslipPublishedAt, locale)}
              </p>
            </>
          ) : request.canonicalSourcePayrollRunEmployeId ? (
            <>
              <p className="font-medium text-slate-900">
                {t('employee.payslips.requestRow.canonicalSourceReadyTitle')}
              </p>
              <p className="mt-2">
                {t('employee.payslips.requestRow.canonicalSourceReadyDescription')}
              </p>
            </>
          ) : (
            <p>{t('employee.payslips.requestRow.awaitingReviewDescription')}</p>
          )}

          {primaryDescriptor ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={Boolean(activeActionKey)}
                onClick={() => void onOpenDocument(request)}
              >
                {isOpening ? (
                  <Loader2 className={cn('h-4 w-4 animate-spin', isRTL ? 'ml-2' : 'mr-2')} />
                ) : (
                  <ExternalLink className={cn('h-4 w-4', isRTL ? 'ml-2' : 'mr-2')} />
                )}
                {t('actions.open')} PDF
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={Boolean(activeActionKey)}
                onClick={() => void onDownloadDocument(request)}
              >
                {isDownloading ? (
                  <Loader2 className={cn('h-4 w-4 animate-spin', isRTL ? 'ml-2' : 'mr-2')} />
                ) : (
                  <FolderOpen className={cn('h-4 w-4', isRTL ? 'ml-2' : 'mr-2')} />
                )}
                {t('actions.download')} PDF
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function AvailableDocumentRow({
  document,
  activeActionKey,
  onOpen,
  onDownload,
}: {
  document: AvailablePayslipDocumentItem
  activeActionKey: string | null
  onOpen: (document: AvailablePayslipDocumentItem) => Promise<void>
  onDownload: (document: AvailablePayslipDocumentItem) => Promise<void>
}) {
  const { t, locale, isRTL } = useI18n()
  const sourceLabel = getPayslipDocumentSourceLabel(document.source)
  const isOpening = activeActionKey === `${document.id}:open`
  const isDownloading = activeActionKey === `${document.id}:download`

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-slate-950">{document.payrollPeriodLabel}</p>
            <StatusBadge tone="success">{t('employee.payslips.documentsSection.availableBadge')}</StatusBadge>
            <StatusBadge tone="neutral" emphasis="outline">
              {sourceLabel}
            </StatusBadge>
            <StatusBadge tone="neutral" emphasis="outline">
              {document.payrollPeriodCode}
            </StatusBadge>
          </div>

          <p className="mt-2 text-sm text-slate-600">
            {formatDateRange(document.periodStart, document.periodEnd, locale)}
          </p>

          <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
            <span>{document.fileName}</span>
            <span>{t('common.published')} {formatTimestamp(document.publishedAt, locale)}</span>
            <span>{t('common.size')} {formatFileSize(document.fileSizeBytes)}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={Boolean(activeActionKey)}
            onClick={() => void onOpen(document)}
          >
            {isOpening ? (
              <Loader2 className={cn('h-4 w-4 animate-spin', isRTL ? 'ml-2' : 'mr-2')} />
            ) : (
              <ExternalLink className={cn('h-4 w-4', isRTL ? 'ml-2' : 'mr-2')} />
            )}
            {t('actions.open')}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={Boolean(activeActionKey)}
            onClick={() => void onDownload(document)}
          >
            {isDownloading ? (
              <Loader2 className={cn('h-4 w-4 animate-spin', isRTL ? 'ml-2' : 'mr-2')} />
            ) : (
              <FolderOpen className={cn('h-4 w-4', isRTL ? 'ml-2' : 'mr-2')} />
            )}
            {t('actions.download')}
          </Button>
        </div>
      </div>
    </div>
  )
}

function PublishedPayslipRow({
  payslip,
  activeActionKey,
  onOpenDocument,
  onDownloadDocument,
}: {
  payslip: EmployeePayslipListItem
  activeActionKey: string | null
  onOpenDocument: (payslip: EmployeePayslipListItem) => Promise<void>
  onDownloadDocument: (payslip: EmployeePayslipListItem) => Promise<void>
}) {
  const { t, locale, isRTL } = useI18n()
  const statusMeta = getPayrollProcessingStatusMeta(payslip.status, t)
  const representationModeLabel = getPayslipDocumentRepresentationModeLabel(
    payslip.documentRepresentationMode,
    t,
  )
  const documentDescriptor = createEmployeePublishedPayslipAccessDescriptor(payslip)
  const isOpening = activeActionKey === `${payslip.id}:open`
  const isDownloading = activeActionKey === `${payslip.id}:download`

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-slate-950">{payslip.payrollPeriodLabel}</p>
            <StatusBadge tone={statusMeta.tone}>{statusMeta.label}</StatusBadge>
            <StatusBadge tone="neutral" emphasis="outline">
              {payslip.payrollRunCode}
            </StatusBadge>
          </div>
          <p className="mt-2 text-sm text-slate-600">
            {formatDateRange(payslip.periodStart, payslip.periodEnd, locale)}
          </p>
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
            <span>{t('common.published')} {formatTimestamp(payslip.publishedAt, locale)}</span>
            <span>{t('common.created')} {formatTimestamp(payslip.createdAt, locale)}</span>
            <span>{t('common.generated')} {formatTimestamp(payslip.documentGeneratedAt, locale)}</span>
          </div>
          <div className="mt-4">
            <PayslipWorkflowTimeline
              source={buildPublishedPayslipTimelineSource({
                status: payslip.status,
                publishedAt: payslip.publishedAt,
                documentReady: payslip.documentReady,
                documentGeneratedAt: payslip.documentGeneratedAt,
              })}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3 text-sm text-slate-600 lg:w-[300px]">
          {payslip.documentReady ? (
            <>
              <p className="font-medium text-slate-900">
                {t('employee.payslips.publishedSection.pdfAvailableTitle')}
              </p>
              {payslip.fileName ? <p className="mt-1 break-all">{payslip.fileName}</p> : null}
              <p className="mt-1 text-xs text-slate-500">{representationModeLabel}</p>
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                <span>{t('common.size')} {formatFileSize(payslip.documentFileSizeBytes)}</span>
                <span>{payslip.documentContentType ?? 'application/pdf'}</span>
              </div>
            </>
          ) : (
            <>
              <p className="font-medium text-slate-900">
                {t('employee.payslips.publishedSection.recordPublishedTitle')}
              </p>
              <p className="mt-1">{t('employee.payslips.publishedSection.recordPublishedDescription')}</p>
            </>
          )}

          {documentDescriptor ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={Boolean(activeActionKey)}
                onClick={() => void onOpenDocument(payslip)}
              >
                {isOpening ? (
                  <Loader2 className={cn('h-4 w-4 animate-spin', isRTL ? 'ml-2' : 'mr-2')} />
                ) : (
                  <ExternalLink className={cn('h-4 w-4', isRTL ? 'ml-2' : 'mr-2')} />
                )}
                {t('actions.open')} PDF
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={Boolean(activeActionKey)}
                onClick={() => void onDownloadDocument(payslip)}
              >
                {isDownloading ? (
                  <Loader2 className={cn('h-4 w-4 animate-spin', isRTL ? 'ml-2' : 'mr-2')} />
                ) : (
                  <FolderOpen className={cn('h-4 w-4', isRTL ? 'ml-2' : 'mr-2')} />
                )}
                {t('actions.download')} PDF
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function sortPeriods(periods: PayslipRequestPeriodOption[]) {
  return [...periods].sort((left, right) => right.periodStart.localeCompare(left.periodStart))
}

function sortPayslipRequests(requests: EmployeePayslipRequestItem[]) {
  return [...requests].sort((left, right) => right.createdAt.localeCompare(left.createdAt))
}

function sortAvailableDocuments(documents: AvailablePayslipDocumentItem[]) {
  return [...documents].sort((left, right) => right.publishedAt.localeCompare(left.publishedAt))
}

function sortPublishedPayslips(items: EmployeePayslipListItem[]) {
  return [...items].sort((left, right) => {
    const leftTimestamp = left.publishedAt ?? left.createdAt
    const rightTimestamp = right.publishedAt ?? right.createdAt
    return rightTimestamp.localeCompare(leftTimestamp)
  })
}

export function EmployeePayslipsPage() {
  const { user } = useAuth()
  const { t, locale, isRTL } = useI18n()
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false)
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('')
  const [requestNote, setRequestNote] = useState('')
  const [activeDocumentActionKey, setActiveDocumentActionKey] = useState<string | null>(null)

  const publishedPayslipsQuery = useEmployeePayslipsQuery(user?.id)
  const requestPeriodsQuery = useEmployeePayslipRequestPeriodsQuery(user?.id)
  const payslipRequestsQuery = useEmployeePayslipRequestsQuery(user?.id)
  const availableDocumentsQuery = useEmployeeAvailablePayslipDocumentsQuery(user?.id)

  const publishedPayslips = useMemo(
    () => sortPublishedPayslips(publishedPayslipsQuery.data ?? []),
    [publishedPayslipsQuery.data],
  )
  const requestPeriods = useMemo(
    () => sortPeriods(requestPeriodsQuery.data ?? []),
    [requestPeriodsQuery.data],
  )
  const payslipRequests = useMemo(
    () => sortPayslipRequests(payslipRequestsQuery.data ?? []),
    [payslipRequestsQuery.data],
  )
  const availableDocuments = useMemo(
    () => sortAvailableDocuments(availableDocumentsQuery.data ?? []),
    [availableDocumentsQuery.data],
  )

  const createRequestMutation = useCreatePayslipRequestMutation(user?.id, {
    onSuccess: () => {
      toast.success(t('employee.payslips.feedback.requestSubmitSuccess'))
      setIsRequestDialogOpen(false)
      setSelectedPeriodId('')
      setRequestNote('')
    },
  })

  const pendingRequestCount = payslipRequests.filter((request) =>
    request.status === 'PENDING' || request.status === 'IN_REVIEW').length
  const latestDocumentTimestamp = availableDocuments[0]?.publishedAt ?? null

  const handleSubmitRequest = async () => {
    if (!selectedPeriodId) {
      toast.error(t('employee.payslips.feedback.selectPeriodError'))
      return
    }

    try {
      await createRequestMutation.mutateAsync({
        payrollPeriodId: selectedPeriodId,
        requestNote,
      })
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('employee.payslips.feedback.requestSubmitError'),
      )
    }
  }

  const handleOpenDocument = async (
    actionKey: string,
    descriptor: ReturnType<typeof createAvailablePayslipDocumentAccessDescriptor> | null,
    failureMessage: string,
  ) => {
    if (!descriptor) {
      toast.error(t('employee.payslips.feedback.documentUnavailable'))
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
    descriptor: ReturnType<typeof createAvailablePayslipDocumentAccessDescriptor> | null,
    failureMessage: string,
  ) => {
    if (!descriptor) {
      toast.error('This payslip PDF is not available yet.')
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

  const showPageSkeleton =
    !publishedPayslipsQuery.data &&
    !payslipRequestsQuery.data &&
    !availableDocumentsQuery.data &&
    (publishedPayslipsQuery.isPending ||
      payslipRequestsQuery.isPending ||
      availableDocumentsQuery.isPending)

  return (
    <DashboardLayout
      title={t('employee.payslips.title')}
      subtitle={t('employee.payslips.subtitle')}
    >
      <PageHeader
        title={t('employee.payslips.title')}
        description={t('employee.payslips.headerDescription')}
        className="mb-6"
        actions={
          <>
            <Button asChild variant="outline">
              <Link to={ROUTES.EMPLOYEE_PROFILE}>
                <ArrowLeft className={cn('h-4 w-4', isRTL ? 'ml-2 rotate-180' : 'mr-2')} />
                {t('actions.backToProfile')}
              </Link>
            </Button>
            <Button
              type="button"
              className={BRAND_BUTTON_CLASS_NAME}
              disabled={requestPeriodsQuery.isPending || requestPeriods.length === 0}
              onClick={() => setIsRequestDialogOpen(true)}
            >
              {createRequestMutation.isPending ? (
                <Loader2 className={cn('h-4 w-4 animate-spin', isRTL ? 'ml-2' : 'mr-2')} />
              ) : (
                <FileText className={cn('h-4 w-4', isRTL ? 'ml-2' : 'mr-2')} />
              )}
              {t('employee.payslips.dialog.title')}
            </Button>
          </>
        }
      />

      {showPageSkeleton ? (
        <PageStateSkeleton variant="list" count={4} />
      ) : (
        <>
          <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              title={t('employee.payslips.summary.myRequestsTitle')}
              value={String(payslipRequests.length)}
              helper={t('employee.payslips.summary.myRequestsHelper')}
            />
            <SummaryCard
              title={t('employee.payslips.summary.pendingReviewTitle')}
              value={String(pendingRequestCount)}
              helper={t('employee.payslips.summary.pendingReviewHelper')}
            />
            <SummaryCard
              title={t('employee.payslips.summary.availableDocumentsTitle')}
              value={String(availableDocuments.length)}
              helper={t('employee.payslips.summary.availableDocumentsHelper')}
            />
            <SummaryCard
              title={t('employee.payslips.summary.latestDeliveryTitle')}
              value={formatTimestamp(latestDocumentTimestamp, locale)}
              helper={t('employee.payslips.summary.latestDeliveryHelper')}
            />
          </div>

          <Card className={`${SURFACE_CARD_CLASS_NAME} mb-6`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-950">
                <ShieldCheck className="h-4 w-4 text-slate-600" />
                {t('employee.payslips.boundary.title')}
              </CardTitle>
              <CardDescription>
                {t('employee.payslips.boundary.description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-6 text-slate-600">
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
                {t('employee.payslips.boundary.itemOne')}
              </div>
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
                {t('employee.payslips.boundary.itemTwo')}
              </div>
            </CardContent>
          </Card>

          <Card className={`${SURFACE_CARD_CLASS_NAME} mb-6`}>
            <CardHeader>
              <CardTitle className="text-base font-semibold text-slate-950">
                {t('employee.payslips.requestsSection.title')}
              </CardTitle>
              <CardDescription>
                {t('employee.payslips.requestsSection.description')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {payslipRequestsQuery.isPending && !payslipRequestsQuery.data ? (
                <SectionSkeleton lines={4} />
              ) : payslipRequestsQuery.isError ? (
                <ErrorState
                  surface="plain"
                  align="left"
                  title={t('employee.payslips.requestsSection.loadErrorTitle')}
                  description={t('employee.payslips.requestsSection.loadErrorDescription')}
                  message={payslipRequestsQuery.error.message}
                  onRetry={() => void payslipRequestsQuery.refetch()}
                />
              ) : payslipRequests.length === 0 ? (
                <EmptyState
                  surface="plain"
                  align="left"
                  title={t('employee.payslips.requestsSection.emptyTitle')}
                  description={t('employee.payslips.requestsSection.emptyDescription')}
                />
              ) : (
                <div className="space-y-3">
                  {payslipRequests.map((request) => (
                    <RequestRow
                      key={request.id}
                      request={request}
                      activeActionKey={activeDocumentActionKey}
                      onOpenDocument={(item) =>
                        handleOpenDocument(
                          `${item.id}:open`,
                          createPayslipRequestDeliveredDocumentAccessDescriptor(item) ??
                            createPayslipRequestCanonicalDocumentAccessDescriptor(item),
                          t('employee.payslips.feedback.openDocumentError'),
                        )
                      }
                      onDownloadDocument={(item) =>
                        handleDownloadDocument(
                          `${item.id}:download`,
                          createPayslipRequestDeliveredDocumentAccessDescriptor(item) ??
                            createPayslipRequestCanonicalDocumentAccessDescriptor(item),
                          t('employee.payslips.feedback.downloadDocumentError'),
                        )
                      }
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className={`${SURFACE_CARD_CLASS_NAME} mb-6`}>
            <CardHeader>
              <CardTitle className="text-base font-semibold text-slate-950">
                {t('employee.payslips.documentsSection.title')}
              </CardTitle>
              <CardDescription>
                {t('employee.payslips.documentsSection.description')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {availableDocumentsQuery.isPending && !availableDocumentsQuery.data ? (
                <SectionSkeleton lines={4} />
              ) : availableDocumentsQuery.isError ? (
                <ErrorState
                  surface="plain"
                  align="left"
                  title={t('employee.payslips.documentsSection.loadErrorTitle')}
                  description={t('employee.payslips.documentsSection.loadErrorDescription')}
                  message={availableDocumentsQuery.error.message}
                  onRetry={() => void availableDocumentsQuery.refetch()}
                />
              ) : availableDocuments.length === 0 ? (
                <EmptyState
                  surface="plain"
                  align="left"
                  title={t('employee.payslips.documentsSection.emptyTitle')}
                  description={t('employee.payslips.documentsSection.emptyDescription')}
                />
              ) : (
                <div className="space-y-3">
                  {availableDocuments.map((document) => (
                    <AvailableDocumentRow
                      key={document.id}
                      document={document}
                      activeActionKey={activeDocumentActionKey}
                      onOpen={(item) =>
                        handleOpenDocument(
                          `${item.id}:open`,
                          createAvailablePayslipDocumentAccessDescriptor(item),
                          t('employee.payslips.feedback.openAvailableDocumentError'),
                        )
                      }
                      onDownload={(item) =>
                        handleDownloadDocument(
                          `${item.id}:download`,
                          createAvailablePayslipDocumentAccessDescriptor(item),
                          t('employee.payslips.feedback.downloadAvailableDocumentError'),
                        )
                      }
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className={SURFACE_CARD_CLASS_NAME}>
            <CardHeader>
              <CardTitle className="text-base font-semibold text-slate-950">
                {t('employee.payslips.publishedSection.title')}
              </CardTitle>
              <CardDescription>
                {t('employee.payslips.publishedSection.description')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {publishedPayslipsQuery.isPending && !publishedPayslipsQuery.data ? (
                <SectionSkeleton lines={4} />
              ) : publishedPayslipsQuery.isError ? (
                <ErrorState
                  surface="plain"
                  align="left"
                  title={t('employee.payslips.publishedSection.loadErrorTitle')}
                  description={t('employee.payslips.publishedSection.loadErrorDescription')}
                  message={publishedPayslipsQuery.error.message}
                  onRetry={() => void publishedPayslipsQuery.refetch()}
                />
              ) : publishedPayslips.length === 0 ? (
                <EmptyState
                  surface="plain"
                  align="left"
                  title={t('employee.payslips.publishedSection.emptyTitle')}
                  description={t('employee.payslips.publishedSection.emptyDescription')}
                />
              ) : (
                <div className="space-y-3">
                  {publishedPayslips.map((payslip) => (
                    <PublishedPayslipRow
                      key={payslip.id}
                      payslip={payslip}
                      activeActionKey={activeDocumentActionKey}
                      onOpenDocument={(item) =>
                        handleOpenDocument(
                          `${item.id}:open`,
                          createEmployeePublishedPayslipAccessDescriptor(item),
                          t('employee.payslips.feedback.openGeneratedDocumentError'),
                        )
                      }
                      onDownloadDocument={(item) =>
                        handleDownloadDocument(
                          `${item.id}:download`,
                          createEmployeePublishedPayslipAccessDescriptor(item),
                          t('employee.payslips.feedback.downloadGeneratedDocumentError'),
                        )
                      }
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Dialog
        open={isRequestDialogOpen}
        onOpenChange={(open) => {
          setIsRequestDialogOpen(open)
          if (!open && !createRequestMutation.isPending) {
            setSelectedPeriodId('')
            setRequestNote('')
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('employee.payslips.dialog.title')}</DialogTitle>
            <DialogDescription>
              {t('employee.payslips.dialog.description')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="payslipRequestPeriod">{t('employee.payslips.dialog.payrollPeriodLabel')}</Label>
              <Select value={selectedPeriodId} onValueChange={setSelectedPeriodId}>
                <SelectTrigger id="payslipRequestPeriod">
                  <SelectValue placeholder={t('employee.payslips.dialog.payrollPeriodPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {requestPeriods.map((period) => (
                    <SelectItem key={period.id} value={period.id}>
                      {period.label} ({period.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="payslipRequestNote">{t('employee.payslips.dialog.noteLabel')}</Label>
              <Textarea
                id="payslipRequestNote"
                value={requestNote}
                onChange={(event) => setRequestNote(event.target.value)}
                placeholder={t('employee.payslips.dialog.notePlaceholder')}
                rows={4}
              />
            </div>

            {requestPeriodsQuery.isPending ? (
              <p className="text-sm text-slate-500">{t('employee.payslips.dialog.loadingPeriods')}</p>
            ) : null}

            {requestPeriodsQuery.isError ? (
              <p className="text-sm text-rose-600">{requestPeriodsQuery.error.message}</p>
            ) : null}

            {!requestPeriodsQuery.isPending &&
            !requestPeriodsQuery.isError &&
            requestPeriods.length === 0 ? (
              <p className="text-sm text-slate-500">
                {t('employee.payslips.dialog.noPeriods')}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={createRequestMutation.isPending}
              onClick={() => setIsRequestDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className={BRAND_BUTTON_CLASS_NAME}
              disabled={
                createRequestMutation.isPending ||
                requestPeriods.length === 0 ||
                selectedPeriodId.length === 0
              }
              onClick={() => void handleSubmitRequest()}
            >
              {createRequestMutation.isPending ? (
                <Loader2 className={cn('h-4 w-4 animate-spin', isRTL ? 'ml-2' : 'mr-2')} />
              ) : (
                <FileText className={cn('h-4 w-4', isRTL ? 'ml-2' : 'mr-2')} />
              )}
              {t('actions.submit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
