import {
  ArrowRight,
  Banknote,
  Bell,
  BriefcaseBusiness,
  FileDown,
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
import { useI18n } from '@/hooks/use-i18n'
import { PayrollLayout } from '@/layouts/payroll-layout'
import { cn } from '@/lib/utils'
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
import { formatRelativeTime } from '@/utils/date'
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
function formatMetricValue(value: number | null): string {
  return value === null ? '\u2014' : String(value)
}

function formatDistributionShare(value: number, total: number): string {
  if (total <= 0) {
    return '0%'
  }

  return `${Math.round((value / total) * 100)}%`
}

function getUnreadPayrollSurfaceClass(isUnread: boolean): string {
  return isUnread
    ? 'border-rose-300 bg-gradient-to-r from-rose-700 to-red-600 text-white shadow-[0_18px_35px_-25px_rgba(190,24,93,0.7)]'
    : 'border-slate-200/80 bg-slate-50/80'
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

function getContractTypeLabel(
  employee: PayrollEmployeeListItem,
  emptyFieldLabel: string,
): string {
  return getEmployeeTypeContratLabel(employee.typeContrat) ?? emptyFieldLabel
}

function getProfessionalCategoryLabel(
  employee: PayrollEmployeeListItem,
  emptyFieldLabel: string,
): string {
  return (
    getEmployeeCategorieProfessionnelleLabel(employee.categorieProfessionnelle) ??
    emptyFieldLabel
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
  const { t } = useI18n()
  const percentage = total > 0 ? Math.max(8, Math.round((value / total) * 100)) : 0

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-900">{label}</p>
          <p className="text-xs text-slate-500">
            {t('payroll.dashboard.distribution.employeesLabel', { count: value })}
          </p>
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
  const { t } = useI18n()
  const activeWidth = total > 0 ? Math.round((activeEmployees / total) * 100) : 0
  const inactiveWidth = Math.max(total > 0 ? 100 - activeWidth : 0, 0)

  return (
    <Card className={SURFACE_CARD_CLASS_NAME}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-950">
          <ShieldCheck className="h-4 w-4 text-slate-600" />
          {t('payroll.dashboard.distribution.statusSummaryTitle')}
        </CardTitle>
        <CardDescription>
          {t('payroll.dashboard.distribution.statusSummaryDescription')}
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
              {t('status.common.active')}
            </p>
            <p className="mt-2 text-2xl font-semibold text-emerald-900">{activeEmployees}</p>
            <p className="mt-1 text-xs text-emerald-700">
              {t('payroll.dashboard.distribution.activeShare', {
                value: formatDistributionShare(activeEmployees, total),
              })}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50 p-4">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-600">
              {t('status.common.inactive')}
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{inactiveEmployees}</p>
            <p className="mt-1 text-xs text-slate-500">
              {t('payroll.dashboard.distribution.inactiveShare', {
                value: formatDistributionShare(inactiveEmployees, total),
              })}
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
  const { isRTL } = useI18n()

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
        <ArrowRight
          className={cn(
            'h-4 w-4 shrink-0',
            primary ? 'text-white' : 'text-slate-400',
            isRTL && 'rotate-180',
          )}
        />
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
  const { t, locale, isRTL } = useI18n()
  return (
    <Card className={SURFACE_CARD_CLASS_NAME}>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-950">
            <Bell className="h-4 w-4 text-slate-600" />
            {t('payroll.dashboard.recentChangesFeedTitle')}
          </CardTitle>
          <CardDescription>
            {t('payroll.dashboard.recentChangesFeedDescription')}
          </CardDescription>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link to={ROUTES.PAYROLL_NOTIFICATIONS}>{t('payroll.dashboard.viewRecentChanges')}</Link>
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <SectionSkeleton lines={5} />
        ) : isError ? (
          <ErrorState
            surface="plain"
            align="left"
            title={t('payroll.dashboard.loadErrorTitle')}
            description={t('payroll.dashboard.loadErrorDescription')}
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
                  className={cn(
                    'rounded-2xl border p-4',
                    getUnreadPayrollSurfaceClass(!item.isRead),
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge tone={categoryMeta.tone}>{categoryMeta.label}</StatusBadge>
                    {!item.isRead ? (
                      <StatusBadge tone="danger" emphasis="solid">
                        {t('common.unread')}
                      </StatusBadge>
                    ) : null}
                  </div>
                  <p
                    className={cn(
                      'mt-3 text-sm font-semibold',
                      item.isRead ? 'text-slate-950' : 'text-white',
                    )}
                  >
                    {item.employeeName ?? t('common.employee')}
                  </p>
                  <p
                    className={cn(
                      'mt-1 text-sm leading-6',
                      item.isRead ? 'text-slate-600' : 'text-rose-50/95',
                    )}
                  >
                    {item.summary}
                  </p>
                  {changedFieldsPreview ? (
                    <p
                      className={cn(
                        'mt-2 text-xs',
                        item.isRead ? 'text-slate-500' : 'text-rose-100/90',
                      )}
                    >
                      {t('payroll.dashboard.changedFieldsLabel', {
                        value: changedFieldsPreview,
                      })}
                    </p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <p
                      className={cn(
                        'text-xs',
                        item.isRead ? 'text-slate-500' : 'text-rose-100/90',
                      )}
                      title={new Date(item.createdAt).toLocaleString(locale)}
                    >
                      {formatRelativeTime(item.createdAt, locale)}
                    </p>
                    {item.link ? (
                      <Button
                        asChild
                        size="sm"
                        variant="outline"
                        className={cn(
                          !item.isRead &&
                            'border-white/60 bg-white/10 text-white hover:bg-white/20 hover:text-white',
                        )}
                      >
                        <Link to={item.link}>
                          {t('payroll.dashboard.openEmployee')}
                          <ArrowRight className={cn('h-4 w-4', isRTL ? 'mr-2 rotate-180' : 'ml-2')} />
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
            title={t('payroll.dashboard.recentChangesEmptyTitle')}
            description={t('payroll.dashboard.recentChangesEmptyDescription')}
          />
        )}
      </CardContent>
    </Card>
  )
}

function DashboardSidePanel({ isRefreshing }: { isRefreshing: boolean }) {
  const { t } = useI18n()
  return (
    <div className="space-y-4">
      <Card className={SURFACE_CARD_CLASS_NAME}>
        <CardHeader>
          <CardTitle className="text-base font-semibold text-slate-950">
            {t('payroll.dashboard.quickLinksTitle')}
          </CardTitle>
          <CardDescription>
            {t('payroll.dashboard.quickLinksDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <QuickLinkCard
            title={t('actions.openProcessing')}
            description={t('payroll.processing.headerDescription')}
            href={ROUTES.PAYROLL_PROCESSING}
            primary
          />
          <QuickLinkCard
            title={t('payroll.processing.configureCompensation')}
            description={t('payroll.dashboard.processingScopeItems.one')}
            href={ROUTES.PAYROLL_COMPENSATION}
          />
          <QuickLinkCard
            title={t('payroll.processing.viewPayrollEmployees')}
            description={t('payroll.dashboard.directoryCta')}
            href={ROUTES.PAYROLL_EMPLOYEES}
          />
          <QuickLinkCard
            title={t('sidebar.payroll.nav.payslipRequests')}
            description={t('auth.login.roles.payroll.features.payslips.description')}
            href={ROUTES.PAYROLL_PAYSLIP_REQUESTS}
          />
          <QuickLinkCard
            title={t('payroll.dashboard.viewRecentChanges')}
            description={t('notificationsMenu.subtitle')}
            href={ROUTES.PAYROLL_NOTIFICATIONS}
          />
          <QuickLinkCard
            title={t('payroll.dashboard.openExportCenter')}
            description={t('auth.login.roles.payroll.features.exports.description')}
            href={ROUTES.PAYROLL_EXPORTS}
          />
          <QuickLinkCard
            title={t('payroll.dashboard.openEmployeeInformationSheets')}
            description={t('payroll.dashboard.processingScopeItems.three')}
            href={ROUTES.PAYROLL_EMPLOYEES}
          />
        </CardContent>
      </Card>

      <Card className={SURFACE_CARD_CLASS_NAME}>
        <CardHeader>
          <CardTitle className="text-base font-semibold text-slate-950">
            {t('payroll.dashboard.processingScope')}
          </CardTitle>
          <CardDescription>{t('payroll.dashboard.processingScopeDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-6 text-slate-600">
          <div className="flex items-start gap-2">
            <Banknote className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
            <p>{t('payroll.dashboard.processingScopeItems.one')}</p>
          </div>
          <div className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
            <p>{t('payroll.dashboard.processingScopeItems.two')}</p>
          </div>
          <div className="flex items-start gap-2">
            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
            <p>{t('payroll.dashboard.processingScopeItems.three')}</p>
          </div>
          <div className="flex items-start gap-2">
            <FileDown className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
            <p>{t('payroll.dashboard.processingScopeItems.four')}</p>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-500">
        <div className="flex flex-col gap-2">
          <span>{t('payroll.dashboard.footerData')}</span>
          <span>
            {isRefreshing
              ? t('payroll.dashboard.refreshing')
              : t('payroll.dashboard.autoRefresh')}
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
  const { t } = useI18n()
  const emptyFieldLabel = t('common.notSet')
  const activeEmployeesCount = employees.filter((employee) => employee.isActive).length
  const inactiveEmployeesCount = employees.length - activeEmployeesCount
  const contractTypesCount = countDistinctValues(employees, (employee) => employee.typeContrat)
  const professionalCategoriesCount = countDistinctValues(
    employees,
    (employee) => employee.categorieProfessionnelle,
  )
  const contractDistribution = buildDistribution(employees, (employee) =>
    getContractTypeLabel(employee, emptyFieldLabel),
  )
  const professionalCategoryDistribution = buildDistribution(
    employees,
    (employee) => getProfessionalCategoryLabel(employee, emptyFieldLabel),
  )

  const kpis: KpiCardDefinition[] = [
    {
      key: 'accessible_employees',
      title: t('payroll.dashboard.kpi.accessibleEmployeesTitle'),
      value: employees.length,
      helper: t('payroll.dashboard.kpi.accessibleEmployeesHelper'),
      icon: Users,
      accentClassName:
        'bg-[linear-gradient(135deg,rgba(255,107,53,0.16),rgba(255,201,71,0.24))] text-[rgb(var(--brand-primary))]',
    },
    {
      key: 'active_employees',
      title: t('payroll.dashboard.kpi.activeEmployeesTitle'),
      value: activeEmployeesCount,
      helper: t('payroll.dashboard.kpi.activeEmployeesHelper'),
      icon: UserCheck,
      accentClassName: 'bg-emerald-100 text-emerald-700',
    },
    {
      key: 'inactive_employees',
      title: t('payroll.dashboard.kpi.inactiveEmployeesTitle'),
      value: inactiveEmployeesCount,
      helper: t('payroll.dashboard.kpi.inactiveEmployeesHelper'),
      icon: UserMinus,
      accentClassName: 'bg-slate-100 text-slate-700',
    },
    {
      key: 'contract_types',
      title: t('payroll.dashboard.kpi.contractTypesTitle'),
      value: contractTypesCount,
      helper: t('payroll.dashboard.kpi.contractTypesHelper'),
      icon: FileText,
      accentClassName: 'bg-sky-100 text-sky-700',
    },
    {
      key: 'professional_categories',
      title: t('payroll.dashboard.kpi.professionalCategoriesTitle'),
      value: professionalCategoriesCount,
      helper: t('payroll.dashboard.kpi.professionalCategoriesHelper'),
      icon: BriefcaseBusiness,
      accentClassName: 'bg-cyan-100 text-cyan-700',
    },
    {
      key: 'recent_changes',
      title: t('payroll.dashboard.kpi.recentChangesTitle'),
      value: recentChangesCount,
      helper: t('payroll.dashboard.kpi.recentChangesHelper', { days: DASHBOARD_WINDOW_DAYS }),
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
          title={t('payroll.dashboard.distribution.byContractTitle')}
          description={t('payroll.dashboard.distribution.byContractDescription')}
          icon={FileText}
          total={employees.length}
          items={contractDistribution}
          emptyTitle={t('payroll.dashboard.distribution.noContractTitle')}
          emptyDescription={t('payroll.dashboard.distribution.noContractDescription')}
          barClassName="bg-gradient-to-r from-[#ff6b35] to-[#ffc947]"
        />

        <DistributionWidget
          title={t('payroll.dashboard.distribution.byCategoryTitle')}
          description={t('payroll.dashboard.distribution.byCategoryDescription')}
          icon={BriefcaseBusiness}
          total={employees.length}
          items={professionalCategoryDistribution}
          emptyTitle={t('payroll.dashboard.distribution.noCategoryTitle')}
          emptyDescription={t('payroll.dashboard.distribution.noCategoryDescription')}
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
  const { t, isRTL } = useI18n()
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
      title={t('payroll.dashboard.title')}
      subtitle={t('payroll.dashboard.subtitle')}
      onSignOut={signOut}
      userEmail={user?.email ?? null}
    >
      <PageHeader
        title={t('payroll.dashboard.headerTitle')}
        description={t('payroll.dashboard.headerDescription')}
        className="mb-6"
        badges={
          <>
            <StatusBadge tone="neutral" emphasis="outline">{t('payroll.dashboard.controlledWorkflow')}</StatusBadge>
            <StatusBadge
              tone={(unreadPayrollChangesCount ?? 0) > 0 ? 'danger' : 'neutral'}
              emphasis={(unreadPayrollChangesCount ?? 0) > 0 ? 'solid' : 'outline'}
            >
              {unreadPayrollChangesCount === null
                ? t('payroll.dashboard.unreadChangesLabel')
                : t('payroll.dashboard.unreadChanges', { count: unreadPayrollChangesCount })}
            </StatusBadge>
          </>
        }
        actions={
          <>
            <Button asChild variant="outline">
              <Link to={ROUTES.PAYROLL_NOTIFICATIONS}>
                {t('actions.viewNotifications')}
                <Bell className={cn('h-4 w-4', isRTL ? 'mr-2' : 'ml-2')} />
              </Link>
            </Button>
            <Button asChild className={BRAND_BUTTON_CLASS_NAME}>
              <Link to={ROUTES.PAYROLL_PROCESSING}>
                {t('actions.openProcessing')}
                <ArrowRight className={cn('h-4 w-4', isRTL ? 'mr-2 rotate-180' : 'ml-2')} />
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
          title={t('payroll.dashboard.loadErrorTitle')}
          description={t('payroll.dashboard.loadErrorDescription')}
          message={payrollEmployeesQuery.error.message}
          onRetry={() => void payrollEmployeesQuery.refetch()}
        />
      ) : employees.length === 0 ? (
        <EmptyState
          className="mb-6"
          title={t('payroll.dashboard.emptyTitle')}
          description={t('payroll.dashboard.emptyDescription')}
          actions={
            <Button asChild variant="outline">
              <Link to={ROUTES.PAYROLL_EMPLOYEES}>{t('payroll.dashboard.directoryCta')}</Link>
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



