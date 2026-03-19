import { zodResolver } from '@hookform/resolvers/zod'
import {
  Edit,
  Loader2,
  MoreHorizontal,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
} from 'lucide-react'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { EmptyState, ErrorState } from '@/components/common/page-state'
import { BRAND_BUTTON_CLASS_NAME, PageHeader } from '@/components/common/page-header'
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
  const departments = departmentsQuery.data ?? []
  const totalDepartments = departments.length

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
      <PageHeader
        title="Departments"
        description="Create, update, and manage department availability."
        className="sticky top-2 z-20 mb-6"
        badges={
          departmentsQuery.isPending ? (
            <Skeleton className="h-6 w-24 rounded-full" />
          ) : (
            <StatusBadge tone="neutral">{totalDepartments} total</StatusBadge>
          )
        }
        actions={
          departmentsQuery.isPending ? (
            <>
              <Skeleton className="h-10 w-full sm:w-64" />
              <Skeleton className="h-10 w-full sm:w-44" />
            </>
          ) : (
            <>
              <div className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Search departments..."
                  className="pl-9"
                  aria-label="Search departments"
                />
              </div>
              <Button type="button" className={BRAND_BUTTON_CLASS_NAME} onClick={openCreateDialog}>
                <Plus className="mr-2 h-4 w-4" />
                Add Department
              </Button>
            </>
          )
        }
      />

      {departmentsQuery.isError ? (
        <ErrorState
          className="mb-6"
          title="Failed to load departments"
          description="We couldn't load department records right now."
          message={departmentsQuery.error.message}
          icon={ShieldAlert}
          onRetry={() => void departmentsQuery.refetch()}
        />
      ) : null}

      <Card className="rounded-2xl border border-slate-200/80 shadow-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="text-base font-semibold">Department list</CardTitle>
          <CardDescription>
            Maintain department metadata used across employee profiles and request workflows.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {departmentsQuery.isPending ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Department Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Created At</TableHead>
                    <TableHead>Updated At</TableHead>
                    <TableHead className="w-[64px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 8 }).map((_, index) => (
                    <TableRow key={`department-skeleton-${index}`}>
                      <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-52" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                      <TableCell><Skeleton className="ml-auto h-8 w-8 rounded-md" /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}

          {!departmentsQuery.isPending && !departmentsQuery.isError && departments.length === 0 ? (
            <EmptyState
              surface="plain"
              className="py-8"
              title={debouncedSearch ? 'No departments found' : 'No departments yet'}
              description={
                debouncedSearch
                  ? 'Try a different search or create a new department.'
                  : 'Create the first department to organize employee assignments.'
              }
              actions={
                <Button
                  type="button"
                  className={BRAND_BUTTON_CLASS_NAME}
                  onClick={openCreateDialog}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Department
                </Button>
              }
            />
          ) : null}

          {!departmentsQuery.isPending && !departmentsQuery.isError && departments.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Department Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Created At</TableHead>
                    <TableHead>Updated At</TableHead>
                    <TableHead className="w-[64px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {departments.map((department) => (
                    <TableRow key={department.id}>
                      <TableCell className="font-medium">{department.nom}</TableCell>
                      <TableCell>
                        {department.code ? (
                          <StatusBadge
                            tone="neutral"
                            emphasis="outline"
                            className="bg-white font-mono text-xs"
                          >
                            {department.code}
                          </StatusBadge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <p className="max-w-[280px] truncate text-sm text-muted-foreground">
                          {department.description ?? '-'}
                        </p>
                      </TableCell>
                      <TableCell>{new Date(department.createdAt).toLocaleString()}</TableCell>
                      <TableCell>{new Date(department.updatedAt).toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        <DepartmentRowActions
                          departmentName={department.nom}
                          onEdit={() => openEditDialog(department)}
                          onDelete={() => setDepartmentToDelete(department)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="sm:max-w-xl">
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
              <Alert variant="destructive">
                <AlertTitle>Could not save department</AlertTitle>
                <AlertDescription>{form.formState.errors.root.message}</AlertDescription>
              </Alert>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="department-nom">
                  Department Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="department-nom"
                  {...form.register('nom')}
                  disabled={isSaving}
                  placeholder="Human Resources"
                />
                {form.formState.errors.nom?.message ? (
                  <p className="text-xs text-destructive">{form.formState.errors.nom.message}</p>
                ) : null}
              </div>

              <div className="space-y-2 sm:col-span-2">
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

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="department-description">Description (optional)</Label>
                <Textarea
                  id="department-description"
                  rows={4}
                  {...form.register('description')}
                  disabled={isSaving}
                  placeholder="Short description of department scope."
                />
                {form.formState.errors.description?.message ? (
                  <p className="text-xs text-destructive">{form.formState.errors.description.message}</p>
                ) : null}
              </div>
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
              <Button
                type="submit"
                disabled={isSaving}
                className="bg-gradient-to-br from-[#ff6b35] to-[#ffc947] text-white shadow-sm transition-all hover:brightness-95 hover:shadow-md"
              >
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

interface DepartmentRowActionsProps {
  departmentName: string
  onEdit: () => void
  onDelete: () => void
}

function DepartmentRowActions({ departmentName, onEdit, onDelete }: DepartmentRowActionsProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [isOpen])

  return (
    <div ref={menuRef} className="relative inline-flex">
      <Button
        type="button"
        size="icon"
        variant="ghost"
        aria-label={`Actions for ${departmentName}`}
        onClick={() => setIsOpen((current) => !current)}
      >
        <MoreHorizontal className="h-4 w-4" />
      </Button>

      {isOpen ? (
        <div className="absolute right-0 top-10 z-30 w-44 rounded-lg border bg-white p-1 shadow-md">
          <ActionMenuItem
            onClick={() => {
              setIsOpen(false)
              onEdit()
            }}
          >
            <Edit className="h-4 w-4" />
            Edit
          </ActionMenuItem>
          <ActionMenuItem
            className="text-destructive hover:bg-destructive/10"
            onClick={() => {
              setIsOpen(false)
              onDelete()
            }}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </ActionMenuItem>
        </div>
      ) : null}
    </div>
  )
}

interface ActionMenuItemProps {
  children: ReactNode
  onClick: () => void
  className?: string
}

function ActionMenuItem({ children, onClick, className }: ActionMenuItemProps) {
  return (
    <button
      type="button"
      className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-muted ${className ?? ''}`}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
