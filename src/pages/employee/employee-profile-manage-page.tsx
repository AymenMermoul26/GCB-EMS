import { zodResolver } from '@hookform/resolvers/zod'
import {
  AlertTriangle,
  BriefcaseBusiness,
  CheckCircle2,
  Loader2,
  Lock,
  Save,
  SendHorizontal,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { Link } from 'react-router-dom'
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  EmptyState,
  ErrorState,
  PageStateSkeleton,
} from '@/components/common/page-state'
import {
  BRAND_BUTTON_CLASS_NAME,
  PageHeader,
  SURFACE_CARD_CLASS_NAME,
} from '@/components/common/page-header'
import { StatusBadge } from '@/components/common/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
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
import { Textarea } from '@/components/ui/textarea'
import { ROUTES } from '@/constants/routes'
import { useAuth } from '@/hooks/use-auth'
import { useI18n } from '@/hooks/use-i18n'
import { useRole } from '@/hooks/use-role'
import { DashboardLayout } from '@/layouts/dashboard-layout'
import { cn } from '@/lib/utils'
import {
  createEmployeeSelfEditSchema,
  normalizeOptional,
  type EmployeeSelfEditValues,
} from '@/schemas/employeeSelfEditSchema'
import {
  normalizeOptionalEmail,
  normalizePhoneNumberInput,
} from '@/schemas/employeeSchema'
import {
  createModificationRequestSchema,
  type ModificationRequestValues,
} from '@/schemas/modification-request.schema'
import { auditService } from '@/services/auditService'
import { useDepartmentsQuery } from '@/services/departmentsService'
import { useEmployeeQuery, useUpdateEmployeeMutation } from '@/services/employeesService'
import { notificationsService } from '@/services/notificationsService'
import { useMyRequestsQuery, useSubmitModificationRequestMutation } from '@/services/requestsService'
import { getDepartmentDisplayName } from '@/types/department'
import {
  EMPLOYEE_POSTE_LABELS,
  EMPLOYEE_POSTE_OPTIONS,
  getEmployeeCategorieProfessionnelleLabel,
  getEmployeeDiplomeLabel,
  getEmployeeNationaliteLabel,
  getEmployeeRegionalBranchLabel,
  getEmployeeSituationFamilialeLabel,
  getEmployeeSexeLabel,
  getEmployeeSpecialiteLabel,
  getEmployeeTypeContratLabel,
  getEmployeeUniversiteLabel,
  type Employee,
} from '@/types/employee'
import {
  MODIFICATION_REQUEST_FIELD_OPTIONS,
  type ModificationRequestField,
  type ModificationRequestFieldGroup,
  type ModificationRequestFieldOption,
} from '@/types/modification-request'
import {
  formatModificationRequestFieldValue,
  getModificationRequestFieldOption,
  getModificationRequestFieldSelectOptions,
  getRequestFieldLabel,
  getRequestFieldGroupLabel,
  getEmployeeFieldValue,
} from '@/utils/modification-requests'

type QrRefreshField = 'poste' | 'email' | 'telephone' | 'photo_url'
const EMPTY_FIELD_VALUE = '\u2014'
const EMPTY_SELECT_VALUE = '__none__'

interface SelfEditComparableValues {
  poste: string | null
  email: string | null
  telephone: string | null
  photo_url: string | null
}

function buildComparableValues(
  employee: Employee,
  values: EmployeeSelfEditValues,
): { previous: SelfEditComparableValues; next: SelfEditComparableValues } {
  const previous: SelfEditComparableValues = {
    poste: normalizeOptional(employee.poste ?? undefined),
    email: normalizeOptionalEmail(employee.email ?? undefined),
    telephone: normalizeOptional(employee.telephone ?? undefined),
    photo_url: normalizeOptional(employee.photoUrl ?? undefined),
  }

  const next: SelfEditComparableValues = {
    poste: normalizeOptional(values.poste),
    email: normalizeOptionalEmail(values.email),
    telephone: normalizeOptional(values.telephone),
    photo_url: normalizeOptional(values.photoUrl),
  }

  return { previous, next }
}

function getChangedSelfEditFields(
  employee: Employee,
  values: EmployeeSelfEditValues,
): QrRefreshField[] {
  const { previous, next } = buildComparableValues(employee, values)
  const trackedFields: QrRefreshField[] = ['poste', 'email', 'telephone', 'photo_url']

  return trackedFields.filter((field) => previous[field] !== next[field])
}

function getStatusTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'ACCEPTEE') {
    return 'success'
  }

  if (status === 'REJETEE') {
    return 'danger'
  }

  if (status === 'EN_ATTENTE') {
    return 'warning'
  }

  return 'neutral'
}

function formatRequestStatus(
  status: string,
  t: ReturnType<typeof useI18n>['t'],
): string {
  if (status === 'ACCEPTEE') {
    return t('status.modification.ACCEPTEE')
  }

  if (status === 'REJETEE') {
    return t('status.modification.REJETEE')
  }

  if (status === 'EN_ATTENTE') {
    return t('status.modification.EN_ATTENTE')
  }

  return status
}

function formatProfileValue(
  value: string | null | undefined,
  emptyValue: string,
): string {
  const normalized = value?.trim()
  return normalized && normalized.length > 0 ? normalized : emptyValue
}

function formatProfileDate(
  value: string | null | undefined,
  locale: string,
): string {
  if (!value) {
    return EMPTY_FIELD_VALUE
  }

  return new Date(`${value}T00:00:00`).toLocaleDateString(locale)
}

function formatProfileNumber(value: number | null | undefined): string {
  return value === null || value === undefined ? EMPTY_FIELD_VALUE : String(value)
}

interface FormFieldProps {
  label: string
  error?: string
  helperText?: string
  children: ReactNode
}

function FormField({ label, error, helperText, children }: FormFieldProps) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-slate-800">{label}</Label>
      {children}
      {helperText ? <p className="text-xs text-muted-foreground">{helperText}</p> : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}

interface ReadOnlyRowProps {
  label: string
  value: string
}

function ReadOnlyRow({ label, value }: ReadOnlyRowProps) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-slate-50 px-3 py-2.5">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-900">{value}</p>
    </div>
  )
}

function getRequestValueInputType(field: ModificationRequestField): 'text' | 'email' | 'tel' | 'url' | 'date' | 'number' {
  const fieldOption = getModificationRequestFieldOption(field)

  if (
    fieldOption.inputType === 'email' ||
    fieldOption.inputType === 'tel' ||
    fieldOption.inputType === 'url' ||
    fieldOption.inputType === 'date' ||
    fieldOption.inputType === 'number'
  ) {
    return fieldOption.inputType
  }

  return 'text'
}

export function EmployeeProfileManagePage() {
  const { employeId } = useRole()
  const { mustChangePassword } = useAuth()
  const { t, locale, isRTL } = useI18n()

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [requestSubmitError, setRequestSubmitError] = useState<string | null>(null)

  const employeeQuery = useEmployeeQuery(employeId)
  const departmentsQuery = useDepartmentsQuery()
  const myRequestsQuery = useMyRequestsQuery(employeId, 1, 10)

  const departmentName = useMemo(() => {
    if (!employeeQuery.data || !departmentsQuery.data) {
      return null
    }

    return (
      getDepartmentDisplayName(
        departmentsQuery.data.find(
          (department) => department.id === employeeQuery.data?.departementId,
        )?.nom,
      ) ?? null
    )
  }, [departmentsQuery.data, employeeQuery.data])

  const editSchema = useMemo(() => createEmployeeSelfEditSchema(t), [t])
  const requestSchema = useMemo(() => createModificationRequestSchema(t), [t])

  const editForm = useForm<EmployeeSelfEditValues>({
    resolver: zodResolver(editSchema),
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: {
      poste: '',
      email: '',
      telephone: '',
      photoUrl: '',
    },
  })

  const requestForm = useForm<ModificationRequestValues>({
    resolver: zodResolver(requestSchema),
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: {
      champCible: 'poste',
      ancienneValeur: '',
      nouvelleValeur: '',
      motif: '',
    },
  })

  const telephoneRegister = editForm.register('telephone')
  const selectedRequestField = useWatch({
    control: requestForm.control,
    name: 'champCible',
  })
  const watchedAncienneValeur = useWatch({
    control: requestForm.control,
    name: 'ancienneValeur',
  })
  const watchedNouvelleValeur = useWatch({
    control: requestForm.control,
    name: 'nouvelleValeur',
  })

  const watchedEditValues = useWatch({
    control: editForm.control,
  })

  useEffect(() => {
    if (!employeeQuery.data) {
      return
    }

    editForm.reset({
      poste: employeeQuery.data.poste ?? '',
      email: employeeQuery.data.email ?? '',
      telephone: employeeQuery.data.telephone ?? '',
      photoUrl: employeeQuery.data.photoUrl ?? '',
    })
  }, [editForm, employeeQuery.data])

  useEffect(() => {
    if (!employeeQuery.data || !selectedRequestField) {
      return
    }

    const currentValue = getEmployeeFieldValue(employeeQuery.data, selectedRequestField)
    requestForm.setValue('ancienneValeur', currentValue, { shouldValidate: true })
    requestForm.setValue('nouvelleValeur', '')
  }, [employeeQuery.data, requestForm, selectedRequestField])

  const updateProfileMutation = useUpdateEmployeeMutation({
    onSuccess: async (updatedEmployee) => {
      toast.success(t('employee.manage.saveSuccess'))
      try {
        await auditService.insertAuditLog({
          action: 'EMPLOYEE_SELF_UPDATED',
          targetType: 'Employe',
          targetId: updatedEmployee.id,
          detailsJson: {
            fields: ['poste', 'email', 'telephone', 'photo_url'],
          },
        })
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t('employee.manage.saveAuditError'))
      }
      await employeeQuery.refetch()
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const submitRequestMutation = useSubmitModificationRequestMutation({
    onSuccess: async (createdRequest) => {
      setRequestSubmitError(null)
      toast.success(t('employee.manage.requestSuccess'))
      requestForm.clearErrors()
      requestForm.reset({
        champCible: 'poste',
        ancienneValeur: employeeQuery.data ? getEmployeeFieldValue(employeeQuery.data, 'poste') : '',
        nouvelleValeur: '',
        motif: '',
      })

      try {
        await auditService.insertAuditLog({
          action: 'REQUEST_SUBMITTED',
          targetType: 'DemandeModification',
          targetId: createdRequest.id,
          detailsJson: {
            champ_cible: createdRequest.champCible,
            ancienne_valeur: createdRequest.ancienneValeur,
            nouvelle_valeur: createdRequest.nouvelleValeur,
          },
        })
      } catch (error) {
        console.error('Failed to write request submission audit log', error)
      }

      await myRequestsQuery.refetch()
    },
    onError: (error) => {
      setRequestSubmitError(error.message)
      toast.error(error.message)
    },
  })

  const onSubmitSelfEdit = editForm.handleSubmit(async (values) => {
    if (!employeId) {
      return
    }

    const currentEmployee = employeeQuery.data
    if (!currentEmployee) {
      return
    }

    const changedFields = getChangedSelfEditFields(currentEmployee, values)

    await updateProfileMutation.mutateAsync({
      id: employeId,
      payload: {
        poste: normalizeOptional(values.poste),
        email: normalizeOptionalEmail(values.email),
        telephone: normalizeOptional(values.telephone),
        photoUrl: normalizeOptional(values.photoUrl),
      },
    })

    if (changedFields.length === 0) {
      return
    }

    try {
      await notificationsService.notifyAdminsQrRefreshRequired({
        employeId,
        changedFields,
      })
    } catch (error) {
      console.error('Failed to notify admins about QR refresh requirement', error)
    }
  })

  const onSubmitRequest = requestForm.handleSubmit(async (values) => {
    if (!employeId) {
      return
    }

    await submitRequestMutation.mutateAsync({
      employeId,
      champCible: values.champCible,
      ancienneValeur: (values.ancienneValeur ?? '').trim() || null,
      nouvelleValeur: (values.nouvelleValeur ?? '').trim(),
      motif: values.motif?.trim() || null,
    })
  })

  const handleOpenConfirm = async () => {
    setRequestSubmitError(null)
    const isValid = await requestForm.trigger()
    if (!isValid) {
      return
    }
    setConfirmOpen(true)
  }

  const handleConfirmSubmit = async () => {
    setConfirmOpen(false)
    await onSubmitRequest()
  }

  const editedProfileFields = useMemo(() => {
    if (!employeeQuery.data) {
      return [] as string[]
    }

    const changedFields = getChangedSelfEditFields(employeeQuery.data, {
      poste: watchedEditValues.poste ?? '',
      email: watchedEditValues.email ?? '',
      telephone: watchedEditValues.telephone ?? '',
      photoUrl: watchedEditValues.photoUrl ?? '',
    })

    return changedFields.map((field) => getRequestFieldLabel(field, t))
  }, [
    employeeQuery.data,
    t,
    watchedEditValues.email,
    watchedEditValues.photoUrl,
    watchedEditValues.poste,
    watchedEditValues.telephone,
  ])

  const selectedRequestFieldLabel =
    getRequestFieldLabel(selectedRequestField as ModificationRequestField, t)
  const selectedRequestFieldOption = getModificationRequestFieldOption(
    selectedRequestField as ModificationRequestField,
  )
  const selectedRequestFieldOptions = useMemo(
    () => getModificationRequestFieldSelectOptions(selectedRequestField as ModificationRequestField),
    [selectedRequestField],
  )
  const groupedRequestFieldOptions = useMemo(() => {
    const grouped = new Map<ModificationRequestFieldGroup, ModificationRequestFieldOption[]>()

    for (const option of MODIFICATION_REQUEST_FIELD_OPTIONS) {
      const currentGroup = grouped.get(option.group) ?? []
      grouped.set(option.group, [...currentGroup, option])
    }

    return grouped
  }, [])
  const currentRequestFieldDisplayValue = formatModificationRequestFieldValue(
    selectedRequestField as ModificationRequestField,
    watchedAncienneValeur ?? null,
    { emptyValue: t('common.notProvided'), locale },
  )
  const requestedRequestFieldDisplayValue = formatModificationRequestFieldValue(
    selectedRequestField as ModificationRequestField,
    watchedNouvelleValeur ?? null,
    { emptyValue: t('common.notProvided'), locale },
  )

  const canSubmitApproval =
    requestForm.formState.isDirty &&
    requestForm.formState.isValid &&
    !submitRequestMutation.isPending

  if (employeeQuery.isPending) {
    return (
      <DashboardLayout
        title={t('employee.manage.title')}
        subtitle={t('employee.manage.subtitle')}
      >
        <PageStateSkeleton variant="profile" />
      </DashboardLayout>
    )
  }

  if (employeeQuery.isError) {
    return (
      <DashboardLayout
        title={t('employee.manage.title')}
        subtitle={t('employee.manage.subtitle')}
      >
        <ErrorState
          title={t('employee.manage.loadErrorTitle')}
          description={t('employee.manage.loadErrorDescription')}
          message={employeeQuery.error.message}
          onRetry={() => void employeeQuery.refetch()}
        />
      </DashboardLayout>
    )
  }

  if (!employeeQuery.data) {
    return (
      <DashboardLayout
        title={t('employee.manage.title')}
        subtitle={t('employee.manage.subtitle')}
      >
        <EmptyState
          title={t('employee.manage.emptyTitle')}
          description={t('employee.manage.emptyDescription')}
        />
      </DashboardLayout>
    )
  }

  const employee = employeeQuery.data

  return (
    <DashboardLayout
      title={t('employee.manage.title')}
      subtitle={t('employee.manage.subtitle')}
    >
      {mustChangePassword ? (
        <Alert className="mb-4 border-amber-300 bg-amber-50 text-amber-900">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{t('auth.reset.createBadge')}</AlertTitle>
          <AlertDescription>
            {t('employee.profile.passwordWarning')}
          </AlertDescription>
        </Alert>
      ) : null}

      {requestSubmitError ? (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>{t('employee.manage.requestTitle')}</AlertTitle>
          <AlertDescription className="mt-1">{requestSubmitError}</AlertDescription>
        </Alert>
      ) : null}

      <PageHeader
        title={t('employee.manage.title')}
        description={t('employee.manage.subtitle')}
        className="sticky top-16 z-20 mb-6"
        actions={
          <>
            <Button asChild variant="outline">
              <Link to={ROUTES.EMPLOYEE_PROFILE}>{t('actions.cancel')}</Link>
            </Button>
            <Button
              type="button"
              onClick={() => void handleOpenConfirm()}
              disabled={!canSubmitApproval}
              className={BRAND_BUTTON_CLASS_NAME}
            >
              {submitRequestMutation.isPending ? (
                <Loader2 className={cn('h-4 w-4 animate-spin', isRTL ? 'ml-2' : 'mr-2')} />
              ) : (
                <SendHorizontal className={cn('h-4 w-4', isRTL ? 'ml-2' : 'mr-2')} />
              )}
              {submitRequestMutation.isPending
                ? t('employee.manage.sending')
                : t('actions.submitForApproval')}
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card className={SURFACE_CARD_CLASS_NAME}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserRound className="h-4 w-4 text-slate-600" />
                {t('employee.manage.directChangesTitle')}
              </CardTitle>
              <CardDescription>
                {t('employee.manage.directChangesDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-5" onSubmit={onSubmitSelfEdit}>
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    label={t('employee.profile.fields.jobTitle')}
                    error={editForm.formState.errors.poste?.message}
                  >
                    <Controller
                      control={editForm.control}
                      name="poste"
                      render={({ field }) => (
                        <Select
                          value={field.value && field.value.length > 0 ? field.value : EMPTY_SELECT_VALUE}
                          onValueChange={(value) =>
                            field.onChange(value === EMPTY_SELECT_VALUE ? '' : value)
                          }
                          disabled={updateProfileMutation.isPending}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={t('employee.profile.fields.jobTitle')} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={EMPTY_SELECT_VALUE}>
                              {t('common.notProvided')}
                            </SelectItem>
                            {EMPLOYEE_POSTE_OPTIONS.map((option) => (
                              <SelectItem key={option} value={option}>
                                {EMPLOYEE_POSTE_LABELS[option]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </FormField>

                  <FormField label={t('common.email')} error={editForm.formState.errors.email?.message}>
                    <Input
                      type="email"
                      {...editForm.register('email')}
                      disabled={updateProfileMutation.isPending}
                    />
                  </FormField>

                  <FormField
                    label={t('employee.profile.fields.phone')}
                    error={editForm.formState.errors.telephone?.message}
                    helperText={t('employee.manage.phoneHelper')}
                  >
                    <Input
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="+213612345678"
                      {...telephoneRegister}
                      onBlur={(event) => {
                        telephoneRegister.onBlur(event)
                        const normalized = normalizePhoneNumberInput(event.target.value)
                        editForm.setValue('telephone', normalized ?? '', {
                          shouldDirty: true,
                          shouldValidate: true,
                          shouldTouch: true,
                        })
                      }}
                      disabled={updateProfileMutation.isPending}
                    />
                  </FormField>

                  <FormField
                    label={t('employee.manage.directFields.photo_url')}
                    error={editForm.formState.errors.photoUrl?.message}
                  >
                    <Input {...editForm.register('photoUrl')} disabled={updateProfileMutation.isPending} />
                  </FormField>
                </div>

                <div className="flex justify-end">
                  <Button
                    type="submit"
                    variant="outline"
                    disabled={updateProfileMutation.isPending || !editForm.formState.isDirty}
                  >
                    {updateProfileMutation.isPending ? (
                      <Loader2 className={cn('h-4 w-4 animate-spin', isRTL ? 'ml-2' : 'mr-2')} />
                    ) : (
                      <Save className={cn('h-4 w-4', isRTL ? 'ml-2' : 'mr-2')} />
                    )}
                    {updateProfileMutation.isPending
                      ? t('employee.manage.saving')
                      : t('actions.save')}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className={SURFACE_CARD_CLASS_NAME}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-slate-600" />
                {t('employee.manage.hrManagedTitle')}
              </CardTitle>
              <CardDescription>
                {t('employee.manage.hrManagedDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <ReadOnlyRow label={t('requests.fields.nom')} value={employee.nom} />
                <ReadOnlyRow label={t('requests.fields.prenom')} value={employee.prenom} />
                <ReadOnlyRow
                  label={t('employee.profile.fields.sex')}
                  value={formatProfileValue(getEmployeeSexeLabel(employee.sexe), t('common.notProvided'))}
                />
                <ReadOnlyRow
                  label={t('employee.profile.fields.birthDate')}
                  value={formatProfileDate(employee.dateNaissance, locale)}
                />
                <ReadOnlyRow
                  label={t('employee.profile.fields.birthPlace')}
                  value={formatProfileValue(employee.lieuNaissance, t('common.notProvided'))}
                />
                <ReadOnlyRow
                  label={t('employee.profile.fields.nationality')}
                  value={formatProfileValue(
                    getEmployeeNationaliteLabel(employee.nationalite),
                    t('common.notProvided'),
                  )}
                />
                <ReadOnlyRow
                  label={t('employee.profile.fields.maritalStatus')}
                  value={formatProfileValue(
                    getEmployeeSituationFamilialeLabel(employee.situationFamiliale),
                    t('common.notProvided'),
                  )}
                />
                <ReadOnlyRow
                  label={t('employee.profile.fields.children')}
                  value={formatProfileNumber(employee.nombreEnfants)}
                />
                <ReadOnlyRow
                  label={t('employee.profile.fields.address')}
                  value={formatProfileValue(employee.adresse, t('common.notProvided'))}
                />
                <ReadOnlyRow label={t('employee.profile.fields.employeeId')} value={employee.matricule} />
                <ReadOnlyRow
                  label={t('employee.profile.fields.department')}
                  value={departmentName ?? employee.departementId ?? t('common.notAssigned')}
                />
                <ReadOnlyRow
                  label={t('employee.profile.fields.regionalBranch')}
                  value={formatProfileValue(
                    getEmployeeRegionalBranchLabel(employee.regionalBranch),
                    t('common.notAssigned'),
                  )}
                />
                <ReadOnlyRow
                  label={t('employee.profile.fields.professionalCategory')}
                  value={formatProfileValue(
                    getEmployeeCategorieProfessionnelleLabel(employee.categorieProfessionnelle),
                    t('common.notAssigned'),
                  )}
                />
                <ReadOnlyRow
                  label={t('employee.profile.fields.contractType')}
                  value={formatProfileValue(
                    getEmployeeTypeContratLabel(employee.typeContrat),
                    t('common.notAssigned'),
                  )}
                />
                <ReadOnlyRow
                  label={t('employee.profile.fields.hireDate')}
                  value={formatProfileDate(employee.dateRecrutement, locale)}
                />
                <ReadOnlyRow
                  label={t('employee.profile.fields.degree')}
                  value={formatProfileValue(getEmployeeDiplomeLabel(employee.diplome), t('common.notProvided'))}
                />
                <ReadOnlyRow
                  label={t('employee.profile.fields.specialization')}
                  value={formatProfileValue(
                    getEmployeeSpecialiteLabel(employee.specialite),
                    t('common.notProvided'),
                  )}
                />
                <ReadOnlyRow
                  label={t('employee.profile.fields.university')}
                  value={formatProfileValue(
                    getEmployeeUniversiteLabel(employee.universite),
                    t('common.notProvided'),
                  )}
                />
              </div>

              <div className="rounded-xl border border-slate-200/80 bg-slate-50 px-3 py-2.5">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  {t('employee.profile.fields.careerHistory')}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm font-medium text-slate-900">
                  {formatProfileValue(employee.historiquePostes, t('common.notProvided'))}
                </p>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {t('employee.manage.socialSecurityHidden')}
              </div>
            </CardContent>
          </Card>

          <Card id="requests" className={`${SURFACE_CARD_CLASS_NAME} scroll-mt-24`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BriefcaseBusiness className="h-4 w-4 text-slate-600" />
                {t('employee.manage.requestTitle')}
              </CardTitle>
              <CardDescription>
                {t('employee.manage.requestDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-5" onSubmit={(event) => event.preventDefault()}>
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    label={t('employee.manage.field')}
                    error={requestForm.formState.errors.champCible?.message}
                  >
                    <Controller
                      control={requestForm.control}
                      name="champCible"
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger>
                            <SelectValue placeholder={t('employee.manage.field')} />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from(groupedRequestFieldOptions.entries()).map(
                              ([group, options]) => (
                                <SelectGroup key={group}>
                                  <SelectLabel>
                                    {getRequestFieldGroupLabel(group, t)}
                                  </SelectLabel>
                                  {options.map((option) => (
                                    <SelectItem key={option.key} value={option.key}>
                                      {getRequestFieldLabel(option.key, t)}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              ),
                            )}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </FormField>

                  <FormField label={t('employee.manage.currentValue')}>
                    {selectedRequestFieldOption.inputType === 'textarea' ? (
                      <Textarea
                        rows={4}
                        value={currentRequestFieldDisplayValue}
                        disabled
                      />
                    ) : (
                      <Input value={currentRequestFieldDisplayValue} disabled />
                    )}
                  </FormField>
                </div>

                <FormField
                  label={t('employee.manage.requestedNewValue')}
                  error={requestForm.formState.errors.nouvelleValeur?.message}
                >
                  {selectedRequestFieldOption.inputType === 'select' ? (
                    <Controller
                      control={requestForm.control}
                      name="nouvelleValeur"
                      render={({ field }) => (
                        <Select
                          value={field.value && field.value.length > 0 ? field.value : undefined}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={t('employee.manage.requestedNewValue')} />
                          </SelectTrigger>
                          <SelectContent>
                            {selectedRequestFieldOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  ) : selectedRequestFieldOption.inputType === 'textarea' ? (
                    <Textarea rows={4} {...requestForm.register('nouvelleValeur')} />
                  ) : (
                    <Input
                      type={getRequestValueInputType(selectedRequestField as ModificationRequestField)}
                      {...requestForm.register('nouvelleValeur')}
                    />
                  )}
                </FormField>

                <FormField label={t('employee.manage.additionalNote')}>
                  <Textarea rows={3} {...requestForm.register('motif')} />
                </FormField>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                  {t('employee.manage.useHeaderSubmit')}
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className={SURFACE_CARD_CLASS_NAME}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-slate-600" />
                {t('employee.manage.beforeSubmission')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                {t('employee.manage.hrReviewNote')}
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                {t('employee.manage.notificationAfterReview')}
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {t('employee.manage.directChangesTitle')}
                </p>
                {editedProfileFields.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t('employee.manage.noUnsavedDirectChanges')}
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {editedProfileFields.map((field) => (
                      <li key={field} className="flex items-center gap-2 text-sm text-slate-700">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        {field}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {t('employee.manage.requestSummary')}
                </p>
                <ReadOnlyRow label={t('employee.manage.selectedField')} value={selectedRequestFieldLabel} />
                <ReadOnlyRow
                  label={t('employee.manage.currentValue')}
                  value={currentRequestFieldDisplayValue}
                />
                <ReadOnlyRow
                  label={t('employee.manage.requestedValue')}
                  value={requestedRequestFieldDisplayValue}
                />
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                {t('employee.manage.someFieldsLocked')}
                <br />
                {t('employee.manage.phoneHelper')}
              </div>
            </CardContent>
          </Card>

          <Card className={SURFACE_CARD_CLASS_NAME}>
            <CardHeader>
              <CardTitle>{t('employee.manage.recentRequestsTitle')}</CardTitle>
              <CardDescription>{t('employee.manage.recentRequestsDescription')}</CardDescription>
            </CardHeader>
            <CardContent>
              {myRequestsQuery.isPending ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : null}

              {myRequestsQuery.isError ? (
                <ErrorState
                  surface="plain"
                  title={t('employee.manage.recentRequestsLoadErrorTitle')}
                  description={t('employee.manage.recentRequestsLoadErrorDescription')}
                  message={myRequestsQuery.error.message}
                  onRetry={() => void myRequestsQuery.refetch()}
                />
              ) : null}

              {!myRequestsQuery.isPending && !myRequestsQuery.isError && myRequestsQuery.data ? (
                myRequestsQuery.data.items.length === 0 ? (
                  <EmptyState
                    surface="plain"
                    title={t('employee.manage.noRequestsTitle')}
                    description={t('employee.manage.noRequestsDescription')}
                  />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('employee.manage.field')}</TableHead>
                        <TableHead>{t('employee.requests.filterPlaceholder')}</TableHead>
                        <TableHead>{t('employee.requests.submitted')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {myRequestsQuery.data.items.slice(0, 5).map((request) => (
                        <TableRow key={request.id}>
                          <TableCell>{getRequestFieldLabel(request.champCible, t)}</TableCell>
                          <TableCell>
                            <StatusBadge tone={getStatusTone(request.statutDemande)}>
                              {formatRequestStatus(request.statutDemande, t)}
                            </StatusBadge>
                          </TableCell>
                          <TableCell>{new Date(request.createdAt).toLocaleDateString(locale)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('employee.manage.confirmSubmitTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('employee.manage.confirmSubmitDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitRequestMutation.isPending}>
              {t('actions.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={submitRequestMutation.isPending}
              onClick={(event) => {
                event.preventDefault()
                void handleConfirmSubmit()
              }}
              className="border-0 bg-gradient-to-br from-[#ff6b35] to-[#ffc947] text-white hover:opacity-95"
            >
              {submitRequestMutation.isPending ? (
                <Loader2 className={cn('h-4 w-4 animate-spin', isRTL ? 'ml-2' : 'mr-2')} />
              ) : (
                <SendHorizontal className={cn('h-4 w-4', isRTL ? 'ml-2' : 'mr-2')} />
              )}
              {submitRequestMutation.isPending
                ? t('employee.manage.sending')
                : t('employee.manage.send')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  )
}
