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
  UserPen,
  UserX,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
import { Badge } from '@/components/ui/badge'
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
import { Skeleton } from '@/components/ui/skeleton'
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
import { departmentsService, useDepartmentsQuery } from '@/services/departmentsService'
import {
  employeesService,
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
  const [employeeToDeactivate, setEmployeeToDeactivate] = useState<Employee | null>(null)

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

  const deactivateMutation = useDeactivateEmployeeMutation({
    onSuccess: () => {
      toast.success('Employee deactivated.')
      setEmployeeToDeactivate(null)
      void employeesQuery.refetch()
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

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

  return (
    <DashboardLayout
      title="Employees"
      subtitle="Employee directory and management workspace."
    >
      <div className="sticky top-2 z-10 mb-6 rounded-2xl border bg-white/95 p-4 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Employees</h2>
              <Badge variant="secondary" className="rounded-full px-3">
                {total}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Manage employees, visibility, and QR tokens.
            </p>
            <div className="h-1.5 w-24 rounded-full bg-gradient-to-br from-[#ff6b35] to-[#ffc947]" />
          </div>

          <div className="flex w-full flex-col gap-3 xl:max-w-3xl xl:items-end">
            <div className="flex w-full flex-wrap items-center gap-2">
              <div className="relative min-w-[250px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  aria-label="Search employees"
                  value={searchInput}
                  onChange={(event) => {
                    setSearchInput(event.target.value)
                    setPage(1)
                  }}
                  placeholder="Search by name, matricule, email..."
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
                <DialogContent>
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
                className="bg-gradient-to-br from-[#ff6b35] to-[#ffc947] text-white shadow-sm transition-all hover:brightness-95 hover:shadow-md"
                onClick={() => navigate(ROUTES.ADMIN_EMPLOYEES_NEW)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Employee
              </Button>
            </div>

            <div className="flex w-full items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                Showing {from}-{to} of {total}
                {employeesQuery.isFetching ? ' (updating...)' : ''}
              </p>
              <div className="inline-flex items-center rounded-xl border bg-slate-50 p-1">
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
          </div>
        </div>
      </div>

      {employeesQuery.isError ? (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Could not load employees</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>{employeesQuery.error.message}</span>
            <Button variant="outline" size="sm" onClick={() => void employeesQuery.refetch()}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {employeesQuery.isPending ? (
        <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <Card key={`employee-skeleton-${index}`} className="rounded-2xl border shadow-sm">
              <CardContent className="space-y-4 p-5">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-40" />
                <Skeleton className="h-3 w-32" />
                <div className="flex gap-2 pt-1">
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-8 w-20" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {!employeesQuery.isPending && !employeesQuery.isError && employees.length === 0 ? (
        <Card className="mx-auto mt-2 max-w-xl rounded-2xl border border-dashed">
          <CardHeader className="text-center">
            <CardTitle>No employees found</CardTitle>
            <CardDescription>
              Try adjusting your search or filters.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center gap-2">
            <Button variant="outline" onClick={handleClearFilters}>
              Clear filters
            </Button>
            <Button
              className="bg-gradient-to-br from-[#ff6b35] to-[#ffc947] text-white hover:brightness-95"
              onClick={() => navigate(ROUTES.ADMIN_EMPLOYEES_NEW)}
            >
              Add Employee
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {!employeesQuery.isPending && !employeesQuery.isError && employees.length > 0 ? (
        <>
          {viewMode === 'grid' ? (
            <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {employees.map((employee) => (
                <Card
                  key={employee.id}
                  className="group rounded-2xl border border-slate-200/80 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                >
                  <CardContent className="flex h-full flex-col gap-4 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        {employee.photoUrl ? (
                          <img
                            src={employee.photoUrl}
                            alt={`${employee.prenom} ${employee.nom}`}
                            className="h-12 w-12 rounded-full border object-cover"
                          />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-full border bg-slate-100 text-sm font-semibold text-slate-600">
                            {getInitials(employee)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-900">
                            {employee.prenom} {employee.nom}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {employee.poste ?? 'No role assigned'}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant={employee.isActive ? 'secondary' : 'outline'}
                        className={employee.isActive ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500'}
                      >
                        {employee.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>

                    <div className="space-y-2 text-sm text-slate-700">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-slate-400" />
                        <span className="truncate">
                          {formatDepartmentName(departmentNameById, employee.departementId)}
                        </span>
                      </div>

                      <div className="inline-flex max-w-full items-center rounded-full bg-slate-100 px-2.5 py-1 font-mono text-xs text-slate-600">
                        {employee.matricule}
                      </div>

                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-slate-400" />
                        <span className="truncate text-xs text-muted-foreground">
                          {isEmptyValue(employee.email) ? 'No email' : employee.email}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-slate-400" />
                        <span className="truncate text-xs text-muted-foreground">
                          {isEmptyValue(employee.telephone) ? 'No phone' : employee.telephone}
                        </span>
                      </div>
                    </div>

                    <div className="mt-auto flex flex-wrap gap-2 pt-2">
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
                        onClick={() => handleOpenEmployeeDetails(employee.id)}
                      >
                        <UserPen className="mr-1 h-4 w-4" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenEmployeeQr(employee.id)}
                      >
                        <QrCode className="mr-1 h-4 w-4" />
                        QR
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={!employee.isActive}
                        onClick={() => setEmployeeToDeactivate(employee)}
                      >
                        <UserX className="mr-1 h-4 w-4" />
                        Deactivate
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border bg-white shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Photo</TableHead>
                    <TableHead>Matricule</TableHead>
                    <TableHead>Nom</TableHead>
                    <TableHead>Prenom</TableHead>
                    <TableHead>Poste</TableHead>
                    <TableHead>Departement</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="w-[250px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((employee) => (
                    <TableRow key={employee.id}>
                      <TableCell>
                        {employee.photoUrl ? (
                          <img
                            src={employee.photoUrl}
                            alt={`${employee.prenom} ${employee.nom}`}
                            className="h-10 w-10 rounded-full border object-cover"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full border bg-slate-100 text-xs font-semibold text-slate-600">
                            {getInitials(employee)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{employee.matricule}</TableCell>
                      <TableCell>{employee.nom}</TableCell>
                      <TableCell>{employee.prenom}</TableCell>
                      <TableCell>{employee.poste ?? '-'}</TableCell>
                      <TableCell>
                        {formatDepartmentName(departmentNameById, employee.departementId)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={employee.isActive ? 'secondary' : 'outline'}>
                          {employee.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
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
                            onClick={() => handleOpenEmployeeDetails(employee.id)}
                          >
                            <UserPen className="mr-1 h-4 w-4" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenEmployeeQr(employee.id)}
                          >
                            <QrCode className="mr-1 h-4 w-4" />
                            QR
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={!employee.isActive}
                            onClick={() => setEmployeeToDeactivate(employee)}
                          >
                            <UserX className="mr-1 h-4 w-4" />
                            Deactivate
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Page {page} · Showing {from}-{to} of {total}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!canGoPrev || employeesQuery.isFetching}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
              >
                Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
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
        open={Boolean(employeeToDeactivate)}
        onOpenChange={(open) => {
          if (!open) {
            setEmployeeToDeactivate(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate employee</AlertDialogTitle>
            <AlertDialogDescription>
              {employeeToDeactivate
                ? `Deactivate ${employeeToDeactivate.prenom} ${employeeToDeactivate.nom}? Their active QR token will be revoked.`
                : 'Confirm deactivation.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deactivateMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                if (!employeeToDeactivate) {
                  return
                }
                void deactivateMutation.mutateAsync(employeeToDeactivate.id)
              }}
              disabled={deactivateMutation.isPending}
            >
              {deactivateMutation.isPending ? 'Deactivating...' : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  )
}
