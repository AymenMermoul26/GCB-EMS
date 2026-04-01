import { Bell, CheckCheck, Loader2, RefreshCw } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { StatusBadge } from '@/components/common/status-badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { ROUTES } from '@/constants/routes'
import { useAuth } from '@/hooks/use-auth'
import { useI18n } from '@/hooks/use-i18n'
import { cn } from '@/lib/utils'
import {
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
  useMyNotificationsQuery,
  useUnreadNotificationsCountQuery,
} from '@/services/notificationsService'
import { formatRelativeTime } from '@/utils/date'

function getMenuNotificationSurfaceClass(isUnread: boolean): string {
  return isUnread
    ? 'border-rose-300 bg-gradient-to-r from-rose-700 to-red-600 text-white shadow-[0_18px_35px_-25px_rgba(190,24,93,0.7)]'
    : 'bg-white'
}

export function NotificationsMenu() {
  const { user } = useAuth()
  const { isRTL, locale, t } = useI18n()
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
        toast.success(t('notificationsMenu.markAllSuccess', { count: updatedCount }))
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
    <div className="relative z-50" ref={rootRef}>
      <Button
        variant="ghost"
        size="icon"
        aria-label={t('notificationsMenu.buttonLabel')}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 ? (
          <StatusBadge
            tone="danger"
            emphasis="solid"
            className={cn(
              'absolute -top-1 h-5 min-w-5 rounded-full px-1 text-[10px] text-white',
              isRTL ? '-left-1' : '-right-1',
            )}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </StatusBadge>
        ) : null}
      </Button>

      {isOpen ? (
        <div className={cn('absolute z-[70] mt-2 w-[min(390px,calc(100vw-1rem))] overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_22px_45px_-25px_rgba(15,23,42,0.55)]', isRTL ? 'left-0' : 'right-0')}>
          <div className="border-b border-slate-200/70 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">{t('notificationsMenu.title')}</p>
                <p className="text-xs text-muted-foreground">{t('notificationsMenu.subtitle')}</p>
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 ? (
                  <StatusBadge tone="danger" emphasis="solid" className="rounded-full text-white">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </StatusBadge>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t('notificationsMenu.refreshAria')}
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
                  <Loader2 className={cn('h-4 w-4 animate-spin', isRTL ? 'ml-2' : 'mr-2')} />
                ) : (
                  <CheckCheck className={cn('h-4 w-4', isRTL ? 'ml-2' : 'mr-2')} />
                )}
                {t('notificationsMenu.markAll')}
              </Button>
            </div>
          </div>

          <div className="max-h-[420px] space-y-2 overflow-y-auto p-3">
            {notificationsQuery.isPending ? (
              <>
                {Array.from({ length: 5 }).map((_, index) => (
                  <div
                    key={`notifications-menu-skeleton-${index}`}
                    className="rounded-xl border border-slate-200/80 p-3"
                  >
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
                  {t('notificationsMenu.errorRetry')}
                </Button>
              </div>
            ) : null}

            {!notificationsQuery.isPending && !notificationsQuery.isError ? (
              latestNotifications.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-muted/20 p-6 text-center">
                  <p className="text-sm font-medium text-slate-900">{t('notificationsMenu.emptyTitle')}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{t('notificationsMenu.emptyDescription')}</p>
                </div>
              ) : (
                latestNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    role={notification.link ? 'button' : undefined}
                    tabIndex={notification.link ? 0 : -1}
                    className={cn(
                      'rounded-xl border p-3 transition-colors',
                      !notification.isRead
                        ? 'cursor-pointer hover:brightness-[1.03] focus:outline-none focus:ring-2 focus:ring-rose-300'
                        : '',
                      getMenuNotificationSurfaceClass(!notification.isRead),
                    )}
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
                              ? 'bg-white/90 shadow-sm'
                              : 'bg-muted-foreground/40',
                          )}
                        />
                        <div className="min-w-0 space-y-1">
                          <p
                            className={cn(
                              'truncate text-sm',
                              !notification.isRead ? 'font-semibold text-white' : 'font-medium text-slate-700',
                            )}
                          >
                            {notification.title}
                          </p>
                          <p
                            className={cn(
                              'line-clamp-2 text-xs',
                              !notification.isRead ? 'text-rose-50/95' : 'text-muted-foreground',
                            )}
                          >
                            {notification.body}
                          </p>
                          <p
                            className={cn(
                              'text-[11px]',
                              !notification.isRead ? 'text-rose-100/90' : 'text-muted-foreground',
                            )}
                          >
                            {formatRelativeTime(notification.createdAt, locale)}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <StatusBadge
                          tone={notification.isRead ? 'neutral' : 'danger'}
                          emphasis={notification.isRead ? 'soft' : 'solid'}
                          className="text-[10px]"
                        >
                          {notification.isRead ? t('common.read') : t('common.unread')}
                        </StatusBadge>
                        {!notification.isRead ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className={cn(
                              !notification.isRead &&
                                'border-white/60 bg-white/10 text-white hover:bg-white/20 hover:text-white',
                            )}
                            disabled={markReadMutation.isPending && markingId === notification.id}
                            onClick={(event) => {
                              event.stopPropagation()
                              void handleMarkReadOnly(notification.id)
                            }}
                          >
                            {markReadMutation.isPending && markingId === notification.id ? (
                              <Loader2
                                className={cn(
                                  'h-3.5 w-3.5 animate-spin',
                                  isRTL ? 'ml-1' : 'mr-1',
                                )}
                              />
                            ) : null}
                            {t('actions.markRead')}
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
                {t('actions.viewAllNotifications')}
              </Link>
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
