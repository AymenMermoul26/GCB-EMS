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
  getPayslipDocumentSourceLabel,
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

function RequestRow({ request }: { request: EmployeePayslipRequestItem }) {
  const statusMeta = getPayslipRequestStatusMeta(request.status)

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

        <div className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3 text-sm text-slate-600 lg:w-[260px]">
          {request.documentId && request.documentFileName ? (
            <>
              <p className="font-medium text-slate-900">Document delivered</p>
              <p className="mt-1 break-all">{request.documentFileName}</p>
              <p className="mt-2 text-xs text-slate-500">
                Published {formatTimestamp(request.documentPublishedAt)}
              </p>
            </>
          ) : (
            <p>
              This request stays visible here while payroll reviews or fulfills the requested
              payslip.
            </p>
          )}
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

function PublishedPayslipRow({ payslip }: { payslip: EmployeePayslipListItem }) {
  const statusMeta = getPayrollProcessingStatusMeta(payslip.status)
  const documentReady = Boolean(payslip.fileName || payslip.storagePath)

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
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3 text-sm text-slate-600">
          {documentReady ? (
            <p className="font-medium text-slate-900">Document linked and available above</p>
          ) : (
            <p>Published payroll metadata is available even if a file has not been attached yet.</p>
          )}
        </div>
      </div>
    </div>
  )
}

function sortPeriods(periods: PayslipRequestPeriodOption[]) {
  return [...periods].sort((left, right) => right.periodStart.localeCompare(left.periodStart))
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

  const publishedPayslips = publishedPayslipsQuery.data ?? []
  const requestPeriods = useMemo(
    () => sortPeriods(requestPeriodsQuery.data ?? []),
    [requestPeriodsQuery.data],
  )
  const payslipRequests = payslipRequestsQuery.data ?? []
  const availableDocuments = availableDocumentsQuery.data ?? []

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

  const handleOpenDocument = async (document: AvailablePayslipDocumentItem) => {
    setActiveDocumentActionKey(`${document.id}:open`)

    try {
      await openPayslipDocument(document)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not open payslip document.')
    } finally {
      setActiveDocumentActionKey(null)
    }
  }

  const handleDownloadDocument = async (document: AvailablePayslipDocumentItem) => {
    setActiveDocumentActionKey(`${document.id}:download`)

    try {
      await downloadPayslipDocument(document)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not download payslip document.',
      )
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
      subtitle="Request, track, and access the payslips available to your employee account."
    >
      <PageHeader
        title="Payslips"
        description="Request a payslip for an existing payroll period, follow payroll review status, and access only the documents published to your own employee account."
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
              helper="Delivered or published payslip files available to preview and download."
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
                employees, or unpublished payslip files.
              </div>
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
                Once payroll fulfills a request or publishes a file-backed payslip, the document
                appears here for preview and download.
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
                  description="Use the request action above whenever you need payroll to deliver a payslip for an available period."
                />
              ) : (
                <div className="space-y-3">
                  {payslipRequests.map((request) => (
                    <RequestRow key={request.id} request={request} />
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
                Preview or download only the payslip files delivered to your own employee account.
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
                  description="Fulfilled requests and file-backed published payslips will appear here."
                />
              ) : (
                <div className="space-y-3">
                  {availableDocuments.map((document) => (
                    <AvailableDocumentRow
                      key={document.id}
                      document={document}
                      activeActionKey={activeDocumentActionKey}
                      onOpen={handleOpenDocument}
                      onDownload={handleDownloadDocument}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className={SURFACE_CARD_CLASS_NAME}>
            <CardHeader>
              <CardTitle className="text-base font-semibold text-slate-950">
                Published payroll records
              </CardTitle>
              <CardDescription>
                Published payroll metadata remains visible here, even when file delivery is handled
                through a separate request.
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
                  description="We couldn't load your published payroll records right now."
                  message={publishedPayslipsQuery.error.message}
                  onRetry={() => void publishedPayslipsQuery.refetch()}
                />
              ) : publishedPayslips.length === 0 ? (
                <EmptyState
                  surface="plain"
                  align="left"
                  title="No published payslip metadata yet"
                  description="Published payroll records will appear here once payroll completes publication for your account."
                />
              ) : (
                <div className="space-y-3">
                  {publishedPayslips.map((payslip) => (
                    <PublishedPayslipRow key={payslip.id} payslip={payslip} />
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
              account until payroll reviews and fulfills it.
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
