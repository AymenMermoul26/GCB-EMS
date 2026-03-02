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
import { normalizePhoneNumberInput } from '@/schemas/employeeSchema'
import {
  modificationRequestSchema,
  type ModificationRequestValues,
} from '@/schemas/modification-request.schema'
import { auditService } from '@/services/auditService'
import { useDepartmentsQuery } from '@/services/departmentsService'
import { useEmployeeQuery, useUpdateEmployeeMutation } from '@/services/employeesService'
import { notificationsService } from '@/services/notificationsService'
import { useMyRequestsQuery, useSubmitModificationRequestMutation } from '@/services/requestsService'
import type { Employee } from '@/types/employee'
import {
  MODIFICATION_REQUEST_FIELD_OPTIONS,
  type ModificationRequestField,
} from '@/types/modification-request'
import {
  REQUEST_FIELD_LABELS,
  getEmployeeFieldValue,
} from '@/utils/modification-requests'

type QrRefreshField = 'poste' | 'email' | 'telephone' | 'photo_url'

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
    email: normalizeOptional(employee.email ?? undefined),
    telephone: normalizeOptional(employee.telephone ?? undefined),
    photo_url: normalizeOptional(employee.photoUrl ?? undefined),
  }

  const next: SelfEditComparableValues = {
    poste: normalizeOptional(values.poste),
    email: normalizeOptional(values.email),
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

function getStatusVariant(status: string): 'secondary' | 'outline' {
  if (status === 'ACCEPTEE') {
    return 'secondary'
  }

  return 'outline'
}

function getStatusClassName(status: string): string {
  if (status === 'REJETEE') {
    return 'border-destructive text-destructive'
  }

  if (status === 'EN_ATTENTE') {
    return 'border-amber-300 text-amber-700'
  }

  return ''
}

function formatFieldValue(value: string | null): string {
  const normalized = (value ?? '').trim()
  return normalized.length > 0 ? normalized : 'Not set'
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
        toast.error(error instanceof Error ? error.message : 'Unable to write audit log')
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
        email: normalizeOptional(values.email),
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
      poste: 'Poste',
      email: 'Email',
      telephone: 'Telephone',
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
        title="Manage Profile"
        subtitle="Update your information and submit it for HR approval."
      >
        <div className="space-y-4">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
            <Skeleton className="h-[520px] w-full rounded-2xl" />
            <Skeleton className="h-[420px] w-full rounded-2xl" />
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (employeeQuery.isError) {
    return (
      <DashboardLayout
        title="Manage Profile"
        subtitle="Update your information and submit it for HR approval."
      >
        <Alert variant="destructive">
          <AlertTitle>Could not load profile</AlertTitle>
          <AlertDescription className="mt-2 flex items-center gap-3">
            <span>{employeeQuery.error.message}</span>
            <Button variant="outline" size="sm" onClick={() => void employeeQuery.refetch()}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      </DashboardLayout>
    )
  }

  if (!employeeQuery.data) {
    return (
      <DashboardLayout
        title="Manage Profile"
        subtitle="Update your information and submit it for HR approval."
      >
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>Profile not available</CardTitle>
            <CardDescription>Contact HR if your employee profile is not linked.</CardDescription>
          </CardHeader>
        </Card>
      </DashboardLayout>
    )
  }

  const employee = employeeQuery.data

  return (
    <DashboardLayout
      title="Manage Profile"
      subtitle="Update your information and submit it for HR approval."
    >
      {mustChangePassword ? (
        <Alert className="mb-4 border-amber-300 bg-amber-50 text-amber-900">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Password update required</AlertTitle>
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

      <section className="sticky top-16 z-20 mb-6 rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-sm backdrop-blur">
        <div className="mb-2 h-1 w-24 rounded-full bg-gradient-to-br from-[#ff6b35] to-[#ffc947]" />
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-slate-900">Manage Profile</h2>
            <p className="text-sm text-slate-600">
              Update your information and submit it for HR approval.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link to={ROUTES.EMPLOYEE_PROFILE}>Cancel</Link>
            </Button>
            <Button
              type="button"
              onClick={() => void handleOpenConfirm()}
              disabled={!canSubmitApproval}
              className="border-0 bg-gradient-to-br from-[#ff6b35] to-[#ffc947] text-white shadow-sm hover:shadow-md"
            >
              {submitRequestMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <SendHorizontal className="mr-2 h-4 w-4" />
              )}
              {submitRequestMutation.isPending ? 'Submitting...' : 'Submit for Approval'}
            </Button>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card className="rounded-2xl border-slate-200/80 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserRound className="h-4 w-4 text-slate-600" />
                Editable Information
              </CardTitle>
              <CardDescription>
                These fields can be updated directly and may trigger QR refresh notifications.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-5" onSubmit={onSubmitSelfEdit}>
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField label="Poste" error={editForm.formState.errors.poste?.message}>
                    <Input {...editForm.register('poste')} disabled={updateProfileMutation.isPending} />
                  </FormField>

                  <FormField label="Email" error={editForm.formState.errors.email?.message}>
                    <Input
                      type="email"
                      {...editForm.register('email')}
                      disabled={updateProfileMutation.isPending}
                    />
                  </FormField>

                  <FormField
                    label="Telephone"
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
                    {updateProfileMutation.isPending ? 'Saving...' : 'Save direct changes'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-slate-200/80 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-slate-600" />
                HR Managed Fields
              </CardTitle>
              <CardDescription>
                Locked fields below are managed by HR and require modification requests.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <ReadOnlyRow label="Nom" value={employee.nom} />
              <ReadOnlyRow label="Prenom" value={employee.prenom} />
              <ReadOnlyRow label="Matricule" value={employee.matricule} />
              <ReadOnlyRow label="Department" value={departmentName ?? employee.departementId} />
            </CardContent>
          </Card>

          <Card id="requests" className="rounded-2xl border-slate-200/80 shadow-sm scroll-mt-24">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BriefcaseBusiness className="h-4 w-4 text-slate-600" />
                Submit Modification Request
              </CardTitle>
              <CardDescription>
                Submit one request at a time. HR reviews and approves changes through workflow.
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
                            <SelectValue placeholder="Select field" />
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

                  <FormField label="Current value">
                    <Input value={requestForm.getValues('ancienneValeur') ?? ''} disabled />
                  </FormField>
                </div>

                <FormField
                  label="Requested new value"
                  error={requestForm.formState.errors.nouvelleValeur?.message}
                >
                  <Input {...requestForm.register('nouvelleValeur')} />
                </FormField>

                <FormField label="Additional note for HR (optional)">
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
          <Card className="rounded-2xl border-slate-200/80 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-slate-600" />
                Before You Submit
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                Your changes will be reviewed by HR before they become official.
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                You will receive a notification once your request is reviewed.
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Direct profile changes
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
                <ReadOnlyRow label="Target field" value={selectedRequestFieldLabel} />
                <ReadOnlyRow
                  label="Current value"
                  value={formatFieldValue(watchedAncienneValeur ?? null)}
                />
                <ReadOnlyRow
                  label="Requested value"
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

          <Card className="rounded-2xl border-slate-200/80 shadow-sm">
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
                <Alert variant="destructive">
                  <AlertTitle>Failed to load requests</AlertTitle>
                  <AlertDescription className="mt-2">{myRequestsQuery.error.message}</AlertDescription>
                </Alert>
              ) : null}

              {!myRequestsQuery.isPending && !myRequestsQuery.isError && myRequestsQuery.data ? (
                myRequestsQuery.data.items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No requests submitted yet.</p>
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
                            <Badge
                              variant={getStatusVariant(request.statutDemande)}
                              className={getStatusClassName(request.statutDemande)}
                            >
                              {request.statutDemande}
                            </Badge>
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
              HR will review your request. You can track status from your requests and notifications.
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
              {submitRequestMutation.isPending ? 'Submitting...' : 'Submit'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  )
}
