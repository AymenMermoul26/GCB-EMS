import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Bell,
  CheckCircle2,
  ExternalLink,
  Filter,
  Loader2,
  MoreHorizontal,
  RefreshCw,
  Search,
  ShieldAlert,
  UserRound,
  XCircle,
} from 'lucide-react'
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
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
import { Textarea } from '@/components/ui/textarea'
import { ROUTES, getAdminEmployeeRoute } from '@/constants/routes'
import { useAuth } from '@/hooks/use-auth'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { DashboardLayout } from '@/layouts/dashboard-layout'
import { auditService } from '@/services/auditService'
import { useDepartmentsQuery } from '@/services/departmentsService'
import { employeesService } from '@/services/employeesService'
import {
  notificationsService,
  useMarkNotificationReadMutation,
  useMyNotificationsQuery,
  useUnreadNotificationsCountQuery,
} from '@/services/notificationsService'
import { roleService } from '@/services/role.service'
import {
  requestsService,
  useAdminRequestsQuery,
  usePendingRequestsCountQuery,
} from '@/services/requestsService'
import type { DemandeStatut, ModificationRequest } from '@/types/modification-request'
import { REQUEST_FIELD_LABELS, toEmployeeUpdatePayload } from '@/utils/modification-requests'

type StatusFilter = DemandeStatut | 'ALL'

function getStatusClassName(status: DemandeStatut): string {
  if (status === 'EN_ATTENTE') {
    return 'border-transparent bg-amber-100 text-amber-800'
  }

  if (status === 'ACCEPTEE') {
    return 'border-transparent bg-emerald-100 text-emerald-800'
  }

  return 'border-transparent bg-rose-100 text-rose-800'
}

function getStatusLabel(status: DemandeStatut): string {
  if (status === 'EN_ATTENTE') {
    return 'Pending'
  }

  if (status === 'ACCEPTEE') {
    return 'Approved'
  }

  return 'Rejected'
}

function getInitials(request: ModificationRequest): string {
  const prenomInitial = request.employePrenom?.trim().charAt(0) ?? ''
  const nomInitial = request.employeNom?.trim().charAt(0) ?? ''
  const initials = `${prenomInitial}${nomInitial}`.toUpperCase()

  return initials || 'NA'
}

function formatEmployeeName(request: ModificationRequest) {
  if (request.employePrenom || request.employeNom) {
    return `${request.employePrenom ?? ''} ${request.employeNom ?? ''}`.trim()
  }

  return request.employeId
}

function formatRequestSummary(request: ModificationRequest): string {
  const fieldLabel = REQUEST_FIELD_LABELS[request.champCible]
  const previousValue = request.ancienneValeur ?? '-'
  const nextValue = request.nouvelleValeur ?? '-'
  const motif = request.motif ? ` | Reason: ${request.motif}` : ''
  return `${fieldLabel}: ${previousValue} -> ${nextValue}${motif}`
}

function formatOptionalDate(value: string | null): string {
  if (!value) {
    return 'Not reviewed'
  }

  return new Date(value).toLocaleString()
}

export function AdminRequestsPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('EN_ATTENTE')
  const [departmentFilter, setDepartmentFilter] = useState<string>('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [searchInput, setSearchInput] = useState('')
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<ModificationRequest | null>(null)
  const [approveTarget, setApproveTarget] = useState<ModificationRequest | null>(null)
  const [approveComment, setApproveComment] = useState('')
  const [rejectTarget, setRejectTarget] = useState<ModificationRequest | null>(null)
  const [rejectComment, setRejectComment] = useState('')

  const debouncedSearch = useDebouncedValue(searchInput, 300)
  const departmentsQuery = useDepartmentsQuery()
  const notificationsQuery = useMyNotificationsQuery(user?.id)
  const unreadNotificationsCountQuery = useUnreadNotificationsCountQuery(user?.id)
  const pendingRequestsCountQuery = usePendingRequestsCountQuery(Boolean(user))

  const requestFilters = useMemo(
    () => ({
      statut: statusFilter === 'ALL' ? undefined : statusFilter,
      departementId: departmentFilter === 'all' ? undefined : departmentFilter,
      page,
      pageSize,
    }),
    [departmentFilter, page, pageSize, statusFilter],
  )

  const requestsQuery = useAdminRequestsQuery(requestFilters)

  const markNotificationReadMutation = useMarkNotificationReadMutation(user?.id, {
    onSuccess: async () => {
      await notificationsQuery.refetch()
    },
  })

  const approveMutation = useMutation({
    mutationFn: async (payload: { request: ModificationRequest; comment?: string }) => {
      const approvedRequest = await requestsService.approveRequest(payload.request.id, payload.comment)

      const employeeUpdateValue = payload.request.nouvelleValeur ?? ''
      await employeesService.updateEmployee(
        payload.request.employeId,
        toEmployeeUpdatePayload(payload.request.champCible, employeeUpdateValue),
      )

      let recipientUserId: string | null = null

      try {
        recipientUserId = await roleService.getUserIdByEmployeId(payload.request.employeId)
      } catch (error) {
        console.error('Failed to resolve recipient user id for approved request', error)
      }

      if (recipientUserId) {
        try {
          await notificationsService.createNotification({
            userId: recipientUserId,
            title: 'Modification request approved',
            body: `Your request for ${REQUEST_FIELD_LABELS[payload.request.champCible]} has been approved.`,
            link: ROUTES.EMPLOYEE_PROFILE,
          })
        } catch (error) {
          console.error('Unable to notify employee for approved request', error)
        }
      }

      try {
        await auditService.insertAuditLog({
          action: 'REQUEST_APPROVED',
          targetType: 'DemandeModification',
          targetId: payload.request.id,
          detailsJson: {
            employe_id: payload.request.employeId,
            champ_cible: payload.request.champCible,
            ancienne_valeur: payload.request.ancienneValeur,
            nouvelle_valeur: payload.request.nouvelleValeur,
            commentaire_traitement: payload.comment ?? null,
          },
        })
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Unable to write audit log')
      }

      return {
        approvedRequest,
        recipientUserId,
      }
    },
    onSuccess: async (result, variables) => {
      toast.success('Request approved and employee updated.')
      setApproveTarget(null)
      setApproveComment('')
      await queryClient.invalidateQueries({ queryKey: ['adminRequests'] })
      await queryClient.invalidateQueries({ queryKey: ['myRequests', variables.request.employeId] })
      await queryClient.invalidateQueries({ queryKey: ['employee', variables.request.employeId] })
      await queryClient.invalidateQueries({ queryKey: ['employees'] })
      await queryClient.invalidateQueries({ queryKey: ['pendingRequestsCount'] })
      if (result.recipientUserId) {
        await queryClient.invalidateQueries({ queryKey: ['notifications', result.recipientUserId] })
        await queryClient.invalidateQueries({
          queryKey: ['notificationsUnreadCount', result.recipientUserId],
        })
      }
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to approve request')
    },
  })

  const rejectMutation = useMutation({
    mutationFn: async (payload: { request: ModificationRequest; comment: string }) => {
      const rejectedRequest = await requestsService.rejectRequest(payload.request.id, payload.comment)

      let recipientUserId: string | null = null

      try {
        recipientUserId = await roleService.getUserIdByEmployeId(payload.request.employeId)
      } catch (error) {
        console.error('Failed to resolve recipient user id for rejected request', error)
      }

      if (recipientUserId) {
        try {
          await notificationsService.createNotification({
            userId: recipientUserId,
            title: 'Modification request rejected',
            body: `Your request for ${REQUEST_FIELD_LABELS[payload.request.champCible]} was rejected.`,
            link: ROUTES.EMPLOYEE_PROFILE,
          })
        } catch (error) {
          console.error('Unable to notify employee for rejected request', error)
        }
      }

      try {
        await auditService.insertAuditLog({
          action: 'REQUEST_REJECTED',
          targetType: 'DemandeModification',
          targetId: payload.request.id,
          detailsJson: {
            employe_id: payload.request.employeId,
            champ_cible: payload.request.champCible,
            ancienne_valeur: payload.request.ancienneValeur,
            nouvelle_valeur: payload.request.nouvelleValeur,
            commentaire_traitement: payload.comment,
          },
        })
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Unable to write audit log')
      }

      return {
        rejectedRequest,
        recipientUserId,
      }
    },
    onSuccess: async (result, variables) => {
      toast.success('Request rejected.')
      setRejectTarget(null)
      setRejectComment('')
      await queryClient.invalidateQueries({ queryKey: ['adminRequests'] })
      await queryClient.invalidateQueries({ queryKey: ['myRequests', variables.request.employeId] })
      await queryClient.invalidateQueries({ queryKey: ['pendingRequestsCount'] })
      if (result.recipientUserId) {
        await queryClient.invalidateQueries({ queryKey: ['notifications', result.recipientUserId] })
        await queryClient.invalidateQueries({
          queryKey: ['notificationsUnreadCount', result.recipientUserId],
        })
      }
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to reject request')
    },
  })

  const baseItems = useMemo(() => requestsQuery.data?.items ?? [], [requestsQuery.data?.items])
  const filteredItems = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase()
    if (!term) {
      return baseItems
    }

    return baseItems.filter((request) => {
      const searchTarget = [
        formatEmployeeName(request),
        request.employeMatricule ?? '',
        REQUEST_FIELD_LABELS[request.champCible],
        request.motif ?? '',
      ]
        .join(' ')
        .toLowerCase()

      return searchTarget.includes(term)
    })
  }, [baseItems, debouncedSearch])

  const total = requestsQuery.data?.total ?? 0
  const pendingCount =
    pendingRequestsCountQuery.data ??
    baseItems.filter((request) => request.statutDemande === 'EN_ATTENTE').length
  const showingFrom = total === 0 ? 0 : (page - 1) * pageSize + 1
  const showingTo = total === 0 ? 0 : Math.min(page * pageSize, total)
  const isSearching = debouncedSearch.trim().length > 0

  const resetFilters = () => {
    setStatusFilter('EN_ATTENTE')
    setDepartmentFilter('all')
    setPageSize(20)
    setPage(1)
    setSearchInput('')
    setIsFilterDialogOpen(false)
  }

  return (
    <DashboardLayout
      title="Modification Requests"
      subtitle="Review and process employee profile change requests."
    >
      <div className="sticky top-2 z-20 mb-6 rounded-2xl border bg-white/95 p-4 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Modification Requests</h1>
              <Badge variant="secondary" className="rounded-full">
                Total {total}
              </Badge>
              <Badge className="rounded-full border-transparent bg-amber-500 text-white">
                Pending {pendingCount}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Review and approve/reject employee profile changes.
            </p>
          </div>

          <div className="flex w-full flex-col gap-2 sm:flex-row xl:w-auto">
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(event) => {
                  setSearchInput(event.target.value)
                  setPage(1)
                }}
                placeholder="Search by employee name, matricule..."
                className="pl-9"
                aria-label="Search requests"
              />
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => setIsFilterDialogOpen(true)}
              aria-label="Open request filters"
            >
              <Filter className="mr-2 h-4 w-4" />
              Filters
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => void requestsQuery.refetch()}
              disabled={requestsQuery.isFetching}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${requestsQuery.isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {requestsQuery.isError ? (
        <Alert variant="destructive" className="mb-6">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Failed to load requests</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>{requestsQuery.error.message}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void requestsQuery.refetch()}
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <Card className="rounded-2xl border border-slate-200/80 shadow-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="text-base font-semibold">Requests queue</CardTitle>
          <CardDescription>
            Focus on pending items first. Open each request for full details before decision.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {requestsQuery.isPending ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Request Summary</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead className="w-[260px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 8 }).map((_, index) => (
                    <TableRow key={`request-skeleton-${index}`}>
                      <TableCell><Skeleton className="h-10 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-[340px]" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="ml-auto h-8 w-48" /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}

          {!requestsQuery.isPending && !requestsQuery.isError && filteredItems.length === 0 ? (
            <div className="flex justify-center py-8">
              <div className="w-full max-w-lg rounded-2xl border border-dashed bg-muted/20 p-8 text-center">
                <h3 className="text-lg font-semibold text-slate-900">No requests</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Employee modification requests will appear here.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-5"
                  onClick={resetFilters}
                >
                  Clear filters
                </Button>
              </div>
            </div>
          ) : null}

          {!requestsQuery.isPending && !requestsQuery.isError && filteredItems.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Request Summary</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead className="w-[260px] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredItems.map((request) => (
                      <TableRow
                        key={request.id}
                        className="cursor-pointer hover:bg-muted/30"
                        onClick={() => setSelectedRequest(request)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
                              {getInitials(request)}
                            </div>
                            <div>
                              <p className="text-sm font-medium">{formatEmployeeName(request)}</p>
                              <p className="text-xs text-muted-foreground">
                                {request.employeMatricule ?? request.employeId}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="[display:-webkit-box] overflow-hidden text-sm text-slate-700 [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
                            {formatRequestSummary(request)}
                          </p>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusClassName(request.statutDemande)}>
                            {getStatusLabel(request.statutDemande)}
                          </Badge>
                        </TableCell>
                        <TableCell>{new Date(request.createdAt).toLocaleString()}</TableCell>
                        <TableCell onClick={(event) => event.stopPropagation()}>
                          <div className="flex items-center justify-end gap-2">
                            {request.statutDemande === 'EN_ATTENTE' ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={approveMutation.isPending || rejectMutation.isPending}
                                  onClick={() => {
                                    setApproveTarget(request)
                                    setApproveComment('')
                                  }}
                                >
                                  <CheckCircle2 className="mr-1 h-4 w-4" />
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-destructive text-destructive hover:bg-destructive/10"
                                  disabled={approveMutation.isPending || rejectMutation.isPending}
                                  onClick={() => {
                                    setRejectTarget(request)
                                    setRejectComment('')
                                  }}
                                >
                                  <XCircle className="mr-1 h-4 w-4" />
                                  Reject
                                </Button>
                              </>
                            ) : (
                              <span className="text-xs text-muted-foreground">Processed</span>
                            )}

                            <RequestRowActions
                              request={request}
                              onViewDetails={() => setSelectedRequest(request)}
                              onOpenEmployee={() => navigate(getAdminEmployeeRoute(request.employeId))}
                              onApprove={() => {
                                setApproveTarget(request)
                                setApproveComment('')
                              }}
                              onReject={() => {
                                setRejectTarget(request)
                                setRejectComment('')
                              }}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing {showingFrom}-{showingTo} of {total}
                  {isSearching ? ' (search applied on current page)' : ''}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 1 || requestsQuery.isFetching}
                    onClick={() => setPage((value) => Math.max(1, value - 1))}
                  >
                    Prev
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={showingTo >= total || requestsQuery.isFetching}
                    onClick={() => setPage((value) => value + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      <Card className="mt-4 rounded-2xl border border-slate-200/80 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Bell className="h-4 w-4" />
            My Notifications
            {(unreadNotificationsCountQuery.data ?? 0) > 0 ? (
              <Badge className="border-transparent bg-red-600 text-white">
                {unreadNotificationsCountQuery.data}
              </Badge>
            ) : null}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {notificationsQuery.isPending ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : null}

          {notificationsQuery.isError ? (
            <p className="text-sm text-destructive">{notificationsQuery.error.message}</p>
          ) : null}

          {!notificationsQuery.isPending && !notificationsQuery.isError ? (
            notificationsQuery.data && notificationsQuery.data.length > 0 ? (
              <div className="space-y-2">
                {notificationsQuery.data.slice(0, 8).map((item) => (
                  <div key={item.id} className="rounded-md border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{item.title}</p>
                        <p className="text-sm text-muted-foreground">{item.body}</p>
                      </div>
                      {!item.isRead ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={markNotificationReadMutation.isPending}
                          onClick={() => void markNotificationReadMutation.mutateAsync(item.id)}
                        >
                          Mark read
                        </Button>
                      ) : (
                        <Badge variant="secondary">Read</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No notifications yet.</p>
            )
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={isFilterDialogOpen} onOpenChange={setIsFilterDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Filter requests</DialogTitle>
            <DialogDescription>Adjust queue filters and pagination size.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="requests-status-filter">Status</Label>
              <Select
                value={statusFilter}
                onValueChange={(value: StatusFilter) => {
                  setStatusFilter(value)
                  setPage(1)
                }}
              >
                <SelectTrigger id="requests-status-filter">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All statuses</SelectItem>
                  <SelectItem value="EN_ATTENTE">Pending</SelectItem>
                  <SelectItem value="ACCEPTEE">Approved</SelectItem>
                  <SelectItem value="REJETEE">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="requests-department-filter">Department</Label>
              <Select
                value={departmentFilter}
                onValueChange={(value) => {
                  setDepartmentFilter(value)
                  setPage(1)
                }}
              >
                <SelectTrigger id="requests-department-filter">
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All departments</SelectItem>
                  {(departmentsQuery.data ?? []).map((department) => (
                    <SelectItem key={department.id} value={department.id}>
                      {department.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="requests-page-size-filter">Page size</Label>
              <Select
                value={String(pageSize)}
                onValueChange={(value) => {
                  setPageSize(Number(value))
                  setPage(1)
                }}
              >
                <SelectTrigger id="requests-page-size-filter">
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
            <Button type="button" variant="outline" onClick={resetFilters}>
              Clear filters
            </Button>
            <Button type="button" onClick={() => setIsFilterDialogOpen(false)}>
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selectedRequest)} onOpenChange={(open) => !open && setSelectedRequest(null)}>
        <DialogContent className="sm:max-w-2xl">
          {selectedRequest ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <UserRound className="h-4 w-4" />
                  {formatEmployeeName(selectedRequest)}
                </DialogTitle>
                <DialogDescription className="flex items-center gap-2">
                  <span>{selectedRequest.employeMatricule ?? selectedRequest.employeId}</span>
                  <Badge className={getStatusClassName(selectedRequest.statutDemande)}>
                    {getStatusLabel(selectedRequest.statutDemande)}
                  </Badge>
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="rounded-xl border p-3">
                  <p className="text-sm font-medium">Request details</p>
                  <p className="mt-2 text-sm text-slate-700">
                    Field: {REQUEST_FIELD_LABELS[selectedRequest.champCible]}
                  </p>
                  <p className="mt-1 text-sm text-slate-700">
                    Previous value: {selectedRequest.ancienneValeur ?? '-'}
                  </p>
                  <p className="mt-1 text-sm text-slate-700">
                    New value: {selectedRequest.nouvelleValeur ?? '-'}
                  </p>
                  {selectedRequest.motif ? (
                    <p className="mt-1 text-sm text-slate-700">
                      Employee reason: {selectedRequest.motif}
                    </p>
                  ) : null}
                </div>

                <div className="rounded-xl border p-3">
                  <p className="text-sm font-medium">Metadata</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Submitted: {new Date(selectedRequest.createdAt).toLocaleString()}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Reviewed: {formatOptionalDate(selectedRequest.traiteAt)}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Reviewed by: {selectedRequest.traiteParUserId ?? 'Not assigned'}
                  </p>
                </div>

                {selectedRequest.commentaireTraitement ? (
                  <div className="rounded-xl border p-3">
                    <p className="text-sm font-medium">Decision reason</p>
                    <p className="mt-2 text-sm text-slate-700">{selectedRequest.commentaireTraitement}</p>
                  </div>
                ) : null}
              </div>

              <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(getAdminEmployeeRoute(selectedRequest.employeId))}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open employee profile
                </Button>

                {selectedRequest.statutDemande === 'EN_ATTENTE' ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="border-destructive text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        setRejectTarget(selectedRequest)
                        setRejectComment('')
                      }}
                    >
                      Reject
                    </Button>
                    <Button
                      type="button"
                      className="bg-gradient-to-br from-[#ff6b35] to-[#ffc947] text-white shadow-sm transition-all hover:brightness-95 hover:shadow-md"
                      onClick={() => {
                        setApproveTarget(selectedRequest)
                        setApproveComment('')
                      }}
                    >
                      Approve
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Request already processed.</p>
                )}
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(approveTarget)} onOpenChange={(open) => !open && setApproveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve request</AlertDialogTitle>
            <AlertDialogDescription>
              This will apply the new value directly to the employee profile.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="approve-comment">Comment (optional)</Label>
            <Textarea
              id="approve-comment"
              rows={3}
              value={approveComment}
              onChange={(event) => setApproveComment(event.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={approveMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={approveMutation.isPending || !approveTarget}
              onClick={(event) => {
                event.preventDefault()
                if (!approveTarget) {
                  return
                }

                void approveMutation.mutateAsync({
                  request: approveTarget,
                  comment: approveComment.trim() || undefined,
                })
              }}
            >
              {approveMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {approveMutation.isPending ? 'Approving...' : 'Confirm approval'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={Boolean(rejectTarget)} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject request</DialogTitle>
            <DialogDescription>
              Rejection comment is required and will be visible to the employee.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="reject-comment">Rejection comment</Label>
            <Textarea
              id="reject-comment"
              rows={4}
              value={rejectComment}
              onChange={(event) => setRejectComment(event.target.value)}
            />
            {rejectComment.trim().length === 0 ? (
              <p className="text-xs text-destructive">Comment is required.</p>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)} disabled={rejectMutation.isPending}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={rejectMutation.isPending || rejectComment.trim().length === 0 || !rejectTarget}
              onClick={() => {
                if (!rejectTarget || rejectComment.trim().length === 0) {
                  return
                }

                void rejectMutation.mutateAsync({
                  request: rejectTarget,
                  comment: rejectComment.trim(),
                })
              }}
            >
              {rejectMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {rejectMutation.isPending ? 'Rejecting...' : 'Reject request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}

interface RequestRowActionsProps {
  request: ModificationRequest
  onViewDetails: () => void
  onOpenEmployee: () => void
  onApprove: () => void
  onReject: () => void
}

function RequestRowActions({
  request,
  onViewDetails,
  onOpenEmployee,
  onApprove,
  onReject,
}: RequestRowActionsProps) {
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
        aria-label={`Actions for request ${request.id}`}
        onClick={() => setIsOpen((current) => !current)}
      >
        <MoreHorizontal className="h-4 w-4" />
      </Button>

      {isOpen ? (
        <div className="absolute right-0 top-10 z-30 w-48 rounded-lg border bg-white p-1 shadow-md">
          <ActionMenuItem
            onClick={() => {
              setIsOpen(false)
              onViewDetails()
            }}
          >
            View details
          </ActionMenuItem>
          <ActionMenuItem
            onClick={() => {
              setIsOpen(false)
              onOpenEmployee()
            }}
          >
            Open employee profile
          </ActionMenuItem>
          {request.statutDemande === 'EN_ATTENTE' ? (
            <>
              <ActionMenuItem
                onClick={() => {
                  setIsOpen(false)
                  onApprove()
                }}
              >
                Approve
              </ActionMenuItem>
              <ActionMenuItem
                className="text-destructive hover:bg-destructive/10"
                onClick={() => {
                  setIsOpen(false)
                  onReject()
                }}
              >
                Reject
              </ActionMenuItem>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

interface ActionMenuItemProps {
  children: ReactNode
  onClick: () => void
  className?: string
}

function ActionMenuItem({ children, onClick, className }: ActionMenuItemProps) {
  return (
    <button
      type="button"
      className={`flex w-full items-center rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-muted ${className ?? ''}`}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
