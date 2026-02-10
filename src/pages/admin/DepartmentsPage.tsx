import { zodResolver } from '@hookform/resolvers/zod'
import { Edit, Loader2, Plus, Search, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

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
import { Card, CardContent } from '@/components/ui/card'
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
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { DashboardLayout } from '@/layouts/dashboard-layout'
import {
  useCreateDepartmentMutation,
  useDeleteDepartmentMutation,
  useDepartmentsQuery,
  useUpdateDepartmentMutation,
} from '@/services/departmentsService'
import {
  departmentSchema,
  normalizeOptionalField,
  type DepartmentFormValues,
} from '@/schemas/departmentSchema'
import type { Department } from '@/types/department'
import {
  mapDepartmentDeleteError,
  mapDepartmentWriteError,
} from '@/utils/supabase-errors'

const emptyFormValues: DepartmentFormValues = {
  nom: '',
  code: '',
  description: '',
}

export function DepartmentsPage() {
  const [searchInput, setSearchInput] = useState('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null)
  const [departmentToDelete, setDepartmentToDelete] = useState<Department | null>(null)

  const debouncedSearch = useDebouncedValue(searchInput, 400)
  const departmentsQuery = useDepartmentsQuery(debouncedSearch)

  const form = useForm<DepartmentFormValues>({
    resolver: zodResolver(departmentSchema),
    defaultValues: emptyFormValues,
  })

  const createMutation = useCreateDepartmentMutation({
    onSuccess: () => {
      toast.success('Department created successfully.')
      setIsDialogOpen(false)
      setEditingDepartment(null)
      form.reset(emptyFormValues)
      form.clearErrors()
    },
    onError: (error) => {
      const message = mapDepartmentWriteError(error)
      form.setError('root', { message })
      toast.error(message)
    },
  })

  const updateMutation = useUpdateDepartmentMutation({
    onSuccess: () => {
      toast.success('Department updated successfully.')
      setIsDialogOpen(false)
      setEditingDepartment(null)
      form.reset(emptyFormValues)
      form.clearErrors()
    },
    onError: (error) => {
      const message = mapDepartmentWriteError(error)
      form.setError('root', { message })
      toast.error(message)
    },
  })

  const deleteMutation = useDeleteDepartmentMutation({
    onSuccess: () => {
      toast.success('Department deleted successfully.')
      setDepartmentToDelete(null)
    },
    onError: (error) => {
      toast.error(mapDepartmentDeleteError(error))
    },
  })

  const isSaving = createMutation.isPending || updateMutation.isPending

  const openCreateDialog = () => {
    setEditingDepartment(null)
    form.reset(emptyFormValues)
    form.clearErrors()
    setIsDialogOpen(true)
  }

  const openEditDialog = (department: Department) => {
    setEditingDepartment(department)
    form.reset({
      nom: department.nom,
      code: department.code ?? '',
      description: department.description ?? '',
    })
    form.clearErrors()
    setIsDialogOpen(true)
  }

  const handleDialogOpenChange = (open: boolean) => {
    setIsDialogOpen(open)

    if (!open) {
      setEditingDepartment(null)
      form.reset(emptyFormValues)
      form.clearErrors()
    }
  }

  const onSubmit = form.handleSubmit(async (values) => {
    const payload = {
      nom: values.nom.trim(),
      code: normalizeOptionalField(values.code)?.toUpperCase() ?? null,
      description: normalizeOptionalField(values.description),
    }

    if (editingDepartment) {
      await updateMutation.mutateAsync({
        id: editingDepartment.id,
        payload,
      })
      return
    }

    await createMutation.mutateAsync(payload)
  })

  return (
    <DashboardLayout
      title="Departments"
      subtitle="Manage department records and assignments."
    >
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search by name or code..."
            className="pl-9"
          />
        </div>

        <Button type="button" onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          New Department
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="w-[180px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {departmentsQuery.isPending
                ? Array.from({ length: 6 }).map((_, index) => (
                    <TableRow key={`department-skeleton-${index}`}>
                      <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-52" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-36" /></TableCell>
                    </TableRow>
                  ))
                : null}

              {!departmentsQuery.isPending &&
              !departmentsQuery.isError &&
              (departmentsQuery.data?.length ?? 0) === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                    No departments found.
                  </TableCell>
                </TableRow>
              ) : null}

              {!departmentsQuery.isPending &&
                (departmentsQuery.data ?? []).map((department) => (
                  <TableRow key={department.id}>
                    <TableCell className="font-medium">{department.nom}</TableCell>
                    <TableCell>{department.code ?? '-'}</TableCell>
                    <TableCell>
                      <p className="max-w-[320px] truncate text-sm text-muted-foreground">
                        {department.description ?? '-'}
                      </p>
                    </TableCell>
                    <TableCell>{new Date(department.updatedAt).toLocaleString()}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditDialog(department)}
                        >
                          <Edit className="mr-1 h-4 w-4" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => setDepartmentToDelete(department)}
                        >
                          <Trash2 className="mr-1 h-4 w-4" />
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {departmentsQuery.isError ? (
        <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm text-destructive">{departmentsQuery.error.message}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => void departmentsQuery.refetch()}
          >
            Retry
          </Button>
        </div>
      ) : null}

      <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingDepartment ? 'Edit Department' : 'New Department'}
            </DialogTitle>
            <DialogDescription>
              {editingDepartment
                ? 'Update the department information.'
                : 'Create a new department for employee assignment.'}
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-4" onSubmit={onSubmit}>
            {form.formState.errors.root?.message ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {form.formState.errors.root.message}
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="department-nom">Nom</Label>
              <Input
                id="department-nom"
                {...form.register('nom')}
                disabled={isSaving}
              />
              {form.formState.errors.nom?.message ? (
                <p className="text-xs text-destructive">{form.formState.errors.nom.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="department-code">Code (optional)</Label>
              <Input
                id="department-code"
                placeholder="Example: HR"
                {...form.register('code')}
                disabled={isSaving}
              />
              {form.formState.errors.code?.message ? (
                <p className="text-xs text-destructive">{form.formState.errors.code.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="department-description">Description (optional)</Label>
              <Textarea
                id="department-description"
                rows={4}
                {...form.register('description')}
                disabled={isSaving}
              />
              {form.formState.errors.description?.message ? (
                <p className="text-xs text-destructive">{form.formState.errors.description.message}</p>
              ) : null}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleDialogOpenChange(false)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {editingDepartment ? 'Save Changes' : 'Create Department'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(departmentToDelete)}
        onOpenChange={(open) => {
          if (!open) {
            setDepartmentToDelete(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete department</AlertDialogTitle>
            <AlertDialogDescription>
              {departmentToDelete
                ? `Delete "${departmentToDelete.nom}"? This action cannot be undone.`
                : 'Confirm department deletion.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending || !departmentToDelete}
              onClick={(event) => {
                event.preventDefault()
                if (!departmentToDelete) {
                  return
                }
                void deleteMutation.mutateAsync(departmentToDelete.id)
              }}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  )
}
