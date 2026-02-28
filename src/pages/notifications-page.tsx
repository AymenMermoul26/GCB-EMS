import { Bell, CheckCheck, Loader2, MoreHorizontal, RefreshCw, Search } from 'lucide-react'
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

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
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DashboardLayout } from '@/layouts/dashboard-layout'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'
import {
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
  useMyNotificationsQuery,
  useUnreadNotificationsCountQuery,
} from '@/services/notificationsService'
import type { NotificationItem, NotificationsFilter } from '@/types/notification'
import { formatRelativeTime } from '@/utils/date'

type ViewFilter = 'all' | 'unread' | 'read'
type NotificationGroupLabel = 'Today' | 'Yesterday' | 'Older'

interface NotificationGroup {
  label: NotificationGroupLabel
  items: NotificationItem[]
}

function getGroupLabel(createdAt: string): NotificationGroupLabel {
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfYesterday = new Date(startOfToday)
  startOfYesterday.setDate(startOfYesterday.getDate() - 1)

  const created = new Date(createdAt)
  if (created >= startOfToday) {
    return 'Today'
  }

  if (created >= startOfYesterday) {
    return 'Yesterday'
  }

  return 'Older'
}

function buildNotificationGroups(notifications: NotificationItem[]): NotificationGroup[] {
  const orderedLabels: NotificationGroupLabel[] = ['Today', 'Yesterday', 'Older']
  const grouped = new Map<NotificationGroupLabel, NotificationItem[]>([
    ['Today', []],
    ['Yesterday', []],
    ['Older', []],
  ])

  for (const notification of notifications) {
    const label = getGroupLabel(notification.createdAt)
    grouped.get(label)?.push(notification)
  }

  return orderedLabels
    .map((label) => ({ label, items: grouped.get(label) ?? [] }))
    .filter((group) => group.items.length > 0)
}

export function NotificationsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [viewFilter, setViewFilter] = useState<ViewFilter>('all')
  const [searchInput, setSearchInput] = useState('')
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false)
  const [markingNotificationId, setMarkingNotificationId] = useState<string | null>(null)

  const backendFilter: NotificationsFilter = viewFilter === 'unread' ? 'unread' : 'all'
  const notificationsQuery = useMyNotificationsQuery(user?.id, { filter: backendFilter })
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

  const allNotifications = useMemo(
    () => notificationsQuery.data ?? [],
    [notificationsQuery.data],
  )
  const normalizedSearch = searchInput.trim().toLowerCase()

  const visibleNotifications = useMemo(() => {
    return allNotifications.filter((notification) => {
      if (viewFilter === 'unread' && notification.isRead) {
        return false
      }

      if (viewFilter === 'read' && !notification.isRead) {
        return false
      }

      if (!normalizedSearch) {
        return true
      }

      const target = `${notification.title} ${notification.body}`.toLowerCase()
      return target.includes(normalizedSearch)
    })
  }, [allNotifications, normalizedSearch, viewFilter])

  const groupedNotifications = useMemo(
    () => buildNotificationGroups(visibleNotifications),
    [visibleNotifications],
  )

  const totalCount = allNotifications.length
  const isMarkAllDisabled = unreadCount === 0 || markAllMutation.isPending

  const clearFilters = () => {
    setViewFilter('all')
    setSearchInput('')
    setIsFilterDialogOpen(false)
  }

  const navigateToNotificationLink = (notification: NotificationItem) => {
    if (!notification.link) {
      return
    }

    navigate(notification.link)
  }

  const handleMarkAsRead = async (notificationId: string) => {
    setMarkingNotificationId(notificationId)
    try {
      await markReadMutation.mutateAsync(notificationId)
    } finally {
      setMarkingNotificationId(null)
    }
  }

  return (
    <DashboardLayout
      title="Notifications"
      subtitle="System updates, workflow alerts, and employee changes."
    >
      <div className="sticky top-2 z-20 mb-6 rounded-2xl border bg-white/95 p-4 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Notifications</h1>
              <Badge variant="secondary" className="rounded-full">
                Total {totalCount}
              </Badge>
              <Badge className="rounded-full border-transparent bg-amber-500 text-white">
                Unread {unreadCount}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              System updates, workflow alerts, and employee changes.
            </p>
          </div>

          <div className="flex w-full flex-col gap-2 sm:flex-row xl:w-auto">
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search notifications..."
                className="pl-9"
                aria-label="Search notifications"
              />
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => setIsFilterDialogOpen(true)}
              aria-label="Open notification filters"
            >
              <MoreHorizontal className="mr-2 h-4 w-4" />
              Filters
            </Button>

            <Button
              type="button"
              variant="outline"
              disabled={isMarkAllDisabled}
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

            <Button
              type="button"
              variant="outline"
              onClick={() => void notificationsQuery.refetch()}
              disabled={notificationsQuery.isFetching}
            >
              <RefreshCw className={cn('mr-2 h-4 w-4', notificationsQuery.isFetching && 'animate-spin')} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {notificationsQuery.isError ? (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Failed to load notifications</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>{notificationsQuery.error.message}</p>
            <Button variant="outline" size="sm" onClick={() => void notificationsQuery.refetch()}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <Card className="rounded-2xl border border-slate-200/80 shadow-sm">
        <CardHeader className="space-y-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Bell className="h-4 w-4" />
            Notification Center
          </CardTitle>
          <CardDescription>
            Stay updated with workflow alerts and platform events.
          </CardDescription>
          <Tabs value={viewFilter} onValueChange={(value) => setViewFilter(value as ViewFilter)}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="unread">Unread</TabsTrigger>
              <TabsTrigger value="read">Read</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          {notificationsQuery.isPending ? (
            <div className="space-y-3">
              {Array.from({ length: 10 }).map((_, index) => (
                <div key={`notification-skeleton-${index}`} className="rounded-xl border p-4">
                  <Skeleton className="h-4 w-52" />
                  <Skeleton className="mt-3 h-4 w-full" />
                  <Skeleton className="mt-2 h-4 w-2/3" />
                </div>
              ))}
            </div>
          ) : null}

          {!notificationsQuery.isPending && !notificationsQuery.isError ? (
            groupedNotifications.length > 0 ? (
              <div className="space-y-6">
                {groupedNotifications.map((group) => (
                  <section key={group.label} className="space-y-3">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-slate-900">{group.label}</h3>
                      <div className="h-px flex-1 bg-border" />
                    </div>
                    <div className="space-y-2">
                      {group.items.map((notification) => {
                        const isUnread = !notification.isRead
                        const isMarkingThis = markingNotificationId === notification.id

                        return (
                          <div
                            key={notification.id}
                            role={notification.link ? 'button' : undefined}
                            tabIndex={notification.link ? 0 : -1}
                            className={cn(
                              'rounded-xl border p-4 transition-colors',
                              notification.link && 'cursor-pointer hover:bg-muted/30 focus:outline-none focus:ring-2 focus:ring-ring',
                              isUnread
                                ? 'bg-muted/40 border-l-4 border-l-[#ff6b35]'
                                : 'bg-background',
                            )}
                            onClick={() => navigateToNotificationLink(notification)}
                            onKeyDown={(event) => {
                              if (!notification.link) {
                                return
                              }

                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault()
                                navigateToNotificationLink(notification)
                              }
                            }}
                          >
                            <div className="flex items-start gap-3">
                              <span
                                className={cn(
                                  'mt-1 inline-flex h-2.5 w-2.5 rounded-full',
                                  isUnread
                                    ? 'bg-gradient-to-br from-[#ff6b35] to-[#ffc947]'
                                    : 'bg-muted-foreground/40',
                                )}
                              />

                              <div className="min-w-0 flex-1 space-y-1">
                                <p className={cn('text-sm', isUnread ? 'font-semibold text-slate-900' : 'font-medium text-slate-700')}>
                                  {notification.title}
                                </p>
                                <p className="text-sm text-muted-foreground [display:-webkit-box] overflow-hidden [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
                                  {notification.body}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {formatRelativeTime(notification.createdAt)}
                                </p>
                              </div>

                              <div className="flex flex-col items-end gap-2" onClick={(event) => event.stopPropagation()}>
                                <Badge
                                  variant={isUnread ? 'outline' : 'secondary'}
                                  className={isUnread ? 'border-[#ff6b35] text-[#ff6b35]' : ''}
                                >
                                  {isUnread ? 'Unread' : 'Read'}
                                </Badge>

                                <div className="flex items-center gap-2">
                                  {isUnread ? (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      disabled={markReadMutation.isPending && isMarkingThis}
                                      onClick={() => {
                                        void handleMarkAsRead(notification.id)
                                      }}
                                    >
                                      {markReadMutation.isPending && isMarkingThis ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      ) : null}
                                      Mark as read
                                    </Button>
                                  ) : null}

                                  <NotificationRowMenu
                                    notification={notification}
                                    onOpen={() => navigateToNotificationLink(notification)}
                                    onMarkRead={() => void handleMarkAsRead(notification.id)}
                                    isMarking={markReadMutation.isPending && isMarkingThis}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <div className="flex justify-center py-8">
                <div className="w-full max-w-lg rounded-2xl border border-dashed bg-muted/20 p-8 text-center">
                  <h3 className="text-lg font-semibold text-slate-900">
                    {normalizedSearch || viewFilter !== 'all' ? 'No results' : 'No notifications'}
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {normalizedSearch || viewFilter !== 'all'
                      ? 'Try changing your search or filters.'
                      : "You're all caught up."}
                  </p>
                  {normalizedSearch || viewFilter !== 'all' ? (
                    <Button type="button" variant="outline" className="mt-5" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  ) : null}
                </div>
              </div>
            )
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={isFilterDialogOpen} onOpenChange={setIsFilterDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Notification filters</DialogTitle>
            <DialogDescription>Refine what appears in your inbox.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="notifications-view-filter">Status</Label>
              <Select value={viewFilter} onValueChange={(value) => setViewFilter(value as ViewFilter)}>
                <SelectTrigger id="notifications-view-filter">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="unread">Unread only</SelectItem>
                  <SelectItem value="read">Read only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={clearFilters}>
              Clear filters
            </Button>
            <Button
              type="button"
              className="bg-gradient-to-br from-[#ff6b35] to-[#ffc947] text-white shadow-sm transition-all hover:brightness-95 hover:shadow-md"
              onClick={() => setIsFilterDialogOpen(false)}
            >
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}

interface NotificationRowMenuProps {
  notification: NotificationItem
  onOpen: () => void
  onMarkRead: () => void
  isMarking: boolean
}

function NotificationRowMenu({
  notification,
  onOpen,
  onMarkRead,
  isMarking,
}: NotificationRowMenuProps) {
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
        aria-label={`Actions for notification ${notification.id}`}
        onClick={() => setIsOpen((current) => !current)}
      >
        <MoreHorizontal className="h-4 w-4" />
      </Button>

      {isOpen ? (
        <div className="absolute right-0 top-10 z-30 w-44 rounded-lg border bg-white p-1 shadow-md">
          {notification.link ? (
            <MenuItem
              onClick={() => {
                setIsOpen(false)
                onOpen()
              }}
            >
              Open related page
            </MenuItem>
          ) : null}

          {!notification.isRead ? (
            <MenuItem
              disabled={isMarking}
              onClick={() => {
                setIsOpen(false)
                onMarkRead()
              }}
            >
              {isMarking ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Marking...
                </>
              ) : (
                'Mark as read'
              )}
            </MenuItem>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

interface MenuItemProps {
  children: ReactNode
  onClick: () => void
  disabled?: boolean
}

function MenuItem({ children, onClick, disabled = false }: MenuItemProps) {
  return (
    <button
      type="button"
      className={cn(
        'flex w-full items-center rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-muted',
        disabled && 'cursor-not-allowed opacity-50',
      )}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  )
}
