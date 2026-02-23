import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Copy,
  Download,
  Mail,
  Loader2,
  QrCode,
  RefreshCcw,
  Save,
  Send,
  ShieldCheck,
  UserX,
} from 'lucide-react'
import { QRCodeCanvas } from 'qrcode.react'
import { type ReactNode, useEffect, useMemo, useState } from 'react'
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
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { ROUTES, getPublicProfileRoute } from '@/constants/routes'
import { useAuth } from '@/hooks/use-auth'
import { DashboardLayout } from '@/layouts/dashboard-layout'
import {
  useDeactivateEmployeeMutation,
  useEmployeeQuery,
  useUpdateEmployeeMutation,
} from '@/services/employeesService'
import {
  useEmployeeProfileQuery,
  useInviteEmployeeAccountMutation,
  useResendInviteMutation,
} from '@/services/accountService'
import { useDepartmentsQuery } from '@/services/departmentsService'
import {
  useEmployeeCurrentTokenQuery,
  useGenerateOrRegenerateTokenMutation,
  useRevokeActiveTokenMutation,
} from '@/services/qrService'
import {
  useEmployeeVisibilityQuery,
  useUpsertVisibilityMutation,
} from '@/services/visibilityService'
import {
  notificationsService,
  useHasUnreadQrRefreshForEmployeeQuery,
} from '@/services/notificationsService'
import { auditService } from '@/services/auditService'
import {
  employeeSchema,
  normalizePhoneNumberInput,
  normalizeOptional,
  type EmployeeFormValues,
} from '@/schemas/employeeSchema'
import type { EmployeeVisibilityFieldKey } from '@/types/visibility'
import { copyTextToClipboard } from '@/utils/clipboard'
import { downloadCanvasAsPng } from '@/utils/qr'
import { mapEmployeeWriteError } from '@/utils/supabase-errors'

function getInitials(prenom: string, nom: string) {
  const initials = `${prenom.trim().charAt(0)}${nom.trim().charAt(0)}`.toUpperCase()
  return initials || 'NA'
}

function isMatriculeConflict(message: string): boolean {
  return message.toLowerCase().includes('matricule')
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return 'No expiration'
  }

  return new Date(value).toLocaleString()
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

const VISIBILITY_FIELDS: Array<{ key: EmployeeVisibilityFieldKey; label: string }> = [
  { key: 'nom', label: 'Nom' },
  { key: 'prenom', label: 'Prenom' },
  { key: 'poste', label: 'Poste' },
  { key: 'email', label: 'Email' },
  { key: 'telephone', label: 'Telephone' },
  { key: 'photo_url', label: 'Photo URL' },
  { key: 'departement', label: 'Departement' },
  { key: 'matricule', label: 'Matricule' },
]

export function AdminEmployeeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [accountEmailInput, setAccountEmailInput] = useState<string | null>(null)

  const employeeQuery = useEmployeeQuery(id)
  const employeeProfileQuery = useEmployeeProfileQuery(id)
  const departmentsQuery = useDepartmentsQuery()
  const visibilityQuery = useEmployeeVisibilityQuery(id)
  const employeeTokenQuery = useEmployeeCurrentTokenQuery(id)
  const qrRefreshRequiredQuery = useHasUnreadQrRefreshForEmployeeQuery(id, user?.id)

  const form = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeSchema),
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
      await queryClient.invalidateQueries({ queryKey: ['employeeToken', employee.id] })
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const upsertVisibilityMutation = useUpsertVisibilityMutation()

  const generateTokenMutation = useGenerateOrRegenerateTokenMutation()
  const revokeTokenMutation = useRevokeActiveTokenMutation()
  const inviteAccountMutation = useInviteEmployeeAccountMutation({
    onSuccess: (result) => {
      toast.success(`Invitation sent to ${result.email}.`)
      setAccountEmailInput(result.email)
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })
  const resendInviteMutation = useResendInviteMutation({
    onSuccess: (result) => {
      toast.success(`Invitation re-sent to ${result.email}.`)
      setAccountEmailInput(result.email)
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const employee = employeeQuery.data
  const isInactive = Boolean(employee && !employee.isActive)
  const isFormDisabled = isInactive || updateMutation.isPending || employeeQuery.isPending
  const token = employeeTokenQuery.data
  const employeeProfile = employeeProfileQuery.data
  const publicProfileUrl =
    token && token.statutToken === 'ACTIF'
      ? `${window.location.origin}${getPublicProfileRoute(token.token)}`
      : null
  const qrCanvasId = `employee-qr-${id ?? 'unknown'}`
  const isInviting = inviteAccountMutation.isPending || resendInviteMutation.isPending
  const needsQrRefresh = qrRefreshRequiredQuery.data ?? false

  const visibilityMap = useMemo(() => {
    const map = new Map<string, boolean>()
    for (const row of visibilityQuery.data ?? []) {
      map.set(row.fieldKey, row.isPublic)
    }

    return map
  }, [visibilityQuery.data])

  const onToggleVisibility = async (fieldKey: EmployeeVisibilityFieldKey, isPublic: boolean) => {
    if (!id) {
      return
    }

    try {
      await upsertVisibilityMutation.mutateAsync({
        employeId: id,
        fieldKey,
        isPublic,
      })

      toast.success(`Visibility updated for ${fieldKey}.`)

      try {
        await auditService.insertAuditLog({
          action: 'VISIBILITY_UPDATED',
          targetType: 'employee_visibility',
          targetId: id,
          detailsJson: {
            employe_id: id,
            field_key: fieldKey,
            is_public: isPublic,
          },
        })
      } catch (auditError) {
        console.error('Failed to write visibility audit log', auditError)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update visibility')
    }
  }

  const onGenerateOrRegenerateToken = async () => {
    if (!employee) {
      return
    }

    if (!employee.isActive) {
      toast.error('Inactive employees cannot generate public QR links.')
      return
    }

    const hadActiveToken = token?.statutToken === 'ACTIF'

    try {
      const nextToken = await generateTokenMutation.mutateAsync(employee.id)
      toast.success(hadActiveToken ? 'QR token regenerated.' : 'QR token generated.')

      if (user?.id) {
        try {
          await notificationsService.markUnreadQrRefreshForEmployeeRead(employee.id, user.id)
          await queryClient.invalidateQueries({
            queryKey: ['qrRefreshRequired', employee.id, user.id],
          })
          await queryClient.invalidateQueries({ queryKey: ['notifications', user.id] })
          await queryClient.invalidateQueries({ queryKey: ['notificationsUnreadCount', user.id] })
        } catch (notificationError) {
          console.error('Failed to clear QR refresh notifications', notificationError)
        }
      }

      try {
        await auditService.insertAuditLog({
          action: 'QR_REGENERATED',
          targetType: 'TokenQR',
          targetId: nextToken.id,
          detailsJson: {
            employe_id: employee.id,
            token_id: nextToken.id,
            statut_token: nextToken.statutToken,
          },
        })
      } catch (auditError) {
        console.error('Failed to write QR regenerate audit log', auditError)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to generate QR token')
    }
  }

  const onRevokeToken = async () => {
    if (!employee) {
      return
    }

    try {
      const revokedToken = await revokeTokenMutation.mutateAsync(employee.id)
      if (revokedToken) {
        toast.success('Active QR token revoked.')
      } else {
        toast.success('No active QR token found.')
      }

      try {
        await auditService.insertAuditLog({
          action: 'QR_REVOKED',
          targetType: 'TokenQR',
          targetId: revokedToken?.id ?? null,
          detailsJson: {
            employe_id: employee.id,
            token_id: revokedToken?.id ?? null,
          },
        })
      } catch (auditError) {
        console.error('Failed to write QR revoke audit log', auditError)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to revoke QR token')
    }
  }

  const onCopyPublicLink = async () => {
    if (!publicProfileUrl) {
      return
    }

    try {
      await copyTextToClipboard(publicProfileUrl)
      toast.success('Public link copied.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to copy link')
    }
  }

  const onDownloadQr = () => {
    if (!employee || !publicProfileUrl) {
      return
    }

    try {
      downloadCanvasAsPng(qrCanvasId, `ems_public_qr_${employee.matricule}.png`)
      toast.success('QR code downloaded.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to download QR')
    }
  }

  const onSendInvite = async () => {
    if (!employee) {
      return
    }

    const normalizedEmail = effectiveInviteEmail

    if (!isValidEmail(normalizedEmail)) {
      toast.error('Please enter a valid email address before sending an invite.')
      return
    }

    await inviteAccountMutation.mutateAsync({
      employeId: employee.id,
      email: normalizedEmail,
    })
  }

  const onResendInvite = async () => {
    if (!employee) {
      return
    }

    const normalizedEmail = effectiveInviteEmail

    if (!isValidEmail(normalizedEmail)) {
      toast.error('Please provide a valid email to resend the invite.')
      return
    }

    await resendInviteMutation.mutateAsync({
      employeId: employee.id,
      email: normalizedEmail,
    })
  }

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
  const currentEmail = useWatch({ control: form.control, name: 'email' })
  const accountEmailSource = accountEmailInput ?? currentEmail ?? employee?.email ?? ''
  const normalizedAccountEmail = accountEmailSource.trim().toLowerCase()
  const fallbackProfileEmail = currentEmail?.trim().toLowerCase() ?? ''
  const effectiveInviteEmail = normalizedAccountEmail || fallbackProfileEmail
  const displayAccountEmail = normalizedAccountEmail || fallbackProfileEmail || 'Not available'
  const canTriggerInvite =
    !isInviting &&
    effectiveInviteEmail.length > 0 &&
    isValidEmail(effectiveInviteEmail)

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
                  <p className="text-xs text-muted-foreground">
                    Format: +213 followed by 5, 6, or 7 and 8 digits.
                  </p>
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
                <Button type="submit" disabled={isFormDisabled || !form.formState.isValid}>
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

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Account
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {employeeProfileQuery.isPending ? (
                <>
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </>
              ) : null}

              {employeeProfileQuery.isError ? (
                <div className="space-y-2">
                  <p className="text-sm text-destructive">{employeeProfileQuery.error.message}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void employeeProfileQuery.refetch()}
                  >
                    Retry
                  </Button>
                </div>
              ) : null}

              {!employeeProfileQuery.isPending && !employeeProfileQuery.isError ? (
                <>
                  {employeeProfile?.userId ? (
                    <div className="space-y-2 rounded-md border p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <p className="font-medium">Linked account</p>
                        <Badge variant="secondary">Linked</Badge>
                      </div>
                      <p>
                        <span className="font-medium">Email:</span> {displayAccountEmail}
                      </p>
                      <p className="break-all text-xs text-muted-foreground">
                        user_id: {employeeProfile.userId}
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                      No linked auth account yet.
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="account-email-input">Invite Email</Label>
                    <Input
                      id="account-email-input"
                      type="email"
                      value={accountEmailSource}
                      onChange={(event) => setAccountEmailInput(event.target.value)}
                      placeholder="employee@company.com"
                      disabled={isInviting}
                    />
                    {normalizedAccountEmail.length > 0 && !isValidEmail(normalizedAccountEmail) ? (
                      <p className="text-xs text-destructive">Enter a valid email address.</p>
                    ) : null}
                  </div>

                  {employeeProfile?.userId ? (
                    <Button
                      type="button"
                      className="w-full"
                      variant="outline"
                      disabled={!canTriggerInvite}
                      onClick={() => void onResendInvite()}
                    >
                      {isInviting ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="mr-2 h-4 w-4" />
                      )}
                      {isInviting ? 'Sending...' : 'Resend Invite'}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      className="w-full"
                      disabled={!canTriggerInvite}
                      onClick={() => void onSendInvite()}
                    >
                      {isInviting ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="mr-2 h-4 w-4" />
                      )}
                      {isInviting ? 'Sending...' : 'Send Invite'}
                    </Button>
                  )}
                </>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                Public Profile Visibility
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {visibilityQuery.isPending ? (
                <>
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </>
              ) : null}

              {visibilityQuery.isError ? (
                <div className="space-y-2">
                  <p className="text-sm text-destructive">{visibilityQuery.error.message}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void visibilityQuery.refetch()}
                  >
                    Retry
                  </Button>
                </div>
              ) : null}

              {!visibilityQuery.isPending && !visibilityQuery.isError ? (
                <>
                  {VISIBILITY_FIELDS.map((field) => (
                    <div
                      key={field.key}
                      className="flex items-center justify-between rounded-md border px-3 py-2"
                    >
                      <p className="text-sm">{field.label}</p>
                      <Switch
                        checked={visibilityMap.get(field.key) ?? false}
                        disabled={upsertVisibilityMutation.isPending}
                        onCheckedChange={(checked) => {
                          void onToggleVisibility(field.key, checked)
                        }}
                      />
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground">
                    Fields not listed in employee_visibility are treated as private.
                  </p>
                </>
              ) : null}
            </CardContent>
          </Card>

          <Card id="qr">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="h-4 w-4" />
                QR / Public Link
                {needsQrRefresh ? (
                  <Badge className="border-transparent bg-red-600 text-white">
                    Needs QR refresh
                  </Badge>
                ) : null}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {needsQrRefresh ? (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
                  Employee info changed. Regenerate QR to ensure public profile is up to date.
                </div>
              ) : null}

              {employeeTokenQuery.isPending ? (
                <>
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </>
              ) : null}

              {employeeTokenQuery.isError ? (
                <div className="space-y-2">
                  <p className="text-sm text-destructive">{employeeTokenQuery.error.message}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void employeeTokenQuery.refetch()}
                  >
                    Retry
                  </Button>
                </div>
              ) : null}

              {!employeeTokenQuery.isPending && !employeeTokenQuery.isError ? (
                <>
                  {token ? (
                    <div className="space-y-2 rounded-md border p-3 text-sm">
                      <p className="break-all">
                        <span className="font-medium">Token:</span> {token.token}
                      </p>
                      <p>
                        <span className="font-medium">Status:</span>{' '}
                        <Badge variant={token.statutToken === 'ACTIF' ? 'secondary' : 'outline'}>
                          {token.statutToken}
                        </Badge>
                      </p>
                      <p>
                        <span className="font-medium">Expires at:</span>{' '}
                        {formatDateTime(token.expiresAt)}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No QR token has been generated yet.
                    </p>
                  )}

                  {isInactive && token ? (
                    <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
                      Employee inactive; public link should be revoked/expired.
                    </p>
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      onClick={() => void onGenerateOrRegenerateToken()}
                      disabled={
                        isInactive ||
                        generateTokenMutation.isPending ||
                        revokeTokenMutation.isPending
                      }
                    >
                      {generateTokenMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCcw className="mr-2 h-4 w-4" />
                      )}
                      {token && token.statutToken === 'ACTIF' ? 'Regenerate QR' : 'Generate QR'}
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={
                            !token ||
                            token.statutToken !== 'ACTIF' ||
                            revokeTokenMutation.isPending
                          }
                        >
                          Revoke
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Revoke active QR token?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will immediately disable the current public profile link.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel disabled={revokeTokenMutation.isPending}>
                            Cancel
                          </AlertDialogCancel>
                          <AlertDialogAction
                            disabled={revokeTokenMutation.isPending}
                            onClick={(event) => {
                              event.preventDefault()
                              void onRevokeToken()
                            }}
                          >
                            {revokeTokenMutation.isPending ? 'Revoking...' : 'Confirm'}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>

                  {publicProfileUrl ? (
                    <>
                      <div className="rounded-md border p-3">
                        <p className="mb-2 text-xs text-muted-foreground">Public URL</p>
                        <p className="break-all text-sm">{publicProfileUrl}</p>
                      </div>

                      <div className="flex items-center justify-center rounded-md border p-4">
                        <QRCodeCanvas
                          id={qrCanvasId}
                          value={publicProfileUrl}
                          size={168}
                          level="M"
                          includeMargin
                        />
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" onClick={() => void onCopyPublicLink()}>
                          <Copy className="mr-2 h-4 w-4" />
                          Copy Public Link
                        </Button>
                        <Button type="button" variant="outline" onClick={onDownloadQr}>
                          <Download className="mr-2 h-4 w-4" />
                          Download QR
                        </Button>
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Generate an active token to enable the public link and QR download.
                    </p>
                  )}
                </>
              ) : null}
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
