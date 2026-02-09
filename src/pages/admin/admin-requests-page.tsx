import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, CheckCircle2, Loader2, XCircle } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { ROUTES } from '@/constants/routes'
import { useAuth } from '@/hooks/use-auth'
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
import { requestsService, useAdminRequestsQuery } from '@/services/requestsService'
import type { DemandeStatut, ModificationRequest } from '@/types/modification-request'
import { REQUEST_FIELD_LABELS, toEmployeeUpdatePayload } from '@/utils/modification-requests'

type StatusFilter = DemandeStatut | 'ALL'

function getStatusVariant(status: DemandeStatut): 'secondary' | 'outline' {
  if (status === 'ACCEPTEE') {
    return 'secondary'
  }

  return 'outline'
}

function getStatusClassName(status: DemandeStatut): string {
  return status === 'REJETEE' ? 'border-destructive text-destructive' : ''
}

function formatEmployeeName(request: ModificationRequest) {
  if (request.employePrenom || request.employeNom) {
    return `${request.employePrenom ?? ''} ${request.employeNom ?? ''}`.trim()
  }

  return request.employeId
}

export function AdminRequestsPage() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('EN_ATTENTE')
  const [departmentFilter, setDepartmentFilter] = useState<string>('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [approveTarget, setApproveTarget] = useState<ModificationRequest | null>(null)
  const [approveComment, setApproveComment] = useState('')
  const [rejectTarget, setRejectTarget] = useState<ModificationRequest | null>(null)
  const [rejectComment, setRejectComment] = useState('')

  const departmentsQuery = useDepartmentsQuery()
  const notificationsQuery = useMyNotificationsQuery(user?.id)
  const unreadNotificationsCountQuery = useUnreadNotificationsCountQuery(user?.id)

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

  const total = requestsQuery.data?.total ?? 0
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = total === 0 ? 0 : Math.min(page * pageSize, total)

  return (
    <DashboardLayout
      title="Modification Requests"
      subtitle="Review and process employee profile change requests."
    >
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-4">
            <Select
              value={statusFilter}
              onValueChange={(value: StatusFilter) => {
                setStatusFilter(value)
                setPage(1)
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All statuses</SelectItem>
                <SelectItem value="EN_ATTENTE">EN_ATTENTE</SelectItem>
                <SelectItem value="ACCEPTEE">ACCEPTEE</SelectItem>
                <SelectItem value="REJETEE">REJETEE</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={departmentFilter}
              onValueChange={(value) => {
                setDepartmentFilter(value)
                setPage(1)
              }}
            >
              <SelectTrigger>
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

            <Select
              value={String(pageSize)}
              onValueChange={(value) => {
                setPageSize(Number(value))
                setPage(1)
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Page size" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Requests</CardTitle>
        </CardHeader>
        <CardContent>
          {requestsQuery.isPending ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : null}

          {requestsQuery.isError ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {requestsQuery.error.message}
            </div>
          ) : null}

          {!requestsQuery.isPending && !requestsQuery.isError && requestsQuery.data ? (
            requestsQuery.data.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">No requests found.</p>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Field</TableHead>
                      <TableHead>Old</TableHead>
                      <TableHead>New</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="w-[210px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requestsQuery.data.items.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell>
                          <div className="text-sm font-medium">{formatEmployeeName(request)}</div>
                          <div className="text-xs text-muted-foreground">
                            {request.employeMatricule ?? request.employeId}
                            {request.employeDepartementNom
                              ? ` · ${request.employeDepartementNom}`
                              : ''}
                          </div>
                        </TableCell>
                        <TableCell>{REQUEST_FIELD_LABELS[request.champCible]}</TableCell>
                        <TableCell>{request.ancienneValeur ?? '-'}</TableCell>
                        <TableCell>{request.nouvelleValeur ?? '-'}</TableCell>
                        <TableCell>
                          <Badge
                            variant={getStatusVariant(request.statutDemande)}
                            className={getStatusClassName(request.statutDemande)}
                          >
                            {request.statutDemande}
                          </Badge>
                        </TableCell>
                        <TableCell>{new Date(request.createdAt).toLocaleString()}</TableCell>
                        <TableCell>
                          {request.statutDemande === 'EN_ATTENTE' ? (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
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
                                variant="destructive"
                                onClick={() => {
                                  setRejectTarget(request)
                                  setRejectComment('')
                                }}
                              >
                                <XCircle className="mr-1 h-4 w-4" />
                                Reject
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">Processed</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Showing {from}-{to} of {total}
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
                      disabled={to >= total || requestsQuery.isFetching}
                      onClick={() => setPage((value) => value + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </>
            )
          ) : null}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
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
              Confirm approval
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
              Reject request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}

