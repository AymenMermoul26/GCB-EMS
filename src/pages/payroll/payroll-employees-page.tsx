import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  FileDown,
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
import {
  PageHeader,
  SURFACE_CARD_CLASS_NAME,
  SURFACE_PANEL_CLASS_NAME,
} from '@/components/common/page-header'
import { StatusBadge } from '@/components/common/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
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
import { ROUTES, getPayrollEmployeeRoute } from '@/constants/routes'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { useAuth } from '@/hooks/use-auth'
import { useI18n } from '@/hooks/use-i18n'
import { PayrollLayout } from '@/layouts/payroll-layout'
import {
  usePayrollEmployeesDirectoryQuery,
  usePayrollEmployeesQuery,
} from '@/services/payrollEmployeesService'
import {
  EMPLOYEE_REGIONAL_BRANCH_LABELS,
  EMPLOYEE_REGIONAL_BRANCH_OPTIONS,
  getEmployeeRegionalBranchLabel,
  getEmployeePosteLabel,
  getEmployeeTypeContratLabel,
} from '@/types/employee'
import { getDepartmentDisplayName } from '@/types/department'
import type {
  PayrollEmployeeListFilters,
  PayrollEmployeeListItem,
  PayrollEmployeeStatusFilter,
} from '@/types/payroll'
import type { TranslateFn } from '@/i18n/messages'

function formatDepartmentName(employee: PayrollEmployeeListItem, t: TranslateFn): string {
  return (
    getDepartmentDisplayName(employee.departementNom)?.trim() ||
    t('payroll.employeeDirectory.fallbacks.departmentNotAssigned')
  )
}

function formatRegionalBranch(value: string | null | undefined, t: TranslateFn): string {
  const normalized = getEmployeeRegionalBranchLabel(value)?.trim()
  if (!normalized) {
    return t('payroll.employeeDirectory.fallbacks.branchNotAssigned')
  }

  return normalized
}

function formatJobTitle(value: string | null | undefined, t: TranslateFn): string {
  const normalized = getEmployeePosteLabel(value)?.trim()
  return normalized && normalized.length > 0
    ? normalized
    : t('payroll.employeeDirectory.fallbacks.jobTitleNotSet')
}

function formatContractType(value: string | null | undefined, t: TranslateFn): string {
  return getEmployeeTypeContratLabel(value) ?? t('common.notSet')
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
    .map(([id, nom]) => ({ id, nom: getDepartmentDisplayName(nom) ?? nom }))
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
  const { isRTL, t } = useI18n()
  const [searchInput, setSearchInput] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('all')
  const [branchFilter, setBranchFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<PayrollEmployeeStatusFilter>('ALL')
  const [contractFilter, setContractFilter] = useState('all')
  const debouncedSearch = useDebouncedValue(searchInput, 350)

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
    branchFilter !== 'all' ||
    statusFilter !== 'ALL' ||
    contractFilter !== 'all'

  const exportCenterHref = useMemo(() => {
    const params = new URLSearchParams()

    if (searchInput.trim().length > 0) {
      params.set('search', searchInput.trim())
    }

    if (departmentFilter !== 'all') {
      params.set('department', departmentFilter)
    }

    if (branchFilter !== 'all') {
      params.set('branch', branchFilter)
    }

    if (statusFilter !== 'ALL') {
      params.set('status', statusFilter)
    }

    if (contractFilter !== 'all') {
      params.set('contract', contractFilter)
    }

    const queryString = params.toString()
    return queryString ? `${ROUTES.PAYROLL_EXPORTS}?${queryString}` : ROUTES.PAYROLL_EXPORTS
  }, [branchFilter, contractFilter, departmentFilter, searchInput, statusFilter])

  const handleClearFilters = () => {
    setSearchInput('')
    setDepartmentFilter('all')
    setBranchFilter('all')
    setStatusFilter('ALL')
    setContractFilter('all')
  }

  return (
    <PayrollLayout
      title={t('payroll.employeeDirectory.title')}
      subtitle={t('payroll.employeeDirectory.subtitle')}
      onSignOut={signOut}
      userEmail={user?.email ?? null}
    >
      <PageHeader
        title={t('payroll.employeeDirectory.title')}
        description={t('payroll.employeeDirectory.headerDescription')}
        className="mb-6"
        badges={
          <>
            <StatusBadge tone="neutral" emphasis="outline">
              {t('payroll.employeeDirectory.readOnlyBadge')}
            </StatusBadge>
            <StatusBadge tone="brand">
              {t('payroll.employeeDirectory.matchedBadge', {
                count: String(employees.length),
              })}
            </StatusBadge>
          </>
        }
        actions={
          <Button asChild variant="outline">
            <Link to={exportCenterHref}>
              <FileDown className={cn('h-4 w-4', isRTL ? 'ml-2' : 'mr-2')} />
              {t('payroll.employeeDirectory.exportCenter')}
            </Link>
          </Button>
        }
      >
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.5fr)_220px_220px_180px_220px_auto]">
          <div className="relative xl:col-span-1">
            <Search
              className={cn(
                'pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400',
                isRTL ? 'right-3' : 'left-3',
              )}
            />
            <Input
              aria-label={t('payroll.employeeDirectory.searchAria')}
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder={t('payroll.employeeDirectory.searchPlaceholder')}
              className={cn(isRTL ? 'pr-9' : 'pl-9')}
            />
          </div>

          <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
            <SelectTrigger aria-label={t('payroll.employeeDirectory.filters.departmentAria')}>
              <SelectValue placeholder={t('common.department')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('payroll.employeeDirectory.filters.allDepartments')}</SelectItem>
              {departmentOptions.map((department) => (
                <SelectItem key={department.id} value={department.id}>
                  {department.nom}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={branchFilter} onValueChange={setBranchFilter}>
            <SelectTrigger aria-label={t('payroll.employeeDirectory.filters.branchAria')}>
              <SelectValue placeholder={t('employee.profile.fields.regionalBranch')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('payroll.employeeDirectory.filters.allBranches')}</SelectItem>
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
            <SelectTrigger aria-label={t('payroll.employeeDirectory.filters.statusAria')}>
              <SelectValue placeholder={t('common.status')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t('payroll.employeeDirectory.filters.allStatuses')}</SelectItem>
              <SelectItem value="ACTIVE">{t('status.common.active')}</SelectItem>
              <SelectItem value="INACTIVE">{t('status.common.inactive')}</SelectItem>
            </SelectContent>
          </Select>

          <Select value={contractFilter} onValueChange={setContractFilter}>
            <SelectTrigger aria-label={t('payroll.employeeDirectory.filters.contractTypeAria')}>
              <SelectValue placeholder={t('employee.profile.fields.contractType')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('payroll.employeeDirectory.filters.allContractTypes')}</SelectItem>
              {contractOptions.map((contractType) => (
                <SelectItem key={contractType} value={contractType}>
                  {formatContractType(contractType, t)}
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
            <Filter className={cn('h-4 w-4', isRTL ? 'ml-2' : 'mr-2')} />
            {t('actions.clearFilters')}
          </Button>
        </div>
      </PageHeader>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Card className={SURFACE_CARD_CLASS_NAME}>
          <CardHeader className="space-y-2 pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <UserRound className="h-4 w-4 text-slate-600" />
              {t('payroll.employeeDirectory.summaries.accessibleEmployeesTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-slate-950">
              {formatSummaryValue(totalAccessibleEmployees)}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {t('payroll.employeeDirectory.summaries.accessibleEmployeesHelper')}
            </p>
          </CardContent>
        </Card>

        <Card className={SURFACE_CARD_CLASS_NAME}>
          <CardHeader className="space-y-2 pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <ShieldCheck className="h-4 w-4 text-slate-600" />
              {t('payroll.employeeDirectory.summaries.activeEmployeesTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-slate-950">
              {formatSummaryValue(activeEmployeesCount)}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {t('payroll.employeeDirectory.summaries.activeEmployeesHelper')}
            </p>
          </CardContent>
        </Card>

        <Card className={SURFACE_CARD_CLASS_NAME}>
          <CardHeader className="space-y-2 pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Building2 className="h-4 w-4 text-slate-600" />
              {t('payroll.employeeDirectory.summaries.departmentCoverageTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-slate-950">
              {formatSummaryValue(departmentCoverageCount)}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {t('payroll.employeeDirectory.summaries.departmentCoverageHelper')}
            </p>
          </CardContent>
        </Card>
      </div>

      {payrollEmployeesQuery.isError ? (
        <ErrorState
          className="mb-6"
          title={t('payroll.employeeDirectory.loadErrorTitle')}
          description={t('payroll.employeeDirectory.loadErrorDescription')}
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
            title={t('payroll.employeeDirectory.searchEmptyTitle')}
            description={t('payroll.employeeDirectory.searchEmptyDescription')}
            actions={
              <Button type="button" variant="outline" onClick={handleClearFilters}>
                {t('actions.clearFilters')}
              </Button>
            }
          />
        ) : (
          <EmptyState
            title={t('payroll.employeeDirectory.emptyTitle')}
            description={t('payroll.employeeDirectory.emptyDescription')}
          />
        )
      ) : null}

      {!payrollEmployeesQuery.isPending &&
      !payrollEmployeesQuery.isError &&
      employees.length > 0 ? (
        <>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-600">
              {t('payroll.employeeDirectory.showingCount', {
                count: String(employees.length),
                updating: payrollEmployeesQuery.isFetching
                  ? t('payroll.employeeDirectory.updatingSuffix')
                  : '',
              })}
            </p>
            <StatusBadge tone="neutral" emphasis="outline">
              {t('payroll.employeeDirectory.consultationOnly')}
            </StatusBadge>
          </div>

          <div className={cn('hidden overflow-hidden lg:block', SURFACE_PANEL_CLASS_NAME)}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('common.employee')}</TableHead>
                  <TableHead>{t('employee.profile.fields.employeeId')}</TableHead>
                  <TableHead>{t('payroll.employeeDirectory.table.departmentBranch')}</TableHead>
                  <TableHead>{t('common.jobTitle')}</TableHead>
                  <TableHead>{t('employee.profile.fields.contractType')}</TableHead>
                  <TableHead>{t('common.status')}</TableHead>
                  <TableHead className={cn('w-[140px]', isRTL ? 'text-left' : 'text-right')}>
                    {t('payroll.employeeDirectory.table.action')}
                  </TableHead>
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
                            {t('payroll.employeeDirectory.table.employeeRecord')}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm text-slate-700">
                      {employee.matricule}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <p>{formatDepartmentName(employee, t)}</p>
                        <p className="text-xs text-slate-500">
                          {formatRegionalBranch(employee.regionalBranch, t)}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>{formatJobTitle(employee.poste, t)}</TableCell>
                    <TableCell>{formatContractType(employee.typeContrat, t)}</TableCell>
                    <TableCell>
                      <StatusBadge tone={employee.isActive ? 'success' : 'neutral'}>
                        {employee.isActive ? t('status.common.active') : t('status.common.inactive')}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className={cn(isRTL ? 'text-left' : 'text-right')}>
                      <Button asChild size="sm" variant="outline">
                        <Link to={getPayrollEmployeeRoute(employee.id)}>
                          {t('actions.open')}
                          <ArrowRight
                            className={cn('h-4 w-4', isRTL ? 'mr-2 rotate-180' : 'ml-2')}
                          />
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
                          {formatJobTitle(employee.poste, t)}
                        </p>
                      </div>
                    </div>
                    <StatusBadge tone={employee.isActive ? 'success' : 'neutral'}>
                      {employee.isActive ? t('status.common.active') : t('status.common.inactive')}
                    </StatusBadge>
                  </div>

                  <div className="space-y-2 text-sm text-slate-700">
                    <div className="flex items-center gap-2">
                      <IdCard className="h-4 w-4 text-slate-400" />
                      <span className="font-mono">{employee.matricule}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-slate-400" />
                      <div className="min-w-0">
                        <p className="truncate">{formatDepartmentName(employee, t)}</p>
                        <p className="truncate text-xs text-slate-500">
                          {formatRegionalBranch(employee.regionalBranch, t)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <BriefcaseBusiness className="h-4 w-4 text-slate-400" />
                      <span>{formatContractType(employee.typeContrat, t)}</span>
                    </div>
                  </div>

                  <Button asChild variant="outline" className="w-full">
                    <Link to={getPayrollEmployeeRoute(employee.id)}>
                      {t('payroll.employeeDirectory.mobileOpenDetail')}
                      <ArrowRight
                        className={cn('h-4 w-4', isRTL ? 'mr-2 rotate-180' : 'ml-2')}
                      />
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
