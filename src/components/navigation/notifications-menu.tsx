import { Bell, CheckCheck, Loader2, RefreshCw } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { ROUTES } from '@/constants/routes'
import { useAuth } from '@/hooks/use-auth'
import { cn } from '@/lib/utils'
import {
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
  useMyNotificationsQuery,
  useUnreadNotificationsCountQuery,
} from '@/services/notificationsService'
import { formatRelativeTime } from '@/utils/date'

export function NotificationsMenu() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [markingId, setMarkingId] = useState<string | null>(null)

  const notificationsQuery = useMyNotificationsQuery(user?.id, { limit: 8 })
  const unreadCountQuery = useUnreadNotificationsCountQuery(user?.id)
  const unreadCount = unreadCountQuery.data ?? 0

  const markReadMutation = useMarkNotificationReadMutation(user?.id, {
    onError: (error) => {
      toast.error(error.message)
    },
  })
  const markAllMutation = useMarkAllNotificationsReadMutation(user?.id, {
    onSuccess: (updatedCount) => {
      if (updatedCount > 0) {
        toast.success(`${updatedCount} notifications marked as read.`)
      }
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handleOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [isOpen])

  const latestNotifications = useMemo(() => notificationsQuery.data ?? [], [notificationsQuery.data])

  const handleItemOpen = async (notificationId: string, link?: string | null) => {
    setMarkingId(notificationId)
    try {
      await markReadMutation.mutateAsync(notificationId)
    } catch {
      // Keep navigation responsive even if mark-as-read fails.
    } finally {
      setMarkingId(null)
    }

    setIsOpen(false)
    if (link) {
      navigate(link)
      return
    }

    navigate(ROUTES.NOTIFICATIONS)
  }

  const handleMarkReadOnly = async (notificationId: string) => {
    setMarkingId(notificationId)
    try {
      await markReadMutation.mutateAsync(notificationId)
    } finally {
      setMarkingId(null)
    }
  }

  return (
    <div className="relative" ref={rootRef}>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Notifications"
        onClick={() => setIsOpen((open) => !open)}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 ? (
          <Badge className="absolute -right-1 -top-1 h-5 min-w-5 rounded-full border-transparent bg-gradient-to-br from-[#ff6b35] to-[#ffc947] px-1 text-[10px] text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        ) : null}
      </Button>

      {isOpen ? (
        <div className="absolute right-0 z-50 mt-2 w-[390px] max-w-[calc(100vw-1.25rem)] overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_22px_45px_-25px_rgba(15,23,42,0.55)]">
          <div className="border-b border-slate-200/70 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">Notifications</p>
                <p className="text-xs text-muted-foreground">Recent alerts and workflow updates.</p>
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 ? (
                  <Badge className="rounded-full border-transparent bg-gradient-to-br from-[#ff6b35] to-[#ffc947] text-white">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Badge>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Refresh notifications"
                  onClick={() => void notificationsQuery.refetch()}
                  disabled={notificationsQuery.isFetching}
                >
                  <RefreshCw className={cn('h-4 w-4', notificationsQuery.isFetching && 'animate-spin')} />
                </Button>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={unreadCount === 0 || markAllMutation.isPending}
                onClick={() => {
                  void markAllMutation.mutateAsync()
                }}
              >
                {markAllMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCheck className="mr-2 h-4 w-4" />
                )}
                Mark all as read
              </Button>
            </div>
          </div>

          <div className="max-h-[420px] space-y-2 overflow-y-auto p-3">
            {notificationsQuery.isPending ? (
              <>
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={`notifications-menu-skeleton-${index}`} className="rounded-xl border p-3">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="mt-2 h-4 w-full" />
                    <Skeleton className="mt-2 h-3 w-24" />
                  </div>
                ))}
              </>
            ) : null}

            {notificationsQuery.isError ? (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3">
                <p className="text-sm text-destructive">{notificationsQuery.error.message}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => void notificationsQuery.refetch()}
                >
                  Retry
                </Button>
              </div>
            ) : null}

            {!notificationsQuery.isPending && !notificationsQuery.isError ? (
              latestNotifications.length === 0 ? (
                <div className="rounded-xl border border-dashed bg-muted/20 p-6 text-center">
                  <p className="text-sm font-medium text-slate-900">You're all caught up</p>
                  <p className="mt-1 text-xs text-muted-foreground">No new notifications.</p>
                </div>
              ) : (
                latestNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    role={notification.link ? 'button' : undefined}
                    tabIndex={notification.link ? 0 : -1}
                    className={cn('rounded-xl border p-3 transition-colors', !notification.isRead ? 'border-slate-300 bg-muted/40' : 'bg-white')}
                    onClick={() => void handleItemOpen(notification.id, notification.link)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        void handleItemOpen(notification.id, notification.link)
                      }
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-1 gap-2.5">
                        <span
                          className={cn(
                            'mt-1 inline-flex h-2.5 w-2.5 rounded-full',
                            !notification.isRead
                              ? 'bg-gradient-to-br from-[#ff6b35] to-[#ffc947]'
                              : 'bg-muted-foreground/40',
                          )}
                        />
                        <div className="min-w-0 space-y-1">
                          <p
                            className={cn(
                              'truncate text-sm',
                              !notification.isRead ? 'font-semibold text-slate-900' : 'font-medium text-slate-700',
                            )}
                          >
                            {notification.title}
                          </p>
                          <p className="line-clamp-2 text-xs text-muted-foreground">
                            {notification.body}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {formatRelativeTime(notification.createdAt)}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <Badge
                          variant={notification.isRead ? 'secondary' : 'outline'}
                          className={cn(!notification.isRead && 'border-[#ff6b35] text-[#ff6b35]', 'text-[10px]')}
                        >
                          {notification.isRead ? 'Read' : 'Unread'}
                        </Badge>
                        {!notification.isRead ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={markReadMutation.isPending && markingId === notification.id}
                            onClick={(event) => {
                              event.stopPropagation()
                              void handleMarkReadOnly(notification.id)
                            }}
                          >
                            {markReadMutation.isPending && markingId === notification.id ? (
                              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                            ) : null}
                            Mark read
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))
              )
            ) : null}
          </div>

          <Separator />

          <div className="p-3">
            <Button asChild className="w-full" variant="outline" size="sm">
              <Link to={ROUTES.NOTIFICATIONS} onClick={() => setIsOpen(false)}>
                View all notifications
              </Link>
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
