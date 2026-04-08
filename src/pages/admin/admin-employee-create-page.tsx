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
import { type ReactNode, useMemo, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import {
  BRAND_BUTTON_CLASS_NAME,
  PageHeader,
} from '@/components/common/page-header'
import { StatusBadge } from '@/components/common/status-badge'
import { EmployeeDossierImportDialog } from '@/components/admin/employee-dossier-import-dialog'
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
import { ROUTES, getAdminEmployeeRoute } from '@/constants/routes'
import { DashboardLayout } from '@/layouts/dashboard-layout'
import { useDepartmentsQuery } from '@/services/departmentsService'
import { useCreateEmployeeMutation } from '@/services/employeesService'
import { notifyPayrollUsersOfNewEmployee } from '@/services/payrollNotificationsService'
import {
  employeeCreateSchema,
  normalizePhoneNumberInput,
  normalizeOptional,
  normalizeOptionalEmail,
  normalizeOptionalInteger,
  type EmployeeCreateFormValues,
} from '@/schemas/employeeSchema'
import {
  type EmployeeDossierExtractionResponse,
  type EmployeeDossierFormFieldKey,
} from '@/types/employee-dossier-import'
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
} from '@/types/employee'
import { getDepartmentDisplayName } from '@/types/department'
import { mapEmployeeWriteError } from '@/utils/supabase-errors'

function isMatriculeConflict(message: string): boolean {
  return message.toLowerCase().includes('matricule')
}

const EMPTY_SELECT_VALUE = '__none__'

interface AppliedDossierImportState {
  extraction: EmployeeDossierExtractionResponse
  appliedFields: EmployeeDossierFormFieldKey[]
  skippedFields: EmployeeDossierFormFieldKey[]
}

interface ImportedFieldHint {
  tone: 'success' | 'warning'
  message: string
}

function isEmptyFormFieldValue(value: unknown): boolean {
  if (typeof value === 'string') {
    return value.trim().length === 0
  }

  return value === null || value === undefined
}

function formatConfidencePercent(confidence: number | null): string {
  if (confidence === null) {
    return 'confidence unavailable'
  }

  return `${Math.round(confidence * 100)}% confidence`
}

export function AdminEmployeeCreatePage() {
  const navigate = useNavigate()
  const departmentsQuery = useDepartmentsQuery()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [dossierImportState, setDossierImportState] =
    useState<AppliedDossierImportState | null>(null)
  const [isDossierImportReviewed, setIsDossierImportReviewed] = useState(false)

  const form = useForm<EmployeeCreateFormValues>({
    resolver: zodResolver(employeeCreateSchema),
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

  const telephoneRegister = form.register('telephone')

  const createMutation = useCreateEmployeeMutation({
    onSuccess: (employee) => {
      void notifyPayrollUsersOfNewEmployee(employee).catch((error) => {
        console.error('Failed to notify payroll users about new employee availability', error)
      })

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

  const applyImportedDossier = (result: EmployeeDossierExtractionResponse) => {
    const appliedFields: EmployeeDossierFormFieldKey[] = []
    const skippedFields: EmployeeDossierFormFieldKey[] = []

    ;(
      Object.entries(result.draft) as [EmployeeDossierFormFieldKey, string | undefined][]
    ).forEach(([fieldKey, importedValue]) => {
      const nextValue = importedValue?.trim()
      if (!nextValue) {
        return
      }

      const currentValue = form.getValues(fieldKey)
      const fieldState = form.getFieldState(fieldKey)
      const shouldSkip = fieldState.isDirty && !isEmptyFormFieldValue(currentValue)

      if (shouldSkip) {
        skippedFields.push(fieldKey)
        return
      }

      form.setValue(fieldKey, nextValue, {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      })
      appliedFields.push(fieldKey)
    })

    setDossierImportState({
      extraction: result,
      appliedFields,
      skippedFields,
    })
    setIsDossierImportReviewed(appliedFields.length === 0)

    if (appliedFields.length === 0) {
      toast.error('No extracted values could be applied safely. Continue with manual entry.')
      return
    }

    if (skippedFields.length > 0) {
      toast.success(
        `Applied ${appliedFields.length} imported field(s). ${skippedFields.length} existing field(s) were kept because they were already edited manually.`,
      )
      return
    }

    toast.success(`Applied ${appliedFields.length} imported field(s) to the employee form.`)
  }

  const importedFieldHints = useMemo<
    Partial<Record<EmployeeDossierFormFieldKey, ImportedFieldHint>>
  >(() => {
    if (!dossierImportState) {
      return {}
    }

    return Object.values(dossierImportState.extraction.fields).reduce<
      Partial<Record<EmployeeDossierFormFieldKey, ImportedFieldHint>>
    >((accumulator, field) => {
      if (
        !field.mappedFormField ||
        !dossierImportState.appliedFields.includes(field.mappedFormField)
      ) {
        return accumulator
      }

      if (field.status === 'imported') {
        accumulator[field.mappedFormField] = {
          tone: 'success',
          message: `Imported from dossier • ${formatConfidencePercent(field.confidence)}`,
        }
      }

      if (field.status === 'low_confidence') {
        accumulator[field.mappedFormField] = {
          tone: 'warning',
          message: `Review imported value • ${formatConfidencePercent(field.confidence)}`,
        }
      }

      return accumulator
    }, {})
  }, [dossierImportState])

  const dossierImportLowConfidenceFields = useMemo(
    () =>
      Object.values(dossierImportState?.extraction.fields ?? {}).filter(
        (field) => field.status === 'low_confidence',
      ),
    [dossierImportState],
  )

  const dossierImportMissingFields = useMemo(
    () =>
      Object.values(dossierImportState?.extraction.fields ?? {}).filter(
        (field) => field.status === 'missing',
      ),
    [dossierImportState],
  )

  const dossierImportUnmappedFields = useMemo(
    () =>
      Object.values(dossierImportState?.extraction.fields ?? {}).filter(
        (field) => field.status === 'unmapped',
      ),
    [dossierImportState],
  )

  const requiresDossierImportReview =
    dossierImportState !== null && dossierImportState.appliedFields.length > 0

  const isCreateButtonDisabled =
    isSubmitting ||
    departmentsQuery.isPending ||
    !form.formState.isValid ||
    (requiresDossierImportReview && !isDossierImportReviewed)

  return (
    <DashboardLayout
      title="Create Employee"
      subtitle="Add a new employee record to the EMS directory."
    >
      <PageHeader
        title="Create Employee"
        description="Add a new employee and generate access details securely."
        className="sticky top-2 z-20 mb-6"
        backAction={
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
        }
        badges={<StatusBadge tone="neutral" emphasis="outline">Step 1 of 1</StatusBadge>}
        actions={
          <>
            <EmployeeDossierImportDialog
              disabled={isSubmitting || departmentsQuery.isPending}
              onApply={applyImportedDossier}
            />
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
              disabled={isCreateButtonDisabled}
              className={BRAND_BUTTON_CLASS_NAME}
            >
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {isSubmitting ? 'Creating...' : 'Create Employee'}
            </Button>
          </>
        }
      />

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

        {dossierImportState ? (
          <Card className="rounded-2xl border border-slate-200/80 shadow-sm">
            <CardHeader className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <ShieldCheck className="h-4 w-4 text-[#ff6b35]" />
                Dossier import review
              </CardTitle>
              <CardDescription>
                OCR values were applied to the existing create form only. Review the imported
                fields before creating the employee record.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-4">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">
                    Applied
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-emerald-900">
                    {dossierImportState.appliedFields.length}
                  </p>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-amber-700">
                    Low confidence
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-amber-900">
                    {dossierImportLowConfidenceFields.length}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-600">
                    Missing
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-slate-900">
                    {dossierImportMissingFields.length}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-600">
                    Kept manual values
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-slate-900">
                    {dossierImportState.skippedFields.length}
                  </p>
                </div>
              </div>

              {dossierImportState.extraction.warnings.length > 0 ? (
                <Alert className="rounded-2xl border border-amber-200 bg-amber-50 text-amber-900">
                  <AlertTitle>Import warnings</AlertTitle>
                  <AlertDescription>
                    {dossierImportState.extraction.warnings.join(' ')}
                  </AlertDescription>
                </Alert>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-900">Low-confidence fields</p>
                  {dossierImportLowConfidenceFields.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {dossierImportLowConfidenceFields.map((field) => (
                        <StatusBadge
                          key={field.key}
                          tone="warning"
                          emphasis="outline"
                        >
                          {field.label}
                        </StatusBadge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No low-confidence values were applied.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-900">Missing or not applied</p>
                  {dossierImportMissingFields.length > 0 ||
                  dossierImportUnmappedFields.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {dossierImportMissingFields.map((field) => (
                        <StatusBadge
                          key={field.key}
                          tone="neutral"
                          emphasis="outline"
                        >
                          {field.label}
                        </StatusBadge>
                      ))}
                      {dossierImportUnmappedFields.map((field) => (
                        <StatusBadge
                          key={field.key}
                          tone="danger"
                          emphasis="outline"
                        >
                          {field.label}
                        </StatusBadge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Every extracted field was either applied or intentionally skipped.
                    </p>
                  )}
                </div>
              </div>

              <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-slate-300"
                  checked={isDossierImportReviewed}
                  onChange={(event) => setIsDossierImportReviewed(event.target.checked)}
                />
                <span>
                  I reviewed the imported dossier values and I confirm the existing Add Employee
                  form is ready for manual submission.
                </span>
              </label>
            </CardContent>
          </Card>
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
            <FieldError
              message={form.formState.errors.prenom?.message}
              importHint={importedFieldHints.prenom}
            >
              <Label htmlFor="prenom">
                First Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="prenom"
                placeholder="First Name"
                disabled={isSubmitting}
                {...form.register('prenom')}
              />
            </FieldError>

            <FieldError
              message={form.formState.errors.nom?.message}
              importHint={importedFieldHints.nom}
            >
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

            <FieldError
              message={form.formState.errors.matricule?.message}
              importHint={importedFieldHints.matricule}
            >
              <Label htmlFor="matricule">Employee ID</Label>
              <Input
                id="matricule"
                placeholder="Leave empty to auto-generate (GCB-XXXXXX)"
                disabled={isSubmitting}
                {...form.register('matricule')}
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to auto-generate the next unique employee ID.
              </p>
            </FieldError>

            <FieldError
              message={form.formState.errors.poste?.message}
              importHint={importedFieldHints.poste}
            >
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
                    disabled={isSubmitting}
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

            <FieldError
              message={form.formState.errors.departementId?.message}
              importHint={importedFieldHints.departementId}
            >
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
                    disabled={isSubmitting}
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
                <StatusBadge tone="success">
                  Active on creation
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
            <FieldError
              message={form.formState.errors.sexe?.message}
              importHint={importedFieldHints.sexe}
            >
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
                    disabled={isSubmitting}
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

            <FieldError
              message={form.formState.errors.dateNaissance?.message}
              importHint={importedFieldHints.dateNaissance}
            >
              <Label htmlFor="dateNaissance">Birth Date</Label>
              <Input
                id="dateNaissance"
                type="date"
                disabled={isSubmitting}
                {...form.register('dateNaissance')}
              />
            </FieldError>

            <FieldError
              message={form.formState.errors.lieuNaissance?.message}
              importHint={importedFieldHints.lieuNaissance}
            >
              <Label htmlFor="lieuNaissance">Birth Place</Label>
              <Input
                id="lieuNaissance"
                placeholder="Birth Place"
                disabled={isSubmitting}
                {...form.register('lieuNaissance')}
              />
            </FieldError>

            <FieldError
              message={form.formState.errors.nationalite?.message}
              importHint={importedFieldHints.nationalite}
            >
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
                    disabled={isSubmitting}
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
            <FieldError
              message={form.formState.errors.categorieProfessionnelle?.message}
              importHint={importedFieldHints.categorieProfessionnelle}
            >
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
                    disabled={isSubmitting}
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

            <FieldError
              message={form.formState.errors.typeContrat?.message}
              importHint={importedFieldHints.typeContrat}
            >
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
                    disabled={isSubmitting}
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

            <FieldError
              message={form.formState.errors.dateRecrutement?.message}
              importHint={importedFieldHints.dateRecrutement}
            >
              <Label htmlFor="dateRecrutement">Hire Date</Label>
              <Input
                id="dateRecrutement"
                type="date"
                disabled={isSubmitting}
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
              <FieldError
                message={form.formState.errors.diplome?.message}
                importHint={importedFieldHints.diplome}
              >
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
                      disabled={isSubmitting}
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

              <FieldError
                message={form.formState.errors.specialite?.message}
                importHint={importedFieldHints.specialite}
              >
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
                      disabled={isSubmitting}
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
                      disabled={isSubmitting}
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
                disabled={isSubmitting}
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
              <FieldError
                message={form.formState.errors.situationFamiliale?.message}
                importHint={importedFieldHints.situationFamiliale}
              >
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
                      disabled={isSubmitting}
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

              <FieldError
                message={form.formState.errors.nombreEnfants?.message}
                importHint={importedFieldHints.nombreEnfants}
              >
                <Label htmlFor="nombreEnfants">Number of Children</Label>
                <Input
                  id="nombreEnfants"
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  disabled={isSubmitting}
                  {...form.register('nombreEnfants')}
                />
              </FieldError>

              <FieldError
                message={form.formState.errors.numeroSecuriteSociale?.message}
                importHint={importedFieldHints.numeroSecuriteSociale}
              >
                <Label htmlFor="numeroSecuriteSociale">Social Security Number</Label>
                <Input
                  id="numeroSecuriteSociale"
                  placeholder="Official administrative identifier"
                  disabled={isSubmitting}
                  {...form.register('numeroSecuriteSociale')}
                />
                <p className="text-xs text-muted-foreground">
                  Sensitive field. Restrict this value to HR administrators.
                </p>
              </FieldError>
            </div>

            <FieldError
              message={form.formState.errors.adresse?.message}
              importHint={importedFieldHints.adresse}
            >
              <Label htmlFor="adresse">Address</Label>
              <Textarea
                id="adresse"
                rows={3}
                placeholder="Employee address"
                disabled={isSubmitting}
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
                disabled={isSubmitting}
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
            <FieldError
              message={form.formState.errors.email?.message}
              importHint={importedFieldHints.email}
            >
              <Label htmlFor="email">Work Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="employee@company.com"
                disabled={isSubmitting}
                {...form.register('email')}
              />
            </FieldError>

            <FieldError
              message={form.formState.errors.telephone?.message}
              importHint={importedFieldHints.telephone}
            >
              <Label htmlFor="telephone">Work Phone</Label>
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
                  disabled={isSubmitting}
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
            Complete the required fields before creating the employee.
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
              disabled={isCreateButtonDisabled}
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
  importHint?: ImportedFieldHint
}

function FieldError({ children, message, importHint }: FieldErrorProps) {
  return (
    <div className="space-y-2">
      {children}
      {importHint ? (
        <p
          className={
            importHint.tone === 'warning'
              ? 'text-xs text-amber-700'
              : 'text-xs text-emerald-700'
          }
        >
          {importHint.message}
        </p>
      ) : null}
      {message ? <p className="text-xs text-destructive">{message}</p> : null}
    </div>
  )
}
