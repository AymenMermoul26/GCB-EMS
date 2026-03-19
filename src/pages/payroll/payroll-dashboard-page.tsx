import {
  ArrowRight,
  Bell,
  BriefcaseBusiness,
  FileText,
  ShieldCheck,
  UserCheck,
  UserMinus,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import {
  EmptyState,
  ErrorState,
  SectionSkeleton,
} from '@/components/common/page-state'
import {
  BRAND_BUTTON_CLASS_NAME,
  PageHeader,
  SURFACE_CARD_CLASS_NAME,
} from '@/components/common/page-header'
import { StatusBadge } from '@/components/common/status-badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ROUTES } from '@/constants/routes'
import { useAuth } from '@/hooks/use-auth'
import { PayrollLayout } from '@/layouts/payroll-layout'
import { usePayrollEmployeesQuery } from '@/services/payrollEmployeesService'
import {
  formatPayrollChangedFieldsPreview,
  getPayrollNotificationCategoryMeta,
  useMyPayrollNotificationsQuery,
  useRecentPayrollNotificationsCountQuery,
  useUnreadPayrollNotificationsCountQuery,
} from '@/services/payrollNotificationsService'
import {
  getEmployeeCategorieProfessionnelleLabel,
  getEmployeeTypeContratLabel,
} from '@/types/employee'
import type {
  PayrollEmployeeListItem,
  PayrollNotificationItem,
} from '@/types/payroll'

interface KpiCardDefinition {
  key: string
  title: string
  value: number | null
  helper: string
  icon: LucideIcon
  accentClassName: string
}

interface DistributionItem {
  label: string
  count: number
}

const DASHBOARD_WINDOW_DAYS = 7
const EMPTY_FIELD_LABEL = 'Not set'

function formatMetricValue(value: number | null): string {
  return value === null ? '\u2014' : String(value)
}

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString()
}

function formatRelativeDate(value: string): string {
  const now = Date.now()
  const target = new Date(value).getTime()
  const diffMs = target - now
  const diffMinutes = Math.round(diffMs / 60000)
  const absMinutes = Math.abs(diffMinutes)

  if (absMinutes < 1) {
    return 'Just now'
  }

  if (absMinutes < 60) {
    return `${absMinutes} minute${absMinutes === 1 ? '' : 's'} ${diffMinutes >= 0 ? 'from now' : 'ago'}`
  }

  const diffHours = Math.round(diffMinutes / 60)
  const absHours = Math.abs(diffHours)
  if (absHours < 24) {
    return `${absHours} hour${absHours === 1 ? '' : 's'} ${diffHours >= 0 ? 'from now' : 'ago'}`
  }

  const diffDays = Math.round(diffHours / 24)
  const absDays = Math.abs(diffDays)
  return `${absDays} day${absDays === 1 ? '' : 's'} ${diffDays >= 0 ? 'from now' : 'ago'}`
}

function formatDistributionShare(value: number, total: number): string {
  if (total <= 0) {
    return '0%'
  }

  return `${Math.round((value / total) * 100)}%`
}

function countDistinctValues(
  employees: PayrollEmployeeListItem[],
  getValue: (employee: PayrollEmployeeListItem) => string | null,
): number {
  return new Set(
    employees
      .map((employee) => getValue(employee)?.trim() ?? '')
      .filter((value) => value.length > 0),
  ).size
}

function buildDistribution(
  employees: PayrollEmployeeListItem[],
  getLabel: (employee: PayrollEmployeeListItem) => string,
): DistributionItem[] {
  const counts = new Map<string, number>()

  for (const employee of employees) {
    const label = getLabel(employee)
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }

  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
}

function getContractTypeLabel(employee: PayrollEmployeeListItem): string {
  return getEmployeeTypeContratLabel(employee.typeContrat) ?? EMPTY_FIELD_LABEL
}

function getProfessionalCategoryLabel(employee: PayrollEmployeeListItem): string {
  return (
    getEmployeeCategorieProfessionnelleLabel(employee.categorieProfessionnelle) ??
    EMPTY_FIELD_LABEL
  )
}

function KpiCard({
  title,
  value,
  helper,
  icon: Icon,
  accentClassName,
}: KpiCardDefinition) {
  return (
    <Card className={SURFACE_CARD_CLASS_NAME}>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-medium text-slate-600">{title}</p>
            <p className="text-3xl font-semibold tracking-tight text-slate-950">
              {formatMetricValue(value)}
            </p>
          </div>
          <div
            className={`flex h-11 w-11 items-center justify-center rounded-2xl ${accentClassName}`}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <p className="text-sm leading-6 text-slate-600">{helper}</p>
      </CardContent>
    </Card>
  )
}

function KpiSkeletonCard() {
  return (
    <Card className={SURFACE_CARD_CLASS_NAME}>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-8 w-20" />
          </div>
          <Skeleton className="h-11 w-11 rounded-2xl" />
        </div>
        <Skeleton className="h-4 w-40" />
      </CardContent>
    </Card>
  )
}

function DistributionRow({
  label,
  value,
  total,
  barClassName,
}: {
  label: string
  value: number
  total: number
  barClassName: string
}) {
  const percentage = total > 0 ? Math.max(8, Math.round((value / total) * 100)) : 0

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-900">{label}</p>
          <p className="text-xs text-slate-500">{value} employees</p>
        </div>
        <span className="text-sm font-semibold text-slate-700">
          {formatDistributionShare(value, total)}
        </span>
      </div>
      <div className="h-2 rounded-full bg-slate-100">
        <div className={`h-2 rounded-full ${barClassName}`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  )
}

function DistributionWidget({
  title,
  description,
  icon: Icon,
  total,
  items,
  emptyTitle,
  emptyDescription,
  barClassName,
}: {
  title: string
  description: string
  icon: LucideIcon
  total: number
  items: DistributionItem[]
  emptyTitle: string
  emptyDescription: string
  barClassName: string
}) {
  return (
    <Card className={SURFACE_CARD_CLASS_NAME}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-950">
          <Icon className="h-4 w-4 text-slate-600" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.length === 0 ? (
          <EmptyState
            surface="plain"
            align="left"
            title={emptyTitle}
            description={emptyDescription}
          />
        ) : (
          items.map((item) => (
            <DistributionRow
              key={item.label}
              label={item.label}
              value={item.count}
              total={total}
              barClassName={barClassName}
            />
          ))
        )}
      </CardContent>
    </Card>
  )
}

function DistributionWidgetSkeleton() {
  return (
    <Card className={SURFACE_CARD_CLASS_NAME}>
      <CardContent className="space-y-4 p-6">
        <Skeleton className="h-5 w-44" />
        <Skeleton className="h-4 w-56" />
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={`distribution-skeleton-${index}`} className="space-y-2">
            <div className="flex justify-between gap-3">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-4 w-12" />
            </div>
            <Skeleton className="h-2 w-full" />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function StatusSummaryWidget({
  total,
  activeEmployees,
  inactiveEmployees,
}: {
  total: number
  activeEmployees: number
  inactiveEmployees: number
}) {
  const activeWidth = total > 0 ? Math.round((activeEmployees / total) * 100) : 0
  const inactiveWidth = Math.max(total > 0 ? 100 - activeWidth : 0, 0)

  return (
    <Card className={SURFACE_CARD_CLASS_NAME}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-950">
          <ShieldCheck className="h-4 w-4 text-slate-600" />
          Employee status summary
        </CardTitle>
        <CardDescription>
          Payroll-visible employee headcount split by current active status.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-hidden rounded-full bg-slate-100">
          <div className="flex h-3 w-full">
            <div className="bg-emerald-500" style={{ width: `${activeWidth}%` }} />
            <div className="bg-slate-400" style={{ width: `${inactiveWidth}%` }} />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50 p-4">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-emerald-700">
              Active
            </p>
            <p className="mt-2 text-2xl font-semibold text-emerald-900">{activeEmployees}</p>
            <p className="mt-1 text-xs text-emerald-700">
              {formatDistributionShare(activeEmployees, total)} of payroll scope
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50 p-4">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-600">
              Inactive
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{inactiveEmployees}</p>
            <p className="mt-1 text-xs text-slate-500">
              {formatDistributionShare(inactiveEmployees, total)} of payroll scope
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function StatusSummarySkeleton() {
  return (
    <Card className={SURFACE_CARD_CLASS_NAME}>
      <CardContent className="space-y-4 p-6">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-3 w-full rounded-full" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
      </CardContent>
    </Card>
  )
}

function QuickLinkCard({
  title,
  description,
  href,
  primary = false,
}: {
  title: string
  description: string
  href: string
  primary?: boolean
}) {
  return (
    <Button
      asChild
      variant="outline"
      className={`h-auto w-full justify-between rounded-2xl px-4 py-3 text-left ${
        primary
          ? 'border-transparent bg-gradient-to-br from-[#ff6b35] to-[#ffc947] text-white shadow-[0_18px_34px_-22px_rgba(255,107,53,0.95)] hover:brightness-95 hover:text-white'
          : 'border-slate-200 bg-white text-slate-900 hover:bg-slate-50'
      }`}
    >
      <Link to={href}>
        <div className="min-w-0">
          <p className="text-sm font-semibold">{title}</p>
          <p className={`text-xs ${primary ? 'text-white/85' : 'text-slate-500'}`}>
            {description}
          </p>
        </div>
        <ArrowRight className={`h-4 w-4 shrink-0 ${primary ? 'text-white' : 'text-slate-400'}`} />
      </Link>
    </Button>
  )
}

function DashboardRecentChangesCard({
  isLoading,
  isError,
  errorMessage,
  onRetry,
  items,
}: {
  isLoading: boolean
  isError: boolean
  errorMessage?: string
  onRetry: () => void
  items: PayrollNotificationItem[]
}) {
  return (
    <Card className={SURFACE_CARD_CLASS_NAME}>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-950">
            <Bell className="h-4 w-4 text-slate-600" />
            Recent HR changes relevant to payroll
          </CardTitle>
          <CardDescription>
            Latest payroll-relevant HR change signals from the notification feed.
          </CardDescription>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link to={ROUTES.PAYROLL_NOTIFICATIONS}>Open feed</Link>
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <SectionSkeleton lines={5} />
        ) : isError ? (
          <ErrorState
            surface="plain"
            align="left"
            title="Could not load payroll changes"
            description="We couldn't load the recent payroll change feed right now."
            message={errorMessage}
            onRetry={onRetry}
          />
        ) : items.length > 0 ? (
          <div className="space-y-3">
            {items.map((item) => {
              const categoryMeta = getPayrollNotificationCategoryMeta(item.category)
              const changedFieldsPreview = formatPayrollChangedFieldsPreview(item.changedFields, 2)

              return (
                <div
                  key={item.id}
                  className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge tone={categoryMeta.tone}>{categoryMeta.label}</StatusBadge>
                    {!item.isRead ? <StatusBadge tone="brand">Unread</StatusBadge> : null}
                  </div>
                  <p className="mt-3 text-sm font-semibold text-slate-950">
                    {item.employeeName ?? 'Employee change'}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{item.summary}</p>
                  {changedFieldsPreview ? (
                    <p className="mt-2 text-xs text-slate-500">
                      Changed fields: {changedFieldsPreview}
                    </p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-slate-500" title={formatTimestamp(item.createdAt)}>
                      {formatRelativeDate(item.createdAt)}
                    </p>
                    {item.link ? (
                      <Button asChild size="sm" variant="outline">
                        <Link to={item.link}>
                          Open employee
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <EmptyState
            surface="plain"
            align="left"
            title="No recent HR changes"
            description="Payroll-relevant HR changes will appear here once they are recorded."
          />
        )}
      </CardContent>
    </Card>
  )
}

function DashboardSidePanel({ isRefreshing }: { isRefreshing: boolean }) {
  return (
    <div className="space-y-4">
      <Card className={SURFACE_CARD_CLASS_NAME}>
        <CardHeader>
          <CardTitle className="text-base font-semibold text-slate-950">Quick links</CardTitle>
          <CardDescription>
            Jump directly into payroll consultation routes that are already available.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <QuickLinkCard
            title="View employees"
            description="Open the payroll employee directory."
            href={ROUTES.PAYROLL_EMPLOYEES}
            primary
          />
          <QuickLinkCard
            title="Search employees"
            description="Search by employee name, ID, or email."
            href={ROUTES.PAYROLL_EMPLOYEES}
          />
          <QuickLinkCard
            title="View recent changes"
            description="Review payroll-relevant HR notifications."
            href={ROUTES.PAYROLL_NOTIFICATIONS}
          />
          <QuickLinkCard
            title="Open employee information sheets"
            description="Open an employee record, then launch the sheet preview."
            href={ROUTES.PAYROLL_EMPLOYEES}
          />
        </CardContent>
      </Card>

      <Card className={SURFACE_CARD_CLASS_NAME}>
        <CardHeader>
          <CardTitle className="text-base font-semibold text-slate-950">
            Consultation scope
          </CardTitle>
          <CardDescription>Payroll users can review approved fields only.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-6 text-slate-600">
          <div className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
            <p>
              This dashboard is informational only. It does not expose editing, QR management,
              public-profile controls, or employee approval flows.
            </p>
          </div>
          <div className="flex items-start gap-2">
            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
            <p>
              Use the payroll employee detail pages and information sheets for read-only payroll
              consultation and print-ready document review.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-500">
        <div className="flex flex-col gap-2">
          <span>
            Dashboard data comes from payroll-safe employee records and payroll change
            notifications only.
          </span>
          <span>
            {isRefreshing
              ? 'Refreshing payroll insight data...'
              : 'Dashboard data refreshes automatically every 15 seconds.'}
          </span>
        </div>
      </div>
    </div>
  )
}

function PayrollInsightsContent({
  employees,
  recentChangesCount,
}: {
  employees: PayrollEmployeeListItem[]
  recentChangesCount: number | null
}) {
  const activeEmployeesCount = employees.filter((employee) => employee.isActive).length
  const inactiveEmployeesCount = employees.length - activeEmployeesCount
  const contractTypesCount = countDistinctValues(employees, (employee) => employee.typeContrat)
  const professionalCategoriesCount = countDistinctValues(
    employees,
    (employee) => employee.categorieProfessionnelle,
  )
  const contractDistribution = buildDistribution(employees, getContractTypeLabel)
  const professionalCategoryDistribution = buildDistribution(
    employees,
    getProfessionalCategoryLabel,
  )

  const kpis: KpiCardDefinition[] = [
    {
      key: 'accessible_employees',
      title: 'Total Accessible Employees',
      value: employees.length,
      helper: 'Employees currently visible to payroll.',
      icon: Users,
      accentClassName:
        'bg-[linear-gradient(135deg,rgba(255,107,53,0.16),rgba(255,201,71,0.24))] text-[rgb(var(--brand-primary))]',
    },
    {
      key: 'active_employees',
      title: 'Active Employees',
      value: activeEmployeesCount,
      helper: 'Currently active employee records.',
      icon: UserCheck,
      accentClassName: 'bg-emerald-100 text-emerald-700',
    },
    {
      key: 'inactive_employees',
      title: 'Inactive Employees',
      value: inactiveEmployeesCount,
      helper: 'Inactive records still visible to payroll.',
      icon: UserMinus,
      accentClassName: 'bg-slate-100 text-slate-700',
    },
    {
      key: 'contract_types',
      title: 'Contract Types',
      value: contractTypesCount,
      helper: 'Distinct contract values currently assigned.',
      icon: FileText,
      accentClassName: 'bg-sky-100 text-sky-700',
    },
    {
      key: 'professional_categories',
      title: 'Professional Categories',
      value: professionalCategoriesCount,
      helper: 'Distinct professional categories in scope.',
      icon: BriefcaseBusiness,
      accentClassName: 'bg-cyan-100 text-cyan-700',
    },
    {
      key: 'recent_changes',
      title: 'Recent HR Changes',
      value: recentChangesCount,
      helper: `Payroll-relevant changes recorded in the last ${DASHBOARD_WINDOW_DAYS} days.`,
      icon: Bell,
      accentClassName: 'bg-amber-100 text-amber-700',
    },
  ]

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {kpis.map((item) => {
          const { key, ...kpiProps } = item

          return <KpiCard key={key} {...kpiProps} />
        })}
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <DistributionWidget
          title="Employees by Contract Type"
          description="Current workforce composition by payroll-visible contract type."
          icon={FileText}
          total={employees.length}
          items={contractDistribution}
          emptyTitle="No contract data yet"
          emptyDescription="Contract type distribution will appear once contract data is available."
          barClassName="bg-gradient-to-r from-[#ff6b35] to-[#ffc947]"
        />

        <DistributionWidget
          title="Employees by Professional Category"
          description="Current payroll-visible workforce split by professional category."
          icon={BriefcaseBusiness}
          total={employees.length}
          items={professionalCategoryDistribution}
          emptyTitle="No professional category data yet"
          emptyDescription="Professional category distribution will appear once category data is available."
          barClassName="bg-gradient-to-r from-sky-500 to-cyan-500"
        />

        <StatusSummaryWidget
          total={employees.length}
          activeEmployees={activeEmployeesCount}
          inactiveEmployees={inactiveEmployeesCount}
        />
      </div>
    </>
  )
}

export function PayrollDashboardPage() {
  const { signOut, user } = useAuth()
  const payrollEmployeesQuery = usePayrollEmployeesQuery()
  const payrollNotificationsQuery = useMyPayrollNotificationsQuery(user?.id, { limit: 5 })
  const unreadPayrollNotificationsCountQuery = useUnreadPayrollNotificationsCountQuery(user?.id)
  const recentPayrollNotificationsCountQuery = useRecentPayrollNotificationsCountQuery(
    user?.id,
    DASHBOARD_WINDOW_DAYS,
  )

  const recentNotifications = payrollNotificationsQuery.data ?? []
  const unreadPayrollChangesCount = unreadPayrollNotificationsCountQuery.data ?? null
  const recentPayrollChangesCount = recentPayrollNotificationsCountQuery.data ?? null
  const employees = payrollEmployeesQuery.data ?? []
  const isRefreshing =
    payrollEmployeesQuery.isFetching ||
    payrollNotificationsQuery.isFetching ||
    recentPayrollNotificationsCountQuery.isFetching ||
    unreadPayrollNotificationsCountQuery.isFetching

  return (
    <PayrollLayout
      title="Payroll Dashboard"
      subtitle="Read-only access to payroll-relevant employee insights."
      onSignOut={signOut}
      userEmail={user?.email ?? null}
    >
      <PageHeader
        title="Payroll Dashboard"
        description="Track payroll-visible employee composition, recent HR changes, and the operational shortcuts needed for payroll consultation."
        className="mb-6"
        badges={
          <>
            <StatusBadge tone="neutral" emphasis="outline">
              Read-only
            </StatusBadge>
            <StatusBadge tone="brand">
              {unreadPayrollChangesCount === null
                ? 'Unread changes'
                : `${unreadPayrollChangesCount} unread changes`}
            </StatusBadge>
          </>
        }
        actions={
          <>
            <Button asChild variant="outline">
              <Link to={ROUTES.PAYROLL_NOTIFICATIONS}>
                View Notifications
                <Bell className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild className={BRAND_BUTTON_CLASS_NAME}>
              <Link to={ROUTES.PAYROLL_EMPLOYEES}>
                View Employees
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </>
        }
      />

      {payrollEmployeesQuery.isPending && !payrollEmployeesQuery.data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <KpiSkeletonCard key={`payroll-kpi-skeleton-${index}`} />
            ))}
          </div>

          <div className="mt-6 grid gap-4 xl:grid-cols-3">
            <DistributionWidgetSkeleton />
            <DistributionWidgetSkeleton />
            <StatusSummarySkeleton />
          </div>
        </>
      ) : payrollEmployeesQuery.isError && !payrollEmployeesQuery.data ? (
        <ErrorState
          className="mb-6"
          title="Could not load payroll employee insights"
          description="We couldn't load payroll employee metrics right now."
          message={payrollEmployeesQuery.error.message}
          onRetry={() => void payrollEmployeesQuery.refetch()}
        />
      ) : employees.length === 0 ? (
        <EmptyState
          className="mb-6"
          title="No payroll-relevant employee data yet"
          description="Employees visible to payroll will appear here once they are available in the payroll-safe directory."
          actions={
            <Button asChild variant="outline">
              <Link to={ROUTES.PAYROLL_EMPLOYEES}>Open employee directory</Link>
            </Button>
          }
        />
      ) : (
        <PayrollInsightsContent
          employees={employees}
          recentChangesCount={recentPayrollChangesCount}
        />
      )}

      <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <DashboardRecentChangesCard
          isLoading={payrollNotificationsQuery.isPending && !payrollNotificationsQuery.data}
          isError={payrollNotificationsQuery.isError}
          errorMessage={payrollNotificationsQuery.isError ? payrollNotificationsQuery.error.message : undefined}
          onRetry={() => void payrollNotificationsQuery.refetch()}
          items={recentNotifications}
        />

        <DashboardSidePanel isRefreshing={isRefreshing} />
      </div>
    </PayrollLayout>
  )
}
