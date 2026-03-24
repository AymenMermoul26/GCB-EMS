import {
  ArrowRight,
  Calculator,
  Search,
  ShieldCheck,
  WalletCards,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import {
  EmptyState,
  ErrorState,
  PageStateSkeleton,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { ROUTES } from '@/constants/routes'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { useAuth } from '@/hooks/use-auth'
import { PayrollLayout } from '@/layouts/payroll-layout'
import { getEmployeePosteLabel } from '@/types/employee'
import {
  usePayrollCompensationProfilesQuery,
  useUpsertPayrollCompensationProfileMutation,
} from '@/services/payrollProcessingService'
import type {
  PayrollCompensationProfile,
  UpsertPayrollCompensationProfilePayload,
} from '@/types/payroll'

function formatAmount(value: number | null): string {
  if (value === null) {
    return '\u2014'
  }

  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatTimestamp(value: string | null): string {
  if (!value) {
    return '\u2014'
  }

  return new Date(value).toLocaleString()
}

function SummaryCard({
  title,
  value,
  helper,
}: {
  title: string
  value: number
  helper: string
}) {
  return (
    <Card className={SURFACE_CARD_CLASS_NAME}>
      <CardContent className="space-y-3 p-5">
        <p className="text-sm font-medium text-slate-600">{title}</p>
        <p className="text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
        <p className="text-sm leading-6 text-slate-600">{helper}</p>
      </CardContent>
    </Card>
  )
}

interface CompensationFormState {
  employeId: string
  baseSalaryAmount: string
  fixedAllowanceAmount: string
  fixedDeductionAmount: string
  isPayrollEligible: 'true' | 'false'
  notes: string
}

function buildFormState(profile: PayrollCompensationProfile): CompensationFormState {
  return {
    employeId: profile.employeId,
    baseSalaryAmount: profile.baseSalaryAmount?.toFixed(2) ?? '0.00',
    fixedAllowanceAmount: profile.fixedAllowanceAmount?.toFixed(2) ?? '0.00',
    fixedDeductionAmount: profile.fixedDeductionAmount?.toFixed(2) ?? '0.00',
    isPayrollEligible: profile.isPayrollEligible ? 'true' : 'false',
    notes: profile.notes ?? '',
  }
}

function parseAmountInput(value: string, fieldLabel: string): number {
  const normalized = value.trim()

  if (normalized.length === 0) {
    return 0
  }

  const parsed = Number(normalized)

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${fieldLabel} must be a non-negative number.`)
  }

  return Number(parsed.toFixed(2))
}

function CompensationTableRow({
  profile,
  onEdit,
}: {
  profile: PayrollCompensationProfile
  onEdit: (profile: PayrollCompensationProfile) => void
}) {
  const readyForCalculation =
    profile.isActive && profile.hasProfile && profile.isPayrollEligible

  return (
    <TableRow>
      <TableCell>
        <div className="space-y-1">
          <p className="text-sm font-medium text-slate-900">
            {profile.prenom} {profile.nom}
          </p>
          <p className="text-xs text-slate-500">{profile.matricule}</p>
        </div>
      </TableCell>
      <TableCell>
        <div className="space-y-1 text-sm text-slate-600">
          <p>{profile.departementNom ?? '\u2014'}</p>
          <p>{getEmployeePosteLabel(profile.poste) ?? '\u2014'}</p>
        </div>
      </TableCell>
      <TableCell className="text-sm text-slate-700">
        {formatAmount(profile.baseSalaryAmount)}
      </TableCell>
      <TableCell className="text-sm text-slate-700">
        {formatAmount(profile.fixedAllowanceAmount)}
      </TableCell>
      <TableCell className="text-sm text-slate-700">
        {formatAmount(profile.fixedDeductionAmount)}
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap items-center gap-2">
          {profile.hasProfile ? (
            <StatusBadge tone={profile.isPayrollEligible ? 'success' : 'warning'}>
              {profile.isPayrollEligible ? 'Eligible' : 'Excluded'}
            </StatusBadge>
          ) : (
            <StatusBadge tone="danger">Missing profile</StatusBadge>
          )}
          <StatusBadge tone={profile.isActive ? 'info' : 'neutral'} emphasis="outline">
            {profile.isActive ? 'Active' : 'Inactive'}
          </StatusBadge>
          {readyForCalculation ? (
            <StatusBadge tone="brand" emphasis="outline">
              Ready
            </StatusBadge>
          ) : null}
        </div>
      </TableCell>
      <TableCell className="text-sm text-slate-600">
        {formatTimestamp(profile.updatedAt)}
      </TableCell>
      <TableCell className="text-right">
        <Button type="button" variant="outline" size="sm" onClick={() => onEdit(profile)}>
          Configure
        </Button>
      </TableCell>
    </TableRow>
  )
}

export function PayrollCompensationPage() {
  const { signOut, user } = useAuth()
  const [search, setSearch] = useState('')
  const [selectedProfile, setSelectedProfile] = useState<PayrollCompensationProfile | null>(null)
  const [formState, setFormState] = useState<CompensationFormState | null>(null)
  const debouncedSearch = useDebouncedValue(search, 300)

  const compensationProfilesQuery = usePayrollCompensationProfilesQuery({
    search: debouncedSearch,
  })

  const profiles = useMemo(
    () => compensationProfilesQuery.data ?? [],
    [compensationProfilesQuery.data],
  )

  const upsertProfileMutation = useUpsertPayrollCompensationProfileMutation(user?.id, {
    onSuccess: () => {
      toast.success('Payroll compensation profile saved.')
      setSelectedProfile(null)
      setFormState(null)
    },
  })

  const totalProfiles = profiles.length
  const readyProfilesCount = profiles.filter(
    (profile) => profile.isActive && profile.hasProfile && profile.isPayrollEligible,
  ).length
  const missingProfilesCount = profiles.filter((profile) => !profile.hasProfile).length
  const excludedProfilesCount = profiles.filter(
    (profile) => profile.hasProfile && (!profile.isPayrollEligible || !profile.isActive),
  ).length

  const handleEdit = (profile: PayrollCompensationProfile) => {
    setSelectedProfile(profile)
    setFormState(buildFormState(profile))
  }

  const handleSave = async () => {
    if (!selectedProfile || !formState) {
      return
    }

    const payload: UpsertPayrollCompensationProfilePayload = {
      employeId: formState.employeId,
      baseSalaryAmount: parseAmountInput(formState.baseSalaryAmount, 'Base salary'),
      fixedAllowanceAmount: parseAmountInput(formState.fixedAllowanceAmount, 'Fixed allowances'),
      fixedDeductionAmount: parseAmountInput(formState.fixedDeductionAmount, 'Fixed deductions'),
      isPayrollEligible: formState.isPayrollEligible === 'true',
      notes: formState.notes,
    }

    try {
      await upsertProfileMutation.mutateAsync(payload)
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Failed to save payroll compensation profile.',
      )
    }
  }

  return (
    <PayrollLayout
      title="Payroll Compensation"
      subtitle="Maintain the fixed payroll inputs used by the simplified payroll calculation engine."
      onSignOut={signOut}
      userEmail={user?.email ?? null}
    >
      <PageHeader
        title="Payroll Compensation"
        description="Configure the fixed payroll inputs used by the simplified payroll engine: base salary, fixed allowances, fixed deductions, and payroll eligibility. These values remain payroll-only and feed the authoritative run calculation process."
        className="mb-6"
        badges={
          <>
            <StatusBadge tone="brand">Payroll-only</StatusBadge>
            <StatusBadge tone="neutral" emphasis="outline">
              Fixed input model
            </StatusBadge>
          </>
        }
        actions={
          <>
            <Button asChild variant="outline">
              <Link to={ROUTES.PAYROLL_EMPLOYEES}>
                Open employees
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild className={BRAND_BUTTON_CLASS_NAME}>
              <Link to={ROUTES.PAYROLL_PROCESSING}>
                Open processing
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </>
        }
      />

      {compensationProfilesQuery.isPending && !compensationProfilesQuery.data ? (
        <PageStateSkeleton variant="table" count={5} />
      ) : compensationProfilesQuery.isError ? (
        <ErrorState
          title="Could not load payroll compensation profiles"
          description="We couldn't load the payroll compensation setup right now."
          message={compensationProfilesQuery.error.message}
          onRetry={() => void compensationProfilesQuery.refetch()}
        />
      ) : (
        <>
          <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              title="Payroll employees"
              value={totalProfiles}
              helper="Payroll-visible employees evaluated by the compensation setup."
            />
            <SummaryCard
              title="Ready for calculation"
              value={readyProfilesCount}
              helper="Active and payroll-eligible employees with configured inputs."
            />
            <SummaryCard
              title="Missing setup"
              value={missingProfilesCount}
              helper="Employees that will be excluded because no compensation profile exists."
            />
            <SummaryCard
              title="Explicitly excluded"
              value={excludedProfilesCount}
              helper="Configured profiles that are inactive or marked payroll-ineligible."
            />
          </div>

          <div className="mb-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
            <Card className={SURFACE_CARD_CLASS_NAME}>
              <CardHeader className="gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-950">
                    <WalletCards className="h-4 w-4 text-slate-600" />
                    Compensation profiles
                  </CardTitle>
                  <CardDescription>
                    The calculation engine uses only these fixed payroll inputs. Missing or
                    ineligible profiles are excluded during run calculation.
                  </CardDescription>
                </div>
                <div className="relative w-full lg:max-w-sm">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search by employee name or matricule"
                    className="pl-9"
                  />
                </div>
              </CardHeader>
              <CardContent>
                {profiles.length === 0 ? (
                  <EmptyState
                    surface="plain"
                    align="left"
                    title="No payroll employees found"
                    description="Payroll-visible employees will appear here once they are available in the payroll scope."
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[220px]">Employee</TableHead>
                          <TableHead className="min-w-[180px]">Department / job</TableHead>
                          <TableHead className="min-w-[140px]">Base salary</TableHead>
                          <TableHead className="min-w-[140px]">Allowances</TableHead>
                          <TableHead className="min-w-[140px]">Deductions</TableHead>
                          <TableHead className="min-w-[220px]">Eligibility</TableHead>
                          <TableHead className="min-w-[180px]">Updated</TableHead>
                          <TableHead className="w-[120px] text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {profiles.map((profile) => (
                          <CompensationTableRow
                            key={profile.employeId}
                            profile={profile}
                            onEdit={handleEdit}
                          />
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className={SURFACE_CARD_CLASS_NAME}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-950">
                  <Calculator className="h-4 w-4 text-slate-600" />
                  Simplified calculation rule
                </CardTitle>
                <CardDescription>
                  This thesis-friendly phase uses a fixed, extensible calculation model.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm leading-6 text-slate-600">
                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
                  <p className="font-medium text-slate-900">Gross pay</p>
                  <p className="mt-1">Base salary + fixed allowances</p>
                </div>
                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
                  <p className="font-medium text-slate-900">Net pay</p>
                  <p className="mt-1">Gross pay - fixed deductions</p>
                </div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
                  Missing compensation setup, inactive employees, and payroll-ineligible employees
                  are excluded by the backend calculation RPC, not by frontend filtering.
                </div>
                <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
                  <div className="flex items-start gap-2">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                    <p>
                      These compensation fields stay inside the payroll module and are not exposed
                      in employee self-service or public QR flows.
                    </p>
                  </div>
                </div>
                <Button asChild variant="outline" className="w-full">
                  <Link to={ROUTES.PAYROLL_PROCESSING}>
                    Review payroll runs
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      <Dialog
        open={Boolean(selectedProfile && formState)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedProfile(null)
            setFormState(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Configure payroll compensation</DialogTitle>
            <DialogDescription>
              {selectedProfile
                ? `Maintain the fixed payroll inputs used to calculate ${selectedProfile.prenom} ${selectedProfile.nom}.`
                : 'Maintain the fixed payroll inputs used by the calculation engine.'}
            </DialogDescription>
          </DialogHeader>

          {selectedProfile && formState ? (
            <>
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
                <p className="text-sm font-semibold text-slate-950">
                  {selectedProfile.prenom} {selectedProfile.nom}
                </p>
                <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-500">
                  <span>{selectedProfile.matricule}</span>
                  <span>{selectedProfile.departementNom ?? '\u2014'}</span>
                  <span>{getEmployeePosteLabel(selectedProfile.poste) ?? '\u2014'}</span>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="comp-base-salary">Base salary</Label>
                  <Input
                    id="comp-base-salary"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formState.baseSalaryAmount}
                    onChange={(event) =>
                      setFormState((current) =>
                        current
                          ? { ...current, baseSalaryAmount: event.target.value }
                          : current,
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="comp-eligibility">Payroll eligibility</Label>
                  <Select
                    value={formState.isPayrollEligible}
                    onValueChange={(value) =>
                      setFormState((current) =>
                        current
                          ? { ...current, isPayrollEligible: value as 'true' | 'false' }
                          : current,
                      )
                    }
                  >
                    <SelectTrigger id="comp-eligibility">
                      <SelectValue placeholder="Eligibility" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Eligible</SelectItem>
                      <SelectItem value="false">Exclude from payroll</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="comp-allowances">Fixed allowances</Label>
                  <Input
                    id="comp-allowances"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formState.fixedAllowanceAmount}
                    onChange={(event) =>
                      setFormState((current) =>
                        current
                          ? { ...current, fixedAllowanceAmount: event.target.value }
                          : current,
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="comp-deductions">Fixed deductions</Label>
                  <Input
                    id="comp-deductions"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formState.fixedDeductionAmount}
                    onChange={(event) =>
                      setFormState((current) =>
                        current
                          ? { ...current, fixedDeductionAmount: event.target.value }
                          : current,
                      )
                    }
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="comp-notes">Notes</Label>
                  <Textarea
                    id="comp-notes"
                    rows={4}
                    value={formState.notes}
                    onChange={(event) =>
                      setFormState((current) =>
                        current ? { ...current, notes: event.target.value } : current,
                      )
                    }
                    placeholder="Optional payroll-only notes for this compensation setup."
                  />
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setSelectedProfile(null)
                    setFormState(null)
                  }}
                  disabled={upsertProfileMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={upsertProfileMutation.isPending}
                >
                  {upsertProfileMutation.isPending ? 'Saving...' : 'Save compensation'}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </PayrollLayout>
  )
}
