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
  SelectItem,
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
import { useRole } from '@/hooks/use-role'
import { DashboardLayout } from '@/layouts/dashboard-layout'
import {
  employeeSelfEditSchema,
  normalizeOptional,
  type EmployeeSelfEditValues,
} from '@/schemas/employeeSelfEditSchema'
import {
  normalizeOptionalEmail,
  normalizePhoneNumberInput,
} from '@/schemas/employeeSchema'
import {
  modificationRequestSchema,
  type ModificationRequestValues,
} from '@/schemas/modification-request.schema'
import { auditService } from '@/services/auditService'
import { useDepartmentsQuery } from '@/services/departmentsService'
import { useEmployeeQuery, useUpdateEmployeeMutation } from '@/services/employeesService'
import { notificationsService } from '@/services/notificationsService'
import { useMyRequestsQuery, useSubmitModificationRequestMutation } from '@/services/requestsService'
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
} from '@/types/modification-request'
import {
  REQUEST_FIELD_LABELS,
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

function formatRequestStatus(status: string): string {
  if (status === 'ACCEPTEE') {
    return 'Approved'
  }

  if (status === 'REJETEE') {
    return 'Rejected'
  }

  if (status === 'EN_ATTENTE') {
    return 'Pending'
  }

  return status
}

function formatFieldValue(value: string | null): string {
  const normalized = (value ?? '').trim()
  return normalized.length > 0 ? normalized : 'Not provided'
}

function formatProfileValue(value: string | null | undefined): string {
  const normalized = value?.trim()
  return normalized && normalized.length > 0 ? normalized : EMPTY_FIELD_VALUE
}

function formatProfileDate(value: string | null | undefined): string {
  if (!value) {
    return EMPTY_FIELD_VALUE
  }

  return new Date(`${value}T00:00:00`).toLocaleDateString()
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

export function EmployeeProfileManagePage() {
  const { employeId } = useRole()
  const { mustChangePassword } = useAuth()

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
      departmentsQuery.data.find(
        (department) => department.id === employeeQuery.data?.departementId,
      )?.nom ?? null
    )
  }, [departmentsQuery.data, employeeQuery.data])

  const editForm = useForm<EmployeeSelfEditValues>({
    resolver: zodResolver(employeeSelfEditSchema),
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
    resolver: zodResolver(modificationRequestSchema),
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
      toast.success('Profile updated successfully.')
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
        toast.error(error instanceof Error ? error.message : "Failed to write audit log")
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
      toast.success('Request submitted successfully.')
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
      nouvelleValeur: values.nouvelleValeur.trim(),
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

    const fieldLabels: Record<QrRefreshField, string> = {
      poste: 'Job Title',
      email: 'Email',
      telephone: 'Phone',
      photo_url: 'Photo URL',
    }

    return changedFields.map((field) => fieldLabels[field])
  }, [
    employeeQuery.data,
    watchedEditValues.email,
    watchedEditValues.photoUrl,
    watchedEditValues.poste,
    watchedEditValues.telephone,
  ])

  const selectedRequestFieldLabel =
    REQUEST_FIELD_LABELS[selectedRequestField as ModificationRequestField] ?? 'Selected field'

  const canSubmitApproval =
    requestForm.formState.isDirty &&
    requestForm.formState.isValid &&
    !submitRequestMutation.isPending

  if (employeeQuery.isPending) {
    return (
      <DashboardLayout
        title="Manage My Profile"
        subtitle="Update your information and submit changes for HR approval."
      >
        <PageStateSkeleton variant="profile" />
      </DashboardLayout>
    )
  }

  if (employeeQuery.isError) {
    return (
      <DashboardLayout
        title="Manage My Profile"
        subtitle="Update your information and submit changes for HR approval."
      >
        <ErrorState
          title="Could not load profile"
          description="We couldn't load your profile management workspace right now."
          message={employeeQuery.error.message}
          onRetry={() => void employeeQuery.refetch()}
        />
      </DashboardLayout>
    )
  }

  if (!employeeQuery.data) {
    return (
      <DashboardLayout
        title="Manage My Profile"
        subtitle="Update your information and submit changes for HR approval."
      >
        <EmptyState
          title="Profile unavailable"
          description="Contact HR if your employee profile is not linked."
        />
      </DashboardLayout>
    )
  }

  const employee = employeeQuery.data

  return (
    <DashboardLayout
      title="Manage My Profile"
      subtitle="Update your information and submit changes for HR approval."
    >
      {mustChangePassword ? (
        <Alert className="mb-4 border-amber-300 bg-amber-50 text-amber-900">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Password change required</AlertTitle>
          <AlertDescription>
            You must change your password before using the application.
          </AlertDescription>
        </Alert>
      ) : null}

      {requestSubmitError ? (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>Could not submit request</AlertTitle>
          <AlertDescription className="mt-1">{requestSubmitError}</AlertDescription>
        </Alert>
      ) : null}

      <PageHeader
        title="Manage My Profile"
        description="Update your information and submit changes for HR approval."
        className="sticky top-16 z-20 mb-6"
        actions={
          <>
            <Button asChild variant="outline">
              <Link to={ROUTES.EMPLOYEE_PROFILE}>Cancel</Link>
            </Button>
            <Button
              type="button"
              onClick={() => void handleOpenConfirm()}
              disabled={!canSubmitApproval}
              className={BRAND_BUTTON_CLASS_NAME}
            >
              {submitRequestMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <SendHorizontal className="mr-2 h-4 w-4" />
              )}
              {submitRequestMutation.isPending ? 'Sending...' : 'Submit for Approval'}
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
                Editable Information
              </CardTitle>
              <CardDescription>
                These fields can be edited directly and may trigger QR refresh notifications.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-5" onSubmit={onSubmitSelfEdit}>
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField label="Job Title" error={editForm.formState.errors.poste?.message}>
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
                  </FormField>

                  <FormField label="Email" error={editForm.formState.errors.email?.message}>
                    <Input
                      type="email"
                      {...editForm.register('email')}
                      disabled={updateProfileMutation.isPending}
                    />
                  </FormField>

                  <FormField
                    label="Phone"
                    error={editForm.formState.errors.telephone?.message}
                    helperText="Format: +213 followed by 5, 6, or 7 and 8 digits."
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

                  <FormField label="Photo URL" error={editForm.formState.errors.photoUrl?.message}>
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
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    {updateProfileMutation.isPending ? 'Saving...' : 'Save Direct Changes'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className={SURFACE_CARD_CLASS_NAME}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-slate-600" />
                HR-Managed Fields
              </CardTitle>
              <CardDescription>
                The locked fields below are managed by HR and require a modification request.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <ReadOnlyRow label="Last Name" value={employee.nom} />
                <ReadOnlyRow label="First Name" value={employee.prenom} />
                <ReadOnlyRow
                  label="Sex"
                  value={formatProfileValue(getEmployeeSexeLabel(employee.sexe))}
                />
                <ReadOnlyRow
                  label="Birth Date"
                  value={formatProfileDate(employee.dateNaissance)}
                />
                <ReadOnlyRow
                  label="Birth Place"
                  value={formatProfileValue(employee.lieuNaissance)}
                />
                <ReadOnlyRow
                  label="Nationality"
                  value={formatProfileValue(getEmployeeNationaliteLabel(employee.nationalite))}
                />
                <ReadOnlyRow
                  label="Marital Status"
                  value={formatProfileValue(
                    getEmployeeSituationFamilialeLabel(employee.situationFamiliale),
                  )}
                />
                <ReadOnlyRow
                  label="Number of Children"
                  value={formatProfileNumber(employee.nombreEnfants)}
                />
                <ReadOnlyRow label="Address" value={formatProfileValue(employee.adresse)} />
                <ReadOnlyRow label="Employee ID" value={employee.matricule} />
                <ReadOnlyRow label="Department" value={departmentName ?? employee.departementId} />
                <ReadOnlyRow
                  label="Regional Branch"
                  value={formatProfileValue(
                    getEmployeeRegionalBranchLabel(employee.regionalBranch),
                  )}
                />
                <ReadOnlyRow
                  label="Professional Category"
                  value={formatProfileValue(
                    getEmployeeCategorieProfessionnelleLabel(employee.categorieProfessionnelle),
                  )}
                />
                <ReadOnlyRow
                  label="Contract Type"
                  value={formatProfileValue(getEmployeeTypeContratLabel(employee.typeContrat))}
                />
                <ReadOnlyRow
                  label="Hire Date"
                  value={formatProfileDate(employee.dateRecrutement)}
                />
                <ReadOnlyRow
                  label="Degree"
                  value={formatProfileValue(getEmployeeDiplomeLabel(employee.diplome))}
                />
                <ReadOnlyRow
                  label="Specialization"
                  value={formatProfileValue(getEmployeeSpecialiteLabel(employee.specialite))}
                />
                <ReadOnlyRow
                  label="University"
                  value={formatProfileValue(getEmployeeUniversiteLabel(employee.universite))}
                />
              </div>

              <div className="rounded-xl border border-slate-200/80 bg-slate-50 px-3 py-2.5">
                <p className="text-xs uppercase tracking-wide text-slate-500">Career History</p>
                <p className="mt-1 whitespace-pre-wrap text-sm font-medium text-slate-900">
                  {formatProfileValue(employee.historiquePostes)}
                </p>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Your social security number is sensitive HR data and is not displayed here.
              </div>
            </CardContent>
          </Card>

          <Card id="requests" className={`${SURFACE_CARD_CLASS_NAME} scroll-mt-24`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BriefcaseBusiness className="h-4 w-4 text-slate-600" />
                Submit a Modification Request
              </CardTitle>
              <CardDescription>
                Submit one request at a time. HR reviews and approves changes through the workflow.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-5" onSubmit={(event) => event.preventDefault()}>
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField label="Field" error={requestForm.formState.errors.champCible?.message}>
                    <Controller
                      control={requestForm.control}
                      name="champCible"
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a field" />
                          </SelectTrigger>
                          <SelectContent>
                            {MODIFICATION_REQUEST_FIELD_OPTIONS.map((option) => (
                              <SelectItem key={option.key} value={option.key}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </FormField>

                  <FormField label="Current Value">
                    <Input value={requestForm.getValues('ancienneValeur') ?? ''} disabled />
                  </FormField>
                </div>

                <FormField
                  label="Requested New Value"
                  error={requestForm.formState.errors.nouvelleValeur?.message}
                >
                  <Input {...requestForm.register('nouvelleValeur')} />
                </FormField>

                <FormField label="Additional Note for HR (optional)">
                  <Textarea rows={3} {...requestForm.register('motif')} />
                </FormField>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                  Use <span className="font-medium">Submit for Approval</span> in the header to send this request.
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
                Before Submission
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                Your changes will be reviewed by HR before becoming official.
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                You will receive a notification once your request is reviewed.
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Direct Profile Changes
                </p>
                {editedProfileFields.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No unsaved direct changes.</p>
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
                  Request summary
                </p>
                <ReadOnlyRow label="Selected Field" value={selectedRequestFieldLabel} />
                <ReadOnlyRow
                  label="Current Value"
                  value={formatFieldValue(watchedAncienneValeur ?? null)}
                />
                <ReadOnlyRow
                  label="Requested Value"
                  value={formatFieldValue(watchedNouvelleValeur ?? null)}
                />
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                Some fields are locked and can only be changed by HR.
                <br />
                Phone format reminder: +213[5|6|7]XXXXXXXX
              </div>
            </CardContent>
          </Card>

          <Card className={SURFACE_CARD_CLASS_NAME}>
            <CardHeader>
              <CardTitle>Recent Requests</CardTitle>
              <CardDescription>Track your latest submitted modification requests.</CardDescription>
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
                  title="Could not load requests"
                  description="We couldn't load your recent requests right now."
                  message={myRequestsQuery.error.message}
                  onRetry={() => void myRequestsQuery.refetch()}
                />
              ) : null}

              {!myRequestsQuery.isPending && !myRequestsQuery.isError && myRequestsQuery.data ? (
                myRequestsQuery.data.items.length === 0 ? (
                  <EmptyState
                    surface="plain"
                    title="No requests submitted yet"
                    description="Your latest HR requests will appear here once you submit them."
                  />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Field</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {myRequestsQuery.data.items.slice(0, 5).map((request) => (
                        <TableRow key={request.id}>
                          <TableCell>{REQUEST_FIELD_LABELS[request.champCible]}</TableCell>
                          <TableCell>
                            <StatusBadge tone={getStatusTone(request.statutDemande)}>
                              {formatRequestStatus(request.statutDemande)}
                            </StatusBadge>
                          </TableCell>
                          <TableCell>{new Date(request.createdAt).toLocaleDateString()}</TableCell>
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
            <AlertDialogTitle>Submit changes for approval?</AlertDialogTitle>
            <AlertDialogDescription>
              HR will review your request. You can track its status from your requests and notifications.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitRequestMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={submitRequestMutation.isPending}
              onClick={(event) => {
                event.preventDefault()
                void handleConfirmSubmit()
              }}
              className="border-0 bg-gradient-to-br from-[#ff6b35] to-[#ffc947] text-white hover:opacity-95"
            >
              {submitRequestMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <SendHorizontal className="mr-2 h-4 w-4" />
              )}
              {submitRequestMutation.isPending ? 'Sending...' : 'Send'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  )
}
