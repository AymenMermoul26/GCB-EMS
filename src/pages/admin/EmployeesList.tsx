import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  Building2,
  Eye,
  FileDown,
  Filter,
  LayoutGrid,
  List,
  Mail,
  Phone,
  Plus,
  QrCode,
  Search,
  UserCheck,
  UserPen,
  UserX,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import {
  EmptyState,
  ErrorState,
  PageStateSkeleton,
  SearchEmptyState,
} from '@/components/common/page-state'
import {
  BRAND_BUTTON_CLASS_NAME,
  PageHeader,
  SURFACE_PANEL_CLASS_NAME,
} from '@/components/common/page-header'
import { StatusBadge } from '@/components/common/status-badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
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
import { ROUTES, getAdminEmployeeRoute } from '@/constants/routes'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { DashboardLayout } from '@/layouts/dashboard-layout'
import { cn } from '@/lib/utils'
import { auditService } from '@/services/auditService'
import { departmentsService, useDepartmentsQuery } from '@/services/departmentsService'
import {
  employeesService,
  useActivateEmployeeMutation,
  useDeactivateEmployeeMutation,
} from '@/services/employeesService'
import type { Employee, EmployeesListParams } from '@/types/employee'
import { downloadCsv, toCsv, type CsvColumn } from '@/utils/csv'

type StatusFilter = 'all' | 'active' | 'inactive'
type ViewMode = 'grid' | 'table'

interface ExportRow {
  matricule: string
  nom: string
  prenom: string
  poste: string
  departement: string
  is_active: string
  email: string
  telephone: string
}

const EXPORT_COLUMNS: CsvColumn<ExportRow>[] = [
  { key: 'matricule', header: 'matricule' },
  { key: 'nom', header: 'nom' },
  { key: 'prenom', header: 'prenom' },
  { key: 'poste', header: 'poste' },
  { key: 'departement', header: 'departement' },
  { key: 'is_active', header: 'is_active' },
  { key: 'email', header: 'email' },
  { key: 'telephone', header: 'telephone' },
]

function formatDepartmentName(
  departmentMap: Map<string, string>,
  departmentId: string,
) {
  return departmentMap.get(departmentId) ?? departmentId
}

function toExportRows(
  employees: Employee[],
  departmentMap: Map<string, string>,
): ExportRow[] {
  return employees.map((employee) => ({
    matricule: employee.matricule,
    nom: employee.nom,
    prenom: employee.prenom,
    poste: employee.poste ?? '',
    departement: formatDepartmentName(departmentMap, employee.departementId),
    is_active: employee.isActive ? 'true' : 'false',
    email: employee.email ?? '',
    telephone: employee.telephone ?? '',
  }))
}

function getInitials(employee: Employee) {
  const prenomInitial = employee.prenom.trim().charAt(0)
  const nomInitial = employee.nom.trim().charAt(0)
  return `${prenomInitial}${nomInitial}`.toUpperCase() || 'NA'
}

function isEmptyValue(value: string | null | undefined) {
  return !value || value.trim().length === 0
}

export function EmployeesListPage() {
  const navigate = useNavigate()

  const [searchInput, setSearchInput] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [exporting, setExporting] = useState(false)
  const [employeeStatusTarget, setEmployeeStatusTarget] = useState<Employee | null>(null)

  const debouncedSearch = useDebouncedValue(searchInput, 400)
  const sort = useMemo(() => ({ field: 'updated_at', direction: 'desc' } as const), [])

  const filters = useMemo<EmployeesListParams>(
    () => ({
      search: debouncedSearch.trim() || undefined,
      departementId: departmentFilter === 'all' ? undefined : departmentFilter,
      isActive:
        statusFilter === 'all' ? undefined : statusFilter === 'active',
      page,
      pageSize,
      sort,
    }),
    [debouncedSearch, departmentFilter, statusFilter, page, pageSize, sort],
  )

  const employeesQuery = useQuery({
    queryKey: [
      'employees',
      filters.search ?? '',
      filters.departementId ?? 'all',
      filters.isActive ?? 'all',
      filters.page,
      filters.pageSize,
      sort.field,
      sort.direction,
    ],
    queryFn: () => employeesService.listEmployees(filters),
    placeholderData: keepPreviousData,
  })

  const departmentsQuery = useDepartmentsQuery()

  const departmentNameById = useMemo(
    () =>
      new Map(
        (departmentsQuery.data ?? []).map((department) => [
          department.id,
          department.nom,
        ]),
      ),
    [departmentsQuery.data],
  )

  const employees = employeesQuery.data?.data ?? []
  const total = employeesQuery.data?.total ?? 0
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = total === 0 ? 0 : Math.min(page * pageSize, total)
  const canGoPrev = page > 1
  const canGoNext = to < total
  const hasActiveFilters =
    searchInput.trim().length > 0 ||
    departmentFilter !== 'all' ||
    statusFilter !== 'all'

  const activateMutation = useActivateEmployeeMutation({
    onSuccess: async (employee) => {
      toast.success('Employee activated.')
      setEmployeeStatusTarget(null)
      try {
        await auditService.insertAuditLog({
          action: 'EMPLOYEE_ACTIVATED',
          targetType: 'Employe',
          targetId: employee.id,
          detailsJson: {
            employe_id: employee.id,
            matricule: employee.matricule,
            is_active: true,
          },
        })
      } catch (error) {
        console.error('Failed to write employee activation audit log', error)
      }
      void employeesQuery.refetch()
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const deactivateMutation = useDeactivateEmployeeMutation({
    onSuccess: async (employee) => {
      toast.success('Employee deactivated.')
      setEmployeeStatusTarget(null)
      try {
        await auditService.insertAuditLog({
          action: 'EMPLOYEE_DEACTIVATED',
          targetType: 'Employe',
          targetId: employee.id,
          detailsJson: {
            employe_id: employee.id,
            matricule: employee.matricule,
            is_active: false,
          },
        })
      } catch (error) {
        console.error('Failed to write employee deactivation audit log', error)
      }
      void employeesQuery.refetch()
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })
  const isStatusMutationPending =
    activateMutation.isPending || deactivateMutation.isPending

  const handleClearFilters = () => {
    setSearchInput('')
    setDepartmentFilter('all')
    setStatusFilter('all')
    setPage(1)
  }

  const handleExportCsv = async () => {
    if (!employeesQuery.data) {
      return
    }

    setExporting(true)

    try {
      const currentFilters = {
        search: filters.search,
        departementId: filters.departementId,
        isActive: filters.isActive,
        sort,
      }

      let exportEmployees: Employee[] = []
      let isCurrentPageOnly = false

      if (employeesQuery.data.total > 5000) {
        exportEmployees = employeesQuery.data.data
        isCurrentPageOnly = true
      } else {
        const exportPageSize = 500
        const totalPages = Math.max(
          1,
          Math.ceil(employeesQuery.data.total / exportPageSize),
        )

        for (let currentPage = 1; currentPage <= totalPages; currentPage += 1) {
          const response = await employeesService.listEmployees({
            ...currentFilters,
            page: currentPage,
            pageSize: exportPageSize,
          })
          exportEmployees = [...exportEmployees, ...response.data]
        }
      }

      if (exportEmployees.length === 0) {
        toast.info('No employees to export.')
        return
      }

      const departments =
        departmentsQuery.data ?? (await departmentsService.listDepartments())
      const departmentMap = new Map(
        departments.map((department) => [department.id, department.nom]),
      )

      const exportRows = toExportRows(exportEmployees, departmentMap)
      const csv = toCsv(exportRows, EXPORT_COLUMNS)
      const date = new Date().toISOString().slice(0, 10)
      downloadCsv(`ems_employees_${date}.csv`, csv)

      if (isCurrentPageOnly) {
        toast.info('Dataset too large; exported current page.')
      } else {
        toast.success('CSV export completed.')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to export CSV')
    } finally {
      setExporting(false)
    }
  }

  const handleOpenEmployeeDetails = (employeeId: string) => {
    navigate(getAdminEmployeeRoute(employeeId))
  }

  const handleOpenEmployeeQr = (employeeId: string) => {
    navigate(`${getAdminEmployeeRoute(employeeId)}#qr`)
  }

  const handleOpenEmployeeEdit = (employeeId: string) => {
    navigate(`${getAdminEmployeeRoute(employeeId)}#edit`)
  }

  const handleConfirmStatusChange = async () => {
    if (!employeeStatusTarget) {
      return
    }

    if (employeeStatusTarget.isActive) {
      await deactivateMutation.mutateAsync(employeeStatusTarget.id)
      return
    }

    await activateMutation.mutateAsync(employeeStatusTarget.id)
  }

  return (
    <DashboardLayout
      title="Employees"
      subtitle="Employee directory and management workspace."
    >
      <PageHeader
        title="Employees"
        description="Manage employees, visibility, and QR tokens."
        className="sticky top-2 z-10 mb-6"
        badges={<StatusBadge tone="neutral">{total} total</StatusBadge>}
        actionsClassName="xl:max-w-3xl"
        actions={
          <>
            <div className="relative min-w-[250px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Search employees"
                value={searchInput}
                onChange={(event) => {
                  setSearchInput(event.target.value)
                  setPage(1)
                }}
                placeholder="Search by name, employee ID, or email..."
                className="pl-9"
              />
            </div>

            <Dialog open={isFilterDialogOpen} onOpenChange={setIsFilterDialogOpen}>
              <DialogTrigger asChild>
                <Button type="button" variant="outline" aria-label="Open filters">
                  <Filter className="mr-2 h-4 w-4" />
                  Filters
                  {hasActiveFilters ? (
                    <span className="ml-2 inline-flex h-2.5 w-2.5 rounded-full bg-[#ff6b35]" />
                  ) : null}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Filter employees</DialogTitle>
                  <DialogDescription>
                    Narrow down results by department and active status.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Department</p>
                    <Select
                      value={departmentFilter}
                      onValueChange={(value) => {
                        setDepartmentFilter(value)
                        setPage(1)
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All departments</SelectItem>
                        {(departmentsQuery.data ?? []).map((department) => (
                          <SelectItem key={department.id} value={department.id}>
                            {department.nom}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium">Status</p>
                    <Select
                      value={statusFilter}
                      onValueChange={(value: StatusFilter) => {
                        setStatusFilter(value)
                        setPage(1)
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All statuses</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium">Page size</p>
                    <Select
                      value={String(pageSize)}
                      onValueChange={(value) => {
                        setPageSize(Number(value))
                        setPage(1)
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select page size" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="20">20</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <DialogFooter className="mt-2 gap-2 sm:justify-between">
                  <Button type="button" variant="outline" onClick={handleClearFilters}>
                    Clear filters
                  </Button>
                  <Button type="button" onClick={() => setIsFilterDialogOpen(false)}>
                    Apply filters
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Button
              type="button"
              variant="outline"
              onClick={handleExportCsv}
              disabled={exporting || employeesQuery.isPending}
            >
              <FileDown className="mr-2 h-4 w-4" />
              {exporting ? 'Exporting...' : 'Export CSV'}
            </Button>

            <Button
              type="button"
              className={BRAND_BUTTON_CLASS_NAME}
              onClick={() => navigate(ROUTES.ADMIN_EMPLOYEES_NEW)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Employee
            </Button>
          </>
        }
      >
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Showing {from}-{to} of {total}
            {employeesQuery.isFetching ? ' (updating...)' : ''}
          </p>
          <div className="inline-flex items-center self-start rounded-xl border bg-slate-50 p-1">
            <Button
              type="button"
              size="sm"
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              className={viewMode === 'grid' ? 'bg-slate-900 text-white hover:bg-slate-800' : ''}
              onClick={() => setViewMode('grid')}
            >
              <LayoutGrid className="mr-2 h-4 w-4" />
              Grid
            </Button>
            <Button
              type="button"
              size="sm"
              variant={viewMode === 'table' ? 'default' : 'ghost'}
              className={viewMode === 'table' ? 'bg-slate-900 text-white hover:bg-slate-800' : ''}
              onClick={() => setViewMode('table')}
            >
              <List className="mr-2 h-4 w-4" />
              Table
            </Button>
          </div>
        </div>
      </PageHeader>

      {employeesQuery.isError ? (
        <ErrorState
          className="mb-6"
          title="Could not load employees"
          description="We couldn't load the employee directory right now."
          message={employeesQuery.error.message}
          onRetry={() => void employeesQuery.refetch()}
        />
      ) : null}

      {employeesQuery.isPending ? (
        <PageStateSkeleton variant={viewMode === 'table' ? 'table' : 'cards'} count={8} />
      ) : null}

      {!employeesQuery.isPending && !employeesQuery.isError && employees.length === 0 ? (
        <>
          {hasActiveFilters ? (
            <SearchEmptyState
              className="mx-auto mt-2 max-w-xl"
              title="No employees found"
              description="Try changing your search terms or filters."
              actions={
                <>
                  <Button variant="outline" onClick={handleClearFilters}>
                    Clear filters
                  </Button>
                  <Button
                    className={BRAND_BUTTON_CLASS_NAME}
                    onClick={() => navigate(ROUTES.ADMIN_EMPLOYEES_NEW)}
                  >
                    Add Employee
                  </Button>
                </>
              }
            />
          ) : (
            <EmptyState
              className="mx-auto mt-2 max-w-xl"
              title="No employees yet"
              description="Add the first employee to start managing the directory."
              actions={
                <Button
                  className="bg-gradient-to-br from-[#ff6b35] to-[#ffc947] text-white hover:brightness-95"
                  onClick={() => navigate(ROUTES.ADMIN_EMPLOYEES_NEW)}
                >
                  Add Employee
                </Button>
              }
            />
          )}
        </>
      ) : null}

      {!employeesQuery.isPending && !employeesQuery.isError && employees.length > 0 ? (
        <>
          {viewMode === 'grid' ? (
            <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {employees.map((employee) => (
                <Card
                  key={employee.id}
                  className={cn(
                    'group rounded-2xl border shadow-sm transition-all duration-200',
                    employee.isActive
                      ? 'border-slate-200/80 bg-white hover:-translate-y-0.5 hover:shadow-md'
                      : 'border-slate-300/90 bg-slate-100/80 text-slate-600 hover:border-slate-300 hover:bg-slate-100',
                  )}
                >
                  <CardContent className="flex h-full flex-col gap-4 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        {employee.photoUrl ? (
                          <img
                            src={employee.photoUrl}
                            alt={`${employee.prenom} ${employee.nom}`}
                            className={cn(
                              'h-12 w-12 rounded-full border object-cover',
                              !employee.isActive && 'grayscale',
                            )}
                          />
                        ) : (
                          <div
                            className={cn(
                              'flex h-12 w-12 items-center justify-center rounded-full border text-sm font-semibold',
                              employee.isActive
                                ? 'bg-slate-100 text-slate-600'
                                : 'bg-slate-200 text-slate-500',
                            )}
                          >
                            {getInitials(employee)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p
                            className={cn(
                              'truncate font-semibold',
                              employee.isActive ? 'text-slate-900' : 'text-slate-700',
                            )}
                          >
                            {employee.prenom} {employee.nom}
                          </p>
                          <p
                            className={cn(
                              'truncate text-xs',
                              employee.isActive ? 'text-muted-foreground' : 'text-slate-500',
                            )}
                          >
                            {employee.poste ?? 'No role assigned'}
                          </p>
                        </div>
                      </div>
                      <StatusBadge tone={employee.isActive ? 'success' : 'neutral'}>
                        {employee.isActive ? 'Active' : 'Inactive'}
                      </StatusBadge>
                    </div>

                    <div
                      className={cn(
                        'space-y-2 text-sm',
                        employee.isActive ? 'text-slate-700' : 'text-slate-600',
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Building2
                          className={cn(
                            'h-4 w-4',
                            employee.isActive ? 'text-slate-400' : 'text-slate-500',
                          )}
                        />
                        <span className="truncate">
                          {formatDepartmentName(departmentNameById, employee.departementId)}
                        </span>
                      </div>

                      <div
                        className={cn(
                          'inline-flex max-w-full items-center rounded-full px-2.5 py-1 font-mono text-xs',
                          employee.isActive
                            ? 'bg-slate-100 text-slate-600'
                            : 'bg-slate-200 text-slate-700',
                        )}
                      >
                        {employee.matricule}
                      </div>

                      <div className="flex items-center gap-2">
                        <Mail
                          className={cn(
                            'h-4 w-4',
                            employee.isActive ? 'text-slate-400' : 'text-slate-500',
                          )}
                        />
                        <span
                          className={cn(
                            'truncate text-xs',
                            employee.isActive ? 'text-muted-foreground' : 'text-slate-500',
                          )}
                        >
                          {isEmptyValue(employee.email) ? 'No email' : employee.email}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Phone
                          className={cn(
                            'h-4 w-4',
                            employee.isActive ? 'text-slate-400' : 'text-slate-500',
                          )}
                        />
                        <span
                          className={cn(
                            'truncate text-xs',
                            employee.isActive ? 'text-muted-foreground' : 'text-slate-500',
                          )}
                        >
                          {isEmptyValue(employee.telephone) ? 'No phone' : employee.telephone}
                        </span>
                      </div>
                    </div>

                    <div className="mt-auto grid grid-cols-2 gap-2 pt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={() => handleOpenEmployeeDetails(employee.id)}
                      >
                        <Eye className="mr-1 h-4 w-4" />
                        View
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={() => handleOpenEmployeeEdit(employee.id)}
                      >
                        <UserPen className="mr-1 h-4 w-4" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={() => handleOpenEmployeeQr(employee.id)}
                        disabled={!employee.isActive}
                      >
                        <QrCode className="mr-1 h-4 w-4" />
                        QR
                      </Button>
                      <Button
                        size="sm"
                        variant={employee.isActive ? 'destructive' : 'outline'}
                        className={cn(
                          'w-full',
                          employee.isActive
                            ? undefined
                            : 'border-transparent bg-gradient-to-br from-[#ff6b35] to-[#ffc947] text-white hover:brightness-95',
                        )}
                        disabled={isStatusMutationPending}
                        onClick={() => setEmployeeStatusTarget(employee)}
                      >
                        {employee.isActive ? (
                          <UserX className="mr-1 h-4 w-4" />
                        ) : (
                          <UserCheck className="mr-1 h-4 w-4" />
                        )}
                        {employee.isActive ? 'Deactivate' : 'Activate'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className={cn(SURFACE_PANEL_CLASS_NAME, 'overflow-hidden')}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Photo</TableHead>
                    <TableHead>Employee ID</TableHead>
                    <TableHead>Last Name</TableHead>
                    <TableHead>First Name</TableHead>
                    <TableHead>Job Title</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[250px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((employee) => (
                    <TableRow
                      key={employee.id}
                      className={cn(
                        employee.isActive
                          ? 'hover:bg-muted/30'
                          : 'bg-slate-50/80 text-slate-600 hover:bg-slate-100/80',
                      )}
                    >
                      <TableCell>
                        {employee.photoUrl ? (
                          <img
                            src={employee.photoUrl}
                            alt={`${employee.prenom} ${employee.nom}`}
                            className={cn(
                              'h-10 w-10 rounded-full border object-cover',
                              !employee.isActive && 'grayscale',
                            )}
                          />
                        ) : (
                          <div
                            className={cn(
                              'flex h-10 w-10 items-center justify-center rounded-full border text-xs font-semibold',
                              employee.isActive
                                ? 'bg-slate-100 text-slate-600'
                                : 'bg-slate-200 text-slate-500',
                            )}
                          >
                            {getInitials(employee)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell
                        className={cn(
                          'font-medium',
                          employee.isActive ? 'text-slate-900' : 'text-slate-700',
                        )}
                      >
                        {employee.matricule}
                      </TableCell>
                      <TableCell className={employee.isActive ? 'text-slate-900' : 'text-slate-700'}>
                        {employee.nom}
                      </TableCell>
                      <TableCell className={employee.isActive ? 'text-slate-900' : 'text-slate-700'}>
                        {employee.prenom}
                      </TableCell>
                      <TableCell>{employee.poste ?? '-'}</TableCell>
                      <TableCell>
                        {formatDepartmentName(departmentNameById, employee.departementId)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge tone={employee.isActive ? 'success' : 'neutral'}>
                          {employee.isActive ? 'Active' : 'Inactive'}
                        </StatusBadge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2 xl:flex-nowrap">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenEmployeeDetails(employee.id)}
                          >
                            <Eye className="mr-1 h-4 w-4" />
                            View
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenEmployeeEdit(employee.id)}
                          >
                            <UserPen className="mr-1 h-4 w-4" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenEmployeeQr(employee.id)}
                            disabled={!employee.isActive}
                          >
                            <QrCode className="mr-1 h-4 w-4" />
                            QR
                          </Button>
                          <Button
                            size="sm"
                            variant={employee.isActive ? 'destructive' : 'outline'}
                            className={
                              employee.isActive
                                ? undefined
                                : 'border-transparent bg-gradient-to-br from-[#ff6b35] to-[#ffc947] text-white hover:brightness-95'
                            }
                            disabled={isStatusMutationPending}
                            onClick={() => setEmployeeStatusTarget(employee)}
                          >
                            {employee.isActive ? (
                              <UserX className="mr-1 h-4 w-4" />
                            ) : (
                              <UserCheck className="mr-1 h-4 w-4" />
                            )}
                            {employee.isActive ? 'Deactivate' : 'Activate'}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Page {page} - Showing {from}-{to} of {total}
            </p>
            <div className="flex w-full gap-2 sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 sm:flex-none"
                disabled={!canGoPrev || employeesQuery.isFetching}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
              >
                Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 sm:flex-none"
                disabled={!canGoNext || employeesQuery.isFetching}
                onClick={() => setPage((value) => value + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      ) : null}

      <AlertDialog
        open={Boolean(employeeStatusTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setEmployeeStatusTarget(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {employeeStatusTarget?.isActive ? 'Deactivate employee?' : 'Activate employee?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {employeeStatusTarget
                ? employeeStatusTarget.isActive
                  ? `Deactivate ${employeeStatusTarget.prenom} ${employeeStatusTarget.nom}? This employee will be marked inactive and treated as unavailable in the system. Their active QR token will be revoked.`
                  : `Activate ${employeeStatusTarget.prenom} ${employeeStatusTarget.nom}? This employee will be restored as active and available in the system.`
                : 'Confirm status change.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isStatusMutationPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                if (!employeeStatusTarget) {
                  return
                }
                void handleConfirmStatusChange()
              }}
              disabled={isStatusMutationPending}
            >
              {isStatusMutationPending
                ? employeeStatusTarget?.isActive
                  ? 'Deactivating...'
                  : 'Activating...'
                : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  )
}

