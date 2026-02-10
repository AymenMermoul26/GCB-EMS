import { Bell, CheckCheck, Loader2 } from 'lucide-react'
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

  const notificationsQuery = useMyNotificationsQuery(user?.id, { limit: 5 })
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
    try {
      await markReadMutation.mutateAsync(notificationId)
    } catch {
      // Keep navigation responsive even if mark-as-read fails.
    }

    setIsOpen(false)
    if (link) {
      navigate(link)
      return
    }

    navigate(ROUTES.NOTIFICATIONS)
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
          <Badge className="absolute -right-1 -top-1 h-5 min-w-5 rounded-full border-transparent bg-red-600 px-1 text-[10px] text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        ) : null}
      </Button>

      {isOpen ? (
        <div className="absolute right-0 z-50 mt-2 w-[360px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-md border bg-background shadow-lg">
          <div className="flex items-center justify-between p-3">
            <p className="text-sm font-semibold">Notifications</p>
            <Button
              type="button"
              variant="ghost"
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
              Mark all
            </Button>
          </div>
          <Separator />

          <div className="max-h-96 space-y-2 overflow-y-auto p-3">
            {notificationsQuery.isPending ? (
              <>
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </>
            ) : null}

            {notificationsQuery.isError ? (
              <p className="text-sm text-destructive">{notificationsQuery.error.message}</p>
            ) : null}

            {!notificationsQuery.isPending && !notificationsQuery.isError ? (
              latestNotifications.length === 0 ? (
                <p className="text-sm text-muted-foreground">No notifications yet.</p>
              ) : (
                latestNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={cn(
                      'rounded-md border p-2',
                      !notification.isRead && 'border-primary/40 bg-primary/5',
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <button
                          type="button"
                          className="truncate text-left text-sm font-medium hover:underline"
                          onClick={() => void handleItemOpen(notification.id, notification.link)}
                        >
                          {notification.title}
                        </button>
                        <p className="line-clamp-2 text-xs text-muted-foreground">
                          {notification.body}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {formatRelativeTime(notification.createdAt)}
                        </p>
                      </div>
                      {!notification.isRead ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={markReadMutation.isPending}
                          onClick={() => {
                            void markReadMutation.mutateAsync(notification.id)
                          }}
                        >
                          Read
                        </Button>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">
                          Read
                        </Badge>
                      )}
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
                Open All Notifications
              </Link>
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
