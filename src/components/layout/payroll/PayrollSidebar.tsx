import { LayoutDashboard, LogOut, Menu, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

import gcbLogo from '@/assets/brand/gcb-logo.svg'
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
import { cn } from '@/lib/utils'

interface PayrollSidebarProps {
  onSignOut: () => Promise<void> | void
  userEmail?: string | null
  className?: string
  onNavigate?: () => void
}

interface PayrollSidebarMobileProps {
  onSignOut: () => Promise<void> | void
  userEmail?: string | null
  className?: string
}

interface PayrollNavItem {
  key: string
  label: string
  to: string
  icon: typeof LayoutDashboard
}

const PAYROLL_NAV_ITEMS: PayrollNavItem[] = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    to: ROUTES.PAYROLL_DASHBOARD,
    icon: LayoutDashboard,
  },
  {
    key: 'employees',
    label: 'Employees',
    to: ROUTES.PAYROLL_EMPLOYEES,
    icon: Users,
  },
]

function getUserInitial(userEmail?: string | null): string {
  const normalized = userEmail?.trim()
  if (!normalized) {
    return 'P'
  }

  return normalized.charAt(0).toUpperCase()
}

function isRouteActive(pathname: string, to: string): boolean {
  return pathname === to || pathname.startsWith(`${to}/`)
}

function PayrollSidebarContent({
  onSignOut,
  userEmail,
  className,
  onNavigate,
}: PayrollSidebarProps) {
  const location = useLocation()
  const userInitial = useMemo(() => getUserInitial(userEmail), [userEmail])

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
        <div className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-1 py-1">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,rgb(var(--brand-primary)),rgb(var(--brand-accent)))] shadow-[0_12px_30px_-16px_rgba(255,107,53,0.85)]">
            <img src={gcbLogo} alt="GCB logo" className="h-8 w-8 object-contain" />
          </div>
          <div className="min-w-0 overflow-hidden text-left">
            <p className="truncate text-sm font-semibold text-slate-900">GCB EMS</p>
            <p className="truncate text-xs text-slate-500">Payroll workspace</p>
          </div>
        </div>
      </div>

      <nav className="mt-5 flex-1 space-y-2">
        {PAYROLL_NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const isActive = isRouteActive(location.pathname, item.to)

          return (
            <Link
              key={item.key}
              to={item.to}
              onClick={() => onNavigate?.()}
              className={cn(
                'flex h-[50px] items-center gap-3 rounded-2xl px-3.5 text-sm font-medium transition-[color,background-color,transform] duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--brand-primary))] focus-visible:ring-offset-2',
                isActive
                  ? 'bg-[linear-gradient(135deg,rgb(var(--brand-primary)),rgb(var(--brand-accent)))] text-white shadow-[0_18px_35px_-20px_rgba(255,107,53,0.95)]'
                  : 'text-slate-700 hover:translate-x-[2px] hover:bg-slate-100 hover:text-slate-950',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="space-y-3 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
            {userInitial}
          </div>
          <div className="min-w-0 overflow-hidden">
            <p className="truncate text-[11px] font-medium uppercase tracking-wider text-slate-500">
              Payroll Agent
            </p>
            <p className="truncate text-sm text-slate-700">{userEmail ?? 'No email'}</p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <StatusBadge tone="neutral" emphasis="outline" className="bg-white">
            Read-only
          </StatusBadge>
          <span className="text-[11px] text-slate-500">Controlled access</span>
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full border-slate-200 text-slate-700 transition-colors hover:border-[rgb(var(--brand-primary))] hover:text-[rgb(var(--brand-primary))]"
          onClick={() => {
            void handleSignOut()
          }}
          aria-label="Sign out"
        >
          <LogOut className="mr-2 h-4 w-4 shrink-0" aria-hidden="true" />
          Logout
        </Button>
      </div>
    </aside>
  )
}

export function PayrollSidebar(props: PayrollSidebarProps) {
  return <PayrollSidebarContent {...props} />
}

export function PayrollSidebarMobile({
  onSignOut,
  userEmail,
  className,
}: PayrollSidebarMobileProps) {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="outline"
          className={cn('border-slate-200 bg-white/90 text-slate-700 hover:bg-slate-100', className)}
          aria-label="Open payroll sidebar"
        >
          <Menu className="h-4 w-4" aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-[320px] border-none bg-transparent p-3 shadow-none sm:w-[360px]"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Payroll Navigation</SheetTitle>
          <SheetDescription>Open payroll pages and account actions.</SheetDescription>
        </SheetHeader>
        <PayrollSidebarContent
          onSignOut={onSignOut}
          userEmail={userEmail}
          className="h-full w-full"
          onNavigate={() => setOpen(false)}
        />
      </SheetContent>
    </Sheet>
  )
}
