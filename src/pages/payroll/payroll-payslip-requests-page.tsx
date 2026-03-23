import {
  ExternalLink,
  FileText,
  Loader2,
  Search,
  ShieldCheck,
} from 'lucide-react'
import { useState } from 'react'
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
import { PayrollLayout } from '@/layouts/payroll-layout'
import {
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
import { getPayslipRequestStatusMeta } from '@/types/payroll'

function formatTimestamp(value: string | null | undefined): string {
  if (!value) {
    return '\u2014'
  }

  return new Date(value).toLocaleString()
}

function formatDateRange(start: string, end: string): string {
  return `${new Date(`${start}T00:00:00`).toLocaleDateString()} - ${new Date(`${end}T00:00:00`).toLocaleDateString()}`
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
  const statusMeta = getPayslipRequestStatusMeta(request.status)

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
            {request.payrollPeriodLabel} | {formatDateRange(request.periodStart, request.periodEnd)}
          </p>

          <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
            <span>{request.departementNom ?? '\u2014'}</span>
            <span>{request.employeEmail ?? '\u2014'}</span>
            <span>Submitted {formatTimestamp(request.createdAt)}</span>
          </div>

          {request.requestNote ? (
            <p className="mt-3 text-sm leading-6 text-slate-600">{request.requestNote}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to={getPayrollEmployeeRoute(request.employeId)}>Open employee</Link>
          </Button>
          <Button type="button" size="sm" onClick={() => onOpen(request)}>
            Review request
          </Button>
        </div>
      </div>
    </div>
  )
}

function canReviewRequest(status: PayslipRequestStatus): boolean {
  return status === 'PENDING' || status === 'IN_REVIEW'
}

export function PayrollPayslipRequestsPage() {
  const { signOut, user } = useAuth()
  const [searchInput, setSearchInput] = useState('')
  const [statusFilter, setStatusFilter] = useState<PayslipRequestStatusFilter>('ALL')
  const [selectedRequest, setSelectedRequest] = useState<PayrollPayslipRequestItem | null>(null)
  const [reviewNote, setReviewNote] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [activeDocumentActionKey, setActiveDocumentActionKey] = useState<string | null>(null)

  const debouncedSearch = useDebouncedValue(searchInput, 350)
  const requestsQuery = usePayrollPayslipRequestsQuery(user?.id, {
    status: statusFilter,
    search: debouncedSearch,
  })

  const requests = requestsQuery.data ?? []
  const pendingCount = requests.filter((request) => request.status === 'PENDING').length
  const inReviewCount = requests.filter((request) => request.status === 'IN_REVIEW').length
  const fulfilledCount = requests.filter((request) => request.status === 'FULFILLED').length
  const rejectedCount = requests.filter((request) => request.status === 'REJECTED').length

  const updateStatusMutation = useUpdatePayslipRequestStatusMutation(user?.id, {
    onSuccess: (_, variables) => {
      toast.success('Payslip request status updated.')
      if (variables.status === 'IN_REVIEW') {
        setSelectedRequest((current) =>
          current ? { ...current, status: 'IN_REVIEW', reviewNote } : current,
        )
      }
    },
  })

  const fulfillRequestMutation = useFulfillPayslipRequestMutation(user?.id, {
    onSuccess: () => {
      toast.success('Payslip request fulfilled and delivered.')
      setSelectedRequest(null)
      setReviewNote('')
      setSelectedFile(null)
    },
  })

  const isFiltered = statusFilter !== 'ALL' || debouncedSearch.trim().length > 0

  const handleOpenRequest = (request: PayrollPayslipRequestItem) => {
    setSelectedRequest(request)
    setReviewNote(request.reviewNote ?? '')
    setSelectedFile(null)
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
        error instanceof Error ? error.message : 'Failed to update payslip request status.',
      )
    }
  }

  const handleReject = async () => {
    if (!selectedRequest) {
      return
    }

    if (reviewNote.trim().length === 0) {
      toast.error('Add a review note before rejecting this request.')
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
      setSelectedFile(null)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to reject payslip request.',
      )
    }
  }

  const handleFulfill = async () => {
    if (!selectedRequest) {
      return
    }

    if (!selectedFile) {
      toast.error('Choose a PDF payslip file before fulfilling this request.')
      return
    }

    try {
      await fulfillRequestMutation.mutateAsync({
        requestId: selectedRequest.id,
        employeId: selectedRequest.employeId,
        file: selectedFile,
        reviewNote,
      })
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to fulfill payslip request.',
      )
    }
  }

  const handleOpenDeliveredDocument = async (request: PayrollPayslipRequestItem) => {
    if (!request.documentId || !request.documentStoragePath || !request.documentFileName) {
      return
    }

    setActiveDocumentActionKey(`${request.id}:open`)

    try {
      await openPayslipDocument({
        auditTargetType: 'PayslipDelivery',
        auditTargetId: request.documentId,
        storagePath: request.documentStoragePath,
        fileName: request.documentFileName,
        payrollPeriodId: request.payrollPeriodId,
        payrollPeriodCode: request.payrollPeriodCode,
        payrollPeriodLabel: request.payrollPeriodLabel,
      })
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not open delivered payslip file.',
      )
    } finally {
      setActiveDocumentActionKey(null)
    }
  }

  const handleDownloadDeliveredDocument = async (request: PayrollPayslipRequestItem) => {
    if (!request.documentId || !request.documentStoragePath || !request.documentFileName) {
      return
    }

    setActiveDocumentActionKey(`${request.id}:download`)

    try {
      await downloadPayslipDocument({
        auditTargetType: 'PayslipDelivery',
        auditTargetId: request.documentId,
        storagePath: request.documentStoragePath,
        fileName: request.documentFileName,
        payrollPeriodId: request.payrollPeriodId,
        payrollPeriodCode: request.payrollPeriodCode,
        payrollPeriodLabel: request.payrollPeriodLabel,
      })
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not download delivered payslip file.',
      )
    } finally {
      setActiveDocumentActionKey(null)
    }
  }

  return (
    <PayrollLayout
      title="Payslip Requests"
      subtitle="Review employee payslip requests and deliver payslip files through the payroll workflow."
      onSignOut={signOut}
      userEmail={user?.email ?? null}
    >
      <PageHeader
        title="Payslip Requests"
        description="Manage employee payslip requests, move them through review, and deliver file-backed payslips securely to employee accounts."
        className="mb-6"
        badges={
          <>
            <StatusBadge tone="brand">Payroll workflow</StatusBadge>
            <StatusBadge tone="neutral" emphasis="outline">
              Employee self-service delivery
            </StatusBadge>
          </>
        }
        actions={
          <>
            <div className="relative min-w-[220px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search by employee or period..."
                className="pl-9"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as PayslipRequestStatusFilter)}
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All statuses</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="IN_REVIEW">In review</SelectItem>
                <SelectItem value="FULFILLED">Fulfilled</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
      />

      {requestsQuery.isPending && !requestsQuery.data ? (
        <PageStateSkeleton variant="list" count={5} />
      ) : requestsQuery.isError ? (
        <ErrorState
          title="Could not load payslip requests"
          description="We couldn't load the payroll payslip request queue right now."
          message={requestsQuery.error.message}
          onRetry={() => void requestsQuery.refetch()}
        />
      ) : (
        <>
          <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              title="Pending"
              value={pendingCount}
              helper="Requests newly submitted by employees."
            />
            <SummaryCard
              title="In review"
              value={inReviewCount}
              helper="Requests currently under payroll review."
            />
            <SummaryCard
              title="Fulfilled"
              value={fulfilledCount}
              helper="Requests already delivered to employee accounts."
            />
            <SummaryCard
              title="Rejected"
              value={rejectedCount}
              helper="Requests closed without delivery."
            />
          </div>

          <Card className={`${SURFACE_CARD_CLASS_NAME} mb-6`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-950">
                <ShieldCheck className="h-4 w-4 text-slate-600" />
                Workflow boundary
              </CardTitle>
              <CardDescription>
                This queue remains payroll-scoped. Payroll users can review and deliver payslips
                without gaining unrelated HR administration rights.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-6 text-slate-600">
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
                Employees can only request and access their own payslips. Payroll users can review
                the request queue and publish only the delivered file for the owning employee.
              </div>
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
                Delivery uses secure storage-backed PDF files and keeps unpublished payroll data out
                of employee self-service views.
              </div>
            </CardContent>
          </Card>

          <Card className={SURFACE_CARD_CLASS_NAME}>
            <CardHeader>
              <CardTitle className="text-base font-semibold text-slate-950">
                Payslip request queue
              </CardTitle>
              <CardDescription>
                Review employee requests, inspect notes, and deliver payslip documents through the
                payroll workflow.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {requests.length === 0 ? (
                isFiltered ? (
                  <SearchEmptyState
                    surface="plain"
                    align="left"
                    title="No payslip requests found"
                    description="Try changing the status filter or search term."
                    actions={
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSearchInput('')
                          setStatusFilter('ALL')
                        }}
                      >
                        Clear filters
                      </Button>
                    }
                  />
                ) : (
                  <EmptyState
                    surface="plain"
                    align="left"
                    title="No payslip requests yet"
                    description="Employee-submitted payslip requests will appear here once the workflow starts being used."
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
            setSelectedFile(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-3xl">
          {selectedRequest ? (
            <>
              <DialogHeader>
                <DialogTitle>Review Payslip Request</DialogTitle>
                <DialogDescription>
                  Inspect the employee, requested period, review note, and delivery state before
                  updating this request.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-950">
                        {buildEmployeeName(selectedRequest)}
                      </p>
                      <StatusBadge tone={getPayslipRequestStatusMeta(selectedRequest.status).tone}>
                        {getPayslipRequestStatusMeta(selectedRequest.status).label}
                      </StatusBadge>
                    </div>
                    <div className="mt-3 space-y-1 text-sm text-slate-600">
                      <p>Matricule: {selectedRequest.employeMatricule}</p>
                      <p>Email: {selectedRequest.employeEmail ?? '\u2014'}</p>
                      <p>Department: {selectedRequest.departementNom ?? '\u2014'}</p>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button asChild variant="outline" size="sm">
                        <Link to={getPayrollEmployeeRoute(selectedRequest.employeId)}>
                          Open employee
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
                      {formatDateRange(selectedRequest.periodStart, selectedRequest.periodEnd)}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                      <span>Submitted {formatTimestamp(selectedRequest.createdAt)}</span>
                      <span>Reviewed {formatTimestamp(selectedRequest.reviewedAt)}</span>
                      <span>Fulfilled {formatTimestamp(selectedRequest.fulfilledAt)}</span>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Employee note
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-700">
                      {selectedRequest.requestNote ?? 'No note provided.'}
                    </p>
                  </div>

                  {selectedRequest.documentId &&
                  selectedRequest.documentStoragePath &&
                  selectedRequest.documentFileName ? (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                      <p className="text-sm font-semibold text-emerald-950">Delivered document</p>
                      <p className="mt-2 text-sm text-emerald-900">
                        {selectedRequest.documentFileName}
                      </p>
                      <p className="mt-2 text-xs text-emerald-800">
                        Published {formatTimestamp(selectedRequest.documentPublishedAt)}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={Boolean(activeDocumentActionKey)}
                          onClick={() => void handleOpenDeliveredDocument(selectedRequest)}
                        >
                          {activeDocumentActionKey === `${selectedRequest.id}:open` ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <ExternalLink className="mr-2 h-4 w-4" />
                          )}
                          Open file
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          disabled={Boolean(activeDocumentActionKey)}
                          onClick={() => void handleDownloadDeliveredDocument(selectedRequest)}
                        >
                          {activeDocumentActionKey === `${selectedRequest.id}:download` ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <FileText className="mr-2 h-4 w-4" />
                          )}
                          Download file
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="payslipRequestReviewNote">Payroll review note</Label>
                    <Textarea
                      id="payslipRequestReviewNote"
                      value={reviewNote}
                      onChange={(event) => setReviewNote(event.target.value)}
                      placeholder="Add an internal payroll note or a rejection explanation."
                      rows={6}
                      disabled={!canReviewRequest(selectedRequest.status)}
                    />
                  </div>

                  {canReviewRequest(selectedRequest.status) ? (
                    <div className="space-y-2">
                      <Label htmlFor="payslipDeliveryFile">Payslip PDF</Label>
                      <Input
                        id="payslipDeliveryFile"
                        type="file"
                        accept="application/pdf,.pdf"
                        onChange={(event) => {
                          setSelectedFile(event.target.files?.[0] ?? null)
                        }}
                      />
                      <p className="text-xs text-slate-500">
                        Uploading a PDF here fulfills the request and publishes the document to the
                        employee account.
                      </p>
                    </div>
                  ) : null}

                  {selectedFile ? (
                    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 text-sm text-slate-700">
                      Selected file: {selectedFile.name}
                    </div>
                  ) : null}

                  {!canReviewRequest(selectedRequest.status) ? (
                    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 text-sm text-slate-600">
                      This request is closed. Delivered files remain available from this dialog and
                      from the employee account, but the workflow state can no longer change.
                    </div>
                  ) : null}
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  disabled={updateStatusMutation.isPending || fulfillRequestMutation.isPending}
                  onClick={() => setSelectedRequest(null)}
                >
                  Close
                </Button>

                {selectedRequest.status === 'PENDING' ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={updateStatusMutation.isPending || fulfillRequestMutation.isPending}
                    onClick={() => void handleMoveToInReview()}
                  >
                    {updateStatusMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Mark in review
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
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Reject
                  </Button>
                ) : null}

                {canReviewRequest(selectedRequest.status) ? (
                  <Button
                    type="button"
                    className={BRAND_BUTTON_CLASS_NAME}
                    disabled={updateStatusMutation.isPending || fulfillRequestMutation.isPending}
                    onClick={() => void handleFulfill()}
                  >
                    {fulfillRequestMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <FileText className="mr-2 h-4 w-4" />
                    )}
                    Fulfill and deliver
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
