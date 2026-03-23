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
import { PayrollLayout } from '@/layouts/payroll-layout'
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

function formatDateRange(start: string, end: string): string {
  return `${new Date(`${start}T00:00:00`).toLocaleDateString()} - ${new Date(`${end}T00:00:00`).toLocaleDateString()}`
}

function formatTimestamp(value: string | null | undefined): string {
  if (!value) {
    return '\u2014'
  }

  return new Date(value).toLocaleString()
}

function buildNextPeriodAction(
  status: PayrollPeriodStatus,
): { label: string; nextStatus: PayrollPeriodStatus } | null {
  switch (status) {
    case 'DRAFT':
      return { label: 'Open period', nextStatus: 'OPEN' }
    case 'OPEN':
      return { label: 'Close period', nextStatus: 'CLOSED' }
    case 'CLOSED':
      return { label: 'Archive period', nextStatus: 'ARCHIVED' }
    default:
      return null
  }
}

function buildNextRunAction(
  status: PayrollProcessingStatus,
): { label: string; nextStatus: PayrollProcessingStatus } | null {
  switch (status) {
    case 'DRAFT':
      return { label: 'Calculate run', nextStatus: 'CALCULATED' }
    case 'CALCULATED':
      return { label: 'Send to review', nextStatus: 'UNDER_REVIEW' }
    case 'UNDER_REVIEW':
      return { label: 'Finalize run', nextStatus: 'FINALIZED' }
    case 'FINALIZED':
      return { label: 'Publish payslips', nextStatus: 'PUBLISHED' }
    case 'PUBLISHED':
      return { label: 'Archive run', nextStatus: 'ARCHIVED' }
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
  const statusMeta = getPayrollPeriodStatusMeta(period.status)
  const nextAction = buildNextPeriodAction(period.status)

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
            {formatDateRange(period.periodStart, period.periodEnd)}
          </p>
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
            <span>{period.runCount} run(s)</span>
            <span>{period.publishedPayslipCount} published payslip(s)</span>
            <span>Updated {formatTimestamp(period.updatedAt)}</span>
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
  const statusMeta = getPayrollProcessingStatusMeta(run.status)
  const nextAction = buildNextRunAction(run.status)

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-slate-950">{run.code}</p>
            <StatusBadge tone={statusMeta.tone}>{statusMeta.label}</StatusBadge>
            <StatusBadge tone="neutral" emphasis="outline">
              {getPayrollRunTypeLabel(run.runType)}
            </StatusBadge>
            <StatusBadge tone="neutral" emphasis="outline">
              {run.periodCode}
            </StatusBadge>
          </div>
          <p className="mt-2 text-sm text-slate-600">{run.periodLabel}</p>
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
            <span>{run.employeeCount} employee entry(ies)</span>
            <span>{run.calculatedEmployeeCount} calculated</span>
            <span>{run.excludedEmployeeCount} excluded</span>
            <span>{run.publishedPayslipCount} published payslip(s)</span>
            <span>Created {formatTimestamp(run.createdAt)}</span>
          </div>
          {run.status !== 'DRAFT' ? (
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
              <span>Gross {run.totalGrossPay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              <span>Deductions {run.totalDeductionsAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              <span>Net {run.totalNetPay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          ) : null}
          {run.notes ? <p className="mt-3 text-sm leading-6 text-slate-600">{run.notes}</p> : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <Link to={getPayrollRunRoute(run.id)}>
              Open run
              <ArrowRight className="ml-2 h-4 w-4" />
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
                ? 'Calculating...'
                : nextAction.label}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function LifecycleReferenceCard() {
  return (
    <Card className={SURFACE_CARD_CLASS_NAME}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-950">
          <ShieldCheck className="h-4 w-4 text-slate-600" />
          Processing lifecycle reference
        </CardTitle>
        <CardDescription>
          Payroll runs now use a simplified fixed-input calculation model while preserving the
          controlled review and publication lifecycle.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm leading-6 text-slate-600">
        <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
          <p className="font-medium text-slate-900">Payroll periods</p>
          <p className="mt-1">Draft -&gt; Open -&gt; Closed -&gt; Archived</p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
          <p className="font-medium text-slate-900">Payroll runs</p>
          <p className="mt-1">
            Draft -&gt; Calculated -&gt; Under review -&gt; Finalized -&gt; Published -&gt; Archived
          </p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
          Simplified run calculation uses fixed base salary, fixed allowances, and fixed
          deductions. Advanced statutory payroll rules remain intentionally out of scope in this
          phase.
        </div>
      </CardContent>
    </Card>
  )
}

export function PayrollProcessingPage() {
  const { signOut, user } = useAuth()
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
      toast.success('Payroll period created.')
      setIsCreatePeriodDialogOpen(false)
      setPeriodForm({ code: '', label: '', periodStart: '', periodEnd: '', notes: '' })
    },
  })
  const updatePeriodStatusMutation = useUpdatePayrollPeriodStatusMutation(user?.id, {
    onSuccess: (_, variables) => {
      toast.success(`Payroll period moved to ${variables.status.toLowerCase().replaceAll('_', ' ')}.`)
    },
  })
  const createRunMutation = useCreatePayrollRunMutation(user?.id, {
    onSuccess: () => {
      toast.success('Payroll run created and seeded with active payroll-visible employees.')
      setIsCreateRunDialogOpen(false)
      setRunForm({ payrollPeriodId: '', code: '', runType: 'REGULAR', notes: '' })
    },
  })
  const calculateRunMutation = useCalculatePayrollRunMutation(user?.id, {
    onSuccess: (result) => {
      toast.success(
        `Payroll calculation completed: ${result.calculatedEmployeeCount} calculated, ${result.excludedEmployeeCount} excluded.`,
      )
    },
  })
  const updateRunStatusMutation = useUpdatePayrollRunStatusMutation(user?.id, {
    onSuccess: (_, variables) => {
      const label = variables.status.toLowerCase().replaceAll('_', ' ')
      toast.success(`Payroll run moved to ${label}.`)
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
      toast.error(error instanceof Error ? error.message : 'Failed to create payroll period')
    }
  }

  const handleCreateRun = async () => {
    try {
      await createRunMutation.mutateAsync(runForm)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create payroll run')
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
        error instanceof Error ? error.message : 'Failed to update payroll period status',
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
            ? 'Failed to calculate payroll run'
            : 'Failed to update payroll run status',
      )
    }
  }

  return (
    <PayrollLayout
      title="Payroll Processing"
      subtitle="Controlled payroll processing foundation and lifecycle preparation."
      onSignOut={signOut}
      userEmail={user?.email ?? null}
    >
      <PageHeader
        title="Payroll Processing"
        description="Create payroll periods and seeded payroll runs, calculate simplified payroll results from fixed compensation inputs, and move payroll runs through review, finalization, and publication."
        className="mb-6"
        badges={
          <>
            <StatusBadge tone="brand">Simplified engine</StatusBadge>
            <StatusBadge tone="neutral" emphasis="outline">
              Fixed inputs only
            </StatusBadge>
          </>
        }
        actions={
          <>
            <Button asChild variant="outline">
              <Link to={ROUTES.PAYROLL_EMPLOYEES}>
                View payroll employees
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to={ROUTES.PAYROLL_COMPENSATION}>
                Configure compensation
                <ArrowRight className="ml-2 h-4 w-4" />
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
              title="Payroll periods"
              value={periodsQuery.isPending ? null : periods.length}
              helper="Configured payroll periods ready for lifecycle control."
            />
            <SummaryCard
              title="Open periods"
              value={periodsQuery.isPending ? null : openPeriodsCount}
              helper="Periods currently available for active payroll processing."
            />
            <SummaryCard
              title="Payroll runs"
              value={runsQuery.isPending ? null : runs.length}
              helper="Runs visible in the current payroll period filter."
            />
            <SummaryCard
              title="Published payslips"
              value={periodsQuery.isPending ? null : publishedPayslipsCount}
              helper="Payslip metadata rows already published after payroll run publication."
            />
          </div>

          <div className="mb-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.7fr)]">
            <Card className={SURFACE_CARD_CLASS_NAME}>
              <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-950">
                    <CalendarDays className="h-4 w-4 text-slate-600" />
                    Payroll periods
                  </CardTitle>
                  <CardDescription>
                    Create payroll periods first, then advance them through the controlled period lifecycle.
                  </CardDescription>
                </div>
                <Button type="button" onClick={() => setIsCreatePeriodDialogOpen(true)}>
                  New period
                </Button>
              </CardHeader>
              <CardContent>
                {periodsQuery.isError ? (
                  <ErrorState
                    surface="plain"
                    align="left"
                    title="Could not load payroll periods"
                    description="We couldn't load payroll periods right now."
                    message={periodsQuery.error.message}
                    onRetry={() => void periodsQuery.refetch()}
                  />
                ) : periods.length === 0 ? (
                  <EmptyState
                    surface="plain"
                    align="left"
                    title="No payroll periods yet"
                    description="Create the first payroll period to start controlled payroll calculation and publication."
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
                  Payroll runs
                </CardTitle>
                <CardDescription>
                  Seed payroll runs from the current active payroll-visible employee scope, calculate fixed-input payroll results, then move them through review and publication.
                </CardDescription>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Select value={selectedPeriodId} onValueChange={setSelectedPeriodId}>
                  <SelectTrigger className="min-w-[220px]" aria-label="Filter runs by payroll period">
                    <SelectValue placeholder="All periods" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All periods</SelectItem>
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
                  New run
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {runsQuery.isError ? (
                <ErrorState
                  surface="plain"
                  align="left"
                  title="Could not load payroll runs"
                  description="We couldn't load payroll runs right now."
                  message={runsQuery.error.message}
                  onRetry={() => void runsQuery.refetch()}
                />
              ) : runsQuery.isPending && !runsQuery.data ? (
                <SectionSkeleton lines={5} />
              ) : runs.length === 0 ? (
                <EmptyState
                  surface="plain"
                  align="left"
                  title="No payroll runs yet"
                  description="Create a payroll run to seed employee entries for a payroll period."
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
                Recent payroll processing activity
              </CardTitle>
                <CardDescription>
                  Calculation, lifecycle, and publication actions recorded for this payroll account.
                </CardDescription>
            </CardHeader>
            <CardContent>
              {activityQuery.isError ? (
                <ErrorState
                  surface="plain"
                  align="left"
                  title="Could not load payroll processing activity"
                  description="We couldn't load payroll processing activity right now."
                  message={activityQuery.error.message}
                  onRetry={() => void activityQuery.refetch()}
                />
              ) : activityQuery.isPending && !activityQuery.data ? (
                <SectionSkeleton lines={4} />
              ) : activity.length === 0 ? (
                <EmptyState
                  surface="plain"
                  align="left"
                  title="No payroll processing activity yet"
                  description="Created periods, calculated runs, lifecycle changes, and published payslip metadata will appear here."
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
            <DialogTitle>Create payroll period</DialogTitle>
            <DialogDescription>
              Define the payroll period window and create the lifecycle anchor for future payroll runs.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="payroll-period-code">Code</Label>
              <Input
                id="payroll-period-code"
                value={periodForm.code}
                onChange={(event) =>
                  setPeriodForm((current) => ({ ...current, code: event.target.value }))
                }
                placeholder="e.g. 2026-03"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payroll-period-label">Label</Label>
              <Input
                id="payroll-period-label"
                value={periodForm.label}
                onChange={(event) =>
                  setPeriodForm((current) => ({ ...current, label: event.target.value }))
                }
                placeholder="e.g. March 2026 Payroll"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payroll-period-start">Period start</Label>
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
              <Label htmlFor="payroll-period-end">Period end</Label>
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
              <Label htmlFor="payroll-period-notes">Notes</Label>
              <Textarea
                id="payroll-period-notes"
                value={periodForm.notes ?? ''}
                onChange={(event) =>
                  setPeriodForm((current) => ({ ...current, notes: event.target.value }))
                }
                placeholder="Optional operational notes for the payroll period."
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
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleCreatePeriod()}
              disabled={createPeriodMutation.isPending}
            >
              {createPeriodMutation.isPending ? 'Creating...' : 'Create period'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCreateRunDialogOpen} onOpenChange={setIsCreateRunDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Create payroll run</DialogTitle>
            <DialogDescription>
              Seed a payroll run from the current active payroll-visible employee scope for the selected payroll period.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="payroll-run-period">Payroll period</Label>
              <Select
                value={runForm.payrollPeriodId}
                onValueChange={(value) =>
                  setRunForm((current) => ({ ...current, payrollPeriodId: value }))
                }
              >
                <SelectTrigger id="payroll-run-period">
                  <SelectValue placeholder="Select a payroll period" />
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
              <Label htmlFor="payroll-run-code">Run code</Label>
              <Input
                id="payroll-run-code"
                value={runForm.code}
                onChange={(event) =>
                  setRunForm((current) => ({ ...current, code: event.target.value }))
                }
                placeholder="e.g. 2026-03-REG-01"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payroll-run-type">Run type</Label>
              <Select
                value={runForm.runType}
                onValueChange={(value) =>
                  setRunForm((current) => ({ ...current, runType: value as PayrollRunType }))
                }
              >
                <SelectTrigger id="payroll-run-type">
                  <SelectValue placeholder="Run type" />
                </SelectTrigger>
                <SelectContent>
                  {RUN_TYPE_OPTIONS.map((runType) => (
                    <SelectItem key={runType} value={runType}>
                      {getPayrollRunTypeLabel(runType)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="payroll-run-notes">Notes</Label>
              <Textarea
                id="payroll-run-notes"
                value={runForm.notes ?? ''}
                onChange={(event) =>
                  setRunForm((current) => ({ ...current, notes: event.target.value }))
                }
                placeholder="Optional operational notes for the payroll run."
                rows={4}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
            Run creation seeds employee entries from the current active payroll-visible employee scope only. Fixed compensation profiles are configured separately, then applied by the backend calculation engine.
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCreateRunDialogOpen(false)}
              disabled={createRunMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleCreateRun()}
              disabled={createRunMutation.isPending || nonArchivedPeriods.length === 0}
            >
              {createRunMutation.isPending ? 'Creating...' : 'Create run'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PayrollLayout>
  )
}
