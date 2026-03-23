import {
  Activity,
  ArrowRight,
  ChevronLeft,
  Calculator,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import {
  EmptyState,
  ErrorState,
  PageStateSkeleton,
  SectionSkeleton,
} from '@/components/common/page-state'
import { PageHeader, SURFACE_CARD_CLASS_NAME } from '@/components/common/page-header'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ROUTES } from '@/constants/routes'
import { useAuth } from '@/hooks/use-auth'
import { PayrollLayout } from '@/layouts/payroll-layout'
import {
  useCalculatePayrollRunMutation,
  useMyPayrollProcessingActivityQuery,
  usePayrollRunEmployeeEntriesQuery,
  usePayrollRunQuery,
  useUpdatePayrollRunStatusMutation,
} from '@/services/payrollProcessingService'
import type {
  PayrollProcessingActivityItem,
  PayrollProcessingStatus,
  PayrollRunDetail,
  PayrollRunEmployeeEntry,
} from '@/types/payroll'
import {
  getPayrollCalculationStatusMeta,
  getPayrollProcessingStatusMeta,
  getPayrollRunTypeLabel,
} from '@/types/payroll'

function formatTimestamp(value: string | null | undefined): string {
  if (!value) {
    return '\u2014'
  }

  return new Date(value).toLocaleString()
}

function formatDateRange(start: string, end: string): string {
  return `${new Date(`${start}T00:00:00`).toLocaleDateString()} - ${new Date(`${end}T00:00:00`).toLocaleDateString()}`
}

function formatAmount(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return '\u2014'
  }

  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
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

function filterRunActivity(
  items: PayrollProcessingActivityItem[],
  runId: string,
): PayrollProcessingActivityItem[] {
  return items.filter(
    (item) => item.targetId === runId || item.payrollRunId === runId,
  )
}

function SummaryCard({
  title,
  value,
  helper,
}: {
  title: string
  value: string
  helper: string
}) {
  return (
    <Card className={SURFACE_CARD_CLASS_NAME}>
      <CardContent className="space-y-3 p-5">
        <p className="text-sm font-medium text-slate-600">{title}</p>
        <p className="text-lg font-semibold text-slate-950">{value}</p>
        <p className="text-sm leading-6 text-slate-600">{helper}</p>
      </CardContent>
    </Card>
  )
}

function RunMetadataCard({ run }: { run: PayrollRunDetail }) {
  return (
    <Card className={SURFACE_CARD_CLASS_NAME}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-950">
          <ShieldCheck className="h-4 w-4 text-slate-600" />
          Run metadata
        </CardTitle>
        <CardDescription>
          Lifecycle, timing, and publication information for this payroll run.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-slate-600">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Created</p>
            <p className="mt-1 font-medium text-slate-900">{formatTimestamp(run.createdAt)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Calculated</p>
            <p className="mt-1 font-medium text-slate-900">{formatTimestamp(run.calculatedAt)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Reviewed</p>
            <p className="mt-1 font-medium text-slate-900">{formatTimestamp(run.reviewedAt)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Finalized</p>
            <p className="mt-1 font-medium text-slate-900">{formatTimestamp(run.finalizedAt)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Published</p>
            <p className="mt-1 font-medium text-slate-900">{formatTimestamp(run.publishedAt)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Archived</p>
            <p className="mt-1 font-medium text-slate-900">{formatTimestamp(run.archivedAt)}</p>
          </div>
        </div>

        {run.notes ? (
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Notes</p>
            <p className="mt-2 leading-6 text-slate-700">{run.notes}</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function EmployeeEntriesCard({
  isLoading,
  isError,
  errorMessage,
  onRetry,
  entries,
}: {
  isLoading: boolean
  isError: boolean
  errorMessage?: string
  onRetry: () => void
  entries: PayrollRunEmployeeEntry[]
}) {
  return (
    <Card className={SURFACE_CARD_CLASS_NAME}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-950">
          <Users className="h-4 w-4 text-slate-600" />
          Payroll calculation results
        </CardTitle>
        <CardDescription>
          Review per-employee payroll calculation snapshots before sending the run to review or publication.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <SectionSkeleton lines={6} />
        ) : isError ? (
          <ErrorState
            surface="plain"
            align="left"
            title="Could not load payroll run entries"
            description="We couldn't load payroll run employee entries right now."
            message={errorMessage}
            onRetry={onRetry}
          />
        ) : entries.length === 0 ? (
          <EmptyState
            surface="plain"
            align="left"
            title="No employee entries yet"
            description="Employee entries will appear here once the payroll run is seeded."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[220px]">Employee</TableHead>
                  <TableHead className="min-w-[180px]">Calculation status</TableHead>
                  <TableHead className="min-w-[140px]">Base salary</TableHead>
                  <TableHead className="min-w-[140px]">Allowances</TableHead>
                  <TableHead className="min-w-[140px]">Deductions</TableHead>
                  <TableHead className="min-w-[140px]">Gross</TableHead>
                  <TableHead className="min-w-[140px]">Net</TableHead>
                  <TableHead className="min-w-[280px]">Review notes</TableHead>
                  <TableHead className="min-w-[160px]">Payslip</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => {
                  const calculationMeta = getPayrollCalculationStatusMeta(entry.calculationStatus)
                  const payslipMeta = entry.payslipStatus
                    ? getPayrollProcessingStatusMeta(entry.payslipStatus)
                    : null

                  return (
                    <TableRow key={entry.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-slate-900">
                            {entry.prenom} {entry.nom}
                          </p>
                          <p className="text-xs text-slate-500">{entry.matricule}</p>
                          <p className="text-xs text-slate-500">
                            {entry.departementNom ?? '\u2014'} | {entry.poste ?? '\u2014'}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          <StatusBadge tone={calculationMeta.tone}>{calculationMeta.label}</StatusBadge>
                          <StatusBadge tone="neutral" emphasis="outline">
                            {getPayrollProcessingStatusMeta(entry.status).label}
                          </StatusBadge>
                          {entry.exclusionReason ? (
                            <p className="text-xs text-slate-500">{entry.exclusionReason}</p>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-slate-700">
                        {formatAmount(entry.baseSalaryAmount)}
                      </TableCell>
                      <TableCell className="text-sm text-slate-700">
                        {formatAmount(entry.totalAllowancesAmount)}
                      </TableCell>
                      <TableCell className="text-sm text-slate-700">
                        {formatAmount(entry.totalDeductionsAmount)}
                      </TableCell>
                      <TableCell className="text-sm text-slate-700">
                        {formatAmount(entry.grossPayAmount)}
                      </TableCell>
                      <TableCell className="text-sm font-medium text-slate-900">
                        {formatAmount(entry.netPayAmount)}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="text-sm text-slate-600">
                            {entry.calculationNotes ?? 'No calculation notes.'}
                          </p>
                          {entry.issueFlags.length > 0 ? (
                            <p className="text-xs text-amber-700">
                              Flags: {entry.issueFlags.join(', ')}
                            </p>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        {payslipMeta ? (
                          <div className="space-y-1">
                            <StatusBadge tone={payslipMeta.tone}>{payslipMeta.label}</StatusBadge>
                            <p className="text-xs text-slate-500">
                              {formatTimestamp(entry.payslipPublishedAt)}
                            </p>
                          </div>
                        ) : (
                          <span className="text-sm text-slate-500">Not published</span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ActivityCard({ items }: { items: PayrollProcessingActivityItem[] }) {
  return (
    <Card className={SURFACE_CARD_CLASS_NAME}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-950">
          <Activity className="h-4 w-4 text-slate-600" />
          Run activity
        </CardTitle>
        <CardDescription>
          Audit-ready actions recorded for this payroll run and its published payslips.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyState
            surface="plain"
            align="left"
            title="No run activity yet"
            description="Lifecycle changes and payslip publication events will appear here."
          />
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
                <p className="text-sm font-semibold text-slate-950">{item.summary}</p>
                <p className="mt-2 text-xs text-slate-500">{formatTimestamp(item.createdAt)}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function PayrollRunDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { signOut, user } = useAuth()
  const runQuery = usePayrollRunQuery(id)
  const entriesQuery = usePayrollRunEmployeeEntriesQuery(id)
  const activityQuery = useMyPayrollProcessingActivityQuery(user?.id, { limit: 50 })
  const updateRunStatusMutation = useUpdatePayrollRunStatusMutation(user?.id, {
    onSuccess: (_, variables) => {
      toast.success(`Payroll run moved to ${variables.status.toLowerCase().replaceAll('_', ' ')}.`)
    },
  })
  const calculateRunMutation = useCalculatePayrollRunMutation(user?.id, {
    onSuccess: (result) => {
      toast.success(
        `Payroll calculation completed: ${result.calculatedEmployeeCount} calculated, ${result.excludedEmployeeCount} excluded.`,
      )
    },
  })

  const run = runQuery.data
  const entries = entriesQuery.data ?? []
  const activity = useMemo(
    () => filterRunActivity(activityQuery.data ?? [], id ?? ''),
    [activityQuery.data, id],
  )
  const nextAction = run ? buildNextRunAction(run.status) : null

  const handleAdvanceRun = async () => {
    if (!run || !nextAction) {
      return
    }

    try {
      if (nextAction.nextStatus === 'CALCULATED') {
        await calculateRunMutation.mutateAsync(run.id)
        return
      }

      await updateRunStatusMutation.mutateAsync({
        runId: run.id,
        status: nextAction.nextStatus,
      })
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : nextAction.nextStatus === 'CALCULATED'
            ? 'Failed to calculate payroll run'
            : 'Failed to update payroll run status',
      )
    }
  }

  const handleRecalculateRun = async () => {
    if (!run) {
      return
    }

    try {
      await calculateRunMutation.mutateAsync(run.id)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to recalculate payroll run')
    }
  }

  if (runQuery.isPending && !runQuery.data) {
    return (
      <PayrollLayout
        title="Payroll Run Detail"
        subtitle="Inspect payroll run lifecycle, seeded employee entries, and publication readiness."
        onSignOut={signOut}
        userEmail={user?.email ?? null}
      >
        <PageStateSkeleton variant="detail" />
      </PayrollLayout>
    )
  }

  if (runQuery.isError) {
    return (
      <PayrollLayout
        title="Payroll Run Detail"
        subtitle="Inspect payroll run lifecycle, seeded employee entries, and publication readiness."
        onSignOut={signOut}
        userEmail={user?.email ?? null}
      >
        <ErrorState
          title="Could not load payroll run"
          description="We couldn't load this payroll run right now."
          message={runQuery.error.message}
          onRetry={() => void runQuery.refetch()}
        />
      </PayrollLayout>
    )
  }

  if (!run) {
    return (
      <PayrollLayout
        title="Payroll Run Detail"
        subtitle="Inspect payroll run lifecycle, seeded employee entries, and publication readiness."
        onSignOut={signOut}
        userEmail={user?.email ?? null}
      >
        <EmptyState
          title="Payroll run not found"
          description="This payroll run is unavailable or outside the current payroll scope."
          actions={
            <Button asChild variant="outline">
              <Link to={ROUTES.PAYROLL_PROCESSING}>
                <ChevronLeft className="mr-2 h-4 w-4" />
                Back to payroll processing
              </Link>
            </Button>
          }
        />
      </PayrollLayout>
    )
  }

  const statusMeta = getPayrollProcessingStatusMeta(run.status)

  return (
    <PayrollLayout
      title="Payroll Run Detail"
      subtitle="Inspect payroll run lifecycle, seeded employee entries, and publication readiness."
      onSignOut={signOut}
      userEmail={user?.email ?? null}
    >
      <PageHeader
        title={run.code}
        description="Review the authoritative per-employee payroll calculation snapshot for this run, then move the run through review, finalization, and publication."
        className="mb-6"
        backAction={
          <Button asChild variant="outline" size="sm">
            <Link to={ROUTES.PAYROLL_PROCESSING}>
              <ChevronLeft className="mr-2 h-4 w-4" />
              Back to processing
            </Link>
          </Button>
        }
        badges={
          <>
            <StatusBadge tone={statusMeta.tone}>{statusMeta.label}</StatusBadge>
            <StatusBadge tone="neutral" emphasis="outline">
              {getPayrollRunTypeLabel(run.runType)}
            </StatusBadge>
            <StatusBadge tone="neutral" emphasis="outline">
              {run.periodCode}
            </StatusBadge>
          </>
        }
        actions={
          <>
            <Button asChild variant="outline">
              <Link to={ROUTES.PAYROLL_COMPENSATION}>
                Open compensation
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            {run.status === 'CALCULATED' ? (
              <Button
                type="button"
                variant="outline"
                disabled={calculateRunMutation.isPending}
                onClick={() => void handleRecalculateRun()}
              >
                {calculateRunMutation.isPending ? 'Recalculating...' : 'Recalculate'}
              </Button>
            ) : null}
            {nextAction ? (
              <Button type="button" onClick={() => void handleAdvanceRun()}>
                {nextAction.nextStatus === 'CALCULATED' && calculateRunMutation.isPending
                  ? 'Calculating...'
                  : updateRunStatusMutation.isPending
                    ? 'Updating...'
                    : nextAction.label}
              </Button>
            ) : null}
          </>
        }
      />

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <SummaryCard
          title="Payroll period"
          value={run.periodLabel}
          helper={formatDateRange(run.periodStart, run.periodEnd)}
        />
        <SummaryCard
          title="Included employees"
          value={String(run.calculatedEmployeeCount)}
          helper="Employee entries included in the calculated payroll totals."
        />
        <SummaryCard
          title="Excluded employees"
          value={String(run.excludedEmployeeCount)}
          helper="Entries excluded because they are inactive, missing setup, or marked ineligible."
        />
        <SummaryCard
          title="Total gross"
          value={formatAmount(run.totalGrossPay)}
          helper="Sum of base salary and fixed allowances for calculated entries."
        />
        <SummaryCard
          title="Total deductions"
          value={formatAmount(run.totalDeductionsAmount)}
          helper="Sum of fixed deductions applied during the run calculation."
        />
        <SummaryCard
          title="Total net"
          value={formatAmount(run.totalNetPay)}
          helper="Net pay snapshot stored for this payroll run."
        />
      </div>

      <div className="mb-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.7fr)]">
        <RunMetadataCard run={run} />

        <Card className={SURFACE_CARD_CLASS_NAME}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-950">
              <Calculator className="h-4 w-4 text-slate-600" />
              Calculation notes
            </CardTitle>
            <CardDescription>
              This run uses the simplified fixed-input payroll calculation model introduced in this phase.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-slate-600">
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
              Gross pay is calculated as base salary plus fixed allowances. Net pay is calculated as gross pay minus fixed deductions.
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
              Exclusion decisions are produced by the backend calculation RPC. Missing compensation setup and payroll-ineligible employees are recorded explicitly for review.
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
              Publishing a run creates payslip metadata records so employee self-service can later consume only published payslips within its own access boundary.
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <EmployeeEntriesCard
          isLoading={entriesQuery.isPending && !entriesQuery.data}
          isError={entriesQuery.isError}
          errorMessage={entriesQuery.isError ? entriesQuery.error.message : undefined}
          onRetry={() => void entriesQuery.refetch()}
          entries={entries}
        />

        {activityQuery.isPending && !activityQuery.data ? (
          <Card className={SURFACE_CARD_CLASS_NAME}>
            <CardContent className="p-6">
              <SectionSkeleton lines={4} />
            </CardContent>
          </Card>
        ) : activityQuery.isError ? (
          <ErrorState
            title="Could not load run activity"
            description="We couldn't load payroll run activity right now."
            message={activityQuery.error.message}
            onRetry={() => void activityQuery.refetch()}
          />
        ) : (
          <ActivityCard items={activity} />
        )}
      </div>
    </PayrollLayout>
  )
}
