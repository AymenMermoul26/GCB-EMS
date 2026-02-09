import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Eye, FileDown, Search, UserX } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
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
import { ROUTES } from '@/constants/routes'
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

export function EmployeesListPage() {
  const navigate = useNavigate()

  const [searchInput, setSearchInput] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
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

  return (
    <DashboardLayout
      title="Employees"
      subtitle="Search, filter, and manage employees."
    >
      <div className="mb-4 grid gap-3 md:grid-cols-5">
        <div className="relative md:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(event) => {
              setSearchInput(event.target.value)
              setPage(1)
            }}
            placeholder="Search matricule, nom, prenom..."
            className="pl-9"
          />
        </div>

        <Select
          value={departmentFilter}
          onValueChange={(value) => {
            setDepartmentFilter(value)
            setPage(1)
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Department" />
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

        <Select
          value={statusFilter}
          onValueChange={(value: StatusFilter) => {
            setStatusFilter(value)
            setPage(1)
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Select
            value={String(pageSize)}
            onValueChange={(value) => {
              setPageSize(Number(value))
              setPage(1)
            }}
          >
            <SelectTrigger className="w-24">
              <SelectValue placeholder="Page size" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
            </SelectContent>
          </Select>

          <Button
            type="button"
            variant="outline"
            onClick={handleExportCsv}
            disabled={exporting || employeesQuery.isPending}
          >
            <FileDown className="mr-2 h-4 w-4" />
            {exporting ? 'Exporting...' : 'CSV Export'}
          </Button>
        </div>
      </div>

      <div className="rounded-md border bg-background">
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
              <TableHead className="w-[170px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {employeesQuery.isPending
              ? Array.from({ length: 8 }).map((_, index) => (
                  <TableRow key={`skeleton-${index}`}>
                    <TableCell>
                      <Skeleton className="h-10 w-10 rounded-full" />
                    </TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-32" /></TableCell>
                  </TableRow>
                ))
              : null}

            {!employeesQuery.isPending && employees.length === 0 && !employeesQuery.isError ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                  No employees found for the selected filters.
                </TableCell>
              </TableRow>
            ) : null}

            {!employeesQuery.isPending &&
              employees.map((employee) => (
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
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`${ROUTES.ADMIN_EMPLOYEES}/${employee.id}`)}
                      >
                        <Eye className="mr-1 h-4 w-4" />
                        View
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

      {employeesQuery.isError ? (
        <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm text-destructive">
            {employeesQuery.error.message}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => void employeesQuery.refetch()}
          >
            Retry
          </Button>
        </div>
      ) : null}

      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {from}-{to} of {total}
          {employeesQuery.isFetching ? ' (updating...)' : ''}
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
