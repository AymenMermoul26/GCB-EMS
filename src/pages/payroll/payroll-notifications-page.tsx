import {
  ArrowRight,
  Bell,
  CheckCheck,
  ExternalLink,
  RefreshCw,
} from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import {
  EmptyState,
  ErrorState,
  PageStateSkeleton,
} from '@/components/common/page-state'
import { PageHeader, SURFACE_CARD_CLASS_NAME } from '@/components/common/page-header'
import { StatusBadge } from '@/components/common/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuth } from '@/hooks/use-auth'
import { PayrollLayout } from '@/layouts/payroll-layout'
import {
  formatPayrollChangedFieldsPreview,
  getPayrollNotificationCategoryMeta,
  PAYROLL_CHANGE_FIELD_LABELS,
  useMarkAllPayrollNotificationsReadMutation,
  useMarkPayrollNotificationReadMutation,
  useMyPayrollNotificationsQuery,
  useUnreadPayrollNotificationsCountQuery,
} from '@/services/payrollNotificationsService'
import type { NotificationsFilter } from '@/types/notification'
import type { PayrollNotificationItem } from '@/types/payroll'

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString()
}

export function PayrollNotificationsPage() {
  const { signOut, user } = useAuth()
  const [filter, setFilter] = useState<NotificationsFilter>('all')
  const [selectedNotification, setSelectedNotification] = useState<PayrollNotificationItem | null>(
    null,
  )

  const notificationsQuery = useMyPayrollNotificationsQuery(user?.id, { filter })
  const unreadCountQuery = useUnreadPayrollNotificationsCountQuery(user?.id)
  const markReadMutation = useMarkPayrollNotificationReadMutation(user?.id, {
    onSuccess: (item) => {
      setSelectedNotification((current) =>
        current && current.id === item.id ? { ...current, isRead: true } : current,
      )
    },
  })
  const markAllReadMutation = useMarkAllPayrollNotificationsReadMutation(user?.id, {
    onSuccess: () => {
      setSelectedNotification((current) =>
        current ? { ...current, isRead: true } : current,
      )
    },
  })

  const notifications = notificationsQuery.data ?? []

  const handleInspectNotification = async (notification: PayrollNotificationItem) => {
    setSelectedNotification(notification)

    if (!notification.isRead) {
      try {
        await markReadMutation.mutateAsync(notification.id)
      } catch (error) {
        console.error('Failed to mark payroll notification as read', error)
      }
    }
  }

  const handleMarkAllRead = async () => {
    try {
      await markAllReadMutation.mutateAsync()
    } catch (error) {
      console.error('Failed to mark all payroll notifications as read', error)
    }
  }

  return (
    <PayrollLayout
      title="Payroll Notifications"
      subtitle="Read-only HR change signals relevant to payroll preparation."
      onSignOut={signOut}
      userEmail={user?.email ?? null}
    >
      <PageHeader
        title="Payroll Notifications"
        description="Review payroll-relevant HR changes without admin editing, approval controls, or internal HR notes."
        className="mb-6"
        badges={
          <>
            <StatusBadge tone="neutral" emphasis="outline">
              Read-only feed
            </StatusBadge>
            <StatusBadge tone="brand">
              {unreadCountQuery.data ?? 0} unread
            </StatusBadge>
          </>
        }
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => void notificationsQuery.refetch()}
              disabled={notificationsQuery.isFetching}
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${notificationsQuery.isFetching ? 'animate-spin' : ''}`}
              />
              Refresh
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleMarkAllRead()}
              disabled={(unreadCountQuery.data ?? 0) === 0 || markAllReadMutation.isPending}
            >
              <CheckCheck className="mr-2 h-4 w-4" />
              Mark all as read
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-[220px_auto]">
          <Select value={filter} onValueChange={(value: NotificationsFilter) => setFilter(value)}>
            <SelectTrigger aria-label="Filter payroll notifications">
              <SelectValue placeholder="Filter notifications" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All activity</SelectItem>
              <SelectItem value="unread">Unread only</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center text-sm text-slate-600">
            Signals are summarized per employee event to reduce payroll noise.
          </div>
        </div>
      </PageHeader>

      {notificationsQuery.isError ? (
        <ErrorState
          className="mb-6"
          title="Could not load payroll notifications"
          description="We couldn't load payroll change signals right now."
          message={notificationsQuery.error.message}
          onRetry={() => void notificationsQuery.refetch()}
        />
      ) : null}

      {notificationsQuery.isPending ? <PageStateSkeleton variant="list" count={6} /> : null}

      {!notificationsQuery.isPending &&
      !notificationsQuery.isError &&
      notifications.length === 0 ? (
        <EmptyState
          title={filter === 'unread' ? 'No unread payroll changes' : 'No payroll changes yet'}
          description={
            filter === 'unread'
              ? 'All payroll-relevant HR changes have been reviewed.'
              : 'Payroll-relevant HR changes will appear here once they are recorded.'
          }
        />
      ) : null}

      {!notificationsQuery.isPending &&
      !notificationsQuery.isError &&
      notifications.length > 0 ? (
        <div className="space-y-4">
          {notifications.map((notification) => {
            const categoryMeta = getPayrollNotificationCategoryMeta(notification.category)
            const changedFieldsPreview = formatPayrollChangedFieldsPreview(
              notification.changedFields,
            )

            return (
              <Card
                key={notification.id}
                className={`${SURFACE_CARD_CLASS_NAME} ${notification.isRead ? '' : 'border-[rgb(var(--brand-primary))]/25 bg-[rgb(var(--brand-primary))]/[0.03]'}`}
              >
                <CardContent className="p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge tone={categoryMeta.tone}>{categoryMeta.label}</StatusBadge>
                        {!notification.isRead ? (
                          <StatusBadge tone="brand">Unread</StatusBadge>
                        ) : (
                          <StatusBadge tone="neutral" emphasis="outline">
                            Read
                          </StatusBadge>
                        )}
                      </div>

                      <div className="mt-3 space-y-1">
                        <p className="text-base font-semibold text-slate-950">
                          {notification.employeeName ?? notification.title}
                        </p>
                        <p className="text-sm leading-6 text-slate-600">{notification.summary}</p>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
                        <span>{formatTimestamp(notification.createdAt)}</span>
                        {notification.matricule ? (
                          <span className="font-mono">{notification.matricule}</span>
                        ) : null}
                        {changedFieldsPreview ? (
                          <span>Changed fields: {changedFieldsPreview}</span>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex w-full flex-wrap gap-2 lg:w-auto lg:justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full sm:w-auto"
                        onClick={() => void handleInspectNotification(notification)}
                        disabled={markReadMutation.isPending}
                      >
                        <Bell className="mr-2 h-4 w-4" />
                        Inspect
                      </Button>
                      {notification.link ? (
                        <Button asChild variant="outline" className="w-full sm:w-auto">
                          <Link to={notification.link}>
                            Open employee
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </Link>
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : null}

      <Dialog
        open={Boolean(selectedNotification)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedNotification(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          {selectedNotification ? (
            <>
              <DialogHeader>
                <DialogTitle>{selectedNotification.employeeName ?? 'Payroll change'}</DialogTitle>
                <DialogDescription>{selectedNotification.summary}</DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge tone={getPayrollNotificationCategoryMeta(selectedNotification.category).tone}>
                    {getPayrollNotificationCategoryMeta(selectedNotification.category).label}
                  </StatusBadge>
                  {!selectedNotification.isRead ? (
                    <StatusBadge tone="brand">Unread</StatusBadge>
                  ) : (
                    <StatusBadge tone="neutral" emphasis="outline">
                      Read
                    </StatusBadge>
                  )}
                </div>

                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
                  <p className="text-sm font-medium text-slate-900">Signal details</p>
                  <dl className="mt-3 space-y-2 text-sm text-slate-600">
                    <div className="flex flex-col gap-1 sm:flex-row sm:gap-3">
                      <dt className="min-w-32 text-slate-500">Timestamp</dt>
                      <dd>{formatTimestamp(selectedNotification.createdAt)}</dd>
                    </div>
                    {selectedNotification.matricule ? (
                      <div className="flex flex-col gap-1 sm:flex-row sm:gap-3">
                        <dt className="min-w-32 text-slate-500">Employee ID</dt>
                        <dd className="font-mono">{selectedNotification.matricule}</dd>
                      </div>
                    ) : null}
                  </dl>
                </div>

                <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
                  <p className="text-sm font-medium text-slate-900">Changed fields</p>
                  {selectedNotification.changedFields.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedNotification.changedFields.map((field) => (
                        <StatusBadge
                          key={`${selectedNotification.id}-${field}`}
                          tone="neutral"
                          emphasis="outline"
                        >
                          {PAYROLL_CHANGE_FIELD_LABELS[field]}
                        </StatusBadge>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-slate-600">
                      This signal summarizes an employee availability event for payroll.
                    </p>
                  )}
                </div>
              </div>

              <DialogFooter className="gap-2">
                {selectedNotification.link ? (
                  <Button asChild variant="outline">
                    <Link to={selectedNotification.link}>
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Open employee detail
                    </Link>
                  </Button>
                ) : null}
                {!selectedNotification.isRead ? (
                  <Button
                    type="button"
                    onClick={() => void markReadMutation.mutateAsync(selectedNotification.id)}
                    disabled={markReadMutation.isPending}
                  >
                    <CheckCheck className="mr-2 h-4 w-4" />
                    Mark as read
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
