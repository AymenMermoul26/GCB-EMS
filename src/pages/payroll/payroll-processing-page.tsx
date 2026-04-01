import {
  Activity,
  ArrowRight,
  CalendarDays,
  ClipboardList,
  ShieldCheck,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import {
  EmptyState,
  ErrorState,
  PageStateSkeleton,
  SectionSkeleton,
} from '@/components/common/page-state'
import {
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
import { Textarea } from '@/components/ui/textarea'
import {
  ROUTES,
  getPayrollRunRoute,
} from '@/constants/routes'
import { useAuth } from '@/hooks/use-auth'
import { useI18n } from '@/hooks/use-i18n'
import { PayrollLayout } from '@/layouts/payroll-layout'
import { cn } from '@/lib/utils'
import {
  useCalculatePayrollRunMutation,
  useCreatePayrollPeriodMutation,
  useCreatePayrollRunMutation,
  useMyPayrollProcessingActivityQuery,
  usePayrollPeriodsQuery,
  usePayrollRunsQuery,
  useUpdatePayrollPeriodStatusMutation,
  useUpdatePayrollRunStatusMutation,
} from '@/services/payrollProcessingService'
import type {
  CreatePayrollPeriodPayload,
  CreatePayrollRunPayload,
  PayrollPeriod,
  PayrollPeriodStatus,
  PayrollProcessingActivityItem,
  PayrollProcessingStatus,
  PayrollRunSummary,
  PayrollRunType,
} from '@/types/payroll'
import {
  getPayrollPeriodStatusMeta,
  getPayrollProcessingStatusMeta,
  getPayrollRunTypeLabel,
} from '@/types/payroll'

const RUN_TYPE_OPTIONS: PayrollRunType[] = [
  'REGULAR',
  'SUPPLEMENTAL',
  'ADJUSTMENT',
  'CORRECTION',
]

function formatSummaryValue(value: number | null): string {
  return value === null ? '\u2014' : String(value)
}

function formatDateRange(start: string, end: string, locale: string): string {
  return `${new Date(`${start}T00:00:00`).toLocaleDateString(locale)} - ${new Date(`${end}T00:00:00`).toLocaleDateString(locale)}`
}

function formatTimestamp(value: string | null | undefined, locale: string): string {
  if (!value) {
    return '\u2014'
  }

  return new Date(value).toLocaleString(locale)
}

function buildNextPeriodAction(
  status: PayrollPeriodStatus,
  t: ReturnType<typeof useI18n>['t'],
): { label: string; nextStatus: PayrollPeriodStatus } | null {
  switch (status) {
    case 'DRAFT':
      return { label: t('payroll.processing.periodActions.open'), nextStatus: 'OPEN' }
    case 'OPEN':
      return { label: t('payroll.processing.periodActions.close'), nextStatus: 'CLOSED' }
    case 'CLOSED':
      return { label: t('payroll.processing.periodActions.archive'), nextStatus: 'ARCHIVED' }
    default:
      return null
  }
}

function buildNextRunAction(
  status: PayrollProcessingStatus,
  t: ReturnType<typeof useI18n>['t'],
): { label: string; nextStatus: PayrollProcessingStatus } | null {
  switch (status) {
    case 'DRAFT':
      return { label: t('payroll.processing.runActions.calculate'), nextStatus: 'CALCULATED' }
    case 'CALCULATED':
      return { label: t('payroll.processing.runActions.review'), nextStatus: 'UNDER_REVIEW' }
    case 'UNDER_REVIEW':
      return { label: t('payroll.processing.runActions.finalize'), nextStatus: 'FINALIZED' }
    case 'FINALIZED':
      return { label: t('payroll.processing.runActions.publish'), nextStatus: 'PUBLISHED' }
    case 'PUBLISHED':
      return { label: t('payroll.processing.runActions.archive'), nextStatus: 'ARCHIVED' }
    default:
      return null
  }
}

function SummaryCard({
  title,
  value,
  helper,
}: {
  title: string
  value: number | null
  helper: string
}) {
  return (
    <Card className={SURFACE_CARD_CLASS_NAME}>
      <CardContent className="space-y-3 p-5">
        <p className="text-sm font-medium text-slate-600">{title}</p>
        <p className="text-3xl font-semibold tracking-tight text-slate-950">
          {formatSummaryValue(value)}
        </p>
        <p className="text-sm leading-6 text-slate-600">{helper}</p>
      </CardContent>
    </Card>
  )
}

function ActivityItemCard({ item }: { item: PayrollProcessingActivityItem }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
      <p className="text-sm font-semibold text-slate-950">{item.summary}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span>{new Date(item.createdAt).toLocaleString()}</span>
        {item.employeeName ? <span>{item.employeeName}</span> : null}
        {item.matricule ? <span>{item.matricule}</span> : null}
      </div>
    </div>
  )
}

function PeriodRow({
  period,
  isMutating,
  onAdvance,
}: {
  period: PayrollPeriod
  isMutating: boolean
  onAdvance: (period: PayrollPeriod, nextStatus: PayrollPeriodStatus) => void
}) {
  const { t, locale } = useI18n()
  const statusMeta = getPayrollPeriodStatusMeta(period.status, t)
  const nextAction = buildNextPeriodAction(period.status, t)

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-slate-950">{period.label}</p>
            <StatusBadge tone={statusMeta.tone}>{statusMeta.label}</StatusBadge>
            <StatusBadge tone="neutral" emphasis="outline">
              {period.code}
            </StatusBadge>
          </div>
          <p className="mt-2 text-sm text-slate-600">
            {formatDateRange(period.periodStart, period.periodEnd, locale)}
          </p>
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
            <span>{t('payroll.processing.runCount', { count: period.runCount })}</span>
            <span>
              {t('payroll.processing.publishedPayslipsCount', {
                count: period.publishedPayslipCount,
              })}
            </span>
            <span>
              {t('payroll.processing.updatedAt', {
                value: formatTimestamp(period.updatedAt, locale),
              })}
            </span>
          </div>
          {period.notes ? <p className="mt-3 text-sm leading-6 text-slate-600">{period.notes}</p> : null}
        </div>

        {nextAction ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isMutating}
            onClick={() => onAdvance(period, nextAction.nextStatus)}
          >
            {nextAction.label}
          </Button>
        ) : null}
      </div>
    </div>
  )
}

function RunRow({
  run,
  isMutating,
  isCalculating,
  onAdvance,
}: {
  run: PayrollRunSummary
  isMutating: boolean
  isCalculating: boolean
  onAdvance: (run: PayrollRunSummary, nextStatus: PayrollProcessingStatus) => void
}) {
  const { t, locale, isRTL } = useI18n()
  const statusMeta = getPayrollProcessingStatusMeta(run.status, t)
  const nextAction = buildNextRunAction(run.status, t)

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-slate-950">{run.code}</p>
            <StatusBadge tone={statusMeta.tone}>{statusMeta.label}</StatusBadge>
            <StatusBadge tone="neutral" emphasis="outline">
              {getPayrollRunTypeLabel(run.runType, t)}
            </StatusBadge>
            <StatusBadge tone="neutral" emphasis="outline">
              {run.periodCode}
            </StatusBadge>
          </div>
          <p className="mt-2 text-sm text-slate-600">{run.periodLabel}</p>
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
            <span>{t('payroll.processing.employeeEntries', { count: run.employeeCount })}</span>
            <span>{t('payroll.processing.calculatedCount', { count: run.calculatedEmployeeCount })}</span>
            <span>{t('payroll.processing.excludedCount', { count: run.excludedEmployeeCount })}</span>
            <span>{t('payroll.processing.publishedPayslipsCount', { count: run.publishedPayslipCount })}</span>
            <span>{t('payroll.processing.createdAt', { value: formatTimestamp(run.createdAt, locale) })}</span>
          </div>
          {run.status !== 'DRAFT' ? (
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
              <span>
                {t('payroll.processing.gross', {
                  value: run.totalGrossPay.toLocaleString(locale, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  }),
                })}
              </span>
              <span>
                {t('payroll.processing.deductions', {
                  value: run.totalDeductionsAmount.toLocaleString(locale, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  }),
                })}
              </span>
              <span>
                {t('payroll.processing.net', {
                  value: run.totalNetPay.toLocaleString(locale, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  }),
                })}
              </span>
            </div>
          ) : null}
          {run.notes ? <p className="mt-3 text-sm leading-6 text-slate-600">{run.notes}</p> : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <Link to={getPayrollRunRoute(run.id)}>
              {t('payroll.processing.openRun')}
              <ArrowRight className={cn('h-4 w-4', isRTL ? 'mr-2 rotate-180' : 'ml-2')} />
            </Link>
          </Button>
          {nextAction ? (
            <Button
              type="button"
              size="sm"
              disabled={isMutating || isCalculating}
              onClick={() => onAdvance(run, nextAction.nextStatus)}
            >
              {nextAction.nextStatus === 'CALCULATED' && isCalculating
                ? t('payroll.processing.calculating')
                : nextAction.label}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function LifecycleReferenceCard() {
  const { t } = useI18n()
  return (
    <Card className={SURFACE_CARD_CLASS_NAME}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-950">
          <ShieldCheck className="h-4 w-4 text-slate-600" />
          {t('payroll.processing.lifecycleTitle')}
        </CardTitle>
        <CardDescription>
          {t('payroll.processing.lifecycleDescription')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm leading-6 text-slate-600">
        <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
          <p className="font-medium text-slate-900">{t('payroll.processing.lifecyclePeriods')}</p>
          <p className="mt-1">{t('payroll.processing.lifecyclePeriodsFlow')}</p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
          <p className="font-medium text-slate-900">{t('payroll.processing.lifecycleRuns')}</p>
          <p className="mt-1">{t('payroll.processing.lifecycleRunsFlow')}</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
          {t('payroll.processing.lifecycleWarning')}
        </div>
      </CardContent>
    </Card>
  )
}

export function PayrollProcessingPage() {
  const { signOut, user } = useAuth()
  const { t, isRTL } = useI18n()
  const [selectedPeriodId, setSelectedPeriodId] = useState('all')
  const [isCreatePeriodDialogOpen, setIsCreatePeriodDialogOpen] = useState(false)
  const [isCreateRunDialogOpen, setIsCreateRunDialogOpen] = useState(false)
  const [periodForm, setPeriodForm] = useState<CreatePayrollPeriodPayload>({
    code: '',
    label: '',
    periodStart: '',
    periodEnd: '',
    notes: '',
  })
  const [runForm, setRunForm] = useState<CreatePayrollRunPayload>({
    payrollPeriodId: '',
    code: '',
    runType: 'REGULAR',
    notes: '',
  })

  const periodsQuery = usePayrollPeriodsQuery()
  const periods = useMemo(() => periodsQuery.data ?? [], [periodsQuery.data])
  const resolvedPeriodId = selectedPeriodId === 'all' ? null : selectedPeriodId
  const runsQuery = usePayrollRunsQuery(resolvedPeriodId)
  const runs = useMemo(() => runsQuery.data ?? [], [runsQuery.data])
  const activityQuery = useMyPayrollProcessingActivityQuery(user?.id, { limit: 8 })
  const activity = useMemo(() => activityQuery.data ?? [], [activityQuery.data])

  const createPeriodMutation = useCreatePayrollPeriodMutation(user?.id, {
    onSuccess: () => {
      toast.success(t('payroll.processing.createPeriodSuccess'))
      setIsCreatePeriodDialogOpen(false)
      setPeriodForm({ code: '', label: '', periodStart: '', periodEnd: '', notes: '' })
    },
  })
  const updatePeriodStatusMutation = useUpdatePayrollPeriodStatusMutation(user?.id, {
    onSuccess: (_, variables) => {
      toast.success(
        t('payroll.processing.movePeriodSuccess', {
          status: getPayrollPeriodStatusMeta(variables.status, t).label,
        }),
      )
    },
  })
  const createRunMutation = useCreatePayrollRunMutation(user?.id, {
    onSuccess: () => {
      toast.success(t('payroll.processing.createRunSuccess'))
      setIsCreateRunDialogOpen(false)
      setRunForm({ payrollPeriodId: '', code: '', runType: 'REGULAR', notes: '' })
    },
  })
  const calculateRunMutation = useCalculatePayrollRunMutation(user?.id, {
    onSuccess: (result) => {
      toast.success(
        t('payroll.processing.calculationSuccess', {
          calculated: result.calculatedEmployeeCount,
          excluded: result.excludedEmployeeCount,
        }),
      )
    },
  })
  const updateRunStatusMutation = useUpdatePayrollRunStatusMutation(user?.id, {
    onSuccess: (_, variables) => {
      toast.success(
        t('payroll.processing.moveRunSuccess', {
          status: getPayrollProcessingStatusMeta(variables.status, t).label,
        }),
      )
    },
  })

  const openPeriodsCount = useMemo(
    () => periods.filter((period) => period.status === 'OPEN').length,
    [periods],
  )
  const publishedPayslipsCount = useMemo(
    () => periods.reduce((total, period) => total + period.publishedPayslipCount, 0),
    [periods],
  )
  const nonArchivedPeriods = useMemo(
    () => periods.filter((period) => period.status !== 'ARCHIVED'),
    [periods],
  )

  const handleCreatePeriod = async () => {
    try {
      await createPeriodMutation.mutateAsync(periodForm)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('payroll.processing.createPeriodError'))
    }
  }

  const handleCreateRun = async () => {
    try {
      await createRunMutation.mutateAsync(runForm)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('payroll.processing.createRunError'))
    }
  }

  const handleOpenCreateRunDialog = () => {
    const preferredPeriod =
      (selectedPeriodId !== 'all'
        ? periods.find(
            (period) => period.id === selectedPeriodId && period.status !== 'ARCHIVED',
          )
        : null) ?? periods.find((period) => period.status !== 'ARCHIVED')

    setRunForm({
      payrollPeriodId: preferredPeriod?.id ?? '',
      code: '',
      runType: 'REGULAR',
      notes: '',
    })
    setIsCreateRunDialogOpen(true)
  }

  const handleAdvancePeriod = async (
    period: PayrollPeriod,
    nextStatus: PayrollPeriodStatus,
  ) => {
    try {
      await updatePeriodStatusMutation.mutateAsync({
        periodId: period.id,
        status: nextStatus,
      })
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('payroll.processing.updatePeriodError'),
      )
    }
  }

  const handleAdvanceRun = async (
    run: PayrollRunSummary,
    nextStatus: PayrollProcessingStatus,
  ) => {
    try {
      if (nextStatus === 'CALCULATED') {
        await calculateRunMutation.mutateAsync(run.id)
        return
      }

      await updateRunStatusMutation.mutateAsync({
        runId: run.id,
        status: nextStatus,
      })
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : nextStatus === 'CALCULATED'
            ? t('payroll.processing.calculateRunError')
            : t('payroll.processing.updateRunError'),
      )
    }
  }

  return (
    <PayrollLayout
      title={t('payroll.processing.title')}
      subtitle={t('payroll.processing.subtitle')}
      onSignOut={signOut}
      userEmail={user?.email ?? null}
    >
      <PageHeader
        title={t('payroll.processing.headerTitle')}
        description={t('payroll.processing.headerDescription')}
        className="mb-6"
        badges={
          <>
            <StatusBadge tone="brand">{t('payroll.processing.simplifiedEngine')}</StatusBadge>
            <StatusBadge tone="neutral" emphasis="outline">
              {t('payroll.processing.fixedInputsOnly')}
            </StatusBadge>
          </>
        }
        actions={
          <>
            <Button asChild variant="outline">
              <Link to={ROUTES.PAYROLL_EMPLOYEES}>
                {t('payroll.processing.viewPayrollEmployees')}
                <ArrowRight className={cn('h-4 w-4', isRTL ? 'mr-2 rotate-180' : 'ml-2')} />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to={ROUTES.PAYROLL_COMPENSATION}>
                {t('payroll.processing.configureCompensation')}
                <ArrowRight className={cn('h-4 w-4', isRTL ? 'mr-2 rotate-180' : 'ml-2')} />
              </Link>
            </Button>
          </>
        }
      />

      {periodsQuery.isPending && !periodsQuery.data && runsQuery.isPending && !runsQuery.data ? (
        <>
          <PageStateSkeleton variant="cards" count={4} className="mb-6" />
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.7fr)]">
            <Card className={SURFACE_CARD_CLASS_NAME}>
              <CardContent className="p-6">
                <SectionSkeleton lines={4} />
              </CardContent>
            </Card>
            <Card className={SURFACE_CARD_CLASS_NAME}>
              <CardContent className="p-6">
                <SectionSkeleton lines={4} />
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <>
          <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              title={t('payroll.processing.summaries.periods')}
              value={periodsQuery.isPending ? null : periods.length}
              helper={t('payroll.processing.summaries.periodsHelper')}
            />
            <SummaryCard
              title={t('payroll.processing.summaries.openPeriods')}
              value={periodsQuery.isPending ? null : openPeriodsCount}
              helper={t('payroll.processing.summaries.openPeriodsHelper')}
            />
            <SummaryCard
              title={t('payroll.processing.summaries.runs')}
              value={runsQuery.isPending ? null : runs.length}
              helper={t('payroll.processing.summaries.runsHelper')}
            />
            <SummaryCard
              title={t('payroll.processing.summaries.publishedPayslips')}
              value={periodsQuery.isPending ? null : publishedPayslipsCount}
              helper={t('payroll.processing.summaries.publishedPayslipsHelper')}
            />
          </div>

          <div className="mb-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.7fr)]">
            <Card className={SURFACE_CARD_CLASS_NAME}>
              <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-950">
                    <CalendarDays className="h-4 w-4 text-slate-600" />
                    {t('payroll.processing.periodsTitle')}
                  </CardTitle>
                  <CardDescription>
                    {t('payroll.processing.periodsDescription')}
                  </CardDescription>
                </div>
                <Button type="button" onClick={() => setIsCreatePeriodDialogOpen(true)}>
                  {t('payroll.processing.newPeriod')}
                </Button>
              </CardHeader>
              <CardContent>
                {periodsQuery.isError ? (
                <ErrorState
                  surface="plain"
                  align="left"
                  title={t('payroll.processing.periodsLoadErrorTitle')}
                  description={t('payroll.processing.periodsLoadErrorDescription')}
                  message={periodsQuery.error.message}
                    onRetry={() => void periodsQuery.refetch()}
                  />
                ) : periods.length === 0 ? (
                <EmptyState
                  surface="plain"
                  align="left"
                  title={t('payroll.processing.noPeriodsTitle')}
                  description={t('payroll.processing.noPeriodsDescription')}
                />
                ) : (
                  <div className="space-y-3">
                    {periods.map((period) => (
                      <PeriodRow
                        key={period.id}
                        period={period}
                        isMutating={updatePeriodStatusMutation.isPending}
                        onAdvance={handleAdvancePeriod}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <LifecycleReferenceCard />
          </div>

          <Card className={`${SURFACE_CARD_CLASS_NAME} mb-6`}>
            <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-950">
                  <ClipboardList className="h-4 w-4 text-slate-600" />
                  {t('payroll.processing.runsTitle')}
                </CardTitle>
                <CardDescription>
                  {t('payroll.processing.runsDescription')}
                </CardDescription>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Select value={selectedPeriodId} onValueChange={setSelectedPeriodId}>
                  <SelectTrigger className="min-w-[220px]" aria-label={t('payroll.processing.payrollPeriod')}>
                    <SelectValue placeholder={t('payroll.processing.allPeriods')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('payroll.processing.allPeriods')}</SelectItem>
                    {periods.map((period) => (
                      <SelectItem key={period.id} value={period.id}>
                        {period.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  onClick={handleOpenCreateRunDialog}
                  disabled={nonArchivedPeriods.length === 0}
                >
                  {t('payroll.processing.newRun')}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {runsQuery.isError ? (
                <ErrorState
                  surface="plain"
                  align="left"
                  title={t('payroll.processing.runsLoadErrorTitle')}
                  description={t('payroll.processing.runsLoadErrorDescription')}
                  message={runsQuery.error.message}
                  onRetry={() => void runsQuery.refetch()}
                />
              ) : runsQuery.isPending && !runsQuery.data ? (
                <SectionSkeleton lines={5} />
              ) : runs.length === 0 ? (
                <EmptyState
                  surface="plain"
                  align="left"
                  title={t('payroll.processing.noRunsTitle')}
                  description={t('payroll.processing.noRunsDescription')}
                />
              ) : (
                <div className="space-y-3">
                  {runs.map((run) => (
                    <RunRow
                      key={run.id}
                      run={run}
                      isMutating={updateRunStatusMutation.isPending}
                      isCalculating={calculateRunMutation.isPending}
                      onAdvance={handleAdvanceRun}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className={SURFACE_CARD_CLASS_NAME}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-950">
                <Activity className="h-4 w-4 text-slate-600" />
                {t('payroll.processing.activityTitle')}
              </CardTitle>
                <CardDescription>
                  {t('payroll.processing.activityDescription')}
                </CardDescription>
            </CardHeader>
            <CardContent>
              {activityQuery.isError ? (
                <ErrorState
                  surface="plain"
                  align="left"
                  title={t('payroll.processing.activityLoadErrorTitle')}
                  description={t('payroll.processing.activityLoadErrorDescription')}
                  message={activityQuery.error.message}
                  onRetry={() => void activityQuery.refetch()}
                />
              ) : activityQuery.isPending && !activityQuery.data ? (
                <SectionSkeleton lines={4} />
              ) : activity.length === 0 ? (
                <EmptyState
                  surface="plain"
                  align="left"
                  title={t('payroll.processing.activityEmptyTitle')}
                  description={t('payroll.processing.activityEmptyDescription')}
                />
              ) : (
                <div className="space-y-3">
                  {activity.map((item) => (
                    <ActivityItemCard key={item.id} item={item} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={isCreatePeriodDialogOpen} onOpenChange={setIsCreatePeriodDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{t('payroll.processing.createPeriodTitle')}</DialogTitle>
            <DialogDescription>
              {t('payroll.processing.createPeriodDescription')}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="payroll-period-code">{t('payroll.processing.periodCode')}</Label>
              <Input
                id="payroll-period-code"
                value={periodForm.code}
                onChange={(event) =>
                  setPeriodForm((current) => ({ ...current, code: event.target.value }))
                }
                placeholder={t('payroll.processing.periodCodePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payroll-period-label">{t('payroll.processing.periodLabel')}</Label>
              <Input
                id="payroll-period-label"
                value={periodForm.label}
                onChange={(event) =>
                  setPeriodForm((current) => ({ ...current, label: event.target.value }))
                }
                placeholder={t('payroll.processing.periodLabelPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payroll-period-start">{t('payroll.processing.periodStart')}</Label>
              <Input
                id="payroll-period-start"
                type="date"
                value={periodForm.periodStart}
                onChange={(event) =>
                  setPeriodForm((current) => ({ ...current, periodStart: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payroll-period-end">{t('payroll.processing.periodEnd')}</Label>
              <Input
                id="payroll-period-end"
                type="date"
                value={periodForm.periodEnd}
                onChange={(event) =>
                  setPeriodForm((current) => ({ ...current, periodEnd: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="payroll-period-notes">{t('payroll.processing.notes')}</Label>
              <Textarea
                id="payroll-period-notes"
                value={periodForm.notes ?? ''}
                onChange={(event) =>
                  setPeriodForm((current) => ({ ...current, notes: event.target.value }))
                }
                placeholder={t('payroll.processing.periodNotesPlaceholder')}
                rows={4}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCreatePeriodDialogOpen(false)}
              disabled={createPeriodMutation.isPending}
            >
              {t('actions.cancel')}
            </Button>
            <Button
              type="button"
              onClick={() => void handleCreatePeriod()}
              disabled={createPeriodMutation.isPending}
            >
              {createPeriodMutation.isPending
                ? t('payroll.processing.creating')
                : t('actions.createPeriod')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCreateRunDialogOpen} onOpenChange={setIsCreateRunDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{t('payroll.processing.createRunTitle')}</DialogTitle>
            <DialogDescription>
              {t('payroll.processing.createRunDescription')}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="payroll-run-period">{t('payroll.processing.payrollPeriod')}</Label>
              <Select
                value={runForm.payrollPeriodId}
                onValueChange={(value) =>
                  setRunForm((current) => ({ ...current, payrollPeriodId: value }))
                }
              >
                <SelectTrigger id="payroll-run-period">
                  <SelectValue placeholder={t('payroll.processing.selectPayrollPeriod')} />
                </SelectTrigger>
                <SelectContent>
                  {nonArchivedPeriods.map((period) => (
                    <SelectItem key={period.id} value={period.id}>
                      {period.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="payroll-run-code">{t('payroll.processing.runCode')}</Label>
              <Input
                id="payroll-run-code"
                value={runForm.code}
                onChange={(event) =>
                  setRunForm((current) => ({ ...current, code: event.target.value }))
                }
                placeholder={t('payroll.processing.runCodePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payroll-run-type">{t('payroll.processing.runType')}</Label>
              <Select
                value={runForm.runType}
                onValueChange={(value) =>
                  setRunForm((current) => ({ ...current, runType: value as PayrollRunType }))
                }
              >
                <SelectTrigger id="payroll-run-type">
                  <SelectValue placeholder={t('payroll.processing.runTypePlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {RUN_TYPE_OPTIONS.map((runType) => (
                    <SelectItem key={runType} value={runType}>
                      {getPayrollRunTypeLabel(runType, t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="payroll-run-notes">{t('payroll.processing.notes')}</Label>
              <Textarea
                id="payroll-run-notes"
                value={runForm.notes ?? ''}
                onChange={(event) =>
                  setRunForm((current) => ({ ...current, notes: event.target.value }))
                }
                placeholder={t('payroll.processing.runNotesPlaceholder')}
                rows={4}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
            {t('payroll.processing.runCreationWarning')}
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCreateRunDialogOpen(false)}
              disabled={createRunMutation.isPending}
            >
              {t('actions.cancel')}
            </Button>
            <Button
              type="button"
              onClick={() => void handleCreateRun()}
              disabled={createRunMutation.isPending || nonArchivedPeriods.length === 0}
            >
              {createRunMutation.isPending
                ? t('payroll.processing.creating')
                : t('actions.createRun')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PayrollLayout>
  )
}
