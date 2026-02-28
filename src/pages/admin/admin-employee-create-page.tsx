import { zodResolver } from '@hookform/resolvers/zod'
import {
  ArrowLeft,
  BriefcaseBusiness,
  CheckCircle2,
  Loader2,
  Mail,
  Save,
  UserRound,
} from 'lucide-react'
import { type ReactNode, useMemo, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Separator } from '@/components/ui/separator'
import { ROUTES, getAdminEmployeeRoute } from '@/constants/routes'
import { DashboardLayout } from '@/layouts/dashboard-layout'
import { useDepartmentsQuery } from '@/services/departmentsService'
import { useCreateEmployeeMutation } from '@/services/employeesService'
import {
  employeeCreateSchema,
  normalizePhoneNumberInput,
  normalizeOptional,
  type EmployeeCreateFormValues,
} from '@/schemas/employeeSchema'
import { mapEmployeeWriteError } from '@/utils/supabase-errors'

function isMatriculeConflict(message: string): boolean {
  return message.toLowerCase().includes('matricule')
}

export function AdminEmployeeCreatePage() {
  const navigate = useNavigate()
  const departmentsQuery = useDepartmentsQuery()
  const [submitError, setSubmitError] = useState<string | null>(null)

  const form = useForm<EmployeeCreateFormValues>({
    resolver: zodResolver(employeeCreateSchema),
    mode: 'onChange',
    reValidateMode: 'onChange',
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

  const telephoneRegister = form.register('telephone')

  const createMutation = useCreateEmployeeMutation({
    onSuccess: (employee) => {
      toast.success(`Employee created successfully (${employee.matricule}).`)
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
    const normalizedMatricule = values.matricule?.trim()

    await createMutation.mutateAsync({
      matricule:
        normalizedMatricule && normalizedMatricule.length > 0
          ? normalizedMatricule
          : undefined,
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
  const formId = 'create-employee-form'
  const currentPhotoUrl = useWatch({ control: form.control, name: 'photoUrl' })
  const currentNom = useWatch({ control: form.control, name: 'nom' })
  const currentPrenom = useWatch({ control: form.control, name: 'prenom' })
  const employeeInitials = useMemo(() => {
    const nomInitial = currentNom?.trim().charAt(0) ?? ''
    const prenomInitial = currentPrenom?.trim().charAt(0) ?? ''
    const initials = `${prenomInitial}${nomInitial}`.toUpperCase()
    return initials || 'NA'
  }, [currentNom, currentPrenom])
  const isDepartmentSelectDisabled = isSubmitting || departmentsQuery.isError

  return (
    <DashboardLayout
      title="Create Employee"
      subtitle="Add a new employee record to the EMS directory."
    >
      <div className="sticky top-2 z-20 mb-6 rounded-2xl border bg-white/95 p-4 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <Button
              type="button"
              variant="ghost"
              className="px-0 text-muted-foreground"
              onClick={() => navigate(ROUTES.ADMIN_EMPLOYEES)}
              disabled={isSubmitting}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to employees
            </Button>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Create Employee</h1>
            <p className="text-sm text-muted-foreground">
              Add a new employee and generate access details securely.
            </p>
            <Badge variant="outline" className="rounded-full">
              Step 1 of 1
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(ROUTES.ADMIN_EMPLOYEES)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form={formId}
              disabled={isSubmitting || departmentsQuery.isPending || !form.formState.isValid}
              className="bg-gradient-to-br from-[#ff6b35] to-[#ffc947] text-white shadow-sm transition-all hover:brightness-95 hover:shadow-md"
            >
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {isSubmitting ? 'Creating...' : 'Create Employee'}
            </Button>
          </div>
        </div>
      </div>

      <form
        id={formId}
        className="mx-auto flex w-full max-w-5xl flex-col gap-6"
        onSubmit={onSubmit}
      >
        {submitError ? (
          <Alert variant="destructive">
            <AlertTitle>Could not create employee</AlertTitle>
            <AlertDescription>
              {submitError} Try again after correcting the highlighted fields.
            </AlertDescription>
          </Alert>
        ) : null}

        <Card className="overflow-hidden rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="h-1.5 w-full bg-gradient-to-br from-[#ff6b35] to-[#ffc947]" />
          <CardHeader className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <BriefcaseBusiness className="h-4 w-4 text-[#ff6b35]" />
              Identity & Job
            </CardTitle>
            <CardDescription>
              Core identity and organizational assignment fields.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <FieldError message={form.formState.errors.prenom?.message}>
              <Label htmlFor="prenom">
                First Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="prenom"
                placeholder="First name"
                disabled={isSubmitting}
                {...form.register('prenom')}
              />
            </FieldError>

            <FieldError message={form.formState.errors.nom?.message}>
              <Label htmlFor="nom">
                Last Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="nom"
                placeholder="Last name"
                disabled={isSubmitting}
                {...form.register('nom')}
              />
            </FieldError>

            <FieldError message={form.formState.errors.matricule?.message}>
              <Label htmlFor="matricule">Matricule</Label>
              <Input
                id="matricule"
                placeholder="Leave empty to auto-generate (GCB-XXXXXX)"
                disabled={isSubmitting}
                {...form.register('matricule')}
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to auto-generate the next unique matricule.
              </p>
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

            <FieldError message={form.formState.errors.departementId?.message}>
              <Label htmlFor="departementId">
                Department <span className="text-destructive">*</span>
              </Label>
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
                      disabled={isDepartmentSelectDisabled}
                    >
                      <SelectTrigger id="departementId">
                        <SelectValue
                          placeholder={
                            departmentsQuery.isError ? 'Departments unavailable' : 'Select department'
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

            <div className="space-y-2">
              <Label>Status</Label>
              <div className="flex h-10 items-center rounded-md border px-3">
                <Badge className="border-transparent bg-emerald-100 text-emerald-800">
                  Active on creation
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-slate-200/80 shadow-sm">
          <CardHeader className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Mail className="h-4 w-4 text-[#ff6b35]" />
              Contact
            </CardTitle>
            <CardDescription>Professional contact details used for communication.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <FieldError message={form.formState.errors.email?.message}>
              <Label htmlFor="email">Professional Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="employee@company.com"
                disabled={isSubmitting}
                {...form.register('email')}
              />
            </FieldError>

            <FieldError message={form.formState.errors.telephone?.message}>
              <Label htmlFor="telephone">Professional Phone</Label>
              <Input
                id="telephone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="+213612345678"
                disabled={isSubmitting}
                {...telephoneRegister}
                onBlur={(event) => {
                  telephoneRegister.onBlur(event)
                  const normalized = normalizePhoneNumberInput(event.target.value)
                  form.setValue('telephone', normalized ?? '', {
                    shouldDirty: true,
                    shouldValidate: true,
                    shouldTouch: true,
                  })
                }}
              />
              <p className="text-xs text-muted-foreground">Format: +213[5|6|7]XXXXXXXX</p>
            </FieldError>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-slate-200/80 shadow-sm">
          <CardHeader className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <UserRound className="h-4 w-4 text-[#ff6b35]" />
              Photo
            </CardTitle>
            <CardDescription>
              Add an image URL for profile display in admin, employee, and QR public pages.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-[160px_minmax(0,1fr)]">
            <div className="flex h-40 w-40 items-center justify-center rounded-xl border bg-slate-50">
              {currentPhotoUrl?.trim() ? (
                <img
                  src={currentPhotoUrl}
                  alt="Employee preview"
                  className="h-full w-full rounded-xl object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-200 text-lg font-semibold text-slate-600">
                  {employeeInitials}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <FieldError message={form.formState.errors.photoUrl?.message}>
                <Label htmlFor="photoUrl">Photo URL</Label>
                <Input
                  id="photoUrl"
                  placeholder="https://..."
                  disabled={isSubmitting}
                  {...form.register('photoUrl')}
                />
              </FieldError>
              <Separator />
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                Use a direct HTTPS image URL. Supported by current profile and QR public rendering.
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-3 pb-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            Validate required fields before creating the employee.
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(ROUTES.ADMIN_EMPLOYEES)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || departmentsQuery.isPending || !form.formState.isValid}
              className="bg-gradient-to-br from-[#ff6b35] to-[#ffc947] text-white shadow-sm transition-all hover:brightness-95 hover:shadow-md"
            >
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {isSubmitting ? 'Creating...' : 'Create Employee'}
            </Button>
          </div>
        </div>
      </form>
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
