import {
  Activity,
  Bell,
  Building2,
  ClipboardList,
  FileClock,
  LayoutDashboard,
  LogOut,
  Menu,
  Users,
} from 'lucide-react'
import {
  type ComponentType,
  type SVGProps,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { NavLink, useLocation } from 'react-router-dom'

import gcbLogo from '@/assets/brand/gcb-logo.svg'
import { LanguageSwitcher } from '@/components/common/language-switcher'
import { StatusBadge } from '@/components/common/status-badge'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { ROUTES } from '@/constants/routes'
import { useI18n } from '@/hooks/use-i18n'
import { cn } from '@/lib/utils'
import { usePendingRequestsCountQuery } from '@/services/requestsService'
import { usePendingPublicProfileVisibilityRequestsCountQuery } from '@/services/visibilityService'

const SIDEBAR_COLLAPSE_STORAGE_KEY = 'gcb.admin.sidebar.collapsed'
const SIDEBAR_LAST_ACTIVE_INDEX_STORAGE_KEY = 'gcb.admin.sidebar.last-active-index'
const NAV_ITEM_HEIGHT = 50
const NAV_ITEM_GAP = 8
const ACTIVE_PILL_TOP_OFFSET = 7
const ACTIVE_PILL_LEFT_OFFSET = -6
const MODERN_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>

interface AdminNavItem {
  key: string
  labelKey: string
  to: string
  icon: IconComponent
}

const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  {
    key: 'dashboard',
    labelKey: 'sidebar.admin.nav.dashboard',
    to: ROUTES.ADMIN_DASHBOARD,
    icon: LayoutDashboard,
  },
  {
    key: 'monitoring',
    labelKey: 'sidebar.admin.nav.monitoring',
    to: ROUTES.ADMIN_MONITORING,
    icon: Activity,
  },
  {
    key: 'employees',
    labelKey: 'sidebar.admin.nav.employees',
    to: ROUTES.ADMIN_EMPLOYEES,
    icon: Users,
  },
  {
    key: 'departments',
    labelKey: 'sidebar.admin.nav.departments',
    to: ROUTES.ADMIN_DEPARTMENTS,
    icon: Building2,
  },
  {
    key: 'requests',
    labelKey: 'sidebar.admin.nav.requests',
    to: ROUTES.ADMIN_REQUESTS,
    icon: ClipboardList,
  },
  {
    key: 'notifications',
    labelKey: 'sidebar.admin.nav.notifications',
    to: ROUTES.NOTIFICATIONS,
    icon: Bell,
  },
  {
    key: 'audit',
    labelKey: 'sidebar.admin.nav.audit',
    to: ROUTES.ADMIN_AUDIT,
    icon: FileClock,
  },
]

interface AdminSidebarProps {
  onSignOut: () => Promise<void> | void
  userEmail?: string | null
  className?: string
  isMobile?: boolean
  onNavigate?: () => void
}

interface AdminSidebarMobileProps {
  onSignOut: () => Promise<void> | void
  userEmail?: string | null
  className?: string
}

function splitToPathAndHash(to: string): { path: string; hash: string } {
  const [path, hash = ''] = to.split('#')
  return {
    path,
    hash: hash ? `#${hash}` : '',
  }
}

function getRouteMatchScore(pathname: string, currentHash: string, to: string): number {
  const { path, hash } = splitToPathAndHash(to)

  if (hash) {
    return pathname === path && currentHash === hash ? path.length + 1000 : -1
  }

  if (pathname === path) {
    return path.length + 500
  }

  if (pathname.startsWith(`${path}/`)) {
    return path.length
  }

  return -1
}

function getUserInitial(userEmail?: string | null): string {
  const normalized = userEmail?.trim()
  if (!normalized) {
    return 'A'
  }

  return normalized.charAt(0).toUpperCase()
}

function AdminSidebarContent({
  onSignOut,
  userEmail,
  className,
  isMobile = false,
  onNavigate,
}: AdminSidebarProps) {
  const location = useLocation()
  const { direction, isRTL, t } = useI18n()
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window === 'undefined') {
      return false
    }

    try {
      return window.localStorage.getItem(SIDEBAR_COLLAPSE_STORAGE_KEY) === '1'
    } catch {
      return false
    }
  })
  const pendingRequestsCountQuery = usePendingRequestsCountQuery(true)
  const pendingVisibilityRequestsCountQuery = usePendingPublicProfileVisibilityRequestsCountQuery(true)
  const pendingRequestsCount =
    (pendingRequestsCountQuery.data ?? 0) + (pendingVisibilityRequestsCountQuery.data ?? 0)

  useEffect(() => {
    if (isMobile) {
      return
    }

    try {
      window.localStorage.setItem(
        SIDEBAR_COLLAPSE_STORAGE_KEY,
        isCollapsed ? '1' : '0',
      )
    } catch {
      // Ignore storage errors and keep runtime state.
    }
  }, [isCollapsed, isMobile])

  const compactMode = isMobile ? false : isCollapsed
  const userInitial = useMemo(() => getUserInitial(userEmail), [userEmail])
  const activeItemIndex = useMemo(
    () => {
      let bestIndex = -1
      let bestScore = -1

      ADMIN_NAV_ITEMS.forEach((item, index) => {
        const score = getRouteMatchScore(location.pathname, location.hash, item.to)
        if (score > bestScore) {
          bestScore = score
          bestIndex = index
        }
      })

      return bestIndex
    },
    [location.hash, location.pathname],
  )
  const activeKey = activeItemIndex >= 0 ? ADMIN_NAV_ITEMS[activeItemIndex].key : null
  const [animatedActiveItemIndex, setAnimatedActiveItemIndex] = useState(() => {
    if (typeof window === 'undefined') {
      return activeItemIndex
    }

    try {
      const storedValue = window.localStorage.getItem(
        SIDEBAR_LAST_ACTIVE_INDEX_STORAGE_KEY,
      )
      if (storedValue === null) {
        return activeItemIndex
      }

      const parsed = Number(storedValue)
      if (!Number.isFinite(parsed)) {
        return activeItemIndex
      }

      return parsed
    } catch {
      return activeItemIndex
    }
  })
  const activeIndicatorY =
    animatedActiveItemIndex >= 0
      ? animatedActiveItemIndex * (NAV_ITEM_HEIGHT + NAV_ITEM_GAP)
      : 0

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setAnimatedActiveItemIndex(activeItemIndex)
    })

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [activeItemIndex])

  useEffect(() => {
    if (activeItemIndex < 0) {
      return
    }

    try {
      window.localStorage.setItem(
        SIDEBAR_LAST_ACTIVE_INDEX_STORAGE_KEY,
        String(activeItemIndex),
      )
    } catch {
      // Ignore storage errors and keep runtime state.
    }
  }, [activeItemIndex])

  const handleSignOut = async () => {
    await onSignOut()
    onNavigate?.()
  }

  return (
    <aside
      dir={direction}
      className={cn(
        'flex h-full flex-col rounded-[28px] border border-white/70 bg-white/85 p-4 shadow-[0_28px_65px_-38px_rgba(15,23,42,0.65)] backdrop-blur supports-[backdrop-filter]:bg-white/70',
        'transition-[width] duration-300 ease-out',
        compactMode ? 'w-[84px]' : 'w-[280px]',
        className,
      )}
    >
      <div className="flex min-h-16 items-center gap-3 px-1">
        <button
          type="button"
          onClick={
            isMobile
              ? undefined
              : () => {
                  setIsCollapsed((value) => !value)
                }
          }
          aria-label={compactMode ? t('sidebar.admin.expand') : t('sidebar.admin.collapse')}
          className={cn(
            'flex min-w-0 flex-1 items-center gap-3 rounded-xl px-1 py-1 transition-colors',
            !isMobile &&
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--brand-primary))] focus-visible:ring-offset-2 hover:bg-slate-100/80',
          )}
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,rgb(var(--brand-primary)),rgb(var(--brand-accent)))] shadow-[0_12px_30px_-16px_rgba(255,107,53,0.85)]">
            <img src={gcbLogo} alt={t('common.appSystemName')} className="h-8 w-8 object-contain" />
          </div>
          <div
            className={cn(
              'min-w-0 overflow-hidden transition-all duration-200',
              compactMode
                ? cn('max-w-0 opacity-0', isRTL ? 'translate-x-2' : '-translate-x-2')
                : 'max-w-[170px] opacity-100',
              isRTL ? 'text-right' : 'text-left',
            )}
          >
            <p className="truncate text-sm font-semibold text-slate-900">GCB EMS</p>
            <p className="truncate text-xs text-slate-500">{t('sidebar.admin.workspace')}</p>
          </div>
        </button>
      </div>

      <nav className="relative mt-5 flex-1 space-y-2">
        <span
          className={cn(
            'pointer-events-none absolute z-0 rounded-2xl border border-white/25 bg-[linear-gradient(135deg,rgb(var(--brand-primary)),rgb(var(--brand-accent)))] shadow-[0_20px_38px_-20px_rgba(255,107,53,1)] will-change-transform',
            'transition-[transform,height,opacity] duration-500',
            compactMode ? 'right-0' : 'right-1',
            animatedActiveItemIndex >= 0 ? 'opacity-100' : 'opacity-0',
          )}
          style={{
            top: ACTIVE_PILL_TOP_OFFSET,
            left: ACTIVE_PILL_LEFT_OFFSET,
            transform: `translate3d(0, ${activeIndicatorY}px, 0)`,
            height: NAV_ITEM_HEIGHT,
            transitionTimingFunction: MODERN_EASE,
          }}
          aria-hidden="true"
        />
        {ADMIN_NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const isActive = activeKey === item.key
          const badgeCount = item.key === 'requests' ? pendingRequestsCount : 0

          return (
            <NavLink
              key={item.key}
              to={item.to}
              onClick={() => onNavigate?.()}
              className={cn(
                'group relative z-10 flex h-[50px] items-center overflow-hidden rounded-2xl py-0 text-sm font-medium leading-none',
                compactMode ? 'justify-center px-0' : 'justify-start px-3.5',
                'transition-[color,background-color,transform] duration-300',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--brand-primary))] focus-visible:ring-offset-2',
                isActive
                  ? 'text-white'
                  : cn(
                      'text-slate-700 hover:bg-slate-100 hover:text-slate-950',
                      isRTL ? 'hover:-translate-x-[2px]' : 'hover:translate-x-[2px]',
                    ),
              )}
              style={{ transitionTimingFunction: MODERN_EASE }}
            >
              <span
                className={cn(
                  'absolute left-1 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-white/85 transition-opacity',
                  isRTL && 'left-auto right-1',
                  compactMode && 'hidden',
                  isActive ? 'opacity-100' : 'opacity-0',
                )}
                aria-hidden="true"
              />
              <span className="relative z-10 flex h-5 w-5 items-center justify-center">
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              </span>
              <span
                className={cn(
                  'relative z-10 ml-3 overflow-hidden whitespace-nowrap leading-none transition-all duration-300',
                  isRTL && 'ml-0 mr-3 text-right',
                  compactMode ? 'max-w-0 opacity-0' : 'max-w-[170px] flex-1 opacity-100',
                  isActive ? 'text-center font-semibold' : isRTL ? 'text-right' : 'text-left',
                )}
                style={{ transitionTimingFunction: MODERN_EASE }}
              >
                {t(item.labelKey)}
              </span>
              {badgeCount > 0 && !compactMode ? (
                <StatusBadge tone="danger" className="relative z-10 ml-2 text-white">
                  {badgeCount}
                </StatusBadge>
              ) : null}
              {badgeCount > 0 && compactMode ? (
                <span
                  className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-red-600"
                  aria-hidden="true"
                />
              ) : null}
            </NavLink>
          )
        })}
      </nav>

      <div
        className={cn(
          'space-y-3 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3 transition-all',
          compactMode && 'items-center p-2.5',
        )}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
            {userInitial}
          </div>
          <div
            className={cn(
              'min-w-0 overflow-hidden transition-all duration-200',
              compactMode ? 'max-w-0 opacity-0' : 'max-w-[170px] opacity-100',
            )}
          >
            <p className="truncate text-[11px] font-medium uppercase tracking-wider text-slate-500">
              {t('sidebar.admin.role')}
            </p>
            <p className="truncate text-sm text-slate-700">{userEmail ?? t('common.noEmail')}</p>
          </div>
        </div>
        <LanguageSwitcher variant="sidebar" compact={compactMode} />
        <Button
          type="button"
          variant="outline"
          className={cn(
            'w-full border-slate-200 text-slate-700 transition-colors hover:border-[rgb(var(--brand-primary))] hover:text-[rgb(var(--brand-primary))]',
            compactMode && 'h-10 w-10 px-0',
          )}
          onClick={() => {
            void handleSignOut()
          }}
          aria-label={t('common.logout')}
        >
          <LogOut
            className={cn('h-4 w-4 shrink-0', !compactMode && (isRTL ? 'ml-2' : 'mr-2'))}
            aria-hidden="true"
          />
          <span
            className={cn(
              'overflow-hidden whitespace-nowrap transition-all duration-200',
              compactMode ? 'max-w-0 opacity-0' : 'max-w-[90px] opacity-100',
            )}
          >
            {t('common.logout')}
          </span>
        </Button>
      </div>
    </aside>
  )
}

export function AdminSidebar(props: AdminSidebarProps) {
  return <AdminSidebarContent {...props} />
}

export function AdminSidebarMobile({
  onSignOut,
  userEmail,
  className,
}: AdminSidebarMobileProps) {
  const [open, setOpen] = useState(false)
  const { isRTL, t } = useI18n()

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="outline"
          className={cn(
            'border-slate-200 bg-white/90 text-slate-700 hover:bg-slate-100',
            className,
          )}
          aria-label={t('sidebar.admin.open')}
        >
          <Menu className="h-4 w-4" aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side={isRTL ? 'right' : 'left'}
        className="w-[320px] border-none bg-transparent p-3 shadow-none sm:w-[360px]"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>{t('sidebar.admin.mobileTitle')}</SheetTitle>
          <SheetDescription>{t('sidebar.admin.mobileDescription')}</SheetDescription>
        </SheetHeader>
        <AdminSidebarContent
          onSignOut={onSignOut}
          userEmail={userEmail}
          isMobile
          className="h-full w-full"
          onNavigate={() => setOpen(false)}
        />
      </SheetContent>
    </Sheet>
  )
}
