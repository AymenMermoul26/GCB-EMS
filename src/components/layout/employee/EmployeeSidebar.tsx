import {
  Bell,
  ClipboardList,
  LogOut,
  Menu,
  PencilLine,
  QrCode,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import { type ComponentType, type SVGProps, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { ROUTES } from '@/constants/routes'
import { useAuth } from '@/hooks/use-auth'
import { useRole } from '@/hooks/use-role'
import { cn } from '@/lib/utils'
import { useEmployeeQuery } from '@/services/employeesService'

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>

interface EmployeeNavItem {
  key: string
  label: string
  to: string
  icon: IconComponent
}

const EMPLOYEE_NAV_ITEMS: EmployeeNavItem[] = [
  { key: 'profile', label: 'My Profile', to: ROUTES.EMPLOYEE_PROFILE, icon: UserRound },
  {
    key: 'manage-profile',
    label: 'Manage Profile',
    to: ROUTES.EMPLOYEE_PROFILE_MANAGE,
    icon: PencilLine,
  },
  {
    key: 'requests',
    label: 'Requests',
    to: `${ROUTES.EMPLOYEE_PROFILE_MANAGE}#requests`,
    icon: ClipboardList,
  },
  {
    key: 'my-qr',
    label: 'My QR Code',
    to: `${ROUTES.EMPLOYEE_PROFILE_MANAGE}#my-qr`,
    icon: QrCode,
  },
  {
    key: 'security',
    label: 'Security',
    to: `${ROUTES.EMPLOYEE_PROFILE_MANAGE}#security`,
    icon: ShieldCheck,
  },
  { key: 'notifications', label: 'Notifications', to: ROUTES.NOTIFICATIONS, icon: Bell },
]

interface EmployeeSidebarProps {
  onSignOut: () => Promise<void> | void
  userEmail?: string | null
  className?: string
  isMobile?: boolean
  onNavigate?: () => void
}

interface EmployeeSidebarMobileProps {
  onSignOut: () => Promise<void> | void
  userEmail?: string | null
  className?: string
}

function getInitial(value?: string | null): string {
  const normalized = value?.trim()
  return normalized ? normalized.charAt(0).toUpperCase() : 'E'
}

function splitToPathAndHash(to: string): { path: string; hash: string } {
  const [path, hash = ''] = to.split('#')
  return {
    path,
    hash: hash ? `#${hash}` : '',
  }
}

function isRouteActive(pathname: string, currentHash: string, to: string): boolean {
  const { path, hash } = splitToPathAndHash(to)
  if (hash) {
    return pathname === path && currentHash === hash
  }

  if (pathname === path) {
    return true
  }

  return pathname.startsWith(`${path}/`)
}

function getEmployeeInitials(prenom?: string | null, nom?: string | null): string {
  const first = prenom?.trim().charAt(0) ?? ''
  const second = nom?.trim().charAt(0) ?? ''
  const initials = `${first}${second}`.toUpperCase()
  return initials || 'EM'
}

function EmployeeSidebarContent({
  onSignOut,
  userEmail,
  className,
  isMobile = false,
  onNavigate,
}: EmployeeSidebarProps) {
  const location = useLocation()
  const { employeId } = useRole()
  const { user } = useAuth()
  const employeeQuery = useEmployeeQuery(employeId)

  const activeKey = useMemo(
    () =>
      EMPLOYEE_NAV_ITEMS.find((item) =>
        isRouteActive(location.pathname, location.hash, item.to),
      )?.key ?? null,
    [location.hash, location.pathname],
  )

  const employeeInitial = getEmployeeInitials(
    employeeQuery.data?.prenom ?? null,
    employeeQuery.data?.nom ?? null,
  )
  const userInitial = getInitial(user?.email ?? userEmail)

  const handleSignOut = async () => {
    await onSignOut()
    onNavigate?.()
  }

  return (
    <aside
      className={cn(
        'flex h-full w-[280px] flex-col rounded-[28px] border border-white/70 bg-white/85 p-4 shadow-[0_28px_65px_-38px_rgba(15,23,42,0.65)] backdrop-blur supports-[backdrop-filter]:bg-white/70',
        className,
      )}
    >
      <div className="flex min-h-16 items-center gap-3 px-1">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,rgb(var(--brand-primary)),rgb(var(--brand-accent)))] shadow-[0_12px_30px_-16px_rgba(255,107,53,0.85)]">
          <img src="/gcb-logo.svg" alt="Company logo" className="h-8 w-8 object-contain" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">GCB EMS</p>
          <p className="truncate text-xs text-slate-500">Employee workspace</p>
        </div>
      </div>

      <nav className="mt-5 flex-1 space-y-2">
        {EMPLOYEE_NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const isActive = activeKey === item.key
          return (
            <Link
              key={item.key}
              to={item.to}
              onClick={() => onNavigate?.()}
              className={cn(
                'group relative flex h-[50px] items-center overflow-hidden rounded-2xl px-3.5 text-sm font-medium transition-[color,background-color,transform] duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--brand-primary))] focus-visible:ring-offset-2',
                isActive
                  ? 'bg-[linear-gradient(135deg,rgb(var(--brand-primary)),rgb(var(--brand-accent)))] text-white shadow-[0_16px_26px_-18px_rgba(255,107,53,0.95)]'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950',
              )}
            >
              <span
                className={cn(
                  'absolute left-1 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-white/90 transition-opacity',
                  isActive ? 'opacity-100' : 'opacity-0',
                )}
                aria-hidden="true"
              />
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="ml-3 truncate">{item.label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="space-y-3 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3">
        {employeeQuery.isPending ? (
          <div className="space-y-2">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-4 w-24" />
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-900 text-xs font-semibold text-white">
              {employeeQuery.data?.photoUrl ? (
                <img
                  src={employeeQuery.data.photoUrl}
                  alt={`${employeeQuery.data.prenom} ${employeeQuery.data.nom}`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span>{employeeQuery.data ? employeeInitial : userInitial}</span>
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">
                {employeeQuery.data
                  ? `${employeeQuery.data.prenom} ${employeeQuery.data.nom}`
                  : 'Employee'}
              </p>
              <p className="truncate text-xs text-slate-500">{userEmail ?? user?.email ?? 'No email'}</p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <Badge variant="outline" className="border-slate-200 bg-white text-slate-700">
            Employee
          </Badge>
          {employeeQuery.isError ? (
            <span className="text-[11px] text-muted-foreground">Profile unavailable</span>
          ) : null}
        </div>

        <Button
          type="button"
          variant="outline"
          className={cn(
            'w-full border-slate-200 text-slate-700 transition-colors hover:border-[rgb(var(--brand-primary))] hover:text-[rgb(var(--brand-primary))]',
            isMobile && 'h-10',
          )}
          onClick={() => {
            void handleSignOut()
          }}
          aria-label="Sign out"
        >
          <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
          Logout
        </Button>
      </div>
    </aside>
  )
}

export function EmployeeSidebar(props: EmployeeSidebarProps) {
  return <EmployeeSidebarContent {...props} />
}

export function EmployeeSidebarMobile({
  onSignOut,
  userEmail,
  className,
}: EmployeeSidebarMobileProps) {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="outline"
          className={cn('border-slate-200 bg-white/90 text-slate-700 hover:bg-slate-100', className)}
          aria-label="Open employee sidebar"
        >
          <Menu className="h-4 w-4" aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-[320px] border-none bg-transparent p-3 shadow-none sm:w-[360px]"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Employee Navigation</SheetTitle>
          <SheetDescription>Open employee pages and account actions.</SheetDescription>
        </SheetHeader>
        <EmployeeSidebarContent
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
