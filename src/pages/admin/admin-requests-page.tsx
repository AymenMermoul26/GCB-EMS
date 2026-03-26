import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Bell,
  CheckCircle2,
  Clock3,
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

import {
  EmptyState,
  ErrorState,
  SearchEmptyState,
} from '@/components/common/page-state'
import { PageHeader } from '@/components/common/page-header'
import { StatusBadge } from '@/components/common/status-badge'
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
import { cn } from '@/lib/utils'
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
import {
  useAdminPublicProfileVisibilityRequestsQuery,
  usePendingPublicProfileVisibilityRequestsCountQuery,
  useUpdatePublicProfileVisibilityRequestStatusMutation,
} from '@/services/visibilityService'
import type { DemandeStatut, ModificationRequest } from '@/types/modification-request'
import {
  EMPLOYEE_VISIBILITY_FIELD_LABELS,
  getPublicProfileVisibilityRequestStatusMeta,
  type AdminPublicProfileVisibilityRequestItem,
  type EmployeeVisibilityFieldKey,
  type PublicProfileVisibilityRequestStatusFilter,
} from '@/types/visibility'
import { getDepartmentDisplayName } from '@/types/department'
import { REQUEST_FIELD_LABELS, toEmployeeUpdatePayload } from '@/utils/modification-requests'

type ModificationStatusFilter = DemandeStatut | 'ALL'
type VisibilityDecisionStatus = 'IN_REVIEW' | 'APPROVED' | 'REJECTED'

interface VisibilityDecisionTarget {
  request: AdminPublicProfileVisibilityRequestItem
  nextStatus: VisibilityDecisionStatus
}

function getModificationStatusTone(status: DemandeStatut): 'warning' | 'success' | 'danger' {
  if (status === 'EN_ATTENTE') {
    return 'warning'
  }

  if (status === 'ACCEPTEE') {
    return 'success'
  }

  return 'danger'
}

function getModificationStatusLabel(status: DemandeStatut): string {
  if (status === 'EN_ATTENTE') {
    return 'Pending'
  }

  if (status === 'ACCEPTEE') {
    return 'Approved'
  }

  return 'Rejected'
}

function getModificationRequestSurfaceClass(status: DemandeStatut): string {
  if (status === 'ACCEPTEE') {
    return 'bg-emerald-50/70 hover:bg-emerald-50'
  }

  if (status === 'REJETEE') {
    return 'bg-rose-50/80 hover:bg-rose-50'
  }

  return 'bg-amber-50/90 hover:bg-amber-100/80'
}

function getVisibilityRequestSurfaceClass(
  status: AdminPublicProfileVisibilityRequestItem['status'],
): string {
  if (status === 'APPROVED') {
    return 'bg-emerald-50/70 hover:bg-emerald-50'
  }

  if (status === 'REJECTED') {
    return 'bg-rose-50/80 hover:bg-rose-50'
  }

  return 'bg-amber-50/90 hover:bg-amber-100/80'
}

function getAttentionNotificationSurfaceClass(isUnread: boolean): string {
  return isUnread
    ? 'border-rose-300 bg-gradient-to-r from-rose-700 to-red-600 text-white shadow-[0_18px_35px_-25px_rgba(190,24,93,0.7)]'
    : 'border-slate-200 bg-white'
}

function fieldLabel(fieldKey: EmployeeVisibilityFieldKey): string {
  return EMPLOYEE_VISIBILITY_FIELD_LABELS[fieldKey] ?? fieldKey
}

function formatVisibilityFieldList(fieldKeys: EmployeeVisibilityFieldKey[]): string {
  if (fieldKeys.length === 0) {
    return 'No public fields selected'
  }

  return fieldKeys.map((fieldKey) => fieldLabel(fieldKey)).join(', ')
}

function getInitials(request: ModificationRequest): string {
  const prenomInitial = request.employePrenom?.trim().charAt(0) ?? ''
  const nomInitial = request.employeNom?.trim().charAt(0) ?? ''
  const initials = `${prenomInitial}${nomInitial}`.toUpperCase()

  return initials || 'NA'
}

function getVisibilityRequestInitials(request: AdminPublicProfileVisibilityRequestItem): string {
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

function formatVisibilityEmployeeName(request: AdminPublicProfileVisibilityRequestItem) {
  return `${request.employePrenom ?? ''} ${request.employeNom ?? ''}`.replace(/\s+/g, ' ').trim()
}

function formatRequestSummary(request: ModificationRequest): string {
  const field = REQUEST_FIELD_LABELS[request.champCible]
  const previousValue = request.ancienneValeur ?? '-'
  const nextValue = request.nouvelleValeur ?? '-'
  const motif = request.motif ? ` | Reason: ${request.motif}` : ''

  return `${field}: ${previousValue} -> ${nextValue}${motif}`
}

function formatOptionalDate(value: string | null): string {
  if (!value) {
    return 'Not reviewed'
  }

  return new Date(value).toLocaleString()
}

function isOpenVisibilityRequest(request: AdminPublicProfileVisibilityRequestItem): boolean {
  return request.status === 'PENDING' || request.status === 'IN_REVIEW'
}

function getVisibilityDecisionDialogCopy(nextStatus: VisibilityDecisionStatus): {
  title: string
  description: string
  confirmLabel: string
  noteLabel: string
  noteRequired: boolean
  confirmTone: 'default' | 'destructive'
} {
  if (nextStatus === 'IN_REVIEW') {
    return {
      title: 'Move request to in review',
      description:
        'This keeps the live public profile unchanged and records that HR has started reviewing the request.',
      confirmLabel: 'Confirm review status',
      noteLabel: 'Review note (optional)',
      noteRequired: false,
      confirmTone: 'default',
    }
  }

  if (nextStatus === 'APPROVED') {
    return {
      title: 'Approve visibility request',
      description:
        'This will apply the requested public profile visibility settings to the live QR profile immediately.',
      confirmLabel: 'Confirm approval',
      noteLabel: 'Approval note (optional)',
      noteRequired: false,
      confirmTone: 'default',
    }
  }

  return {
    title: 'Reject visibility request',
    description:
      'Rejection keeps the live public profile unchanged. The review note will be visible to the employee.',
    confirmLabel: 'Reject request',
    noteLabel: 'Rejection note',
    noteRequired: true,
    confirmTone: 'destructive',
  }
}

export function AdminRequestsPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [statusFilter, setStatusFilter] = useState<ModificationStatusFilter>('EN_ATTENTE')
  const [visibilityStatusFilter, setVisibilityStatusFilter] =
    useState<PublicProfileVisibilityRequestStatusFilter>('PENDING')
  const [departmentFilter, setDepartmentFilter] = useState<string>('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [searchInput, setSearchInput] = useState('')
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<ModificationRequest | null>(null)
  const [selectedVisibilityRequest, setSelectedVisibilityRequest] =
    useState<AdminPublicProfileVisibilityRequestItem | null>(null)
  const [approveTarget, setApproveTarget] = useState<ModificationRequest | null>(null)
  const [approveComment, setApproveComment] = useState('')
  const [rejectTarget, setRejectTarget] = useState<ModificationRequest | null>(null)
  const [rejectComment, setRejectComment] = useState('')
  const [visibilityDecisionTarget, setVisibilityDecisionTarget] =
    useState<VisibilityDecisionTarget | null>(null)
  const [visibilityReviewNote, setVisibilityReviewNote] = useState('')

  const debouncedSearch = useDebouncedValue(searchInput, 300)
  const departmentsQuery = useDepartmentsQuery()
  const notificationsQuery = useMyNotificationsQuery(user?.id)
  const unreadNotificationsCountQuery = useUnreadNotificationsCountQuery(user?.id)
  const pendingRequestsCountQuery = usePendingRequestsCountQuery(Boolean(user))
  const pendingVisibilityRequestsCountQuery =
    usePendingPublicProfileVisibilityRequestsCountQuery(Boolean(user))

  const requestFilters = useMemo(
    () => ({
      statut: statusFilter === 'ALL' ? undefined : statusFilter,
      departementId: departmentFilter === 'all' ? undefined : departmentFilter,
      page,
      pageSize,
    }),
    [departmentFilter, page, pageSize, statusFilter],
  )

  const visibilityRequestFilters = useMemo(
    () => ({
      status: visibilityStatusFilter === 'ALL' ? undefined : visibilityStatusFilter,
      search: debouncedSearch.trim() || undefined,
      departementId: departmentFilter === 'all' ? undefined : departmentFilter,
    }),
    [debouncedSearch, departmentFilter, visibilityStatusFilter],
  )

  const requestsQuery = useAdminRequestsQuery(requestFilters)
  const visibilityRequestsQuery = useAdminPublicProfileVisibilityRequestsQuery(visibilityRequestFilters)

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

  const visibilityDecisionMutation = useUpdatePublicProfileVisibilityRequestStatusMutation({
    onSuccess: (_data, variables) => {
      if (variables.status === 'IN_REVIEW') {
        toast.success('Visibility request moved to in review.')
      } else if (variables.status === 'APPROVED') {
        toast.success('Visibility request approved and live profile updated.')
      } else {
        toast.success('Visibility request rejected.')
      }

      setVisibilityDecisionTarget(null)
      setVisibilityReviewNote('')
      setSelectedVisibilityRequest(null)
    },
    onError: (error) => {
      toast.error(error.message)
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

  const visibilityItems = visibilityRequestsQuery.data ?? []
  const total = requestsQuery.data?.total ?? 0
  const pendingCount =
    pendingRequestsCountQuery.data ??
    baseItems.filter((request) => request.statutDemande === 'EN_ATTENTE').length
  const pendingVisibilityCount =
    pendingVisibilityRequestsCountQuery.data ??
    visibilityItems.filter((request) => request.status === 'PENDING').length
  const totalOpenCount = pendingCount + pendingVisibilityCount
  const showingFrom = total === 0 ? 0 : (page - 1) * pageSize + 1
  const showingTo = total === 0 ? 0 : Math.min(page * pageSize, total)
  const isSearching = debouncedSearch.trim().length > 0
  const hasActiveFilters =
    isSearching ||
    statusFilter !== 'EN_ATTENTE' ||
    visibilityStatusFilter !== 'PENDING' ||
    departmentFilter !== 'all' ||
    pageSize !== 20

  const resetFilters = () => {
    setStatusFilter('EN_ATTENTE')
    setVisibilityStatusFilter('PENDING')
    setDepartmentFilter('all')
    setPageSize(20)
    setPage(1)
    setSearchInput('')
    setIsFilterDialogOpen(false)
  }

  const refreshPage = async () => {
    await Promise.all([
      requestsQuery.refetch(),
      visibilityRequestsQuery.refetch(),
      notificationsQuery.refetch(),
      unreadNotificationsCountQuery.refetch(),
      pendingRequestsCountQuery.refetch(),
      pendingVisibilityRequestsCountQuery.refetch(),
    ])
  }

  const visibilityDialogCopy = visibilityDecisionTarget
    ? getVisibilityDecisionDialogCopy(visibilityDecisionTarget.nextStatus)
    : null
  const visibilityNoteRequired = visibilityDialogCopy?.noteRequired ?? false
  const isVisibilityReviewNoteValid =
    !visibilityNoteRequired || visibilityReviewNote.trim().length > 0

  return (
    <DashboardLayout
      title="Requests & Reviews"
      subtitle="Process employee profile changes and public profile visibility submissions."
    >
      <PageHeader
        title="Requests & Reviews"
        description="Review employee profile changes and approve public profile visibility requests before anything goes live."
        className="sticky top-2 z-20 mb-6"
        badges={
          <>
            <StatusBadge tone="warning" emphasis="solid">Profile Pending {pendingCount}</StatusBadge>
            <StatusBadge tone="warning" emphasis="solid">Visibility Pending {pendingVisibilityCount}</StatusBadge>
            <StatusBadge
              tone={totalOpenCount > 0 ? 'danger' : 'neutral'}
              emphasis={totalOpenCount > 0 ? 'solid' : 'soft'}
            >
              Open Total {totalOpenCount}
            </StatusBadge>
          </>
        }
        actions={
          <>
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(event) => {
                  setSearchInput(event.target.value)
                  setPage(1)
                }}
                placeholder="Search by employee name, employee ID, or request note..."
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
              onClick={() => void refreshPage()}
              disabled={
                requestsQuery.isFetching ||
                visibilityRequestsQuery.isFetching ||
                notificationsQuery.isFetching
              }
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${
                  requestsQuery.isFetching || visibilityRequestsQuery.isFetching
                    ? 'animate-spin'
                    : ''
                }`}
              />
              Refresh
            </Button>
          </>
        }
      />

      <div className="space-y-4">
        <Card className="rounded-2xl border border-slate-200/80 shadow-sm">
          <CardHeader className="space-y-1">
            <CardTitle className="text-base font-semibold">Employee profile change requests</CardTitle>
            <CardDescription>
              Focus on pending employee profile update requests first. Open each request for full details before decision.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {requestsQuery.isError ? (
              <ErrorState
                surface="plain"
                title="Failed to load profile change requests"
                description="We couldn't load the employee modification request queue right now."
                message={requestsQuery.error.message}
                icon={ShieldAlert}
                onRetry={() => void requestsQuery.refetch()}
              />
            ) : null}

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
              <>
                {hasActiveFilters ? (
                  <SearchEmptyState
                    surface="plain"
                    className="py-8"
                    title="No profile change requests found"
                    description="Try changing your search or queue filters."
                    actions={
                      <Button type="button" variant="outline" onClick={resetFilters}>
                        Clear filters
                      </Button>
                    }
                  />
                ) : (
                  <EmptyState
                    surface="plain"
                    className="py-8"
                    title="No profile change requests yet"
                    description="Employee modification requests will appear here once they are submitted."
                  />
                )}
              </>
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
                          className={cn(
                            'cursor-pointer transition-colors',
                            getModificationRequestSurfaceClass(request.statutDemande),
                          )}
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
                            <StatusBadge
                              tone={getModificationStatusTone(request.statutDemande)}
                              emphasis="solid"
                            >
                              {getModificationStatusLabel(request.statutDemande)}
                            </StatusBadge>
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

        <Card className="rounded-2xl border border-slate-200/80 shadow-sm">
          <CardHeader className="space-y-1">
            <CardTitle className="text-base font-semibold">Public profile visibility requests</CardTitle>
            <CardDescription>
              Employees now propose their own QR visibility settings. Only approved requests update the live public profile.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {visibilityRequestsQuery.isError ? (
              <ErrorState
                surface="plain"
                title="Failed to load visibility requests"
                description="We couldn't load the public profile visibility review queue right now."
                message={visibilityRequestsQuery.error.message}
                icon={ShieldAlert}
                onRetry={() => void visibilityRequestsQuery.refetch()}
              />
            ) : null}

            {visibilityRequestsQuery.isPending ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Live Public Profile</TableHead>
                      <TableHead>Requested Visibility</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead className="w-[320px] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.from({ length: 6 }).map((_, index) => (
                      <TableRow key={`visibility-request-skeleton-${index}`}>
                        <TableCell><Skeleton className="h-10 w-40" /></TableCell>
                        <TableCell><Skeleton className="h-8 w-56" /></TableCell>
                        <TableCell><Skeleton className="h-8 w-56" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                        <TableCell><Skeleton className="ml-auto h-8 w-56" /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}

            {!visibilityRequestsQuery.isPending && !visibilityRequestsQuery.isError ? (
              visibilityItems.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Live Public Profile</TableHead>
                        <TableHead>Requested Visibility</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Submitted</TableHead>
                        <TableHead className="w-[320px] text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibilityItems.map((request) => {
                        const statusMeta = getPublicProfileVisibilityRequestStatusMeta(request.status)
                        const requestIsOpen = isOpenVisibilityRequest(request)

                        return (
                          <TableRow
                            key={request.id}
                            className={cn(
                              'cursor-pointer transition-colors',
                              getVisibilityRequestSurfaceClass(request.status),
                            )}
                            onClick={() => setSelectedVisibilityRequest(request)}
                          >
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
                                  {getVisibilityRequestInitials(request)}
                                </div>
                                <div>
                                  <p className="text-sm font-medium">{formatVisibilityEmployeeName(request)}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {request.employeMatricule}
                                      {request.departementNom
                                        ? ` | ${getDepartmentDisplayName(request.departementNom) ?? request.departementNom}`
                                        : ''}
                                    </p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <p className="[display:-webkit-box] overflow-hidden text-sm text-slate-700 [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
                                {formatVisibilityFieldList(request.liveFieldKeys)}
                              </p>
                            </TableCell>
                            <TableCell>
                              <p className="[display:-webkit-box] overflow-hidden text-sm text-slate-700 [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
                                {formatVisibilityFieldList(request.requestedFieldKeys)}
                              </p>
                            </TableCell>
                            <TableCell>
                              <StatusBadge tone={statusMeta.tone} emphasis="solid">
                                {statusMeta.label}
                              </StatusBadge>
                            </TableCell>
                            <TableCell>{new Date(request.createdAt).toLocaleString()}</TableCell>
                            <TableCell onClick={(event) => event.stopPropagation()}>
                              <div className="flex items-center justify-end gap-2">
                                {requestIsOpen ? (
                                  <>
                                    {request.status === 'PENDING' ? (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={visibilityDecisionMutation.isPending}
                                        onClick={() => {
                                          setVisibilityDecisionTarget({
                                            request,
                                            nextStatus: 'IN_REVIEW',
                                          })
                                          setVisibilityReviewNote('')
                                        }}
                                      >
                                        <Clock3 className="mr-1 h-4 w-4" />
                                        In review
                                      </Button>
                                    ) : null}
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={visibilityDecisionMutation.isPending}
                                      onClick={() => {
                                        setVisibilityDecisionTarget({
                                          request,
                                          nextStatus: 'APPROVED',
                                        })
                                        setVisibilityReviewNote('')
                                      }}
                                    >
                                      <CheckCircle2 className="mr-1 h-4 w-4" />
                                      Approve
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="border-destructive text-destructive hover:bg-destructive/10"
                                      disabled={visibilityDecisionMutation.isPending}
                                      onClick={() => {
                                        setVisibilityDecisionTarget({
                                          request,
                                          nextStatus: 'REJECTED',
                                        })
                                        setVisibilityReviewNote('')
                                      }}
                                    >
                                      <XCircle className="mr-1 h-4 w-4" />
                                      Reject
                                    </Button>
                                  </>
                                ) : (
                                  <span className="text-xs text-muted-foreground">Processed</span>
                                )}

                                <VisibilityRequestRowActions
                                  request={request}
                                  onViewDetails={() => setSelectedVisibilityRequest(request)}
                                  onOpenEmployee={() => navigate(getAdminEmployeeRoute(request.employeId))}
                                  onMarkInReview={() => {
                                    setVisibilityDecisionTarget({
                                      request,
                                      nextStatus: 'IN_REVIEW',
                                    })
                                    setVisibilityReviewNote('')
                                  }}
                                  onApprove={() => {
                                    setVisibilityDecisionTarget({
                                      request,
                                      nextStatus: 'APPROVED',
                                    })
                                    setVisibilityReviewNote('')
                                  }}
                                  onReject={() => {
                                    setVisibilityDecisionTarget({
                                      request,
                                      nextStatus: 'REJECTED',
                                    })
                                    setVisibilityReviewNote('')
                                  }}
                                />
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <>
                  {hasActiveFilters ? (
                    <SearchEmptyState
                      surface="plain"
                      className="py-8"
                      title="No visibility requests found"
                      description="Try changing your search or review filters."
                      actions={
                        <Button type="button" variant="outline" onClick={resetFilters}>
                          Clear filters
                        </Button>
                      }
                    />
                  ) : (
                    <EmptyState
                      surface="plain"
                      className="py-8"
                      title="No visibility requests yet"
                      description="Employee-submitted public profile visibility requests will appear here once they are sent."
                    />
                  )}
                </>
              )
            ) : null}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-slate-200/80 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Bell className="h-4 w-4" />
              My Notifications
              {(unreadNotificationsCountQuery.data ?? 0) > 0 ? (
                <StatusBadge tone="danger" emphasis="solid">
                  {unreadNotificationsCountQuery.data}
                </StatusBadge>
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
              <ErrorState
                surface="plain"
                title="Could not load notifications"
                description="We couldn't load your latest admin notifications."
                message={notificationsQuery.error.message}
                onRetry={() => void notificationsQuery.refetch()}
              />
            ) : null}

            {!notificationsQuery.isPending && !notificationsQuery.isError ? (
              notificationsQuery.data && notificationsQuery.data.length > 0 ? (
                <div className="space-y-2">
                  {notificationsQuery.data.slice(0, 8).map((item) => (
                    <div
                      key={item.id}
                      className={cn(
                        'rounded-xl border p-3',
                        getAttentionNotificationSurfaceClass(!item.isRead),
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className={cn('text-sm font-medium', !item.isRead && 'text-white')}>
                            {item.title}
                          </p>
                          <p
                            className={cn(
                              'text-sm',
                              !item.isRead ? 'text-rose-50/95' : 'text-muted-foreground',
                            )}
                          >
                            {item.body}
                          </p>
                        </div>
                        {!item.isRead ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-white/60 bg-white/10 text-white hover:bg-white/20 hover:text-white"
                            disabled={markNotificationReadMutation.isPending}
                            onClick={() => void markNotificationReadMutation.mutateAsync(item.id)}
                          >
                            Mark read
                          </Button>
                        ) : (
                          <StatusBadge tone="neutral" emphasis="soft">Read</StatusBadge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  surface="plain"
                  title="No notifications yet"
                  description="New workflow and system alerts will appear here."
                />
              )
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isFilterDialogOpen} onOpenChange={setIsFilterDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Filter requests</DialogTitle>
            <DialogDescription>
              Adjust queue filters for employee profile changes and public visibility reviews.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="requests-status-filter">Profile change status</Label>
              <Select
                value={statusFilter}
                onValueChange={(value: ModificationStatusFilter) => {
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
              <Label htmlFor="visibility-requests-status-filter">Visibility request status</Label>
              <Select
                value={visibilityStatusFilter}
                onValueChange={(value: PublicProfileVisibilityRequestStatusFilter) => {
                  setVisibilityStatusFilter(value)
                  setPage(1)
                }}
              >
                <SelectTrigger id="visibility-requests-status-filter">
                  <SelectValue placeholder="Visibility request status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All statuses</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="IN_REVIEW">In review</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
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
                        {getDepartmentDisplayName(department.nom) ?? department.nom}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="requests-page-size-filter">Profile queue page size</Label>
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
                  <StatusBadge
                    tone={getModificationStatusTone(selectedRequest.statutDemande)}
                    emphasis="solid"
                  >
                    {getModificationStatusLabel(selectedRequest.statutDemande)}
                  </StatusBadge>
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

      <Dialog
        open={Boolean(selectedVisibilityRequest)}
        onOpenChange={(open) => !open && setSelectedVisibilityRequest(null)}
      >
        <DialogContent className="sm:max-w-2xl">
          {selectedVisibilityRequest ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <UserRound className="h-4 w-4" />
                  {formatVisibilityEmployeeName(selectedVisibilityRequest)}
                </DialogTitle>
                  <DialogDescription className="flex flex-wrap items-center gap-2">
                    <span>{selectedVisibilityRequest.employeMatricule}</span>
                    {selectedVisibilityRequest.departementNom ? (
                      <span>
                        {getDepartmentDisplayName(selectedVisibilityRequest.departementNom) ??
                          selectedVisibilityRequest.departementNom}
                      </span>
                    ) : null}
                  <StatusBadge
                    tone={getPublicProfileVisibilityRequestStatusMeta(selectedVisibilityRequest.status).tone}
                    emphasis="solid"
                  >
                    {getPublicProfileVisibilityRequestStatusMeta(selectedVisibilityRequest.status).label}
                  </StatusBadge>
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border p-3">
                    <p className="text-sm font-medium">Published when requested</p>
                    <p className="mt-2 text-sm text-slate-700">
                      {formatVisibilityFieldList(selectedVisibilityRequest.currentFieldKeys)}
                    </p>
                  </div>
                  <div className="rounded-xl border p-3">
                    <p className="text-sm font-medium">Current live public profile</p>
                    <p className="mt-2 text-sm text-slate-700">
                      {formatVisibilityFieldList(selectedVisibilityRequest.liveFieldKeys)}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border p-3">
                  <p className="text-sm font-medium">Requested public visibility</p>
                  <p className="mt-2 text-sm text-slate-700">
                    {formatVisibilityFieldList(selectedVisibilityRequest.requestedFieldKeys)}
                  </p>
                </div>

                {selectedVisibilityRequest.requestNote ? (
                  <div className="rounded-xl border p-3">
                    <p className="text-sm font-medium">Employee note</p>
                    <p className="mt-2 text-sm text-slate-700">{selectedVisibilityRequest.requestNote}</p>
                  </div>
                ) : null}

                <div className="rounded-xl border p-3">
                  <p className="text-sm font-medium">Metadata</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Submitted: {new Date(selectedVisibilityRequest.createdAt).toLocaleString()}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Reviewed: {formatOptionalDate(selectedVisibilityRequest.reviewedAt)}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Reviewed by: {selectedVisibilityRequest.reviewedByUserId ?? 'Not assigned'}
                  </p>
                </div>

                {selectedVisibilityRequest.reviewNote ? (
                  <div className="rounded-xl border p-3">
                    <p className="text-sm font-medium">HR review note</p>
                    <p className="mt-2 text-sm text-slate-700">{selectedVisibilityRequest.reviewNote}</p>
                  </div>
                ) : null}
              </div>

              <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(getAdminEmployeeRoute(selectedVisibilityRequest.employeId))}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open employee profile
                </Button>

                {isOpenVisibilityRequest(selectedVisibilityRequest) ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {selectedVisibilityRequest.status === 'PENDING' ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setVisibilityDecisionTarget({
                            request: selectedVisibilityRequest,
                            nextStatus: 'IN_REVIEW',
                          })
                          setVisibilityReviewNote('')
                        }}
                      >
                        In review
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="outline"
                      className="border-destructive text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        setVisibilityDecisionTarget({
                          request: selectedVisibilityRequest,
                          nextStatus: 'REJECTED',
                        })
                        setVisibilityReviewNote('')
                      }}
                    >
                      Reject
                    </Button>
                    <Button
                      type="button"
                      className="bg-gradient-to-br from-[#ff6b35] to-[#ffc947] text-white shadow-sm transition-all hover:brightness-95 hover:shadow-md"
                      onClick={() => {
                        setVisibilityDecisionTarget({
                          request: selectedVisibilityRequest,
                          nextStatus: 'APPROVED',
                        })
                        setVisibilityReviewNote('')
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

      <Dialog
        open={Boolean(visibilityDecisionTarget)}
        onOpenChange={(open) => !open && setVisibilityDecisionTarget(null)}
      >
        <DialogContent>
          {visibilityDecisionTarget && visibilityDialogCopy ? (
            <>
              <DialogHeader>
                <DialogTitle>{visibilityDialogCopy.title}</DialogTitle>
                <DialogDescription>{visibilityDialogCopy.description}</DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="rounded-xl border p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Current live public profile
                  </p>
                  <p className="mt-2 text-sm text-slate-700">
                    {formatVisibilityFieldList(visibilityDecisionTarget.request.liveFieldKeys)}
                  </p>
                </div>

                <div className="rounded-xl border p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Requested public profile
                  </p>
                  <p className="mt-2 text-sm text-slate-700">
                    {formatVisibilityFieldList(visibilityDecisionTarget.request.requestedFieldKeys)}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="visibility-review-note">{visibilityDialogCopy.noteLabel}</Label>
                  <Textarea
                    id="visibility-review-note"
                    rows={4}
                    value={visibilityReviewNote}
                    onChange={(event) => setVisibilityReviewNote(event.target.value)}
                  />
                  {visibilityNoteRequired && visibilityReviewNote.trim().length === 0 ? (
                    <p className="text-xs text-destructive">A review note is required.</p>
                  ) : null}
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  disabled={visibilityDecisionMutation.isPending}
                  onClick={() => setVisibilityDecisionTarget(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant={visibilityDialogCopy.confirmTone}
                  disabled={visibilityDecisionMutation.isPending || !isVisibilityReviewNoteValid}
                  onClick={() => {
                    if (!isVisibilityReviewNoteValid) {
                      return
                    }

                    void visibilityDecisionMutation.mutateAsync({
                      requestId: visibilityDecisionTarget.request.id,
                      status: visibilityDecisionTarget.nextStatus,
                      reviewNote: visibilityReviewNote.trim() || undefined,
                    })
                  }}
                >
                  {visibilityDecisionMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  {visibilityDecisionMutation.isPending
                    ? 'Saving...'
                    : visibilityDialogCopy.confirmLabel}
                </Button>
              </DialogFooter>
            </>
          ) : null}
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

interface VisibilityRequestRowActionsProps {
  request: AdminPublicProfileVisibilityRequestItem
  onViewDetails: () => void
  onOpenEmployee: () => void
  onMarkInReview: () => void
  onApprove: () => void
  onReject: () => void
}

function VisibilityRequestRowActions({
  request,
  onViewDetails,
  onOpenEmployee,
  onMarkInReview,
  onApprove,
  onReject,
}: VisibilityRequestRowActionsProps) {
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
        aria-label={`Actions for visibility request ${request.id}`}
        onClick={() => setIsOpen((current) => !current)}
      >
        <MoreHorizontal className="h-4 w-4" />
      </Button>

      {isOpen ? (
        <div className="absolute right-0 top-10 z-30 w-56 rounded-lg border bg-white p-1 shadow-md">
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
          {isOpenVisibilityRequest(request) ? (
            <>
              {request.status === 'PENDING' ? (
                <ActionMenuItem
                  onClick={() => {
                    setIsOpen(false)
                    onMarkInReview()
                  }}
                >
                  Move to in review
                </ActionMenuItem>
              ) : null}
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
