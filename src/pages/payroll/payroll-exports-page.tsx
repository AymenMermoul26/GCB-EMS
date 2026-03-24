import {
  ArrowRight,
  FileDown,
  FileText,
  Filter,
  Search,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import {
  EmptyState,
  ErrorState,
  PageStateSkeleton,
  SearchEmptyState,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ROUTES, getPayrollEmployeeRoute } from '@/constants/routes'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { useAuth } from '@/hooks/use-auth'
import { PayrollLayout } from '@/layouts/payroll-layout'
import {
  useGeneratePayrollEmployeesCsvExportMutation,
  useMyPayrollExportHistoryQuery,
} from '@/services/payrollExportsService'
import {
  usePayrollEmployeesDirectoryQuery,
  usePayrollEmployeesQuery,
} from '@/services/payrollEmployeesService'
import {
  EMPLOYEE_REGIONAL_BRANCH_LABELS,
  EMPLOYEE_REGIONAL_BRANCH_OPTIONS,
  getEmployeeRegionalBranchLabel,
  getEmployeeTypeContratLabel,
} from '@/types/employee'
import type {
  PayrollEmployeeListFilters,
  PayrollEmployeeListItem,
  PayrollEmployeeStatusFilter,
  PayrollExportAction,
  PayrollExportHistoryItem,
} from '@/types/payroll'

const EXPORT_FIELD_LABELS = [
  'Employee ID',
  'Last name',
  'First name',
  'Department',
  'Regional branch',
  'Job title',
  'Professional category',
  'Contract type',
  'Hire date',
  'Status',
  'Email',
  'Phone',
  'Address',
  'Marital status',
  'Number of children',
] as const

function buildDepartmentOptions(employees: PayrollEmployeeListItem[]) {
  const departmentEntries = employees.flatMap((employee) => {
    if (!employee.departementId || !employee.departementNom) {
      return []
    }

    return [[employee.departementId, employee.departementNom] as const]
  })

  return [...new Map(departmentEntries).entries()]
    .map(([id, nom]) => ({ id, nom }))
    .sort((left, right) => left.nom.localeCompare(right.nom))
}

function buildContractTypeOptions(employees: PayrollEmployeeListItem[]) {
  return [...new Set(
    employees
      .map((employee) => employee.typeContrat)
      .filter((value): value is string => Boolean(value && value.trim())),
  )].sort((left, right) => left.localeCompare(right))
}

function formatSummaryValue(value: number | null): string {
  return value === null ? '\u2014' : String(value)
}

function formatContractType(value: string | null | undefined): string {
  return getEmployeeTypeContratLabel(value) ?? 'Not set'
}

function formatRegionalBranch(value: string | null | undefined): string {
  return getEmployeeRegionalBranchLabel(value) ?? 'All regional branches'
}

function formatExportActionLabel(action: PayrollExportAction): string {
  return action === 'PAYROLL_EXPORT_PRINT_INITIATED'
    ? 'Information sheet export'
    : 'CSV export generated'
}

function getExportActionTone(action: PayrollExportAction): 'brand' | 'info' {
  return action === 'PAYROLL_EXPORT_PRINT_INITIATED' ? 'info' : 'brand'
}

function buildExportHistoryDescription(item: PayrollExportHistoryItem): string {
  if (item.exportType === 'PAYROLL_EMPLOYEE_INFORMATION_SHEET') {
    return item.employeeName && item.matricule
      ? `${item.employeeName} (${item.matricule})`
      : item.employeeName ?? item.matricule ?? 'Single employee sheet export'
  }

  const scopeParts = [
    item.departmentName,
    item.regionalBranch ? formatRegionalBranch(item.regionalBranch) : null,
    item.status !== 'ALL' ? item.status : null,
    item.typeContrat ? formatContractType(item.typeContrat) : null,
    item.search ? `Search: ${item.search}` : null,
  ].filter((value): value is string => Boolean(value))

  return scopeParts.length > 0
    ? scopeParts.join(' | ')
    : 'Full payroll-safe employee directory'
}

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString()
}

function ExportSummaryCard({
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

export function PayrollExportsPage() {
  const { signOut, user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [searchInput, setSearchInput] = useState(() => searchParams.get('search') ?? '')
  const [departmentFilter, setDepartmentFilter] = useState(
    () => searchParams.get('department') ?? 'all',
  )
  const [branchFilter, setBranchFilter] = useState(() => searchParams.get('branch') ?? 'all')
  const [statusFilter, setStatusFilter] = useState<PayrollEmployeeStatusFilter>(() => {
    const value = searchParams.get('status')
    return value === 'ACTIVE' || value === 'INACTIVE' || value === 'ALL' ? value : 'ALL'
  })
  const [contractFilter, setContractFilter] = useState(
    () => searchParams.get('contract') ?? 'all',
  )
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false)
  const debouncedSearch = useDebouncedValue(searchInput, 350)

  useEffect(() => {
    const nextParams = new URLSearchParams()

    if (searchInput.trim().length > 0) {
      nextParams.set('search', searchInput.trim())
    }

    if (departmentFilter !== 'all') {
      nextParams.set('department', departmentFilter)
    }

    if (branchFilter !== 'all') {
      nextParams.set('branch', branchFilter)
    }

    if (statusFilter !== 'ALL') {
      nextParams.set('status', statusFilter)
    }

    if (contractFilter !== 'all') {
      nextParams.set('contract', contractFilter)
    }

    setSearchParams(nextParams, { replace: true })
  }, [branchFilter, contractFilter, departmentFilter, searchInput, setSearchParams, statusFilter])

  const filters = useMemo<PayrollEmployeeListFilters>(
    () => ({
      search: debouncedSearch.trim() || undefined,
      departementId: departmentFilter === 'all' ? undefined : departmentFilter,
      regionalBranch: branchFilter === 'all' ? undefined : branchFilter,
      status: statusFilter,
      typeContrat: contractFilter === 'all' ? undefined : contractFilter,
    }),
    [branchFilter, contractFilter, debouncedSearch, departmentFilter, statusFilter],
  )

  const payrollEmployeesQuery = usePayrollEmployeesDirectoryQuery(filters)
  const payrollReferenceQuery = usePayrollEmployeesQuery()
  const exportHistoryQuery = useMyPayrollExportHistoryQuery(user?.id, { limit: 8 })
  const exportCsvMutation = useGeneratePayrollEmployeesCsvExportMutation(user?.id, {
    onSuccess: ({ rowCount, fileName }) => {
      toast.success(`CSV export generated (${rowCount} rows).`)
      setIsReviewDialogOpen(false)
      console.info('Payroll export generated', fileName)
    },
  })

  const previewEmployees = useMemo(
    () => payrollEmployeesQuery.data ?? [],
    [payrollEmployeesQuery.data],
  )
  const referenceEmployees = useMemo(
    () => payrollReferenceQuery.data ?? payrollEmployeesQuery.data ?? [],
    [payrollEmployeesQuery.data, payrollReferenceQuery.data],
  )
  const exportHistory = exportHistoryQuery.data ?? []

  const departmentOptions = useMemo(
    () => buildDepartmentOptions(referenceEmployees),
    [referenceEmployees],
  )
  const contractOptions = useMemo(
    () => buildContractTypeOptions(referenceEmployees),
    [referenceEmployees],
  )

  const departmentNameById = useMemo(
    () => new Map(departmentOptions.map((department) => [department.id, department.nom])),
    [departmentOptions],
  )

  const selectedDepartmentName =
    departmentFilter !== 'all' ? departmentNameById.get(departmentFilter) ?? null : null

  const activeEmployeesInScope = useMemo(
    () => previewEmployees.filter((employee) => employee.isActive).length,
    [previewEmployees],
  )

  const hasActiveFilters =
    searchInput.trim().length > 0 ||
    departmentFilter !== 'all' ||
    branchFilter !== 'all' ||
    statusFilter !== 'ALL' ||
    contractFilter !== 'all'

  const handleClearFilters = () => {
    setSearchInput('')
    setDepartmentFilter('all')
    setBranchFilter('all')
    setStatusFilter('ALL')
    setContractFilter('all')
  }

  const handleGenerateCsvExport = async () => {
    try {
      await exportCsvMutation.mutateAsync({
        filters: {
          search: searchInput.trim() || undefined,
          departementId: departmentFilter === 'all' ? undefined : departmentFilter,
          regionalBranch: branchFilter === 'all' ? undefined : branchFilter,
          status: statusFilter,
          typeContrat: contractFilter === 'all' ? undefined : contractFilter,
        },
        departmentName: selectedDepartmentName,
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to generate payroll CSV export')
    }
  }

  return (
    <PayrollLayout
      title="Payroll Exports"
      subtitle="Controlled export of payroll-safe employee data."
      onSignOut={signOut}
      userEmail={user?.email ?? null}
    >
      <PageHeader
        title="Payroll Exports"
        description="Review export scope, generate payroll-safe CSV files, and monitor recent payroll export activity without exposing admin-only or unsupported fields."
        className="mb-6"
        badges={
          <>
            <StatusBadge tone="neutral" emphasis="outline">
              Read-only
            </StatusBadge>
            <StatusBadge tone="brand">{previewEmployees.length} matched</StatusBadge>
          </>
        }
        actions={
          <Button asChild variant="outline">
            <Link to={ROUTES.PAYROLL_EMPLOYEES}>
              View employees
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        }
      >
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.5fr)_220px_220px_180px_220px_auto]">
          <div className="relative xl:col-span-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              aria-label="Search export scope"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search by name, employee ID, or email..."
              className="pl-9"
            />
          </div>

          <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
            <SelectTrigger aria-label="Filter export scope by department">
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All departments</SelectItem>
              {departmentOptions.map((department) => (
                <SelectItem key={department.id} value={department.id}>
                  {department.nom}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={branchFilter} onValueChange={setBranchFilter}>
            <SelectTrigger aria-label="Filter export scope by regional branch">
              <SelectValue placeholder="Regional branch" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All regional branches</SelectItem>
              {EMPLOYEE_REGIONAL_BRANCH_OPTIONS.map((branch) => (
                <SelectItem key={branch} value={branch}>
                  {EMPLOYEE_REGIONAL_BRANCH_LABELS[branch]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={statusFilter}
            onValueChange={(value: PayrollEmployeeStatusFilter) => setStatusFilter(value)}
          >
            <SelectTrigger aria-label="Filter export scope by status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="INACTIVE">Inactive</SelectItem>
            </SelectContent>
          </Select>

          <Select value={contractFilter} onValueChange={setContractFilter}>
            <SelectTrigger aria-label="Filter export scope by contract type">
              <SelectValue placeholder="Contract type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All contract types</SelectItem>
              {contractOptions.map((contractType) => (
                <SelectItem key={contractType} value={contractType}>
                  {formatContractType(contractType)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            type="button"
            variant="outline"
            onClick={handleClearFilters}
            disabled={!hasActiveFilters}
          >
            <Filter className="mr-2 h-4 w-4" />
            Clear filters
          </Button>
        </div>
      </PageHeader>

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ExportSummaryCard
          title="Employees in scope"
          value={payrollEmployeesQuery.isPending ? null : previewEmployees.length}
          helper="Payroll-safe employee rows that match the current export filters."
        />
        <ExportSummaryCard
          title="Active in scope"
          value={payrollEmployeesQuery.isPending ? null : activeEmployeesInScope}
          helper="Currently active payroll-visible employees within the export scope."
        />
        <ExportSummaryCard
          title="Exportable columns"
          value={EXPORT_FIELD_LABELS.length}
          helper="Fields included in the controlled payroll CSV export."
        />
        <ExportSummaryCard
          title="Recent export activity"
          value={exportHistoryQuery.isPending ? null : exportHistory.length}
          helper="Most recent payroll export actions recorded for this payroll account."
        />
      </div>

      {payrollEmployeesQuery.isError ? (
        <ErrorState
          className="mb-6"
          title="Could not load payroll export scope"
          description="We couldn't load the payroll export preview right now."
          message={payrollEmployeesQuery.error.message}
          onRetry={() => {
            void payrollEmployeesQuery.refetch()
            void payrollReferenceQuery.refetch()
          }}
        />
      ) : null}

      {payrollEmployeesQuery.isPending ? (
        <>
          <PageStateSkeleton variant="cards" count={4} className="mb-6" />
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(340px,0.85fr)]">
            <Card className={SURFACE_CARD_CLASS_NAME}>
              <CardContent className="p-6">
                <SectionSkeleton lines={5} />
              </CardContent>
            </Card>
            <Card className={SURFACE_CARD_CLASS_NAME}>
              <CardContent className="p-6">
                <SectionSkeleton lines={4} />
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}

      {!payrollEmployeesQuery.isPending &&
      !payrollEmployeesQuery.isError &&
      previewEmployees.length === 0 ? (
        hasActiveFilters ? (
          <SearchEmptyState
            className="mb-6"
            title="No payroll employees match this export scope"
            description="Try changing the export filters or clear them before generating a CSV."
            actions={
              <Button type="button" variant="outline" onClick={handleClearFilters}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <EmptyState
            className="mb-6"
            title="No payroll-safe employees available for export"
            description="The export center will become available once payroll-visible employee records exist."
          />
        )
      ) : null}

      {!payrollEmployeesQuery.isPending &&
      !payrollEmployeesQuery.isError &&
      previewEmployees.length > 0 ? (
        <div className="mb-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(340px,0.85fr)]">
          <Card className={SURFACE_CARD_CLASS_NAME}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-950">
                <FileDown className="h-4 w-4 text-slate-600" />
                Filtered employee directory CSV
              </CardTitle>
              <CardDescription>
                Generate a controlled CSV export for the current payroll-safe employee scope.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
                <p className="text-sm font-medium text-slate-900">Export summary</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">Rows</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {previewEmployees.length}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">Contract scope</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {contractFilter === 'all' ? 'All contract types' : formatContractType(contractFilter)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">Department</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {selectedDepartmentName ?? 'All departments'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">Regional branch</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {branchFilter === 'all'
                        ? 'All regional branches'
                        : formatRegionalBranch(branchFilter)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">Status</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {statusFilter === 'ALL' ? 'All statuses' : statusFilter}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-slate-900">Included fields</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {EXPORT_FIELD_LABELS.map((fieldLabel) => (
                    <StatusBadge key={fieldLabel} tone="neutral" emphasis="outline">
                      {fieldLabel}
                    </StatusBadge>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
                Internal HR notes, QR controls, public-profile settings, social security numbers,
                and unsupported sensitive fields are intentionally excluded from CSV exports.
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={() => setIsReviewDialogOpen(true)}
                  disabled={exportCsvMutation.isPending}
                >
                  <FileDown className="mr-2 h-4 w-4" />
                  {exportCsvMutation.isPending ? 'Preparing export...' : 'Review export'}
                </Button>
                <Button asChild variant="outline">
                  <Link to={ROUTES.PAYROLL_EMPLOYEES}>
                    Open employee directory
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className={SURFACE_CARD_CLASS_NAME}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-950">
                <FileText className="h-4 w-4 text-slate-600" />
                Available export actions
              </CardTitle>
              <CardDescription>
                Payroll exports remain read-only and limited to payroll-approved data surfaces.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
                <p className="text-sm font-semibold text-slate-900">Batch CSV export</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Export the currently filtered payroll employee directory as CSV using the same
                  payroll-safe scope visible in this workspace.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
                <p className="text-sm font-semibold text-slate-900">Employee information sheet</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Individual employee sheets remain available from employee detail pages and can be
                  printed or saved as PDF through the browser.
                </p>
                <Button asChild variant="outline" size="sm" className="mt-3">
                  <Link to={ROUTES.PAYROLL_EMPLOYEES}>
                    Browse employees
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>

              <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-sm leading-6 text-slate-600">
                Export actions are logged for payroll activity visibility. Email delivery,
                unrestricted file exports, and payroll calculations remain intentionally unavailable.
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Card className={SURFACE_CARD_CLASS_NAME}>
        <CardHeader>
          <CardTitle className="text-base font-semibold text-slate-950">
            Recent export activity
          </CardTitle>
          <CardDescription>
            Latest payroll export events recorded for this payroll account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {exportHistoryQuery.isPending ? (
            <SectionSkeleton lines={5} />
          ) : exportHistoryQuery.isError ? (
            <ErrorState
              surface="plain"
              align="left"
              title="Could not load export activity"
              description="We couldn't load payroll export history right now."
              message={exportHistoryQuery.error.message}
              onRetry={() => void exportHistoryQuery.refetch()}
            />
          ) : exportHistory.length === 0 ? (
            <EmptyState
              surface="plain"
              align="left"
              title="No payroll exports yet"
              description="Generated CSV exports and information sheet print actions will appear here."
            />
          ) : (
            <div className="space-y-3">
              {exportHistory.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge tone={getExportActionTone(item.action)}>
                          {formatExportActionLabel(item.action)}
                        </StatusBadge>
                        <StatusBadge tone="neutral" emphasis="outline">
                          {item.exportType === 'PAYROLL_EMPLOYEE_INFORMATION_SHEET'
                            ? 'Information sheet'
                            : 'CSV'}
                        </StatusBadge>
                      </div>

                      <p className="mt-3 text-sm font-semibold text-slate-950">
                        {buildExportHistoryDescription(item)}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
                        <span>{formatTimestamp(item.createdAt)}</span>
                        {item.rowCount !== null ? <span>{item.rowCount} row(s)</span> : null}
                        {item.fileName ? <span className="font-mono">{item.fileName}</span> : null}
                      </div>
                    </div>

                    {item.employeeId ? (
                      <Button asChild size="sm" variant="outline">
                        <Link to={getPayrollEmployeeRoute(item.employeeId)}>
                          Open employee
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isReviewDialogOpen} onOpenChange={setIsReviewDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review payroll CSV export</DialogTitle>
            <DialogDescription>
              Confirm the payroll-safe export scope before the CSV file is generated.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Rows to export</p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">
                  {previewEmployees.length}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Included fields</p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">
                  {EXPORT_FIELD_LABELS.length}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
              <p className="text-sm font-medium text-slate-900">Filter context</p>
              <dl className="mt-3 space-y-2 text-sm text-slate-600">
                <div className="flex flex-col gap-1 sm:flex-row sm:gap-3">
                  <dt className="min-w-32 text-slate-500">Search</dt>
                  <dd>{searchInput.trim() || 'None'}</dd>
                </div>
                <div className="flex flex-col gap-1 sm:flex-row sm:gap-3">
                  <dt className="min-w-32 text-slate-500">Department</dt>
                  <dd>{selectedDepartmentName ?? 'All departments'}</dd>
                </div>
                <div className="flex flex-col gap-1 sm:flex-row sm:gap-3">
                  <dt className="min-w-32 text-slate-500">Regional branch</dt>
                  <dd>
                    {branchFilter === 'all'
                      ? 'All regional branches'
                      : formatRegionalBranch(branchFilter)}
                  </dd>
                </div>
                <div className="flex flex-col gap-1 sm:flex-row sm:gap-3">
                  <dt className="min-w-32 text-slate-500">Status</dt>
                  <dd>{statusFilter === 'ALL' ? 'All statuses' : statusFilter}</dd>
                </div>
                <div className="flex flex-col gap-1 sm:flex-row sm:gap-3">
                  <dt className="min-w-32 text-slate-500">Contract type</dt>
                  <dd>
                    {contractFilter === 'all'
                      ? 'All contract types'
                      : formatContractType(contractFilter)}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
              This export excludes social security numbers, internal notes, QR/public-profile data,
              and any field outside the current payroll-safe export policy.
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsReviewDialogOpen(false)}
              disabled={exportCsvMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleGenerateCsvExport()}
              disabled={exportCsvMutation.isPending || previewEmployees.length === 0}
            >
              <FileDown className="mr-2 h-4 w-4" />
              {exportCsvMutation.isPending ? 'Generating...' : 'Generate CSV'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PayrollLayout>
  )
}
