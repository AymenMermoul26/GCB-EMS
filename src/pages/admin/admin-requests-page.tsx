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
import { useI18n } from '@/hooks/use-i18n'
import type { TranslateFn } from '@/i18n/messages'
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
  getEmployeeVisibilityFieldLabel,
  getPublicProfileVisibilityRequestStatusMeta,
  type AdminPublicProfileVisibilityRequestItem,
  type EmployeeVisibilityFieldKey,
  type PublicProfileVisibilityRequestStatusFilter,
} from '@/types/visibility'
import { getDepartmentDisplayName } from '@/types/department'
import { getRequestFieldLabel, toEmployeeUpdatePayload } from '@/utils/modification-requests'

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

function getModificationStatusLabel(status: DemandeStatut, t: TranslateFn): string {
  return t(`status.modification.${status}`)
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

function fieldLabel(fieldKey: EmployeeVisibilityFieldKey, t: TranslateFn): string {
  return getEmployeeVisibilityFieldLabel(fieldKey, t)
}

function formatVisibilityFieldList(
  fieldKeys: EmployeeVisibilityFieldKey[],
  t: TranslateFn,
): string {
  if (fieldKeys.length === 0) {
    return t('employee.qr.noPublicFields')
  }

  return fieldKeys.map((fieldKey) => fieldLabel(fieldKey, t)).join(', ')
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

function formatRequestSummary(request: ModificationRequest, t: TranslateFn): string {
  const field = getRequestFieldLabel(request.champCible, t)
  const previousValue = request.ancienneValeur ?? '-'
  const nextValue = request.nouvelleValeur ?? '-'
  const motif = request.motif ? ` • ${request.motif}` : ''

  return `${field}: ${previousValue} -> ${nextValue}${motif}`
}

function formatOptionalDate(
  value: string | null,
  locale: string,
  t: TranslateFn,
): string {
  if (!value) {
    return t('common.notReviewed')
  }

  return new Date(value).toLocaleString(locale)
}

function isOpenVisibilityRequest(request: AdminPublicProfileVisibilityRequestItem): boolean {
  return request.status === 'PENDING' || request.status === 'IN_REVIEW'
}

function getVisibilityDecisionDialogCopy(
  nextStatus: VisibilityDecisionStatus,
  t: TranslateFn,
): {
  title: string
  description: string
  confirmLabel: string
  noteLabel: string
  noteRequired: boolean
  confirmTone: 'default' | 'destructive'
} {
  if (nextStatus === 'IN_REVIEW') {
    return {
      title: t('admin.requests.dialogs.visibilityDecision.inReviewTitle'),
      description: t('admin.requests.dialogs.visibilityDecision.inReviewDescription'),
      confirmLabel: t('admin.requests.dialogs.visibilityDecision.inReviewConfirm'),
      noteLabel: t('admin.requests.dialogs.visibilityDecision.inReviewNoteLabel'),
      noteRequired: false,
      confirmTone: 'default',
    }
  }

  if (nextStatus === 'APPROVED') {
    return {
      title: t('admin.requests.dialogs.visibilityDecision.approveTitle'),
      description: t('admin.requests.dialogs.visibilityDecision.approveDescription'),
      confirmLabel: t('admin.requests.dialogs.visibilityDecision.approveConfirm'),
      noteLabel: t('admin.requests.dialogs.visibilityDecision.approveNoteLabel'),
      noteRequired: false,
      confirmTone: 'default',
    }
  }

  return {
    title: t('admin.requests.dialogs.visibilityDecision.rejectTitle'),
    description: t('admin.requests.dialogs.visibilityDecision.rejectDescription'),
    confirmLabel: t('admin.requests.dialogs.visibilityDecision.rejectConfirm'),
    noteLabel: t('admin.requests.dialogs.visibilityDecision.rejectNoteLabel'),
    noteRequired: true,
    confirmTone: 'destructive',
  }
}

export function AdminRequestsPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { t, locale, isRTL } = useI18n()

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
            body: `Your request for ${getRequestFieldLabel(payload.request.champCible)} has been approved.`,
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
        toast.error(error instanceof Error ? error.message : t('admin.requests.toasts.auditLogError'))
      }

      return {
        approvedRequest,
        recipientUserId,
      }
    },
    onSuccess: async (result, variables) => {
      toast.success(t('admin.requests.toasts.approveSuccess'))
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
      toast.error(error instanceof Error ? error.message : t('admin.requests.toasts.approveError'))
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
            body: `Your request for ${getRequestFieldLabel(payload.request.champCible)} was rejected.`,
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
        toast.error(error instanceof Error ? error.message : t('admin.requests.toasts.auditLogError'))
      }

      return {
        rejectedRequest,
        recipientUserId,
      }
    },
    onSuccess: async (result, variables) => {
      toast.success(t('admin.requests.toasts.rejectSuccess'))
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
      toast.error(error instanceof Error ? error.message : t('admin.requests.toasts.rejectError'))
    },
  })

  const visibilityDecisionMutation = useUpdatePublicProfileVisibilityRequestStatusMutation({
    onSuccess: (_data, variables) => {
      if (variables.status === 'IN_REVIEW') {
        toast.success(t('admin.requests.toasts.visibilityInReviewSuccess'))
      } else if (variables.status === 'APPROVED') {
        toast.success(t('admin.requests.toasts.visibilityApproveSuccess'))
      } else {
        toast.success(t('admin.requests.toasts.visibilityRejectSuccess'))
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
        getRequestFieldLabel(request.champCible, t),
        request.motif ?? '',
      ]
        .join(' ')
        .toLowerCase()

      return searchTarget.includes(term)
    })
  }, [baseItems, debouncedSearch, t])

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
    ? getVisibilityDecisionDialogCopy(visibilityDecisionTarget.nextStatus, t)
    : null
  const visibilityNoteRequired = visibilityDialogCopy?.noteRequired ?? false
  const isVisibilityReviewNoteValid =
    !visibilityNoteRequired || visibilityReviewNote.trim().length > 0

  return (
    <DashboardLayout
      title={t('admin.requests.title')}
      subtitle={t('admin.requests.subtitle')}
    >
      <PageHeader
        title={t('admin.requests.title')}
        description={t('admin.requests.description')}
        className="sticky top-2 z-20 mb-6"
        badges={
          <>
            <StatusBadge tone="warning" emphasis="solid">
              {t('admin.requests.badges.profilePending', { count: pendingCount })}
            </StatusBadge>
            <StatusBadge tone="warning" emphasis="solid">
              {t('admin.requests.badges.visibilityPending', { count: pendingVisibilityCount })}
            </StatusBadge>
            <StatusBadge
              tone={totalOpenCount > 0 ? 'danger' : 'neutral'}
              emphasis={totalOpenCount > 0 ? 'solid' : 'soft'}
            >
              {t('admin.requests.badges.openTotal', { count: totalOpenCount })}
            </StatusBadge>
          </>
        }
        actions={
          <>
            <div className="relative w-full sm:w-72">
              <Search
                className={cn(
                  'pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground',
                  isRTL ? 'right-3' : 'left-3',
                )}
              />
              <Input
                value={searchInput}
                onChange={(event) => {
                  setSearchInput(event.target.value)
                  setPage(1)
                }}
                placeholder={t('admin.requests.searchPlaceholder')}
                className={cn(isRTL ? 'pr-9' : 'pl-9')}
                aria-label={t('admin.requests.searchAria')}
              />
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => setIsFilterDialogOpen(true)}
              aria-label={t('admin.requests.openFiltersAria')}
            >
              <Filter className={cn('h-4 w-4', isRTL ? 'ml-2' : 'mr-2')} />
              {t('actions.filters')}
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
                className={`${isRTL ? 'ml-2' : 'mr-2'} h-4 w-4 ${
                  requestsQuery.isFetching || visibilityRequestsQuery.isFetching
                    ? 'animate-spin'
                    : ''
                }`}
              />
              {t('actions.refresh')}
            </Button>
          </>
        }
      />

      <div className="space-y-4">
        <Card className="rounded-2xl border border-slate-200/80 shadow-sm">
          <CardHeader className="space-y-1">
            <CardTitle className="text-base font-semibold">
              {t('admin.requests.profileQueue.title')}
            </CardTitle>
            <CardDescription>
              {t('admin.requests.profileQueue.description')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {requestsQuery.isError ? (
              <ErrorState
                surface="plain"
                title={t('admin.requests.profileQueue.loadErrorTitle')}
                description={t('admin.requests.profileQueue.loadErrorDescription')}
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
                      <TableHead>{t('admin.requests.tables.employee')}</TableHead>
                      <TableHead>{t('admin.requests.tables.requestSummary')}</TableHead>
                      <TableHead>{t('admin.requests.tables.status')}</TableHead>
                      <TableHead>{t('admin.requests.tables.submitted')}</TableHead>
                      <TableHead className={cn('w-[260px]', isRTL ? 'text-left' : 'text-right')}>
                        {t('admin.requests.tables.actions')}
                      </TableHead>
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
                      title={t('admin.requests.profileQueue.searchEmptyTitle')}
                      description={t('admin.requests.profileQueue.searchEmptyDescription')}
                      actions={
                        <Button type="button" variant="outline" onClick={resetFilters}>
                          {t('actions.clearFilters')}
                        </Button>
                      }
                    />
                ) : (
                    <EmptyState
                      surface="plain"
                      className="py-8"
                      title={t('admin.requests.profileQueue.emptyTitle')}
                      description={t('admin.requests.profileQueue.emptyDescription')}
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
                        <TableHead>{t('admin.requests.tables.employee')}</TableHead>
                        <TableHead>{t('admin.requests.tables.requestSummary')}</TableHead>
                        <TableHead>{t('admin.requests.tables.status')}</TableHead>
                        <TableHead>{t('admin.requests.tables.submitted')}</TableHead>
                        <TableHead className={cn('w-[260px]', isRTL ? 'text-left' : 'text-right')}>
                          {t('admin.requests.tables.actions')}
                        </TableHead>
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
                              {formatRequestSummary(request, t)}
                            </p>
                          </TableCell>
                          <TableCell>
                            <StatusBadge
                              tone={getModificationStatusTone(request.statutDemande)}
                              emphasis="solid"
                            >
                              {getModificationStatusLabel(request.statutDemande, t)}
                            </StatusBadge>
                          </TableCell>
                          <TableCell>{new Date(request.createdAt).toLocaleString(locale)}</TableCell>
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
                                    <CheckCircle2 className={cn('h-4 w-4', isRTL ? 'ml-1' : 'mr-1')} />
                                    {t('actions.approve')}
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
                                    <XCircle className={cn('h-4 w-4', isRTL ? 'ml-1' : 'mr-1')} />
                                    {t('actions.reject')}
                                  </Button>
                                </>
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  {t('admin.requests.tables.processed')}
                                </span>
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
                    {t(
                      isSearching
                        ? 'admin.requests.tables.showingSearch'
                        : 'admin.requests.tables.showing',
                      {
                        from: showingFrom,
                        to: showingTo,
                        total,
                        suffix: t('common.searchAppliedCurrentPage'),
                      },
                    )}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === 1 || requestsQuery.isFetching}
                      onClick={() => setPage((value) => Math.max(1, value - 1))}
                    >
                      {t('actions.previous')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={showingTo >= total || requestsQuery.isFetching}
                      onClick={() => setPage((value) => value + 1)}
                    >
                      {t('actions.next')}
                    </Button>
                  </div>
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-slate-200/80 shadow-sm">
          <CardHeader className="space-y-1">
            <CardTitle className="text-base font-semibold">
              {t('admin.requests.visibilityQueue.title')}
            </CardTitle>
            <CardDescription>
              {t('admin.requests.visibilityQueue.description')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {visibilityRequestsQuery.isError ? (
              <ErrorState
                surface="plain"
                title={t('admin.requests.visibilityQueue.loadErrorTitle')}
                description={t('admin.requests.visibilityQueue.loadErrorDescription')}
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
                      <TableHead>{t('admin.requests.tables.employee')}</TableHead>
                      <TableHead>{t('admin.requests.tables.livePublicProfile')}</TableHead>
                      <TableHead>{t('admin.requests.tables.requestedVisibility')}</TableHead>
                      <TableHead>{t('admin.requests.tables.status')}</TableHead>
                      <TableHead>{t('admin.requests.tables.submitted')}</TableHead>
                      <TableHead className={cn('w-[320px]', isRTL ? 'text-left' : 'text-right')}>
                        {t('admin.requests.tables.actions')}
                      </TableHead>
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
                        <TableHead>{t('admin.requests.tables.employee')}</TableHead>
                        <TableHead>{t('admin.requests.tables.livePublicProfile')}</TableHead>
                        <TableHead>{t('admin.requests.tables.requestedVisibility')}</TableHead>
                        <TableHead>{t('admin.requests.tables.status')}</TableHead>
                        <TableHead>{t('admin.requests.tables.submitted')}</TableHead>
                        <TableHead className={cn('w-[320px]', isRTL ? 'text-left' : 'text-right')}>
                          {t('admin.requests.tables.actions')}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibilityItems.map((request) => {
                        const statusMeta = getPublicProfileVisibilityRequestStatusMeta(request.status, t)
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
                                {formatVisibilityFieldList(request.liveFieldKeys, t)}
                              </p>
                            </TableCell>
                            <TableCell>
                              <p className="[display:-webkit-box] overflow-hidden text-sm text-slate-700 [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
                                {formatVisibilityFieldList(request.requestedFieldKeys, t)}
                              </p>
                            </TableCell>
                            <TableCell>
                              <StatusBadge tone={statusMeta.tone} emphasis="solid">
                                {statusMeta.label}
                              </StatusBadge>
                            </TableCell>
                            <TableCell>{new Date(request.createdAt).toLocaleString(locale)}</TableCell>
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
                                        <Clock3 className={cn('h-4 w-4', isRTL ? 'ml-1' : 'mr-1')} />
                                        {t('actions.markInReview')}
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
                                      <CheckCircle2 className={cn('h-4 w-4', isRTL ? 'ml-1' : 'mr-1')} />
                                      {t('actions.approve')}
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
                                      <XCircle className={cn('h-4 w-4', isRTL ? 'ml-1' : 'mr-1')} />
                                      {t('actions.reject')}
                                    </Button>
                                  </>
                                ) : (
                                  <span className="text-xs text-muted-foreground">
                                    {t('admin.requests.tables.processed')}
                                  </span>
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
                      title={t('admin.requests.visibilityQueue.searchEmptyTitle')}
                      description={t('admin.requests.visibilityQueue.searchEmptyDescription')}
                      actions={
                        <Button type="button" variant="outline" onClick={resetFilters}>
                          {t('actions.clearFilters')}
                        </Button>
                      }
                    />
                  ) : (
                    <EmptyState
                      surface="plain"
                      className="py-8"
                      title={t('admin.requests.visibilityQueue.emptyTitle')}
                      description={t('admin.requests.visibilityQueue.emptyDescription')}
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
              {t('admin.requests.notifications.title')}
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
                title={t('admin.requests.notifications.loadErrorTitle')}
                description={t('admin.requests.notifications.loadErrorDescription')}
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
                            {t('actions.markRead')}
                          </Button>
                        ) : (
                          <StatusBadge tone="neutral" emphasis="soft">{t('common.read')}</StatusBadge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  surface="plain"
                  title={t('admin.requests.notifications.emptyTitle')}
                  description={t('admin.requests.notifications.emptyDescription')}
                />
              )
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isFilterDialogOpen} onOpenChange={setIsFilterDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('admin.requests.filters.title')}</DialogTitle>
            <DialogDescription>
              {t('admin.requests.filters.description')}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="requests-status-filter">{t('admin.requests.filters.profileStatus')}</Label>
              <Select
                value={statusFilter}
                onValueChange={(value: ModificationStatusFilter) => {
                  setStatusFilter(value)
                  setPage(1)
                }}
              >
                <SelectTrigger id="requests-status-filter">
                  <SelectValue placeholder={t('admin.requests.filters.statusPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{t('common.allStatuses')}</SelectItem>
                  <SelectItem value="EN_ATTENTE">{t('status.modification.EN_ATTENTE')}</SelectItem>
                  <SelectItem value="ACCEPTEE">{t('status.modification.ACCEPTEE')}</SelectItem>
                  <SelectItem value="REJETEE">{t('status.modification.REJETEE')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="visibility-requests-status-filter">
                {t('admin.requests.filters.visibilityStatus')}
              </Label>
              <Select
                value={visibilityStatusFilter}
                onValueChange={(value: PublicProfileVisibilityRequestStatusFilter) => {
                  setVisibilityStatusFilter(value)
                  setPage(1)
                }}
              >
                <SelectTrigger id="visibility-requests-status-filter">
                  <SelectValue placeholder={t('admin.requests.filters.visibilityPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{t('common.allStatuses')}</SelectItem>
                  <SelectItem value="PENDING">{t('status.visibility.PENDING')}</SelectItem>
                  <SelectItem value="IN_REVIEW">{t('status.visibility.IN_REVIEW')}</SelectItem>
                  <SelectItem value="APPROVED">{t('status.visibility.APPROVED')}</SelectItem>
                  <SelectItem value="REJECTED">{t('status.visibility.REJECTED')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="requests-department-filter">{t('admin.requests.filters.department')}</Label>
              <Select
                value={departmentFilter}
                onValueChange={(value) => {
                  setDepartmentFilter(value)
                  setPage(1)
                }}
              >
                <SelectTrigger id="requests-department-filter">
                  <SelectValue placeholder={t('admin.requests.filters.departmentPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('common.allDepartments')}</SelectItem>
                    {(departmentsQuery.data ?? []).map((department) => (
                      <SelectItem key={department.id} value={department.id}>
                        {getDepartmentDisplayName(department.nom) ?? department.nom}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="requests-page-size-filter">{t('admin.requests.filters.profilePageSize')}</Label>
              <Select
                value={String(pageSize)}
                onValueChange={(value) => {
                  setPageSize(Number(value))
                  setPage(1)
                }}
              >
                <SelectTrigger id="requests-page-size-filter">
                  <SelectValue placeholder={t('admin.requests.filters.pageSizePlaceholder')} />
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
              {t('actions.clearFilters')}
            </Button>
            <Button type="button" onClick={() => setIsFilterDialogOpen(false)}>
              {t('actions.apply')}
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
                    {getModificationStatusLabel(selectedRequest.statutDemande, t)}
                  </StatusBadge>
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="rounded-xl border p-3">
                  <p className="text-sm font-medium">{t('admin.requests.detail.requestDetails')}</p>
                  <p className="mt-2 text-sm text-slate-700">
                    {t('employee.requests.targetField')}: {getRequestFieldLabel(selectedRequest.champCible, t)}
                  </p>
                  <p className="mt-1 text-sm text-slate-700">
                    {t('admin.requests.dialogs.request.previousValue')}: {selectedRequest.ancienneValeur ?? '-'}
                  </p>
                  <p className="mt-1 text-sm text-slate-700">
                    {t('admin.requests.dialogs.request.newValue')}: {selectedRequest.nouvelleValeur ?? '-'}
                  </p>
                  {selectedRequest.motif ? (
                    <p className="mt-1 text-sm text-slate-700">
                      {t('admin.requests.dialogs.request.employeeReason')}: {selectedRequest.motif}
                    </p>
                  ) : null}
                </div>

                <div className="rounded-xl border p-3">
                  <p className="text-sm font-medium">{t('admin.requests.detail.metadata')}</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {t('admin.requests.dialogs.request.submitted', {
                      value: new Date(selectedRequest.createdAt).toLocaleString(locale),
                    })}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t('admin.requests.dialogs.request.reviewed', {
                      value: formatOptionalDate(selectedRequest.traiteAt, locale, t),
                    })}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t('admin.requests.dialogs.request.reviewedBy', {
                      value: selectedRequest.traiteParUserId ?? t('common.notAssigned'),
                    })}
                  </p>
                </div>

                {selectedRequest.commentaireTraitement ? (
                  <div className="rounded-xl border p-3">
                    <p className="text-sm font-medium">{t('admin.requests.detail.decisionReason')}</p>
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
                  <ExternalLink className={cn('h-4 w-4', isRTL ? 'ml-2' : 'mr-2')} />
                  {t('actions.openEmployeeProfile')}
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
                      {t('actions.reject')}
                    </Button>
                    <Button
                      type="button"
                      className="bg-gradient-to-br from-[#ff6b35] to-[#ffc947] text-white shadow-sm transition-all hover:brightness-95 hover:shadow-md"
                      onClick={() => {
                        setApproveTarget(selectedRequest)
                        setApproveComment('')
                      }}
                    >
                      {t('actions.approve')}
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t('admin.requests.dialogs.request.alreadyProcessed')}
                  </p>
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
                    tone={getPublicProfileVisibilityRequestStatusMeta(selectedVisibilityRequest.status, t).tone}
                    emphasis="solid"
                  >
                    {getPublicProfileVisibilityRequestStatusMeta(selectedVisibilityRequest.status, t).label}
                  </StatusBadge>
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border p-3">
                    <p className="text-sm font-medium">
                      {t('admin.requests.dialogs.visibility.publishedWhenRequested')}
                    </p>
                    <p className="mt-2 text-sm text-slate-700">
                      {formatVisibilityFieldList(selectedVisibilityRequest.currentFieldKeys, t)}
                    </p>
                  </div>
                  <div className="rounded-xl border p-3">
                    <p className="text-sm font-medium">
                      {t('admin.requests.dialogs.visibility.currentLivePublicProfile')}
                    </p>
                    <p className="mt-2 text-sm text-slate-700">
                      {formatVisibilityFieldList(selectedVisibilityRequest.liveFieldKeys, t)}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border p-3">
                  <p className="text-sm font-medium">
                    {t('admin.requests.dialogs.visibility.requestedPublicVisibility')}
                  </p>
                  <p className="mt-2 text-sm text-slate-700">
                    {formatVisibilityFieldList(selectedVisibilityRequest.requestedFieldKeys, t)}
                  </p>
                </div>

                {selectedVisibilityRequest.requestNote ? (
                  <div className="rounded-xl border p-3">
                    <p className="text-sm font-medium">
                      {t('admin.requests.dialogs.visibility.employeeNote')}
                    </p>
                    <p className="mt-2 text-sm text-slate-700">{selectedVisibilityRequest.requestNote}</p>
                  </div>
                ) : null}

                <div className="rounded-xl border p-3">
                  <p className="text-sm font-medium">{t('admin.requests.detail.metadata')}</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {t('admin.requests.dialogs.visibility.submitted', {
                      value: new Date(selectedVisibilityRequest.createdAt).toLocaleString(locale),
                    })}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t('admin.requests.dialogs.visibility.reviewed', {
                      value: formatOptionalDate(selectedVisibilityRequest.reviewedAt, locale, t),
                    })}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t('admin.requests.dialogs.visibility.reviewedBy', {
                      value: selectedVisibilityRequest.reviewedByUserId ?? t('common.notAssigned'),
                    })}
                  </p>
                </div>

                {selectedVisibilityRequest.reviewNote ? (
                  <div className="rounded-xl border p-3">
                    <p className="text-sm font-medium">
                      {t('admin.requests.dialogs.visibility.hrReviewNote')}
                    </p>
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
                  <ExternalLink className={cn('h-4 w-4', isRTL ? 'ml-2' : 'mr-2')} />
                  {t('actions.openEmployeeProfile')}
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
                        {t('actions.markInReview')}
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
                      {t('actions.reject')}
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
                      {t('actions.approve')}
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t('admin.requests.dialogs.visibility.alreadyProcessed')}
                  </p>
                )}
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(approveTarget)} onOpenChange={(open) => !open && setApproveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.requests.dialogs.approve.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin.requests.dialogs.approve.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="approve-comment">{t('admin.requests.dialogs.approve.commentOptional')}</Label>
            <Textarea
              id="approve-comment"
              rows={3}
              value={approveComment}
              onChange={(event) => setApproveComment(event.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={approveMutation.isPending}>
              {t('actions.cancel')}
            </AlertDialogCancel>
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
                <Loader2 className={cn('h-4 w-4 animate-spin', isRTL ? 'ml-2' : 'mr-2')} />
              ) : null}
              {approveMutation.isPending
                ? t('admin.requests.dialogs.approve.confirming')
                : t('admin.requests.dialogs.approve.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={Boolean(rejectTarget)} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.requests.dialogs.reject.title')}</DialogTitle>
            <DialogDescription>
              {t('admin.requests.dialogs.reject.description')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="reject-comment">{t('admin.requests.dialogs.reject.commentLabel')}</Label>
            <Textarea
              id="reject-comment"
              rows={4}
              value={rejectComment}
              onChange={(event) => setRejectComment(event.target.value)}
            />
            {rejectComment.trim().length === 0 ? (
              <p className="text-xs text-destructive">
                {t('admin.requests.dialogs.reject.commentRequired')}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)} disabled={rejectMutation.isPending}>
              {t('actions.cancel')}
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
              {rejectMutation.isPending ? (
                <Loader2 className={cn('h-4 w-4 animate-spin', isRTL ? 'ml-2' : 'mr-2')} />
              ) : null}
              {rejectMutation.isPending
                ? t('admin.requests.dialogs.reject.rejecting')
                : t('admin.requests.dialogs.reject.confirm')}
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
                    {t('admin.requests.dialogs.visibilityDecision.currentLivePublicProfile')}
                  </p>
                  <p className="mt-2 text-sm text-slate-700">
                    {formatVisibilityFieldList(visibilityDecisionTarget.request.liveFieldKeys, t)}
                  </p>
                </div>

                <div className="rounded-xl border p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    {t('admin.requests.dialogs.visibilityDecision.requestedPublicProfile')}
                  </p>
                  <p className="mt-2 text-sm text-slate-700">
                    {formatVisibilityFieldList(visibilityDecisionTarget.request.requestedFieldKeys, t)}
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
                    <p className="text-xs text-destructive">
                      {t('admin.requests.dialogs.visibilityDecision.reviewNoteRequired')}
                    </p>
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
                  {t('actions.cancel')}
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
                    <Loader2 className={cn('h-4 w-4 animate-spin', isRTL ? 'ml-2' : 'mr-2')} />
                  ) : null}
                  {visibilityDecisionMutation.isPending
                    ? t('admin.requests.dialogs.visibilityDecision.saving')
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
  const { t } = useI18n()
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
        aria-label={`${t('admin.requests.tables.actions')} ${request.id}`}
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
            {t('actions.viewDetails')}
          </ActionMenuItem>
          <ActionMenuItem
            onClick={() => {
              setIsOpen(false)
              onOpenEmployee()
            }}
          >
            {t('actions.openEmployeeProfile')}
          </ActionMenuItem>
          {request.statutDemande === 'EN_ATTENTE' ? (
            <>
              <ActionMenuItem
                onClick={() => {
                  setIsOpen(false)
                  onApprove()
                }}
              >
                {t('actions.approve')}
              </ActionMenuItem>
              <ActionMenuItem
                className="text-destructive hover:bg-destructive/10"
                onClick={() => {
                  setIsOpen(false)
                  onReject()
                }}
              >
                {t('actions.reject')}
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
  const { t } = useI18n()
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
        aria-label={`${t('admin.requests.tables.actions')} ${request.id}`}
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
            {t('actions.viewDetails')}
          </ActionMenuItem>
          <ActionMenuItem
            onClick={() => {
              setIsOpen(false)
              onOpenEmployee()
            }}
          >
            {t('actions.openEmployeeProfile')}
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
                  {t('actions.markInReview')}
                </ActionMenuItem>
              ) : null}
              <ActionMenuItem
                onClick={() => {
                  setIsOpen(false)
                  onApprove()
                }}
              >
                {t('actions.approve')}
              </ActionMenuItem>
              <ActionMenuItem
                className="text-destructive hover:bg-destructive/10"
                onClick={() => {
                  setIsOpen(false)
                  onReject()
                }}
              >
                {t('actions.reject')}
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
