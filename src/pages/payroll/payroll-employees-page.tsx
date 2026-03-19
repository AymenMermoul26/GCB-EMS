import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  Filter,
  IdCard,
  Search,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import {
  EmptyState,
  ErrorState,
  PageStateSkeleton,
  SearchEmptyState,
} from '@/components/common/page-state'
import { PageHeader, SURFACE_CARD_CLASS_NAME } from '@/components/common/page-header'
import { StatusBadge } from '@/components/common/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
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
import { getPayrollEmployeeRoute } from '@/constants/routes'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { useAuth } from '@/hooks/use-auth'
import { PayrollLayout } from '@/layouts/payroll-layout'
import {
  usePayrollEmployeesDirectoryQuery,
  usePayrollEmployeesQuery,
} from '@/services/payrollEmployeesService'
import {
  getEmployeeTypeContratLabel,
} from '@/types/employee'
import type {
  PayrollEmployeeListFilters,
  PayrollEmployeeListItem,
  PayrollEmployeeStatusFilter,
} from '@/types/payroll'

function formatDepartmentName(employee: PayrollEmployeeListItem): string {
  return employee.departementNom?.trim() || 'Department not assigned'
}

function formatJobTitle(value: string | null | undefined): string {
  const normalized = value?.trim()
  return normalized && normalized.length > 0 ? normalized : 'Job title not set'
}

function formatContractType(value: string | null | undefined): string {
  return getEmployeeTypeContratLabel(value) ?? 'Not set'
}

function buildFullName(employee: PayrollEmployeeListItem): string {
  return `${employee.prenom} ${employee.nom}`
}

function getInitials(employee: PayrollEmployeeListItem): string {
  return `${employee.prenom.trim().charAt(0)}${employee.nom.trim().charAt(0)}`.toUpperCase() || 'NA'
}

function formatSummaryValue(value: number | null): string {
  return value === null ? '\u2014' : String(value)
}

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

export function PayrollEmployeesPage() {
  const { signOut, user } = useAuth()
  const [searchInput, setSearchInput] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<PayrollEmployeeStatusFilter>('ALL')
  const [contractFilter, setContractFilter] = useState('all')
  const debouncedSearch = useDebouncedValue(searchInput, 350)

  const filters = useMemo<PayrollEmployeeListFilters>(
    () => ({
      search: debouncedSearch.trim() || undefined,
      departementId: departmentFilter === 'all' ? undefined : departmentFilter,
      status: statusFilter,
      typeContrat: contractFilter === 'all' ? undefined : contractFilter,
    }),
    [contractFilter, debouncedSearch, departmentFilter, statusFilter],
  )

  const payrollEmployeesQuery = usePayrollEmployeesDirectoryQuery(filters)
  const payrollReferenceQuery = usePayrollEmployeesQuery()

  const employees = payrollEmployeesQuery.data ?? []
  const referenceEmployees = useMemo(
    () => payrollReferenceQuery.data ?? payrollEmployeesQuery.data ?? [],
    [payrollEmployeesQuery.data, payrollReferenceQuery.data],
  )

  const departmentOptions = useMemo(
    () => buildDepartmentOptions(referenceEmployees),
    [referenceEmployees],
  )
  const contractOptions = useMemo(
    () => buildContractTypeOptions(referenceEmployees),
    [referenceEmployees],
  )

  const totalAccessibleEmployees = payrollReferenceQuery.data?.length ?? null
  const activeEmployeesCount = useMemo(() => {
    if (!payrollReferenceQuery.data) {
      return null
    }

    return payrollReferenceQuery.data.filter((employee) => employee.isActive).length
  }, [payrollReferenceQuery.data])
  const departmentCoverageCount = useMemo(() => {
    if (!payrollReferenceQuery.data) {
      return null
    }

    return new Set(
      payrollReferenceQuery.data
        .map((employee) => employee.departementId)
        .filter((departementId) => departementId && departementId.length > 0),
    ).size
  }, [payrollReferenceQuery.data])

  const hasActiveFilters =
    searchInput.trim().length > 0 ||
    departmentFilter !== 'all' ||
    statusFilter !== 'ALL' ||
    contractFilter !== 'all'

  const handleClearFilters = () => {
    setSearchInput('')
    setDepartmentFilter('all')
    setStatusFilter('ALL')
    setContractFilter('all')
  }

  return (
    <PayrollLayout
      title="Payroll Employees"
      subtitle="Read-only payroll employee consultation."
      onSignOut={signOut}
      userEmail={user?.email ?? null}
    >
      <PageHeader
        title="Payroll Employees"
        description="Search and review payroll-relevant employee information without admin editing, QR controls, or internal HR notes."
        className="mb-6"
        badges={
          <>
            <StatusBadge tone="neutral" emphasis="outline">
              Read-only
            </StatusBadge>
            <StatusBadge tone="brand">{employees.length} matched</StatusBadge>
          </>
        }
      >
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.5fr)_220px_180px_220px_auto]">
          <div className="relative xl:col-span-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              aria-label="Search payroll employees"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search by name, employee ID, or email..."
              className="pl-9"
            />
          </div>

          <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
            <SelectTrigger aria-label="Filter by department">
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

          <Select
            value={statusFilter}
            onValueChange={(value: PayrollEmployeeStatusFilter) => setStatusFilter(value)}
          >
            <SelectTrigger aria-label="Filter by status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="INACTIVE">Inactive</SelectItem>
            </SelectContent>
          </Select>

          <Select value={contractFilter} onValueChange={setContractFilter}>
            <SelectTrigger aria-label="Filter by contract type">
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

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Card className={SURFACE_CARD_CLASS_NAME}>
          <CardHeader className="space-y-2 pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <UserRound className="h-4 w-4 text-slate-600" />
              Accessible employees
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-slate-950">
              {formatSummaryValue(totalAccessibleEmployees)}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Employees currently available to payroll consultation.
            </p>
          </CardContent>
        </Card>

        <Card className={SURFACE_CARD_CLASS_NAME}>
          <CardHeader className="space-y-2 pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <ShieldCheck className="h-4 w-4 text-slate-600" />
              Active employees
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-slate-950">
              {formatSummaryValue(activeEmployeesCount)}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Active employee records visible to payroll users.
            </p>
          </CardContent>
        </Card>

        <Card className={SURFACE_CARD_CLASS_NAME}>
          <CardHeader className="space-y-2 pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Building2 className="h-4 w-4 text-slate-600" />
              Department coverage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-slate-950">
              {formatSummaryValue(departmentCoverageCount)}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Departments represented in the payroll consultation scope.
            </p>
          </CardContent>
        </Card>
      </div>

      {payrollEmployeesQuery.isError ? (
        <ErrorState
          className="mb-6"
          title="Could not load payroll employees"
          description="We couldn't load the payroll employee directory right now."
          message={payrollEmployeesQuery.error.message}
          onRetry={() => {
            void payrollEmployeesQuery.refetch()
            void payrollReferenceQuery.refetch()
          }}
        />
      ) : null}

      {payrollEmployeesQuery.isPending ? <PageStateSkeleton variant="table" count={6} /> : null}

      {!payrollEmployeesQuery.isPending &&
      !payrollEmployeesQuery.isError &&
      employees.length === 0 ? (
        hasActiveFilters ? (
          <SearchEmptyState
            title="No payroll employees found"
            description="Try changing your search terms or filters."
            actions={
              <Button type="button" variant="outline" onClick={handleClearFilters}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <EmptyState
            title="No payroll employees available"
            description="No employee records are currently available for payroll consultation."
          />
        )
      ) : null}

      {!payrollEmployeesQuery.isPending &&
      !payrollEmployeesQuery.isError &&
      employees.length > 0 ? (
        <>
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-sm text-slate-600">
              Showing {employees.length} payroll employee
              {employees.length === 1 ? '' : 's'}
              {payrollEmployeesQuery.isFetching ? ' (updating...)' : ''}
            </p>
            <StatusBadge tone="neutral" emphasis="outline">
              Consultation only
            </StatusBadge>
          </div>

          <div className="hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm lg:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Employee ID</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Job title</TableHead>
                  <TableHead>Contract type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[140px] text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((employee) => (
                  <TableRow key={employee.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-xs font-semibold text-slate-600">
                          {getInitials(employee)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-900">
                            {buildFullName(employee)}
                          </p>
                          <p className="truncate text-xs text-slate-500">
                            Payroll employee record
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm text-slate-700">
                      {employee.matricule}
                    </TableCell>
                    <TableCell>{formatDepartmentName(employee)}</TableCell>
                    <TableCell>{formatJobTitle(employee.poste)}</TableCell>
                    <TableCell>{formatContractType(employee.typeContrat)}</TableCell>
                    <TableCell>
                      <StatusBadge tone={employee.isActive ? 'success' : 'neutral'}>
                        {employee.isActive ? 'Active' : 'Inactive'}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link to={getPayrollEmployeeRoute(employee.id)}>
                          Open
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="grid gap-4 lg:hidden">
            {employees.map((employee) => (
              <Card key={employee.id} className={SURFACE_CARD_CLASS_NAME}>
                <CardContent className="space-y-4 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-sm font-semibold text-slate-600">
                        {getInitials(employee)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900">
                          {buildFullName(employee)}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {formatJobTitle(employee.poste)}
                        </p>
                      </div>
                    </div>
                    <StatusBadge tone={employee.isActive ? 'success' : 'neutral'}>
                      {employee.isActive ? 'Active' : 'Inactive'}
                    </StatusBadge>
                  </div>

                  <div className="space-y-2 text-sm text-slate-700">
                    <div className="flex items-center gap-2">
                      <IdCard className="h-4 w-4 text-slate-400" />
                      <span className="font-mono">{employee.matricule}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-slate-400" />
                      <span>{formatDepartmentName(employee)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <BriefcaseBusiness className="h-4 w-4 text-slate-400" />
                      <span>{formatContractType(employee.typeContrat)}</span>
                    </div>
                  </div>

                  <Button asChild variant="outline" className="w-full">
                    <Link to={getPayrollEmployeeRoute(employee.id)}>
                      Open payroll detail
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      ) : null}
    </PayrollLayout>
  )
}
