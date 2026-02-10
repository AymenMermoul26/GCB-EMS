import { Bell, CheckCheck, Loader2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { DashboardLayout } from '@/layouts/dashboard-layout'
import { useAuth } from '@/hooks/use-auth'
import {
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
  useMyNotificationsQuery,
  useUnreadNotificationsCountQuery,
} from '@/services/notificationsService'

export function NotificationsPage() {
  const { user } = useAuth()
  const notificationsQuery = useMyNotificationsQuery(user?.id)
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

  return (
    <DashboardLayout
      title="My Notifications"
      subtitle="Track workflow updates and system messages."
    >
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Notifications
            {unreadCount > 0 ? (
              <Badge className="border-transparent bg-red-600 text-white">{unreadCount}</Badge>
            ) : null}
          </CardTitle>
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
        </CardHeader>
        <CardContent className="space-y-3">
          {notificationsQuery.isPending ? (
            <>
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </>
          ) : null}

          {notificationsQuery.isError ? (
            <div className="space-y-2">
              <p className="text-sm text-destructive">{notificationsQuery.error.message}</p>
              <Button variant="outline" size="sm" onClick={() => void notificationsQuery.refetch()}>
                Retry
              </Button>
            </div>
          ) : null}

          {!notificationsQuery.isPending && !notificationsQuery.isError ? (
            notificationsQuery.data && notificationsQuery.data.length > 0 ? (
              notificationsQuery.data.map((notification) => (
                <div key={notification.id} className="rounded-md border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm font-medium">{notification.title}</p>
                      <p className="text-sm text-muted-foreground">{notification.body}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(notification.createdAt).toLocaleString()}
                      </p>
                      {notification.link ? (
                        <Link to={notification.link} className="text-xs text-primary hover:underline">
                          Open related page
                        </Link>
                      ) : null}
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
                        Mark as read
                      </Button>
                    ) : (
                      <Badge variant="secondary">Read</Badge>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                No notifications yet.
              </div>
            )
          ) : null}
        </CardContent>
      </Card>
    </DashboardLayout>
  )
}
