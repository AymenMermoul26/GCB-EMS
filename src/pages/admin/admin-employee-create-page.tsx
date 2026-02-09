import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Loader2, Save } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { ROUTES, getAdminEmployeeRoute } from '@/constants/routes'
import { DashboardLayout } from '@/layouts/dashboard-layout'
import { useDepartmentsQuery } from '@/services/departmentsService'
import { useCreateEmployeeMutation } from '@/services/employeesService'
import {
  employeeSchema,
  normalizeOptional,
  type EmployeeFormValues,
} from '@/schemas/employeeSchema'
import { mapEmployeeWriteError } from '@/utils/supabase-errors'

function isMatriculeConflict(message: string): boolean {
  return message.toLowerCase().includes('matricule')
}

export function AdminEmployeeCreatePage() {
  const navigate = useNavigate()
  const departmentsQuery = useDepartmentsQuery()
  const [submitError, setSubmitError] = useState<string | null>(null)

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

  const createMutation = useCreateEmployeeMutation({
    onSuccess: (employee) => {
      toast.success('Employee created successfully.')
      navigate(getAdminEmployeeRoute(employee.id), { replace: true })
    },
    onError: (error) => {
      const friendlyMessage = mapEmployeeWriteError(error)
      setSubmitError(friendlyMessage)
      if (isMatriculeConflict(friendlyMessage)) {
        form.setError('matricule', { type: 'server', message: friendlyMessage })
      }
    },
  })

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null)

    await createMutation.mutateAsync({
      matricule: values.matricule.trim(),
      nom: values.nom.trim(),
      prenom: values.prenom.trim(),
      departementId: values.departementId,
      poste: normalizeOptional(values.poste),
      email: normalizeOptional(values.email),
      telephone: normalizeOptional(values.telephone),
      photoUrl: normalizeOptional(values.photoUrl),
      isActive: true,
    })
  })

  const isSubmitting = createMutation.isPending

  return (
    <DashboardLayout
      title="Create Employee"
      subtitle="Add a new employee record to the EMS directory."
    >
      <div className="mb-4">
        <Button variant="ghost" onClick={() => navigate(ROUTES.ADMIN_EMPLOYEES)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Employees
        </Button>
      </div>

      <Card className="max-w-4xl">
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
                  placeholder="EMP-001"
                  disabled={isSubmitting}
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
                        disabled={isSubmitting || departmentsQuery.isError}
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
                <Input
                  id="nom"
                  placeholder="Last name"
                  disabled={isSubmitting}
                  {...form.register('nom')}
                />
              </FieldError>

              <FieldError message={form.formState.errors.prenom?.message}>
                <Label htmlFor="prenom">Prenom</Label>
                <Input
                  id="prenom"
                  placeholder="First name"
                  disabled={isSubmitting}
                  {...form.register('prenom')}
                />
              </FieldError>

              <FieldError message={form.formState.errors.poste?.message}>
                <Label htmlFor="poste">Poste</Label>
                <Input
                  id="poste"
                  placeholder="Software Engineer"
                  disabled={isSubmitting}
                  {...form.register('poste')}
                />
              </FieldError>

              <FieldError message={form.formState.errors.email?.message}>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="employee@company.com"
                  disabled={isSubmitting}
                  {...form.register('email')}
                />
              </FieldError>

              <FieldError message={form.formState.errors.telephone?.message}>
                <Label htmlFor="telephone">Telephone</Label>
                <Input
                  id="telephone"
                  placeholder="+1 555 123 4567"
                  disabled={isSubmitting}
                  {...form.register('telephone')}
                />
              </FieldError>

              <FieldError message={form.formState.errors.photoUrl?.message}>
                <Label htmlFor="photoUrl">Photo URL</Label>
                <Input
                  id="photoUrl"
                  placeholder="https://..."
                  disabled={isSubmitting}
                  {...form.register('photoUrl')}
                />
              </FieldError>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(ROUTES.ADMIN_EMPLOYEES)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || departmentsQuery.isPending}>
                {isSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                {isSubmitting ? 'Creating...' : 'Create Employee'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
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
