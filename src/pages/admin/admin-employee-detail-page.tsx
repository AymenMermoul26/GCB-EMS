import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Loader2, Save, UserX } from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { ROUTES } from '@/constants/routes'
import { DashboardLayout } from '@/layouts/dashboard-layout'
import {
  useDeactivateEmployeeMutation,
  useEmployeeQuery,
  useUpdateEmployeeMutation,
} from '@/services/employeesService'
import { useDepartmentsQuery } from '@/services/departmentsService'
import {
  employeeSchema,
  normalizeOptional,
  type EmployeeFormValues,
} from '@/schemas/employeeSchema'
import { mapEmployeeWriteError } from '@/utils/supabase-errors'

function getInitials(prenom: string, nom: string) {
  const initials = `${prenom.trim().charAt(0)}${nom.trim().charAt(0)}`.toUpperCase()
  return initials || 'NA'
}

function isMatriculeConflict(message: string): boolean {
  return message.toLowerCase().includes('matricule')
}

export function AdminEmployeeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [submitError, setSubmitError] = useState<string | null>(null)

  const employeeQuery = useEmployeeQuery(id)
  const departmentsQuery = useDepartmentsQuery()

  const form = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      matricule: '',
      nom: '',
      prenom: '',
      departementId: undefined,
      poste: '',
      email: '',
      telephone: '',
      photoUrl: '',
    },
  })

  useEffect(() => {
    if (!employeeQuery.data) {
      return
    }

    form.reset({
      matricule: employeeQuery.data.matricule,
      nom: employeeQuery.data.nom,
      prenom: employeeQuery.data.prenom,
      departementId: employeeQuery.data.departementId,
      poste: employeeQuery.data.poste ?? '',
      email: employeeQuery.data.email ?? '',
      telephone: employeeQuery.data.telephone ?? '',
      photoUrl: employeeQuery.data.photoUrl ?? '',
    })
  }, [employeeQuery.data, form])

  const updateMutation = useUpdateEmployeeMutation({
    onSuccess: (employee) => {
      setSubmitError(null)
      toast.success('Employee updated successfully.')
      form.reset({
        matricule: employee.matricule,
        nom: employee.nom,
        prenom: employee.prenom,
        departementId: employee.departementId,
        poste: employee.poste ?? '',
        email: employee.email ?? '',
        telephone: employee.telephone ?? '',
        photoUrl: employee.photoUrl ?? '',
      })
    },
    onError: (error) => {
      const friendlyMessage = mapEmployeeWriteError(error)
      setSubmitError(friendlyMessage)
      if (isMatriculeConflict(friendlyMessage)) {
        form.setError('matricule', { type: 'server', message: friendlyMessage })
      }
    },
  })

  const deactivateMutation = useDeactivateEmployeeMutation({
    onSuccess: async (employee) => {
      toast.success('Employee deactivated.')
      queryClient.setQueryData(['employee', employee.id], employee)
      await queryClient.invalidateQueries({ queryKey: ['employees'] })
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const employee = employeeQuery.data
  const isInactive = Boolean(employee && !employee.isActive)
  const isFormDisabled = isInactive || updateMutation.isPending || employeeQuery.isPending

  const onSubmit = form.handleSubmit(async (values) => {
    if (!id) {
      return
    }

    setSubmitError(null)

    await updateMutation.mutateAsync({
      id,
      payload: {
        matricule: values.matricule.trim(),
        nom: values.nom.trim(),
        prenom: values.prenom.trim(),
        departementId: values.departementId,
        poste: normalizeOptional(values.poste),
        email: normalizeOptional(values.email),
        telephone: normalizeOptional(values.telephone),
        photoUrl: normalizeOptional(values.photoUrl),
      },
    })
  })

  const currentPhotoUrl = useWatch({ control: form.control, name: 'photoUrl' })
  const currentPrenom = useWatch({ control: form.control, name: 'prenom' })
  const currentNom = useWatch({ control: form.control, name: 'nom' })

  if (!id) {
    return (
      <DashboardLayout title="Employee Details" subtitle="Invalid route parameter.">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-destructive">Employee id is missing.</p>
          </CardContent>
        </Card>
      </DashboardLayout>
    )
  }

  if (employeeQuery.isPending) {
    return (
      <DashboardLayout title="Employee Details" subtitle="Loading employee information...">
        <div className="space-y-4">
          <Skeleton className="h-10 w-44" />
          <Skeleton className="h-72 w-full" />
        </div>
      </DashboardLayout>
    )
  }

  if (employeeQuery.isError) {
    return (
      <DashboardLayout title="Employee Details" subtitle="Unable to load employee information.">
        <Card>
          <CardContent className="space-y-3 p-6">
            <p className="text-sm text-destructive">{employeeQuery.error.message}</p>
            <Button variant="outline" onClick={() => void employeeQuery.refetch()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    )
  }

  if (!employee) {
    return (
      <DashboardLayout title="Employee Details" subtitle="This employee does not exist.">
        <Card>
          <CardContent className="space-y-3 p-6">
            <p className="text-sm text-muted-foreground">Employee not found.</p>
            <Button variant="outline" onClick={() => navigate(ROUTES.ADMIN_EMPLOYEES)}>
              Back to Employees
            </Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout
      title={`${employee.prenom} ${employee.nom}`}
      subtitle="View and edit employee details."
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Matricule: {employee.matricule}</p>
          <Badge variant={employee.isActive ? 'secondary' : 'outline'}>
            {employee.isActive ? 'Active' : 'Inactive'}
          </Badge>
        </div>
        <Button variant="ghost" onClick={() => navigate(ROUTES.ADMIN_EMPLOYEES)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Employees
        </Button>
      </div>

      {isInactive ? (
        <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          This employee is inactive. Reactivate is not supported yet.
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Employee Information</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={onSubmit}>
              {submitError ? (
                <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                  {submitError}
                </div>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <FieldError message={form.formState.errors.matricule?.message}>
                  <Label htmlFor="matricule">Matricule</Label>
                  <Input
                    id="matricule"
                    disabled={isFormDisabled}
                    {...form.register('matricule')}
                  />
                </FieldError>

                <FieldError message={form.formState.errors.departementId?.message}>
                  <Label htmlFor="departementId">Department</Label>
                  {departmentsQuery.isPending ? (
                    <Skeleton className="h-10 w-full" />
                  ) : (
                    <Controller
                      control={form.control}
                      name="departementId"
                      render={({ field }) => (
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                          disabled={isFormDisabled || departmentsQuery.isError}
                        >
                          <SelectTrigger id="departementId">
                            <SelectValue
                              placeholder={
                                departmentsQuery.isError
                                  ? 'Departments unavailable'
                                  : 'Select department'
                              }
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {(departmentsQuery.data ?? []).map((department) => (
                              <SelectItem key={department.id} value={department.id}>
                                {department.nom}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  )}
                  {departmentsQuery.isError ? (
                    <p className="text-xs text-destructive">{departmentsQuery.error.message}</p>
                  ) : null}
                </FieldError>

                <FieldError message={form.formState.errors.nom?.message}>
                  <Label htmlFor="nom">Nom</Label>
                  <Input id="nom" disabled={isFormDisabled} {...form.register('nom')} />
                </FieldError>

                <FieldError message={form.formState.errors.prenom?.message}>
                  <Label htmlFor="prenom">Prenom</Label>
                  <Input id="prenom" disabled={isFormDisabled} {...form.register('prenom')} />
                </FieldError>

                <FieldError message={form.formState.errors.poste?.message}>
                  <Label htmlFor="poste">Poste</Label>
                  <Input id="poste" disabled={isFormDisabled} {...form.register('poste')} />
                </FieldError>

                <FieldError message={form.formState.errors.email?.message}>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    disabled={isFormDisabled}
                    {...form.register('email')}
                  />
                </FieldError>

                <FieldError message={form.formState.errors.telephone?.message}>
                  <Label htmlFor="telephone">Telephone</Label>
                  <Input
                    id="telephone"
                    disabled={isFormDisabled}
                    {...form.register('telephone')}
                  />
                </FieldError>

                <FieldError message={form.formState.errors.photoUrl?.message}>
                  <Label htmlFor="photoUrl">Photo URL</Label>
                  <Input
                    id="photoUrl"
                    disabled={isFormDisabled}
                    {...form.register('photoUrl')}
                  />
                </FieldError>
              </div>

              <Separator />

              <div className="flex items-center gap-2">
                <Button type="submit" disabled={isFormDisabled}>
                  {updateMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Photo</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-3">
              {currentPhotoUrl && currentPhotoUrl.trim().length > 0 ? (
                <img
                  src={currentPhotoUrl}
                  alt={`${currentPrenom || employee.prenom} ${currentNom || employee.nom}`}
                  className="h-28 w-28 rounded-full border object-cover"
                />
              ) : (
                <div className="flex h-28 w-28 items-center justify-center rounded-full border bg-slate-100 text-2xl font-semibold text-slate-600">
                  {getInitials(currentPrenom || employee.prenom, currentNom || employee.nom)}
                </div>
              )}
              <p className="text-center text-xs text-muted-foreground">
                Preview based on the current Photo URL field.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    className="w-full"
                    disabled={!employee.isActive || deactivateMutation.isPending}
                  >
                    <UserX className="mr-2 h-4 w-4" />
                    Deactivate Employee
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Deactivate employee</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will mark the employee as inactive and revoke their active QR token.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={deactivateMutation.isPending}>
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      disabled={deactivateMutation.isPending}
                      onClick={(event) => {
                        event.preventDefault()
                        void deactivateMutation.mutateAsync(employee.id)
                      }}
                    >
                      {deactivateMutation.isPending ? 'Deactivating...' : 'Confirm'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}

interface FieldErrorProps {
  children: ReactNode
  message?: string
}

function FieldError({ children, message }: FieldErrorProps) {
  return (
    <div className="space-y-2">
      {children}
      {message ? <p className="text-xs text-destructive">{message}</p> : null}
    </div>
  )
}
