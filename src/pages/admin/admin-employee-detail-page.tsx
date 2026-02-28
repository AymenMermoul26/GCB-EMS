
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Copy,
  Download,
  ExternalLink,
  Loader2,
  Mail,
  MoreVertical,
  Phone,
  QrCode,
  RefreshCcw,
  Save,
  Send,
  ShieldCheck,
  UserPen,
  UserX,
} from 'lucide-react'
import { QRCodeCanvas } from 'qrcode.react'
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EmployeeBadgeDialog } from '@/components/admin/employee-badge-dialog'
import { env } from '@/config/env'
import { ROUTES, getPublicProfileRoute } from '@/constants/routes'
import { useAuth } from '@/hooks/use-auth'
import { DashboardLayout } from '@/layouts/dashboard-layout'
import {
  useEmployeeProfileQuery,
  useInviteEmployeeAccountMutation,
  useResendInviteMutation,
} from '@/services/accountService'
import { auditService } from '@/services/auditService'
import { useDepartmentsQuery } from '@/services/departmentsService'
import {
  useDeactivateEmployeeMutation,
  useEmployeeQuery,
  useUpdateEmployeeMutation,
} from '@/services/employeesService'
import {
  notificationsService,
  useHasUnreadQrRefreshForEmployeeQuery,
} from '@/services/notificationsService'
import {
  useEmployeeCurrentTokenQuery,
  useGenerateOrRegenerateTokenMutation,
  useRevokeActiveTokenMutation,
} from '@/services/qrService'
import { useAdminRequestsQuery } from '@/services/requestsService'
import {
  useEmployeeVisibilityQuery,
  useUpsertVisibilityMutation,
} from '@/services/visibilityService'
import {
  employeeSchema,
  normalizeOptional,
  normalizePhoneNumberInput,
  type EmployeeFormValues,
} from '@/schemas/employeeSchema'
import type { EmployeeVisibilityFieldKey } from '@/types/visibility'
import { REQUEST_FIELD_LABELS } from '@/utils/modification-requests'
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

function formatOptionalValue(value: string | null | undefined): string {
  if (!value || value.trim().length === 0) {
    return 'Not set'
  }

  return value
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function requestStatusBadgeClass(status: string): string {
  if (status === 'EN_ATTENTE') {
    return 'border-transparent bg-amber-100 text-amber-800'
  }

  if (status === 'ACCEPTEE') {
    return 'border-transparent bg-emerald-100 text-emerald-800'
  }

  if (status === 'REJETEE') {
    return 'border-transparent bg-rose-100 text-rose-800'
  }

  return ''
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

type DetailTab = 'overview' | 'qr-visibility' | 'requests'

export function AdminEmployeeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const employeeId = id ?? ''

  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<DetailTab>(() =>
    location.hash === '#qr' ? 'qr-visibility' : 'overview',
  )
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [employeeToDeactivate, setEmployeeToDeactivate] = useState(false)
  const [accountEmailInput, setAccountEmailInput] = useState<string | null>(null)
  const [isMoreActionsOpen, setIsMoreActionsOpen] = useState(false)
  const editSectionRef = useRef<HTMLDivElement | null>(null)

  const employeeQuery = useEmployeeQuery(id)
  const employeeProfileQuery = useEmployeeProfileQuery(id)
  const departmentsQuery = useDepartmentsQuery()
  const visibilityQuery = useEmployeeVisibilityQuery(id)
  const employeeTokenQuery = useEmployeeCurrentTokenQuery(id)
  const employeeRequestsQuery = useAdminRequestsQuery({ employeId: id, page: 1, pageSize: 8 })
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
      setEmployeeToDeactivate(false)
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
  const publicBaseUrl = (env.VITE_PUBLIC_BASE_URL ?? window.location.origin).replace(/\/+$/, '')
  const publicProfileUrl =
    token && token.statutToken === 'ACTIF'
      ? `${publicBaseUrl}${getPublicProfileRoute(token.token)}`
      : null
  const qrCanvasId = `employee-qr-${employeeId || 'unknown'}`
  const isInviting = inviteAccountMutation.isPending || resendInviteMutation.isPending
  const needsQrRefresh = qrRefreshRequiredQuery.data ?? false

  const departmentName = useMemo(() => {
    if (!employee) {
      return 'Not set'
    }

    return (
      departmentsQuery.data?.find((department) => department.id === employee.departementId)?.nom ??
      employee.departementId
    )
  }, [departmentsQuery.data, employee])

  const visibilityMap = useMemo(() => {
    const map = new Map<string, boolean>()
    for (const row of visibilityQuery.data ?? []) {
      map.set(row.fieldKey, row.isPublic)
    }

    return map
  }, [visibilityQuery.data])

  const scrollToEditForm = () => {
    const section = editSectionRef.current
    if (!section) {
      return
    }

    const stickyHeaderOffset = 120
    const targetY = section.getBoundingClientRect().top + window.scrollY - stickyHeaderOffset
    window.scrollTo({
      top: Math.max(targetY, 0),
      behavior: 'smooth',
    })
  }

  const goToEditSection = () => {
    if (activeTab !== 'overview') {
      setActiveTab('overview')
      window.setTimeout(scrollToEditForm, 140)
      return
    }

    scrollToEditForm()
  }

  const onToggleVisibility = async (fieldKey: EmployeeVisibilityFieldKey, isPublic: boolean) => {
    try {
      await upsertVisibilityMutation.mutateAsync({
        employeId: employeeId,
        fieldKey,
        isPublic,
      })

      toast.success(`Visibility updated for ${fieldKey}.`)

      try {
        await auditService.insertAuditLog({
          action: 'VISIBILITY_UPDATED',
          targetType: 'employee_visibility',
          targetId: employeeId,
          detailsJson: {
            employe_id: employeeId,
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
      toast.error('No active public profile link available.')
      return
    }

    try {
      await copyTextToClipboard(publicProfileUrl)
      toast.success('Public link copied.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to copy link')
    }
  }

  const onOpenPublicPreview = () => {
    if (!publicProfileUrl) {
      toast.error('No active public profile link available.')
      return
    }

    window.open(publicProfileUrl, '_blank', 'noopener,noreferrer')
  }

  const onCopyEmployeeEmail = async () => {
    if (!employee?.email) {
      toast.error('Email is not set for this employee.')
      return
    }

    try {
      await copyTextToClipboard(employee.email)
      toast.success('Email copied.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to copy email')
    }
  }

  const onCopyEmployeeMatricule = async () => {
    if (!employee) {
      return
    }

    try {
      await copyTextToClipboard(employee.matricule)
      toast.success('Matricule copied.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to copy matricule')
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
    setSubmitError(null)

    await updateMutation.mutateAsync({
      id: employeeId,
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
  const currentTelephone = useWatch({ control: form.control, name: 'telephone' })
  const currentPoste = useWatch({ control: form.control, name: 'poste' })
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
      <DashboardLayout title="Employee Profile" subtitle="Invalid route parameter.">
        <Card>
          <CardContent className="space-y-3 p-6">
            <p className="text-sm text-destructive">Employee id is missing.</p>
            <Button variant="outline" onClick={() => navigate(ROUTES.ADMIN_EMPLOYEES)}>
              Back to Employees
            </Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    )
  }

  if (employeeQuery.isPending) {
    return (
      <DashboardLayout
        title="Employee Profile"
        subtitle="Loading employee details..."
      >
        <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
          <Card className="rounded-2xl">
            <CardContent className="space-y-4 p-5">
              <Skeleton className="h-20 w-20 rounded-full" />
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-48" />
            </CardContent>
          </Card>
          <Card className="rounded-2xl">
            <CardContent className="space-y-4 p-5">
              <Skeleton className="h-10 w-64" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    )
  }

  if (employeeQuery.isError) {
    return (
      <DashboardLayout
        title="Employee Profile"
        subtitle="Could not load employee details."
      >
        <Alert variant="destructive">
          <AlertTitle>Unable to load employee</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>{employeeQuery.error.message}</span>
            <Button variant="outline" size="sm" onClick={() => void employeeQuery.refetch()}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      </DashboardLayout>
    )
  }

  if (!employee) {
    return (
      <DashboardLayout
        title="Employee Profile"
        subtitle="Employee was not found."
      >
        <Card className="rounded-2xl">
          <CardContent className="space-y-3 p-6">
            <p className="text-sm text-muted-foreground">Employee not found.</p>
            <Button variant="outline" onClick={() => navigate(ROUTES.ADMIN_EMPLOYEES)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to employees
            </Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout
      title="Employee Profile"
      subtitle="Employee details, QR profile, visibility, and audit activity."
    >
      <div className="sticky top-2 z-20 mb-6 rounded-2xl border bg-white/95 p-4 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="space-y-2">
            <Button
              type="button"
              variant="ghost"
              className="px-0 text-muted-foreground"
              onClick={() => navigate(ROUTES.ADMIN_EMPLOYEES)}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to employees
            </Button>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Employee Profile</h1>
            <p className="text-sm text-muted-foreground">
              Employee details, QR profile, visibility, and audit activity.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              className="bg-gradient-to-br from-[#ff6b35] to-[#ffc947] text-white shadow-sm transition-all hover:brightness-95 hover:shadow-md"
              onClick={goToEditSection}
            >
              <UserPen className="mr-2 h-4 w-4" />
              Edit Employee
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isInactive || generateTokenMutation.isPending}
              onClick={() => {
                setActiveTab('qr-visibility')
                void onGenerateOrRegenerateToken()
              }}
            >
              {generateTokenMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCcw className="mr-2 h-4 w-4" />
              )}
              Regenerate QR
            </Button>
            <EmployeeBadgeDialog
              employee={{
                matricule: employee.matricule,
                nom: employee.nom,
                prenom: employee.prenom,
                poste: employee.poste,
                photoUrl: employee.photoUrl,
              }}
              departmentName={departmentName}
              publicProfileUrl={publicProfileUrl}
              isTokenLoading={employeeTokenQuery.isPending}
              tokenError={employeeTokenQuery.isError ? employeeTokenQuery.error.message : null}
              isGeneratingQr={generateTokenMutation.isPending}
              onGenerateQr={() => {
                setActiveTab('qr-visibility')
                void onGenerateOrRegenerateToken()
              }}
            />

            <Dialog open={isMoreActionsOpen} onOpenChange={setIsMoreActionsOpen}>
              <DialogTrigger asChild>
                <Button type="button" variant="outline" size="icon" aria-label="More actions">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                  <DialogTitle>More actions</DialogTitle>
                  <DialogDescription>
                    Quick actions for this employee profile.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => {
                      void onCopyEmployeeEmail()
                      setIsMoreActionsOpen(false)
                    }}
                  >
                    <Mail className="mr-2 h-4 w-4" />
                    Copy email
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => {
                      void onCopyEmployeeMatricule()
                      setIsMoreActionsOpen(false)
                    }}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copy matricule
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start"
                    disabled={!publicProfileUrl}
                    onClick={() => {
                      onOpenPublicPreview()
                      setIsMoreActionsOpen(false)
                    }}
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    View public profile
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    className="w-full justify-start"
                    disabled={!employee.isActive}
                    onClick={() => {
                      setEmployeeToDeactivate(true)
                      setIsMoreActionsOpen(false)
                    }}
                  >
                    <UserX className="mr-2 h-4 w-4" />
                    Deactivate employee
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card className="overflow-hidden rounded-2xl border border-slate-200/80 shadow-sm">
            <div className="h-1.5 w-full bg-gradient-to-br from-[#ff6b35] to-[#ffc947]" />
            <CardContent className="space-y-4 p-5">
              <div className="flex flex-col items-center gap-3 text-center">
                {currentPhotoUrl && currentPhotoUrl.trim().length > 0 ? (
                  <img
                    src={currentPhotoUrl}
                    alt={`${currentPrenom || employee.prenom} ${currentNom || employee.nom}`}
                    className="h-24 w-24 rounded-full border object-cover"
                  />
                ) : (
                  <div className="flex h-24 w-24 items-center justify-center rounded-full border bg-slate-100 text-2xl font-semibold text-slate-600">
                    {getInitials(currentPrenom || employee.prenom, currentNom || employee.nom)}
                  </div>
                )}

                <div>
                  <p className="text-lg font-semibold text-slate-900">
                    {currentPrenom || employee.prenom} {currentNom || employee.nom}
                  </p>
                  <Badge
                    variant={employee.isActive ? 'secondary' : 'outline'}
                    className={employee.isActive ? 'bg-emerald-100 text-emerald-800' : 'text-slate-500'}
                  >
                    {employee.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <InfoLine label="Matricule" value={employee.matricule} mono />
                <InfoLine label="Department" value={departmentName} />
                <InfoLine label="Poste" value={formatOptionalValue(currentPoste || employee.poste)} />
              </div>

              <Separator />

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  <span className="truncate">{formatOptionalValue(currentEmail || employee.email)}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-4 w-4" />
                  <span className="truncate">{formatOptionalValue(currentTelephone || employee.telephone)}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => void onCopyEmployeeEmail()}>
                  <Copy className="mr-1 h-4 w-4" />
                  Copy Email
                </Button>
                <Button size="sm" variant="outline" onClick={() => void onCopyEmployeeMatricule()}>
                  <Copy className="mr-1 h-4 w-4" />
                  Copy Matricule
                </Button>
              </div>
            </CardContent>
          </Card>

          {needsQrRefresh ? (
            <Alert>
              <AlertTitle className="text-amber-800">Needs QR refresh</AlertTitle>
              <AlertDescription className="text-amber-700">
                Employee info changed. Regenerate QR to keep the public profile in sync.
              </AlertDescription>
            </Alert>
          ) : null}
        </div>

        <div>
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as DetailTab)}>
            <TabsList className="w-full justify-start gap-1 overflow-x-auto">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="qr-visibility">QR & Visibility</TabsTrigger>
              <TabsTrigger value="requests">Requests</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              {isInactive ? (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                  This employee is inactive. Reactivate is not supported yet.
                </div>
              ) : null}

              <Card
                id="employee-info-section"
                ref={editSectionRef}
                className="scroll-mt-32 rounded-2xl border border-slate-200/80 shadow-sm"
              >
                <CardHeader>
                  <CardTitle>Overview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 text-sm sm:grid-cols-2">
                    <InfoGrid label="Nom" value={employee.nom} />
                    <InfoGrid label="Prenom" value={employee.prenom} />
                    <InfoGrid label="Matricule" value={employee.matricule} mono />
                    <InfoGrid label="Poste" value={formatOptionalValue(employee.poste)} />
                    <InfoGrid label="Department" value={departmentName} />
                    <InfoGrid label="Email" value={formatOptionalValue(employee.email)} />
                    <InfoGrid label="Telephone" value={formatOptionalValue(employee.telephone)} />
                    <InfoGrid label="Created at" value={formatDateTime(employee.createdAt)} />
                    <InfoGrid label="Updated at" value={formatDateTime(employee.updatedAt)} />
                    <InfoGrid label="Account role" value={employeeProfile?.role ?? 'Not linked'} />
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border border-slate-200/80 shadow-sm">
                <CardHeader>
                  <CardTitle>Employee Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <form className="space-y-4" onSubmit={onSubmit}>
                    {submitError ? (
                      <Alert variant="destructive">
                        <AlertTitle>Update failed</AlertTitle>
                        <AlertDescription>{submitError}</AlertDescription>
                      </Alert>
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

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="submit"
                        disabled={isFormDisabled || !form.formState.isValid}
                        className="bg-gradient-to-br from-[#ff6b35] to-[#ffc947] text-white hover:brightness-95"
                      >
                        {updateMutation.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="mr-2 h-4 w-4" />
                        )}
                        {updateMutation.isPending ? 'Saving...' : 'Save changes'}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border border-slate-200/80 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Account Access
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
                    <Alert variant="destructive">
                      <AlertTitle>Account data unavailable</AlertTitle>
                      <AlertDescription className="space-y-2">
                        <p>{employeeProfileQuery.error.message}</p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void employeeProfileQuery.refetch()}
                        >
                          Retry
                        </Button>
                      </AlertDescription>
                    </Alert>
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
                          {isInviting ? 'Sending...' : 'Resend invite'}
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
                          {isInviting ? 'Sending...' : 'Send invite'}
                        </Button>
                      )}
                    </>
                  ) : null}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="qr-visibility" className="space-y-4">
              <div id="qr" className="grid gap-4 xl:grid-cols-2">
                <Card className="rounded-2xl border border-slate-200/80 shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <QrCode className="h-4 w-4" />
                      QR Token
                      {needsQrRefresh ? (
                        <Badge className="border-transparent bg-red-600 text-white">Needs refresh</Badge>
                      ) : null}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {employeeTokenQuery.isPending ? (
                      <>
                        <Skeleton className="h-8 w-full" />
                        <Skeleton className="h-8 w-full" />
                      </>
                    ) : null}

                    {employeeTokenQuery.isError ? (
                      <Alert variant="destructive">
                        <AlertTitle>Could not load QR token</AlertTitle>
                        <AlertDescription className="space-y-2">
                          <p>{employeeTokenQuery.error.message}</p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void employeeTokenQuery.refetch()}
                          >
                            Retry
                          </Button>
                        </AlertDescription>
                      </Alert>
                    ) : null}
                    {!employeeTokenQuery.isPending && !employeeTokenQuery.isError ? (
                      <>
                        {token ? (
                          <div className="space-y-2 rounded-xl border p-3 text-sm">
                            <p className="break-all">
                              <span className="font-medium">Token:</span> {token.token}
                            </p>
                            <p>
                              <span className="font-medium">Status:</span>{' '}
                              <Badge
                                className={
                                  token.statutToken === 'ACTIF'
                                    ? 'border-transparent bg-emerald-100 text-emerald-800'
                                    : 'border-transparent bg-slate-100 text-slate-700'
                                }
                              >
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

                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            disabled={
                              isInactive ||
                              generateTokenMutation.isPending ||
                              revokeTokenMutation.isPending
                            }
                            className="bg-gradient-to-br from-[#ff6b35] to-[#ffc947] text-white hover:brightness-95"
                            onClick={() => void onGenerateOrRegenerateToken()}
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
                            <div className="rounded-xl border p-3">
                              <p className="mb-1 text-xs text-muted-foreground">Public profile URL</p>
                              <p className="break-all text-sm">{publicProfileUrl}</p>
                            </div>

                            <div className="flex items-center justify-center rounded-xl border p-4">
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
                                Copy link
                              </Button>
                              <Button type="button" variant="outline" onClick={onDownloadQr}>
                                <Download className="mr-2 h-4 w-4" />
                                Download QR
                              </Button>
                              <Button type="button" variant="outline" onClick={onOpenPublicPreview}>
                                <ExternalLink className="mr-2 h-4 w-4" />
                                View public profile
                              </Button>
                            </div>
                          </>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            Generate an active token to enable public profile preview.
                          </p>
                        )}
                      </>
                    ) : null}
                  </CardContent>
                </Card>

                <Card className="rounded-2xl border border-slate-200/80 shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4" />
                      Public Visibility
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
                      <Alert variant="destructive">
                        <AlertTitle>Visibility unavailable</AlertTitle>
                        <AlertDescription className="space-y-2">
                          <p>{visibilityQuery.error.message}</p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void visibilityQuery.refetch()}
                          >
                            Retry
                          </Button>
                        </AlertDescription>
                      </Alert>
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
                          Only enabled fields appear in the public QR profile.
                        </p>
                      </>
                    ) : null}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="requests" className="space-y-4">
              <Card className="rounded-2xl border border-slate-200/80 shadow-sm">
                <CardHeader>
                  <CardTitle>Modification Requests</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {employeeRequestsQuery.isPending ? (
                    <>
                      <Skeleton className="h-16 w-full" />
                      <Skeleton className="h-16 w-full" />
                    </>
                  ) : null}

                  {employeeRequestsQuery.isError ? (
                    <Alert variant="destructive">
                      <AlertTitle>Could not load requests</AlertTitle>
                      <AlertDescription className="space-y-2">
                        <p>{employeeRequestsQuery.error.message}</p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void employeeRequestsQuery.refetch()}
                        >
                          Retry
                        </Button>
                      </AlertDescription>
                    </Alert>
                  ) : null}

                  {!employeeRequestsQuery.isPending && !employeeRequestsQuery.isError ? (
                    employeeRequestsQuery.data && employeeRequestsQuery.data.items.length > 0 ? (
                      <div className="space-y-2">
                        {employeeRequestsQuery.data.items.map((request) => (
                          <div key={request.id} className="rounded-xl border p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <p className="text-sm font-medium">
                                  {REQUEST_FIELD_LABELS[request.champCible]}: {formatOptionalValue(request.ancienneValeur)} ? {formatOptionalValue(request.nouvelleValeur)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {new Date(request.createdAt).toLocaleString()}
                                </p>
                              </div>
                              <Badge className={requestStatusBadgeClass(request.statutDemande)}>
                                {request.statutDemande}
                              </Badge>
                            </div>
                            {request.commentaireTraitement ? (
                              <p className="mt-2 text-xs text-muted-foreground">
                                Admin comment: {request.commentaireTraitement}
                              </p>
                            ) : null}
                          </div>
                        ))}
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => navigate(ROUTES.ADMIN_REQUESTS)}
                        >
                          Open requests center
                        </Button>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                        No modification requests.
                      </div>
                    )
                  ) : null}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <AlertDialog open={employeeToDeactivate} onOpenChange={setEmployeeToDeactivate}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate employee</AlertDialogTitle>
            <AlertDialogDescription>
              Deactivate {employee.prenom} {employee.nom}? Their active QR token will be revoked.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deactivateMutation.isPending}>Cancel</AlertDialogCancel>
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

interface InfoGridProps {
  label: string
  value: string
  mono?: boolean
}

function InfoGrid({ label, value, mono = false }: InfoGridProps) {
  return (
    <div className="rounded-lg border bg-slate-50/50 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-sm text-slate-900 ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  )
}

interface InfoLineProps {
  label: string
  value: string
  mono?: boolean
}

function InfoLine({ label, value, mono = false }: InfoLineProps) {
  return (
    <p className="flex items-center justify-between gap-2 rounded-md border bg-slate-50/50 px-3 py-2">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className={mono ? 'font-mono text-xs text-slate-800' : 'text-sm text-slate-800'}>{value}</span>
    </p>
  )
}
