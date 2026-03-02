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
import { useRole } from '@/hooks/use-role'
import { DashboardLayout } from '@/layouts/dashboard-layout'
import { useMyRequestsQuery } from '@/services/requestsService'
import type { DemandeStatut, ModificationRequest } from '@/types/modification-request'
import { REQUEST_FIELD_LABELS } from '@/utils/modification-requests'

type StatusFilter = 'ALL' | DemandeStatut

function getStatusMeta(status: DemandeStatut): {
  label: string
  icon: typeof Clock3
  className: string
} {
  if (status === 'ACCEPTEE') {
    return {
      label: 'Approved',
      icon: CheckCircle2,
      className: 'border-emerald-300 text-emerald-700',
    }
  }

  if (status === 'REJETEE') {
    return {
      label: 'Rejected',
      icon: XCircle,
      className: 'border-destructive text-destructive',
    }
  }

  return {
    label: 'Pending',
    icon: Clock3,
    className: 'border-amber-300 text-amber-700',
  }
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return '-'
  }
  return new Date(value).toLocaleString()
}

function buildRequestSummary(request: ModificationRequest): string {
  const fieldLabel = REQUEST_FIELD_LABELS[request.champCible] ?? request.champCible
  const oldValue = (request.ancienneValeur ?? '').trim() || 'Not set'
  const newValue = (request.nouvelleValeur ?? '').trim() || 'Not set'
  return `${fieldLabel}: ${oldValue} -> ${newValue}`
}

function matchesSearch(request: ModificationRequest, term: string): boolean {
  if (!term) {
    return true
  }

  const normalized = term.toLowerCase()
  const summary = buildRequestSummary(request).toLowerCase()
  const motif = (request.motif ?? '').toLowerCase()
  const field = (REQUEST_FIELD_LABELS[request.champCible] ?? request.champCible).toLowerCase()
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
          matchesSearch(request, debouncedSearch.trim()),
      ),
    [debouncedSearch, requests, statusFilter],
  )

  const isFiltered = statusFilter !== 'ALL' || debouncedSearch.trim().length > 0

  return (
    <DashboardLayout
      title="My Requests"
      subtitle="Track the status of your profile change submissions."
    >
      <section className="sticky top-16 z-20 mb-6 rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-sm backdrop-blur">
        <div className="mb-2 h-1 w-24 rounded-full bg-gradient-to-br from-[#ff6b35] to-[#ffc947]" />
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-900">My Requests</h2>
              <Badge variant="outline" className="border-slate-300 text-slate-700">
                Total {requestsQuery.data?.total ?? requests.length}
              </Badge>
              <Badge className="border-amber-300 bg-amber-50 text-amber-700">
                Pending {pendingCount}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              Track the status of your profile change submissions.
            </p>
          </div>

          <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
            <div className="relative min-w-[220px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search requests..."
                className="pl-9"
                aria-label="Search requests"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as StatusFilter)}
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All statuses</SelectItem>
                <SelectItem value="EN_ATTENTE">Pending</SelectItem>
                <SelectItem value="ACCEPTEE">Approved</SelectItem>
                <SelectItem value="REJETEE">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Button
              asChild
              className="border-0 bg-gradient-to-br from-[#ff6b35] to-[#ffc947] text-white shadow-sm hover:shadow-md"
            >
              <Link to={`${ROUTES.EMPLOYEE_PROFILE_MANAGE}#requests`}>New Request</Link>
            </Button>
          </div>
        </div>
      </section>

      <Alert className="mb-4 border-slate-200 bg-slate-50">
        <AlertTitle>Review Workflow</AlertTitle>
        <AlertDescription>
          Requests are reviewed by HR. You will be notified once a decision is made.
        </AlertDescription>
      </Alert>

      <Card className="rounded-2xl border-slate-200/80 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Request History</CardTitle>
          <CardDescription>
            Monitor approval status and open each request for full details.
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
            <Alert variant="destructive">
              <AlertTitle>Failed to load requests</AlertTitle>
              <AlertDescription className="mt-2 flex items-center gap-3">
                <span>{requestsQuery.error.message}</span>
                <Button variant="outline" size="sm" onClick={() => void requestsQuery.refetch()}>
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}

          {!requestsQuery.isPending && !requestsQuery.isError ? (
            filteredRequests.length === 0 ? (
              requests.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-8 text-center">
                  <h3 className="text-lg font-semibold text-slate-900">No requests yet</h3>
                  <p className="mt-2 text-sm text-slate-600">
                    Submit a change request to update your information.
                  </p>
                  <Button
                    asChild
                    className="mt-4 border-0 bg-gradient-to-br from-[#ff6b35] to-[#ffc947] text-white shadow-sm hover:shadow-md"
                  >
                    <Link to={`${ROUTES.EMPLOYEE_PROFILE_MANAGE}#requests`}>Create request</Link>
                  </Button>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-8 text-center">
                  <h3 className="text-lg font-semibold text-slate-900">No results</h3>
                  <p className="mt-2 text-sm text-slate-600">
                    Try changing your search or status filter.
                  </p>
                  {isFiltered ? (
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={() => {
                        setSearch('')
                        setStatusFilter('ALL')
                      }}
                    >
                      Clear filters
                    </Button>
                  ) : null}
                </div>
              )
            ) : (
              <>
                <div className="hidden overflow-x-auto md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Submitted</TableHead>
                        <TableHead>Summary</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Reviewed</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRequests.map((request) => {
                        const statusMeta = getStatusMeta(request.statutDemande)
                        const StatusIcon = statusMeta.icon
                        return (
                          <TableRow
                            key={request.id}
                            className="cursor-pointer"
                            onClick={() => setSelectedRequest(request)}
                          >
                            <TableCell>{formatDateTime(request.createdAt)}</TableCell>
                            <TableCell className="max-w-[420px]">
                              <p className="line-clamp-2 text-sm text-slate-700">
                                {buildRequestSummary(request)}
                              </p>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={statusMeta.className}>
                                <StatusIcon className="mr-1 h-3.5 w-3.5" />
                                {statusMeta.label}
                              </Badge>
                            </TableCell>
                            <TableCell>{formatDateTime(request.traiteAt)}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  setSelectedRequest(request)
                                }}
                              >
                                View details
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
                    const statusMeta = getStatusMeta(request.statutDemande)
                    const StatusIcon = statusMeta.icon
                    return (
                      <button
                        key={request.id}
                        type="button"
                        onClick={() => setSelectedRequest(request)}
                        className="w-full rounded-xl border border-slate-200 bg-white p-3 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--brand-primary))]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs text-muted-foreground">
                              {formatDateTime(request.createdAt)}
                            </p>
                            <p className="mt-1 line-clamp-2 text-sm text-slate-700">
                              {buildRequestSummary(request)}
                            </p>
                          </div>
                          <Badge variant="outline" className={statusMeta.className}>
                            <StatusIcon className="mr-1 h-3.5 w-3.5" />
                            {statusMeta.label}
                          </Badge>
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
                  Request Details
                  <Badge variant="outline" className={getStatusMeta(selectedRequest.statutDemande).className}>
                    {getStatusMeta(selectedRequest.statutDemande).label}
                  </Badge>
                </DialogTitle>
                <DialogDescription>
                  Submitted on {formatDateTime(selectedRequest.createdAt)}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Summary</p>
                  <p className="mt-1 text-sm text-slate-800">{buildRequestSummary(selectedRequest)}</p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Target field</p>
                    <p className="mt-1 text-sm font-medium text-slate-900">
                      {REQUEST_FIELD_LABELS[selectedRequest.champCible] ?? selectedRequest.champCible}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Reviewed on</p>
                    <p className="mt-1 text-sm font-medium text-slate-900">
                      {formatDateTime(selectedRequest.traiteAt)}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Current value</p>
                  <p className="mt-1 text-sm text-slate-800">
                    {(selectedRequest.ancienneValeur ?? '').trim() || 'Not set'}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Requested value</p>
                  <p className="mt-1 text-sm text-slate-800">
                    {(selectedRequest.nouvelleValeur ?? '').trim() || 'Not set'}
                  </p>
                </div>

                {selectedRequest.motif ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Request note</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">
                      {selectedRequest.motif}
                    </p>
                  </div>
                ) : null}

                {selectedRequest.statutDemande === 'ACCEPTEE' && selectedRequest.traiteAt ? (
                  <Alert className="border-emerald-300 bg-emerald-50 text-emerald-900">
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertTitle>Approved</AlertTitle>
                    <AlertDescription>
                      Approved on {formatDateTime(selectedRequest.traiteAt)}.
                    </AlertDescription>
                  </Alert>
                ) : null}

                {selectedRequest.statutDemande === 'REJETEE' ? (
                  <Alert className="border-destructive/40 bg-destructive/5 text-destructive">
                    <XCircle className="h-4 w-4" />
                    <AlertTitle>Rejected</AlertTitle>
                    <AlertDescription>
                      {selectedRequest.commentaireTraitement?.trim()
                        ? `Reason: ${selectedRequest.commentaireTraitement}`
                        : 'No rejection reason provided.'}
                    </AlertDescription>
                  </Alert>
                ) : null}
              </div>

              <DialogFooter className="mt-2">
                <Button variant="outline" onClick={() => setSelectedRequest(null)}>
                  Close
                </Button>
                <Button asChild variant="outline">
                  <Link to={`${ROUTES.EMPLOYEE_PROFILE_MANAGE}#requests`}>
                    <FileText className="mr-2 h-4 w-4" />
                    New request
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </DialogFooter>
            </>
          ) : (
            <div className="py-10 text-center text-sm text-muted-foreground">
              <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" />
              Loading request...
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
