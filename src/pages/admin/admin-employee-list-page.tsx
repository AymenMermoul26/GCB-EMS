import { useMemo, useState } from 'react'

import { FullScreenLoader } from '@/components/common/full-screen-loader'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useDepartmentsQuery } from '@/services/departmentsService'
import { useEmployeesQuery } from '@/services/employeesService'
import { DashboardLayout } from '@/layouts/dashboard-layout'

export function AdminEmployeeListPage() {
  const [search, setSearch] = useState('')
  const [departementId, setDepartementId] = useState('')
  const [showOnlyActive, setShowOnlyActive] = useState(true)
  const [page, setPage] = useState(1)
  const pageSize = 10

  const employeesQuery = useEmployeesQuery(
    useMemo(
      () => ({
        search: search.trim() || undefined,
        departementId: departementId || undefined,
        isActive: showOnlyActive ? true : undefined,
        page,
        pageSize,
        sort: { field: 'nom', direction: 'asc' } as const,
      }),
      [departementId, page, search, showOnlyActive],
    ),
  )
  const departmentsQuery = useDepartmentsQuery()

  const totalPages = Math.max(1, Math.ceil((employeesQuery.data?.total ?? 0) / pageSize))

  return (
    <DashboardLayout
      title="Employee Management"
      subtitle="Placeholder admin list page wired to Supabase listEmployees()."
    >
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="grid gap-3 md:grid-cols-3">
            <Input
              placeholder="Search by matricule, nom, prenom..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
            />

            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={departementId}
              onChange={(event) => {
                setDepartementId(event.target.value)
                setPage(1)
              }}
            >
              <option value="">All departments</option>
              {(departmentsQuery.data ?? []).map((department) => (
                <option key={department.id} value={department.id}>
                  {department.nom}
                </option>
              ))}
            </select>

            <label className="flex h-10 items-center gap-2 rounded-md border border-input px-3 text-sm">
              <input
                type="checkbox"
                checked={showOnlyActive}
                onChange={(event) => {
                  setShowOnlyActive(event.target.checked)
                  setPage(1)
                }}
              />
              Show active only
            </label>
          </div>
        </CardContent>
      </Card>

      {employeesQuery.isPending ? <FullScreenLoader label="Loading employees..." /> : null}

      {employeesQuery.error ? (
        <p className="text-sm text-destructive">{employeesQuery.error.message}</p>
      ) : null}

      {employeesQuery.data ? (
        <div className="overflow-hidden rounded-lg border bg-background">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Matricule</th>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {employeesQuery.data.items.map((employee) => {
                const departmentName =
                  departmentsQuery.data?.find(
                    (department) => department.id === employee.departementId,
                  )?.nom ?? employee.departementId

                return (
                  <tr key={employee.id} className="border-t">
                    <td className="px-4 py-3 font-medium">{employee.matricule}</td>
                    <td className="px-4 py-3">
                      {employee.nom} {employee.prenom}
                    </td>
                    <td className="px-4 py-3">{departmentName}</td>
                    <td className="px-4 py-3">
                      <Badge variant={employee.isActive ? 'secondary' : 'outline'}>
                        {employee.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          <div className="flex items-center justify-between border-t px-4 py-3 text-sm">
            <p>
              Page {employeesQuery.data.page} of {totalPages} - {employeesQuery.data.total}{' '}
              results
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-md border px-3 py-1 disabled:opacity-50"
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                disabled={page <= 1}
              >
                Previous
              </button>
              <button
                type="button"
                className="rounded-md border px-3 py-1 disabled:opacity-50"
                onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                disabled={page >= totalPages}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </DashboardLayout>
  )
}
