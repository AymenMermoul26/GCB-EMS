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
import { DashboardLayout } from '@/layouts/dashboard-layout'
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

function formatTimestamp(value: string | null | undefined): string {
  if (!value) {
    return '\u2014'
  }

  return new Date(value).toLocaleString()
}

function formatDateRange(start: string, end: string): string {
  return `${new Date(`${start}T00:00:00`).toLocaleDateString()} - ${new Date(`${end}T00:00:00`).toLocaleDateString()}`
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
  const statusMeta = getPayslipRequestStatusMeta(request.status)
  const canonicalPayslipStatusMeta = request.canonicalPayslipStatus
    ? getPayrollProcessingStatusMeta(request.canonicalPayslipStatus)
    : null
  const representationModeLabel = request.canonicalDocumentRepresentationMode
    ? getPayslipDocumentRepresentationModeLabel(request.canonicalDocumentRepresentationMode)
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
            {formatDateRange(request.periodStart, request.periodEnd)}
          </p>

          <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
            <span>Submitted {formatTimestamp(request.createdAt)}</span>
            <span>Reviewed {formatTimestamp(request.reviewedAt)}</span>
            <span>Fulfilled {formatTimestamp(request.fulfilledAt)}</span>
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
                Request note
              </p>
              <p className="mt-2">{request.requestNote}</p>
            </div>
          ) : null}

          {request.reviewNote ? (
            <div className="mt-3 rounded-xl border border-slate-200/80 bg-white p-3 text-sm leading-6 text-slate-700">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Payroll review note
              </p>
              <p className="mt-2">{request.reviewNote}</p>
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3 text-sm text-slate-600 lg:w-[300px]">
          {hasDeliveredDocument ? (
            <>
              <p className="font-medium text-slate-900">Delivered document representation</p>
              <p className="mt-1 break-all">{request.documentFileName}</p>
              <p className="mt-2 text-xs text-slate-500">
                Published {formatTimestamp(request.documentPublishedAt)}
              </p>
            </>
          ) : request.canonicalPayslipId ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-slate-900">Canonical generated payslip</p>
                {canonicalPayslipStatusMeta ? (
                  <StatusBadge tone={canonicalPayslipStatusMeta.tone} emphasis="outline">
                    {canonicalPayslipStatusMeta.label}
                  </StatusBadge>
                ) : null}
              </div>
              <p className="mt-2">
                {request.canonicalDocumentReady
                  ? 'This payroll-derived payslip already has a secure generated PDF available in your account. Payroll may still close this request separately for request-history traceability.'
                  : 'The payroll-derived payslip record exists, but the generated PDF representation is still pending.'}
              </p>
              {fileName ? <p className="mt-2 break-all text-xs text-slate-500">{fileName}</p> : null}
              {fileSizeBytes ? (
                <p className="mt-1 text-xs text-slate-500">Size {formatFileSize(fileSizeBytes)}</p>
              ) : null}
              {representationModeLabel ? (
                <p className="mt-2 text-xs text-slate-500">{representationModeLabel}</p>
              ) : null}
              <p className="mt-2 text-xs text-slate-500">
                Published {formatTimestamp(request.canonicalPayslipPublishedAt)}
              </p>
            </>
          ) : request.canonicalSourcePayrollRunEmployeId ? (
            <>
              <p className="font-medium text-slate-900">Payroll result source ready</p>
              <p className="mt-2">
                Payroll has a published payroll result for this period. The generated PDF becomes
                available here as soon as document generation finishes and publication makes it
                visible to your account.
              </p>
            </>
          ) : (
            <p>
              This request stays visible here while payroll reviews the request and links it to a
              payroll-derived payslip record.
            </p>
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
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ExternalLink className="mr-2 h-4 w-4" />
                )}
                Open PDF
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={Boolean(activeActionKey)}
                onClick={() => void onDownloadDocument(request)}
              >
                {isDownloading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FolderOpen className="mr-2 h-4 w-4" />
                )}
                Download PDF
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
  const sourceLabel = getPayslipDocumentSourceLabel(document.source)
  const isOpening = activeActionKey === `${document.id}:open`
  const isDownloading = activeActionKey === `${document.id}:download`

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-slate-950">{document.payrollPeriodLabel}</p>
            <StatusBadge tone="success">Available</StatusBadge>
            <StatusBadge tone="neutral" emphasis="outline">
              {sourceLabel}
            </StatusBadge>
            <StatusBadge tone="neutral" emphasis="outline">
              {document.payrollPeriodCode}
            </StatusBadge>
          </div>

          <p className="mt-2 text-sm text-slate-600">
            {formatDateRange(document.periodStart, document.periodEnd)}
          </p>

          <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
            <span>{document.fileName}</span>
            <span>Published {formatTimestamp(document.publishedAt)}</span>
            <span>Size {formatFileSize(document.fileSizeBytes)}</span>
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
            {isOpening ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ExternalLink className="mr-2 h-4 w-4" />}
            Open
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={Boolean(activeActionKey)}
            onClick={() => void onDownload(document)}
          >
            {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FolderOpen className="mr-2 h-4 w-4" />}
            Download
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
  const statusMeta = getPayrollProcessingStatusMeta(payslip.status)
  const representationModeLabel = getPayslipDocumentRepresentationModeLabel(
    payslip.documentRepresentationMode,
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
            {formatDateRange(payslip.periodStart, payslip.periodEnd)}
          </p>
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
            <span>Published {formatTimestamp(payslip.publishedAt)}</span>
            <span>Created {formatTimestamp(payslip.createdAt)}</span>
            <span>Generated {formatTimestamp(payslip.documentGeneratedAt)}</span>
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
              <p className="font-medium text-slate-900">Generated payslip PDF available</p>
              {payslip.fileName ? <p className="mt-1 break-all">{payslip.fileName}</p> : null}
              <p className="mt-1 text-xs text-slate-500">{representationModeLabel}</p>
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                <span>Size {formatFileSize(payslip.documentFileSizeBytes)}</span>
                <span>{payslip.documentContentType ?? 'application/pdf'}</span>
              </div>
            </>
          ) : (
            <>
              <p className="font-medium text-slate-900">Canonical payslip record published</p>
              <p className="mt-1">
                Payroll data is available for this period, even though the generated PDF
                representation is not available yet.
              </p>
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
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ExternalLink className="mr-2 h-4 w-4" />
                )}
                Open PDF
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={Boolean(activeActionKey)}
                onClick={() => void onDownloadDocument(payslip)}
              >
                {isDownloading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FolderOpen className="mr-2 h-4 w-4" />
                )}
                Download PDF
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
      toast.success('Payslip request submitted.')
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
      toast.error('Select a payroll period before submitting your request.')
      return
    }

    try {
      await createRequestMutation.mutateAsync({
        payrollPeriodId: selectedPeriodId,
        requestNote,
      })
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to submit payslip request.',
      )
    }
  }

  const handleOpenDocument = async (
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
      title="Payslips"
      subtitle="Request, track, and access payroll-derived payslip records and their available document representations."
    >
      <PageHeader
        title="Payslips"
        description="Request a payslip for an existing payroll period, follow payroll review status, and access only the payroll-derived payslip records and document representations published to your own employee account."
        className="mb-6"
        actions={
          <>
            <Button asChild variant="outline">
              <Link to={ROUTES.EMPLOYEE_PROFILE}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to profile
              </Link>
            </Button>
            <Button
              type="button"
              className={BRAND_BUTTON_CLASS_NAME}
              disabled={requestPeriodsQuery.isPending || requestPeriods.length === 0}
              onClick={() => setIsRequestDialogOpen(true)}
            >
              {createRequestMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileText className="mr-2 h-4 w-4" />
              )}
              Request payslip
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
              title="My requests"
              value={String(payslipRequests.length)}
              helper="Payslip requests you have submitted from your employee account."
            />
            <SummaryCard
              title="Pending review"
              value={String(pendingRequestCount)}
              helper="Requests still waiting on payroll review or fulfillment."
            />
            <SummaryCard
              title="Available documents"
              value={String(availableDocuments.length)}
              helper="PDF representations currently available to preview and download."
            />
            <SummaryCard
              title="Latest delivery"
              value={formatTimestamp(latestDocumentTimestamp)}
              helper="Most recent payslip document publication available in your account."
            />
          </div>

          <Card className={`${SURFACE_CARD_CLASS_NAME} mb-6`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-950">
                <ShieldCheck className="h-4 w-4 text-slate-600" />
                Access boundary
              </CardTitle>
              <CardDescription>
                Employee self-service stays restricted to your own requests and your own published
                payslip documents.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-6 text-slate-600">
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
                You cannot access draft payroll runs, payroll calculation details for other
                employees, unpublished payslip records, or unpublished document representations.
              </div>
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
                Canonical payslip records come from published payroll data. Preview and download
                become available only after the generated PDF representation is attached to that
                record and published to your employee account.
              </div>
            </CardContent>
          </Card>

          <Card className={`${SURFACE_CARD_CLASS_NAME} mb-6`}>
            <CardHeader>
              <CardTitle className="text-base font-semibold text-slate-950">
                My payslip requests
              </CardTitle>
              <CardDescription>
                Follow the payroll review lifecycle for the payslips you requested.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {payslipRequestsQuery.isPending && !payslipRequestsQuery.data ? (
                <SectionSkeleton lines={4} />
              ) : payslipRequestsQuery.isError ? (
                <ErrorState
                  surface="plain"
                  align="left"
                  title="Could not load payslip requests"
                  description="We couldn't load your payslip request history right now."
                  message={payslipRequestsQuery.error.message}
                  onRetry={() => void payslipRequestsQuery.refetch()}
                />
              ) : payslipRequests.length === 0 ? (
                <EmptyState
                  surface="plain"
                  align="left"
                  title="No payslip requests yet"
                  description="Use the request action above whenever you need payroll to review and deliver an available payslip document for an eligible period."
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
                          'Could not open payslip PDF.',
                        )
                      }
                      onDownloadDocument={(item) =>
                        handleDownloadDocument(
                          `${item.id}:download`,
                          createPayslipRequestDeliveredDocumentAccessDescriptor(item) ??
                            createPayslipRequestCanonicalDocumentAccessDescriptor(item),
                          'Could not download payslip PDF.',
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
                Available payslip documents
              </CardTitle>
              <CardDescription>
                Preview or download only the payslip documents published to your own employee
                account, whether they came directly from payroll publication or from request
                delivery history.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {availableDocumentsQuery.isPending && !availableDocumentsQuery.data ? (
                <SectionSkeleton lines={4} />
              ) : availableDocumentsQuery.isError ? (
                <ErrorState
                  surface="plain"
                  align="left"
                  title="Could not load payslip documents"
                  description="We couldn't load your available payslip documents right now."
                  message={availableDocumentsQuery.error.message}
                  onRetry={() => void availableDocumentsQuery.refetch()}
                />
              ) : availableDocuments.length === 0 ? (
                <EmptyState
                  surface="plain"
                  align="left"
                  title="No payslip documents available"
                  description="Generated payroll PDFs and request-delivery document records will appear here once they are published to your account."
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
                          'Could not open payslip document.',
                        )
                      }
                      onDownload={(item) =>
                        handleDownloadDocument(
                          `${item.id}:download`,
                          createAvailablePayslipDocumentAccessDescriptor(item),
                          'Could not download payslip document.',
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
                Published payslip records
              </CardTitle>
              <CardDescription>
                Canonical payslip records remain visible here even before a PDF representation is
                generated and attached.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {publishedPayslipsQuery.isPending && !publishedPayslipsQuery.data ? (
                <SectionSkeleton lines={4} />
              ) : publishedPayslipsQuery.isError ? (
                <ErrorState
                  surface="plain"
                  align="left"
                  title="Could not load published payslips"
                  description="We couldn't load your published payslip records right now."
                  message={publishedPayslipsQuery.error.message}
                  onRetry={() => void publishedPayslipsQuery.refetch()}
                />
              ) : publishedPayslips.length === 0 ? (
                <EmptyState
                  surface="plain"
                  align="left"
                  title="No published payslip records yet"
                  description="Payroll-derived payslip records will appear here once payroll completes publication for your account."
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
                          'Could not open generated payslip PDF.',
                        )
                      }
                      onDownloadDocument={(item) =>
                        handleDownloadDocument(
                          `${item.id}:download`,
                          createEmployeePublishedPayslipAccessDescriptor(item),
                          'Could not download generated payslip PDF.',
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
            <DialogTitle>Request Payslip</DialogTitle>
            <DialogDescription>
              Submit a payroll request for one available payroll period. The request stays in your
              account until payroll reviews it and delivers any available document representation
              for the payroll-derived payslip record.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="payslipRequestPeriod">Payroll period</Label>
              <Select value={selectedPeriodId} onValueChange={setSelectedPeriodId}>
                <SelectTrigger id="payslipRequestPeriod">
                  <SelectValue placeholder="Select a payroll period" />
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
              <Label htmlFor="payslipRequestNote">Note</Label>
              <Textarea
                id="payslipRequestNote"
                value={requestNote}
                onChange={(event) => setRequestNote(event.target.value)}
                placeholder="Add an optional note for payroll review."
                rows={4}
              />
            </div>

            {requestPeriodsQuery.isPending ? (
              <p className="text-sm text-slate-500">Loading available payroll periods...</p>
            ) : null}

            {requestPeriodsQuery.isError ? (
              <p className="text-sm text-rose-600">{requestPeriodsQuery.error.message}</p>
            ) : null}

            {!requestPeriodsQuery.isPending &&
            !requestPeriodsQuery.isError &&
            requestPeriods.length === 0 ? (
              <p className="text-sm text-slate-500">
                No payroll periods are currently available for a new payslip request.
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
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileText className="mr-2 h-4 w-4" />
              )}
              Submit request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
