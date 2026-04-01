import { zodResolver } from '@hookform/resolvers/zod'
import {
  ArrowLeft,
  BriefcaseBusiness,
  CheckCircle2,
  Loader2,
  Mail,
  Save,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import {
  BRAND_BUTTON_CLASS_NAME,
  PageHeader,
} from '@/components/common/page-header'
import { EmptyState, ErrorState } from '@/components/common/page-state'
import { StatusBadge } from '@/components/common/status-badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
import { Textarea } from '@/components/ui/textarea'
import {
  ROUTES,
  getAdminEmployeeRoute,
} from '@/constants/routes'
import { DashboardLayout } from '@/layouts/dashboard-layout'
import { useDepartmentsQuery } from '@/services/departmentsService'
import {
  useAdminEmployeeQuery,
  useUpdateAdminEmployeeMutation,
} from '@/services/employeesService'
import { notifyPayrollUsersOfEmployeeUpdate } from '@/services/payrollNotificationsService'
import {
  employeeSchema,
  normalizePhoneNumberInput,
  normalizeOptional,
  normalizeOptionalEmail,
  normalizeOptionalInteger,
  type EmployeeFormValues,
} from '@/schemas/employeeSchema'
import {
  EMPLOYEE_CATEGORIE_PROFESSIONNELLE_LABELS,
  EMPLOYEE_DIPLOME_LABELS,
  EMPLOYEE_DIPLOME_OPTIONS,
  EMPLOYEE_NATIONALITE_LABELS,
  EMPLOYEE_NATIONALITE_OPTIONS,
  EMPLOYEE_POSTE_LABELS,
  EMPLOYEE_POSTE_OPTIONS,
  EMPLOYEE_REGIONAL_BRANCH_LABELS,
  EMPLOYEE_REGIONAL_BRANCH_OPTIONS,
  EMPLOYEE_SPECIALITE_LABELS,
  EMPLOYEE_SPECIALITE_OPTIONS,
  EMPLOYEE_SITUATION_FAMILIALE_OPTIONS,
  EMPLOYEE_SITUATION_FAMILIALE_LABELS,
  EMPLOYEE_SEXE_OPTIONS,
  EMPLOYEE_CATEGORIE_PROFESSIONNELLE_OPTIONS,
  EMPLOYEE_SEXE_LABELS,
  EMPLOYEE_TYPE_CONTRAT_OPTIONS,
  EMPLOYEE_TYPE_CONTRAT_LABELS,
  EMPLOYEE_UNIVERSITE_LABELS,
  EMPLOYEE_UNIVERSITE_OPTIONS,
  sanitizeEmployeeTextValue,
} from '@/types/employee'
import { getDepartmentDisplayName } from '@/types/department'
import { mapEmployeeWriteError } from '@/utils/supabase-errors'

function isMatriculeConflict(message: string): boolean {
  return message.toLowerCase().includes('matricule')
}

const EMPTY_SELECT_VALUE = '__none__'

function toOptionalInputValue(value: string | null | undefined): string {
  return sanitizeEmployeeTextValue(value) ?? ''
}

function toOptionalSelectValue<T extends string>(
  value: string | null | undefined,
  options: readonly T[],
): string {
  const sanitized = sanitizeEmployeeTextValue(value)

  if (!sanitized) {
    return ''
  }

  return options.includes(sanitized as T) ? sanitized : ''
}

function buildEmployeeEditFormValues(
  employee: NonNullable<ReturnType<typeof useAdminEmployeeQuery>['data']>,
): EmployeeFormValues {
  return {
    matricule: employee.matricule,
    nom: employee.nom,
    prenom: employee.prenom,
    departementId: employee.departementId,
    regionalBranch: toOptionalSelectValue(employee.regionalBranch, EMPLOYEE_REGIONAL_BRANCH_OPTIONS),
    sexe: toOptionalSelectValue(employee.sexe, EMPLOYEE_SEXE_OPTIONS),
    dateNaissance: employee.dateNaissance ?? '',
    lieuNaissance: toOptionalInputValue(employee.lieuNaissance),
    nationalite: toOptionalSelectValue(employee.nationalite, EMPLOYEE_NATIONALITE_OPTIONS),
    situationFamiliale: toOptionalSelectValue(
      employee.situationFamiliale,
      EMPLOYEE_SITUATION_FAMILIALE_OPTIONS,
    ),
    nombreEnfants:
      employee.nombreEnfants !== null && employee.nombreEnfants !== undefined
        ? String(employee.nombreEnfants)
        : '',
    adresse: toOptionalInputValue(employee.adresse),
    numeroSecuriteSociale: toOptionalInputValue(employee.numeroSecuriteSociale),
    diplome: toOptionalSelectValue(employee.diplome, EMPLOYEE_DIPLOME_OPTIONS),
    specialite: toOptionalSelectValue(employee.specialite, EMPLOYEE_SPECIALITE_OPTIONS),
    universite: toOptionalSelectValue(employee.universite, EMPLOYEE_UNIVERSITE_OPTIONS),
    historiquePostes: toOptionalInputValue(employee.historiquePostes),
    observations: toOptionalInputValue(employee.observations),
    poste: toOptionalSelectValue(employee.poste, EMPLOYEE_POSTE_OPTIONS),
    categorieProfessionnelle: toOptionalSelectValue(
      employee.categorieProfessionnelle,
      EMPLOYEE_CATEGORIE_PROFESSIONNELLE_OPTIONS,
    ),
    typeContrat: toOptionalSelectValue(employee.typeContrat, EMPLOYEE_TYPE_CONTRAT_OPTIONS),
    dateRecrutement: employee.dateRecrutement ?? '',
    email: toOptionalInputValue(employee.email),
    telephone: toOptionalInputValue(employee.telephone),
    photoUrl: toOptionalInputValue(employee.photoUrl),
  }
}

export function AdminEmployeeEditPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const employeeId = id ?? ''
  const departmentsQuery = useDepartmentsQuery()
  const employeeQuery = useAdminEmployeeQuery(id)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const form = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeSchema),
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: {
      matricule: '',
      nom: '',
      prenom: '',
      departementId: undefined,
      regionalBranch: '',
      sexe: '',
      dateNaissance: '',
      lieuNaissance: '',
      nationalite: '',
      situationFamiliale: '',
      nombreEnfants: '',
      adresse: '',
      numeroSecuriteSociale: '',
      diplome: '',
      specialite: '',
      universite: '',
      historiquePostes: '',
      observations: '',
      poste: '',
      categorieProfessionnelle: '',
      typeContrat: '',
      dateRecrutement: '',
      email: '',
      telephone: '',
      photoUrl: '',
    },
  })

  useEffect(() => {
    if (!employeeQuery.data) {
      return
    }

    form.reset(buildEmployeeEditFormValues(employeeQuery.data))
  }, [employeeQuery.data, form])

  const telephoneRegister = form.register('telephone')

  const updateMutation = useUpdateAdminEmployeeMutation({
    onSuccess: (employee) => {
      toast.success(`Employee updated successfully (${employee.matricule}).`)
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
    const previousEmployee = employeeQuery.data

    const updatedEmployee = await updateMutation.mutateAsync({
      id: employeeId,
      payload: {
        matricule: values.matricule.trim(),
        nom: values.nom.trim(),
        prenom: values.prenom.trim(),
        departementId: values.departementId,
        regionalBranch: normalizeOptional(values.regionalBranch),
        sexe: normalizeOptional(values.sexe),
        dateNaissance: normalizeOptional(values.dateNaissance),
        lieuNaissance: normalizeOptional(values.lieuNaissance),
        nationalite: normalizeOptional(values.nationalite),
        situationFamiliale: normalizeOptional(values.situationFamiliale),
        nombreEnfants: normalizeOptionalInteger(values.nombreEnfants),
        adresse: normalizeOptional(values.adresse),
        numeroSecuriteSociale: normalizeOptional(values.numeroSecuriteSociale),
        diplome: normalizeOptional(values.diplome),
        specialite: normalizeOptional(values.specialite),
        universite: normalizeOptional(values.universite),
        historiquePostes: normalizeOptional(values.historiquePostes),
        observations: normalizeOptional(values.observations),
        poste: normalizeOptional(values.poste),
        categorieProfessionnelle: normalizeOptional(values.categorieProfessionnelle),
        typeContrat: normalizeOptional(values.typeContrat),
        dateRecrutement: normalizeOptional(values.dateRecrutement),
        email: normalizeOptionalEmail(values.email),
        telephone: normalizeOptional(values.telephone),
        photoUrl: normalizeOptional(values.photoUrl),
      },
    })

    if (!previousEmployee) {
      return
    }

    void notifyPayrollUsersOfEmployeeUpdate(previousEmployee, updatedEmployee).catch((error) => {
      console.error('Failed to notify payroll users about employee update', error)
    })
  })

  const isSubmitting = updateMutation.isPending
  const isInactive = Boolean(employeeQuery.data && !employeeQuery.data.isActive)
  const isFormDisabled = isSubmitting || employeeQuery.isFetching || isInactive
  const formId = 'edit-employee-form'
  const currentPhotoUrl = useWatch({ control: form.control, name: 'photoUrl' })
  const currentNom = useWatch({ control: form.control, name: 'nom' })
  const currentPrenom = useWatch({ control: form.control, name: 'prenom' })
  const employeeInitials = useMemo(() => {
    const nomInitial = currentNom?.trim().charAt(0) ?? ''
    const prenomInitial = currentPrenom?.trim().charAt(0) ?? ''
    const initials = `${prenomInitial}${nomInitial}`.toUpperCase()
    return initials || 'NA'
  }, [currentNom, currentPrenom])
  const isDepartmentSelectDisabled = isFormDisabled || departmentsQuery.isError

  if (!id) {
    return (
      <DashboardLayout title="Edit Employee" subtitle="Invalid route parameter.">
        <Card>
          <CardContent className="space-y-3 p-6">
            <p className="text-sm text-destructive">Employee id is missing.</p>
            <Button variant="outline" onClick={() => navigate(ROUTES.ADMIN_EMPLOYEES)}>
              Back to employees
            </Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    )
  }

  if (employeeQuery.isPending || employeeQuery.isFetching) {
    return (
      <DashboardLayout title="Edit Employee" subtitle="Loading employee details...">
        <div className="mx-auto grid w-full max-w-5xl gap-6">
          <Card className="rounded-2xl border border-slate-200/80 shadow-sm">
            <CardContent className="grid gap-4 p-6 md:grid-cols-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
          <Card className="rounded-2xl border border-slate-200/80 shadow-sm">
            <CardContent className="grid gap-4 p-6 md:grid-cols-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-24 w-full md:col-span-2" />
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    )
  }

  if (employeeQuery.isError) {
    return (
      <DashboardLayout title="Edit Employee" subtitle="Could not load employee details.">
        <ErrorState
          title="Could not load employee"
          description="We couldn't load this employee record right now."
          message={employeeQuery.error.message}
          onRetry={() => void employeeQuery.refetch()}
        />
      </DashboardLayout>
    )
  }

  if (!employeeQuery.data) {
    return (
      <DashboardLayout title="Edit Employee" subtitle="Employee not found.">
        <EmptyState
          title="Employee not found"
          description="The requested employee record could not be found."
          actions={
            <Button variant="outline" onClick={() => navigate(ROUTES.ADMIN_EMPLOYEES)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to employees
            </Button>
          }
        />
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout
      title="Edit Employee"
      subtitle="Review the current record and update only the fields that changed."
    >
      <PageHeader
        title="Edit Employee"
        description="Update this employee record with the latest verified information."
        className="sticky top-2 z-20 mb-6"
        backAction={
          <Button
            type="button"
            variant="ghost"
            className="px-0 text-muted-foreground"
            onClick={() => navigate(getAdminEmployeeRoute(employeeId))}
            disabled={isSubmitting}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to employee profile
          </Button>
        }
        badges={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone="neutral" emphasis="outline">
              Editing record
            </StatusBadge>
            <StatusBadge tone={employeeQuery.data.isActive ? 'success' : 'neutral'}>
              {employeeQuery.data.isActive ? 'Active' : 'Inactive'}
            </StatusBadge>
          </div>
        }
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(getAdminEmployeeRoute(employeeId))}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form={formId}
              disabled={isFormDisabled || departmentsQuery.isPending || !form.formState.isValid}
              className={BRAND_BUTTON_CLASS_NAME}
            >
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </>
        }
      />

      <form
        id={formId}
        className="mx-auto flex w-full max-w-5xl flex-col gap-6"
        onSubmit={onSubmit}
      >
        {isInactive ? (
          <Alert>
            <AlertTitle>Employee record is inactive</AlertTitle>
            <AlertDescription>
              Reactivate this employee from the profile page before editing the record.
            </AlertDescription>
          </Alert>
        ) : null}

        {submitError ? (
          <Alert variant="destructive">
            <AlertTitle>Could not update employee</AlertTitle>
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
                placeholder="First Name"
                disabled={isFormDisabled}
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
                disabled={isFormDisabled}
                {...form.register('nom')}
              />
            </FieldError>

            <FieldError message={form.formState.errors.matricule?.message}>
              <Label htmlFor="matricule">Employee ID</Label>
              <Input
                id="matricule"
                placeholder="Employee ID"
                disabled={isFormDisabled}
                {...form.register('matricule')}
              />
            </FieldError>

            <FieldError message={form.formState.errors.poste?.message}>
              <Label htmlFor="poste">Job Title</Label>
              <Controller
                control={form.control}
                name="poste"
                render={({ field }) => (
                  <Select
                    value={field.value && field.value.length > 0 ? field.value : EMPTY_SELECT_VALUE}
                    onValueChange={(value) =>
                      field.onChange(value === EMPTY_SELECT_VALUE ? '' : value)
                    }
                    disabled={isFormDisabled}
                  >
                    <SelectTrigger id="poste">
                      <SelectValue placeholder="Select a job title" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={EMPTY_SELECT_VALUE}>Not provided</SelectItem>
                      {EMPLOYEE_POSTE_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {EMPLOYEE_POSTE_LABELS[option]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
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
                            {getDepartmentDisplayName(department.nom) ?? department.nom}
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

            <FieldError message={form.formState.errors.regionalBranch?.message}>
              <Label htmlFor="regionalBranch">Regional branch</Label>
              <Controller
                control={form.control}
                name="regionalBranch"
                render={({ field }) => (
                  <Select
                    value={field.value && field.value.length > 0 ? field.value : EMPTY_SELECT_VALUE}
                    onValueChange={(value) =>
                      field.onChange(value === EMPTY_SELECT_VALUE ? '' : value)
                    }
                    disabled={isFormDisabled}
                  >
                    <SelectTrigger id="regionalBranch">
                      <SelectValue placeholder="Select regional branch" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={EMPTY_SELECT_VALUE}>Not provided</SelectItem>
                      {EMPLOYEE_REGIONAL_BRANCH_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {EMPLOYEE_REGIONAL_BRANCH_LABELS[option]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FieldError>

            <div className="space-y-2">
              <Label>Status</Label>
              <div className="flex h-10 items-center rounded-md border px-3">
                <StatusBadge tone={employeeQuery.data.isActive ? 'success' : 'neutral'}>
                  {employeeQuery.data.isActive ? 'Active' : 'Inactive'}
                </StatusBadge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-slate-200/80 shadow-sm">
          <CardHeader className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <UserRound className="h-4 w-4 text-[#ff6b35]" />
              Personal Information
            </CardTitle>
            <CardDescription>
              Sensitive civil information managed by HR and hidden from the public profile.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <FieldError message={form.formState.errors.sexe?.message}>
              <Label htmlFor="sexe">Sex</Label>
              <Controller
                control={form.control}
                name="sexe"
                render={({ field }) => (
                  <Select
                    value={field.value && field.value.length > 0 ? field.value : EMPTY_SELECT_VALUE}
                    onValueChange={(value) =>
                      field.onChange(value === EMPTY_SELECT_VALUE ? '' : value)
                    }
                    disabled={isFormDisabled}
                  >
                    <SelectTrigger id="sexe">
                      <SelectValue placeholder="Select sex" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={EMPTY_SELECT_VALUE}>Not provided</SelectItem>
                      {EMPLOYEE_SEXE_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {EMPLOYEE_SEXE_LABELS[option]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FieldError>

            <FieldError message={form.formState.errors.dateNaissance?.message}>
              <Label htmlFor="dateNaissance">Birth Date</Label>
              <Input
                id="dateNaissance"
                type="date"
                disabled={isFormDisabled}
                {...form.register('dateNaissance')}
              />
            </FieldError>

            <FieldError message={form.formState.errors.lieuNaissance?.message}>
              <Label htmlFor="lieuNaissance">Birth Place</Label>
              <Input
                id="lieuNaissance"
                placeholder="Birth Place"
                disabled={isFormDisabled}
                {...form.register('lieuNaissance')}
              />
            </FieldError>

            <FieldError message={form.formState.errors.nationalite?.message}>
              <Label htmlFor="nationalite">Nationality</Label>
              <Controller
                control={form.control}
                name="nationalite"
                render={({ field }) => (
                  <Select
                    value={field.value && field.value.length > 0 ? field.value : EMPTY_SELECT_VALUE}
                    onValueChange={(value) =>
                      field.onChange(value === EMPTY_SELECT_VALUE ? '' : value)
                    }
                    disabled={isFormDisabled}
                  >
                    <SelectTrigger id="nationalite">
                      <SelectValue placeholder="Select a nationality" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={EMPTY_SELECT_VALUE}>Not provided</SelectItem>
                      {EMPLOYEE_NATIONALITE_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {EMPLOYEE_NATIONALITE_LABELS[option]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FieldError>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-slate-200/80 shadow-sm">
          <CardHeader className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <BriefcaseBusiness className="h-4 w-4 text-[#ff6b35]" />
              Employment Information
            </CardTitle>
            <CardDescription>
              Core HR data used to structure the employee record.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <FieldError message={form.formState.errors.categorieProfessionnelle?.message}>
              <Label htmlFor="categorieProfessionnelle">Professional Category</Label>
              <Controller
                control={form.control}
                name="categorieProfessionnelle"
                render={({ field }) => (
                  <Select
                    value={field.value && field.value.length > 0 ? field.value : EMPTY_SELECT_VALUE}
                    onValueChange={(value) =>
                      field.onChange(value === EMPTY_SELECT_VALUE ? '' : value)
                    }
                    disabled={isFormDisabled}
                  >
                    <SelectTrigger id="categorieProfessionnelle">
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={EMPTY_SELECT_VALUE}>Not provided</SelectItem>
                      {EMPLOYEE_CATEGORIE_PROFESSIONNELLE_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {EMPLOYEE_CATEGORIE_PROFESSIONNELLE_LABELS[option]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FieldError>

            <FieldError message={form.formState.errors.typeContrat?.message}>
              <Label htmlFor="typeContrat">Contract Type</Label>
              <Controller
                control={form.control}
                name="typeContrat"
                render={({ field }) => (
                  <Select
                    value={field.value && field.value.length > 0 ? field.value : EMPTY_SELECT_VALUE}
                    onValueChange={(value) =>
                      field.onChange(value === EMPTY_SELECT_VALUE ? '' : value)
                    }
                    disabled={isFormDisabled}
                  >
                    <SelectTrigger id="typeContrat">
                      <SelectValue placeholder="Select a contract type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={EMPTY_SELECT_VALUE}>Not provided</SelectItem>
                      {EMPLOYEE_TYPE_CONTRAT_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {EMPLOYEE_TYPE_CONTRAT_LABELS[option]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FieldError>

            <FieldError message={form.formState.errors.dateRecrutement?.message}>
              <Label htmlFor="dateRecrutement">Hire Date</Label>
              <Input
                id="dateRecrutement"
                type="date"
                disabled={isFormDisabled}
                {...form.register('dateRecrutement')}
              />
            </FieldError>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-slate-200/80 shadow-sm">
          <CardHeader className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <BriefcaseBusiness className="h-4 w-4 text-[#ff6b35]" />
              Education & Career Background
            </CardTitle>
            <CardDescription>
              Education level, specialization, university, and career background summarized for internal HR use.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <FieldError message={form.formState.errors.diplome?.message}>
                <Label htmlFor="diplome">Degree / Diploma</Label>
                <Controller
                  control={form.control}
                  name="diplome"
                  render={({ field }) => (
                    <Select
                      value={field.value && field.value.length > 0 ? field.value : EMPTY_SELECT_VALUE}
                      onValueChange={(value) =>
                        field.onChange(value === EMPTY_SELECT_VALUE ? '' : value)
                      }
                      disabled={isFormDisabled}
                    >
                      <SelectTrigger id="diplome">
                        <SelectValue placeholder="Select a degree" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={EMPTY_SELECT_VALUE}>Not provided</SelectItem>
                        {EMPLOYEE_DIPLOME_OPTIONS.map((option) => (
                          <SelectItem key={option} value={option}>
                            {EMPLOYEE_DIPLOME_LABELS[option]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </FieldError>

              <FieldError message={form.formState.errors.specialite?.message}>
                <Label htmlFor="specialite">Specialization</Label>
                <Controller
                  control={form.control}
                  name="specialite"
                  render={({ field }) => (
                    <Select
                      value={field.value && field.value.length > 0 ? field.value : EMPTY_SELECT_VALUE}
                      onValueChange={(value) =>
                        field.onChange(value === EMPTY_SELECT_VALUE ? '' : value)
                      }
                      disabled={isFormDisabled}
                    >
                      <SelectTrigger id="specialite">
                        <SelectValue placeholder="Select a specialization" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={EMPTY_SELECT_VALUE}>Not provided</SelectItem>
                        {EMPLOYEE_SPECIALITE_OPTIONS.map((option) => (
                          <SelectItem key={option} value={option}>
                            {EMPLOYEE_SPECIALITE_LABELS[option]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </FieldError>

              <FieldError message={form.formState.errors.universite?.message}>
                <Label htmlFor="universite">University</Label>
                <Controller
                  control={form.control}
                  name="universite"
                  render={({ field }) => (
                    <Select
                      value={field.value && field.value.length > 0 ? field.value : EMPTY_SELECT_VALUE}
                      onValueChange={(value) =>
                        field.onChange(value === EMPTY_SELECT_VALUE ? '' : value)
                      }
                      disabled={isFormDisabled}
                    >
                      <SelectTrigger id="universite">
                        <SelectValue placeholder="Select a university" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={EMPTY_SELECT_VALUE}>Not provided</SelectItem>
                        {EMPLOYEE_UNIVERSITE_OPTIONS.map((option) => (
                          <SelectItem key={option} value={option}>
                            {EMPLOYEE_UNIVERSITE_LABELS[option]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </FieldError>
            </div>

            <FieldError message={form.formState.errors.historiquePostes?.message}>
              <Label htmlFor="historiquePostes">Career History</Label>
              <Textarea
                id="historiquePostes"
                rows={5}
                placeholder="Summary of previous roles and career history"
                disabled={isFormDisabled}
                {...form.register('historiquePostes')}
              />
            </FieldError>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-slate-200/80 shadow-sm">
          <CardHeader className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <ShieldCheck className="h-4 w-4 text-[#ff6b35]" />
              Administrative Information
            </CardTitle>
            <CardDescription>
              Sensitive HR and payroll-related data. This section remains internal and is never exposed through the public QR profile.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Access to these fields must remain limited to HR administrators.
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FieldError message={form.formState.errors.situationFamiliale?.message}>
                <Label htmlFor="situationFamiliale">Marital Status</Label>
                <Controller
                  control={form.control}
                  name="situationFamiliale"
                  render={({ field }) => (
                    <Select
                      value={field.value && field.value.length > 0 ? field.value : EMPTY_SELECT_VALUE}
                      onValueChange={(value) =>
                        field.onChange(value === EMPTY_SELECT_VALUE ? '' : value)
                      }
                      disabled={isFormDisabled}
                    >
                      <SelectTrigger id="situationFamiliale">
                        <SelectValue placeholder="Select marital status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={EMPTY_SELECT_VALUE}>Not provided</SelectItem>
                        {EMPLOYEE_SITUATION_FAMILIALE_OPTIONS.map((option) => (
                          <SelectItem key={option} value={option}>
                            {EMPLOYEE_SITUATION_FAMILIALE_LABELS[option]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </FieldError>

              <FieldError message={form.formState.errors.nombreEnfants?.message}>
                <Label htmlFor="nombreEnfants">Number of Children</Label>
                <Input
                  id="nombreEnfants"
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  disabled={isFormDisabled}
                  {...form.register('nombreEnfants')}
                />
              </FieldError>

              <FieldError message={form.formState.errors.numeroSecuriteSociale?.message}>
                <Label htmlFor="numeroSecuriteSociale">Social Security Number</Label>
                <Input
                  id="numeroSecuriteSociale"
                  placeholder="Official administrative identifier"
                  disabled={isFormDisabled}
                  {...form.register('numeroSecuriteSociale')}
                />
                <p className="text-xs text-muted-foreground">
                  Sensitive field. Restrict this value to HR administrators.
                </p>
              </FieldError>
            </div>

            <FieldError message={form.formState.errors.adresse?.message}>
              <Label htmlFor="adresse">Address</Label>
              <Textarea
                id="adresse"
                rows={3}
                placeholder="Employee address"
                disabled={isFormDisabled}
                {...form.register('adresse')}
              />
            </FieldError>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-slate-200/80 shadow-sm">
          <CardHeader className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <ShieldCheck className="h-4 w-4 text-[#ff6b35]" />
              Internal Notes
            </CardTitle>
            <CardDescription>
              Admin-only internal notes. This field is not shown to employees or in public profile flows.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Internal note field. Keep content professional and limited to HR operational use.
            </div>

            <FieldError message={form.formState.errors.observations?.message}>
              <Label htmlFor="observations">Internal Notes</Label>
              <Textarea
                id="observations"
                rows={5}
                placeholder="Internal notes about this employee"
                disabled={isFormDisabled}
                {...form.register('observations')}
              />
            </FieldError>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-slate-200/80 shadow-sm">
          <CardHeader className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Mail className="h-4 w-4 text-[#ff6b35]" />
              Contact
            </CardTitle>
            <CardDescription>Work contact details used for communication.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <FieldError message={form.formState.errors.email?.message}>
              <Label htmlFor="email">Work Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="employee@company.com"
                disabled={isFormDisabled}
                {...form.register('email')}
              />
            </FieldError>

            <FieldError message={form.formState.errors.telephone?.message}>
              <Label htmlFor="telephone">Work Phone</Label>
              <Input
                id="telephone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="+213612345678"
                disabled={isFormDisabled}
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
              Add an image URL for profile rendering across admin, employee, and public QR pages.
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
                  disabled={isFormDisabled}
                  {...form.register('photoUrl')}
                />
              </FieldError>
              <Separator />
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                Use a direct HTTPS image URL. Compatible with the current profile and public QR rendering.
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-3 pb-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            Review the required fields before saving changes.
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(getAdminEmployeeRoute(employeeId))}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isFormDisabled || departmentsQuery.isPending || !form.formState.isValid}
              className="bg-gradient-to-br from-[#ff6b35] to-[#ffc947] text-white shadow-sm transition-all hover:brightness-95 hover:shadow-md"
            >
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {isSubmitting ? 'Saving...' : 'Save Changes'}
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
