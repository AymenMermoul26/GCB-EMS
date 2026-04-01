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
  Send,
  ShieldCheck,
  UserCheck,
  UserPen,
  UserX,
} from 'lucide-react'
import { QRCodeCanvas } from 'qrcode.react'
import { useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import {
  BRAND_BUTTON_CLASS_NAME,
  PageHeader,
} from '@/components/common/page-header'
import { EmptyState, ErrorState } from '@/components/common/page-state'
import { StatusBadge } from '@/components/common/status-badge'
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
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EmployeeBadgeDialog } from '@/components/admin/employee-badge-dialog'
import { EmployeeInformationSheetDialog } from '@/components/admin/employee-information-sheet-dialog'
import { env } from '@/config/env'
import {
  ROUTES,
  getAdminEmployeeEditRoute,
  getPublicProfileRoute,
} from '@/constants/routes'
import { useAuth } from '@/hooks/use-auth'
import { DashboardLayout } from '@/layouts/dashboard-layout'
import { cn } from '@/lib/utils'
import {
  useEmployeeProfileQuery,
  useInviteEmployeeAccountMutation,
  useResendInviteMutation,
} from '@/services/accountService'
import { auditService } from '@/services/auditService'
import { useDepartmentsQuery } from '@/services/departmentsService'
import {
  useActivateEmployeeMutation,
  useAdminEmployeeQuery,
  useDeactivateEmployeeMutation,
} from '@/services/employeesService'
import {
  notificationsService,
  useHasUnreadQrRefreshForEmployeeQuery,
} from '@/services/notificationsService'
import { notifyPayrollUsersOfEmployeeStatusChange } from '@/services/payrollNotificationsService'
import {
  useEmployeeCurrentTokenQuery,
  useGenerateOrRegenerateTokenMutation,
  useRevokeActiveTokenMutation,
} from '@/services/qrService'
import { useAdminRequestsQuery } from '@/services/requestsService'
import {
  useAdminPublicProfileVisibilityRequestsQuery,
  useEmployeeVisibilityQuery,
} from '@/services/visibilityService'
import {
  EMPLOYEE_VISIBILITY_FIELD_LABELS,
  getPublicProfileVisibilityRequestStatusMeta,
  type AdminPublicProfileVisibilityRequestItem,
  type EmployeeVisibilityFieldKey,
} from '@/types/visibility'
import {
  getEmployeeCategorieProfessionnelleLabel,
  getEmployeeDiplomeLabel,
  getEmployeeNationaliteLabel,
  getEmployeePosteLabel,
  getEmployeeRegionalBranchLabel,
  getEmployeeSituationFamilialeLabel,
  getEmployeeSexeLabel,
  getEmployeeSpecialiteLabel,
  getEmployeeTypeContratLabel,
  getEmployeeUniversiteLabel,
  sanitizeEmployeeTextValue,
} from '@/types/employee'
import { getDepartmentDisplayName } from '@/types/department'
import { PUBLIC_QR_VISIBILITY_FIELDS } from '@/types/employee-governance'
import { REQUEST_FIELD_LABELS } from '@/utils/modification-requests'
import { copyTextToClipboard } from '@/utils/clipboard'
import { downloadCanvasAsPng } from '@/utils/qr'

function getInitials(prenom: string, nom: string) {
  const initials = `${prenom.trim().charAt(0)}${nom.trim().charAt(0)}`.toUpperCase()
  return initials || 'NA'
}


function formatDateTime(value: string | null): string {
  if (!value) {
    return 'No expiration'
  }

  return new Date(value).toLocaleString()
}

function formatVisibilityFieldList(fieldKeys: string[]): string {
  if (fieldKeys.length === 0) {
    return 'No public fields selected'
  }

  return fieldKeys
    .map((fieldKey) => EMPLOYEE_VISIBILITY_FIELD_LABELS[fieldKey as EmployeeVisibilityFieldKey] ?? fieldKey)
    .join(', ')
}

function findOpenVisibilityRequest(
  requests: AdminPublicProfileVisibilityRequestItem[],
): AdminPublicProfileVisibilityRequestItem | null {
  return (
    requests.find((request) => request.status === 'PENDING' || request.status === 'IN_REVIEW') ?? null
  )
}

function formatOptionalValue(value: string | null | undefined): string {
  return sanitizeEmployeeTextValue(value) ?? 'Not provided'
}

function formatEmploymentValue(value: string | null | undefined): string {
  return sanitizeEmployeeTextValue(value) ?? 'Not provided'
}

function formatEmploymentDate(value: string | null | undefined): string {
  if (!value) {
    return 'Not provided'
  }

  return new Date(`${value}T00:00:00`).toLocaleDateString()
}

function formatCivilValue(value: string | null | undefined): string {
  return sanitizeEmployeeTextValue(value) ?? 'Not provided'
}

function formatCivilDate(value: string | null | undefined): string {
  if (!value) {
    return 'Not provided'
  }

  return new Date(`${value}T00:00:00`).toLocaleDateString()
}

function formatAdministrativeNumber(value: number | null | undefined): string {
  return value === null || value === undefined ? 'Not provided' : String(value)
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function getInviteSuccessMessage(params: {
  email: string
  resend: boolean
  deliveryType?: 'invite' | 'magiclink'
}): string {
  const actionLabel = params.resend ? 'resent' : 'sent'

  if (params.deliveryType === 'magiclink') {
    return `Access email ${actionLabel} to ${params.email}.`
  }

  return `Invitation ${actionLabel} to ${params.email}.`
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


type DetailTab = 'overview' | 'qr-visibility' | 'requests'

function getInitialTab(hash: string): DetailTab {
  if (hash === '#qr') {
    return 'qr-visibility'
  }

  return 'overview'
}

export function AdminEmployeeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const employeeId = id ?? ''

  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<DetailTab>(() => getInitialTab(location.hash))
  const [employeeStatusAction, setEmployeeStatusAction] = useState<'activate' | 'deactivate' | null>(null)
  const [accountEmailInput, setAccountEmailInput] = useState<string | null>(null)
  const [isMoreActionsOpen, setIsMoreActionsOpen] = useState(false)

  const employeeQuery = useAdminEmployeeQuery(id)
  const employeeProfileQuery = useEmployeeProfileQuery(id)
  const departmentsQuery = useDepartmentsQuery()
  const visibilityQuery = useEmployeeVisibilityQuery(id)
  const visibilityRequestsQuery = useAdminPublicProfileVisibilityRequestsQuery({ employeId: id })
  const employeeTokenQuery = useEmployeeCurrentTokenQuery(id)
  const employeeRequestsQuery = useAdminRequestsQuery({ employeId: id, page: 1, pageSize: 8 })
  const qrRefreshRequiredQuery = useHasUnreadQrRefreshForEmployeeQuery(id, user?.id)

  const activateMutation = useActivateEmployeeMutation({
    onSuccess: async (employee) => {
      toast.success('Employee activated.')
      setEmployeeStatusAction(null)
      queryClient.setQueryData(['employee', employee.id], employee)
      await queryClient.invalidateQueries({ queryKey: ['employees'] })
      try {
        await auditService.insertAuditLog({
          action: 'EMPLOYEE_ACTIVATED',
          targetType: 'Employe',
          targetId: employee.id,
          detailsJson: {
            employe_id: employee.id,
            matricule: employee.matricule,
            is_active: true,
          },
        })
      } catch (auditError) {
        console.error('Failed to write employee activation audit log', auditError)
      }
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const deactivateMutation = useDeactivateEmployeeMutation({
    onSuccess: async (employee) => {
      toast.success('Employee deactivated.')
      setEmployeeStatusAction(null)
      queryClient.setQueryData(['employee', employee.id], employee)
      await queryClient.invalidateQueries({ queryKey: ['employees'] })
      await queryClient.invalidateQueries({ queryKey: ['employeeToken', employee.id] })
      try {
        await auditService.insertAuditLog({
          action: 'EMPLOYEE_DEACTIVATED',
          targetType: 'Employe',
          targetId: employee.id,
          detailsJson: {
            employe_id: employee.id,
            matricule: employee.matricule,
            is_active: false,
          },
        })
      } catch (auditError) {
        console.error('Failed to write employee deactivation audit log', auditError)
      }
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const generateTokenMutation = useGenerateOrRegenerateTokenMutation()
  const revokeTokenMutation = useRevokeActiveTokenMutation()
  const inviteAccountMutation = useInviteEmployeeAccountMutation({
    onSuccess: (result) => {
      if (result.email_sent) {
        toast.success(
          getInviteSuccessMessage({
            email: result.email,
            resend: false,
            deliveryType: result.email_delivery_type,
          }),
        )
      } else {
        toast.info(`Account is linked for ${result.email}, but no invitation email was sent.`)
      }
      setAccountEmailInput(result.email)
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })
  const resendInviteMutation = useResendInviteMutation({
    onSuccess: (result) => {
      if (result.email_sent) {
        toast.success(
          getInviteSuccessMessage({
            email: result.email,
            resend: true,
            deliveryType: result.email_delivery_type,
          }),
        )
      } else {
        toast.info(`Account is linked for ${result.email}, but no new email was sent.`)
      }
      setAccountEmailInput(result.email)
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const employee = employeeQuery.data
  const isInactive = Boolean(employee && !employee.isActive)
  const isStatusMutationPending = activateMutation.isPending || deactivateMutation.isPending
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
      return 'Not provided'
    }

    return (
      getDepartmentDisplayName(
        departmentsQuery.data?.find((department) => department.id === employee.departementId)?.nom,
      ) ?? employee.departementId
    )
  }, [departmentsQuery.data, employee])

  const visibilityMap = useMemo(() => {
    const map = new Map<string, boolean>()
    for (const row of visibilityQuery.data ?? []) {
      map.set(row.fieldKey, row.isPublic)
    }

    return map
  }, [visibilityQuery.data])
  const latestVisibilityRequest = useMemo(
    () => visibilityRequestsQuery.data?.[0] ?? null,
    [visibilityRequestsQuery.data],
  )
  const openVisibilityRequest = useMemo(
    () => findOpenVisibilityRequest(visibilityRequestsQuery.data ?? []),
    [visibilityRequestsQuery.data],
  )

  const onConfirmEmployeeStatusChange = async () => {
    if (!employee) {
      return
    }

    const previousEmployee = employee

    if (employee.isActive) {
      const deactivatedEmployee = await deactivateMutation.mutateAsync(employee.id)

      void notifyPayrollUsersOfEmployeeStatusChange(previousEmployee, deactivatedEmployee).catch(
        (error) => {
        console.error('Failed to notify payroll users about employee deactivation', error)
        },
      )

      return
    }

    const activatedEmployee = await activateMutation.mutateAsync(employee.id)

    void notifyPayrollUsersOfEmployeeStatusChange(previousEmployee, activatedEmployee).catch(
      (error) => {
      console.error('Failed to notify payroll users about employee activation', error)
      },
    )
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
      await generateTokenMutation.mutateAsync(employee.id)
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
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not generate QR token')
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
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not revoke QR token')
    }
  }
  const onCopyPublicLink = async () => {
    if (!publicProfileUrl) {
      toast.error('No active public profile link is available.')
      return
    }

    try {
      await copyTextToClipboard(publicProfileUrl)
      toast.success('Public link copied.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not copy link')
    }
  }

  const onOpenPublicPreview = () => {
    if (!publicProfileUrl) {
      toast.error('No active public profile link is available.')
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
      toast.error(error instanceof Error ? error.message : 'Could not copy email')
    }
  }

  const onCopyEmployeeMatricule = async () => {
    if (!employee) {
      return
    }

    try {
      await copyTextToClipboard(employee.matricule)
      toast.success('Employee ID copied.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not copy employee ID')
    }
  }

  const onDownloadQr = () => {
    if (!employee || !publicProfileUrl) {
      return
    }

    try {
      downloadCanvasAsPng(qrCanvasId, `ems_public_qr_${employee.matricule}.png`)
      toast.success('QR downloaded.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not download QR')
    }
  }

  const onSendInvite = async () => {
    if (!employee) {
      return
    }

    const normalizedEmail = effectiveInviteEmail

    if (!isValidEmail(normalizedEmail)) {
      toast.error('Please enter a valid email address before sending an invitation.')
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
      toast.error('Please enter a valid email address before resending the invitation.')
      return
    }

    await resendInviteMutation.mutateAsync({
      employeId: employee.id,
      email: normalizedEmail,
    })
  }

  const accountEmailSource = accountEmailInput ?? employee?.email ?? ''
  const normalizedAccountEmail = accountEmailSource.trim().toLowerCase()
  const fallbackProfileEmail = employee?.email?.trim().toLowerCase() ?? ''
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
              Back to employees
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
        <ErrorState
          title="Could not load employee"
          description="We couldn't load this employee profile right now."
          message={employeeQuery.error.message}
          onRetry={() => void employeeQuery.refetch()}
        />
      </DashboardLayout>
    )
  }

  if (!employee) {
    return (
      <DashboardLayout
        title="Employee Profile"
        subtitle="Employee not found."
      >
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
      title="Employee Profile"
      subtitle="Employee details, QR profile, visibility, and audit activity."
    >
      <PageHeader
        title="Employee Profile"
        description="Employee details, QR profile, visibility, and audit activity."
        className="sticky top-2 z-20 mb-6"
        backAction={
          <Button
            type="button"
            variant="ghost"
            className="px-0 text-muted-foreground"
            onClick={() => navigate(ROUTES.ADMIN_EMPLOYEES)}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to employees
          </Button>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {employee.isActive ? (
              <Button
                type="button"
                className={BRAND_BUTTON_CLASS_NAME}
                onClick={() => navigate(getAdminEmployeeEditRoute(employee.id))}
              >
                <UserPen className="mr-2 h-4 w-4" />
                Edit Employee
              </Button>
            ) : (
              <Button
                type="button"
                className={BRAND_BUTTON_CLASS_NAME}
                disabled={isStatusMutationPending}
                onClick={() => setEmployeeStatusAction('activate')}
              >
                {activateMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <UserCheck className="mr-2 h-4 w-4" />
                )}
                {activateMutation.isPending ? 'Activating...' : "Activate Employee"}
              </Button>
            )}
            {employee.isActive ? (
              <Button
                type="button"
                variant="outline"
                className="border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive"
                disabled={isStatusMutationPending}
                onClick={() => setEmployeeStatusAction('deactivate')}
              >
                <UserX className="mr-2 h-4 w-4" />
                Deactivate Employee
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              disabled={isInactive || generateTokenMutation.isPending || isStatusMutationPending}
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
                regionalBranch: employee.regionalBranch,
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
            <EmployeeInformationSheetDialog
              employee={{
                id: employee.id,
                matricule: employee.matricule,
                nom: employee.nom,
                prenom: employee.prenom,
                sexe: employee.sexe,
                dateNaissance: employee.dateNaissance,
                lieuNaissance: employee.lieuNaissance,
                nationalite: employee.nationalite,
                situationFamiliale: employee.situationFamiliale,
                nombreEnfants: employee.nombreEnfants,
                adresse: employee.adresse,
                poste: employee.poste,
                regionalBranch: employee.regionalBranch,
                categorieProfessionnelle: employee.categorieProfessionnelle,
                typeContrat: employee.typeContrat,
                dateRecrutement: employee.dateRecrutement,
                email: employee.email,
                telephone: employee.telephone,
                photoUrl: employee.photoUrl,
                isActive: employee.isActive,
              }}
              departmentName={departmentName}
              isLoading={employeeQuery.isPending}
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
                    Copy Email
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
                    Copy Employee ID
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
                    Open Public Profile
                  </Button>
                  <Button
                    type="button"
                    variant={employee.isActive ? 'destructive' : 'outline'}
                    className={cn(
                      'w-full justify-start',
                      !employee.isActive &&
                        'border-transparent bg-gradient-to-br from-[#ff6b35] to-[#ffc947] text-white hover:brightness-95',
                    )}
                    disabled={isStatusMutationPending}
                    onClick={() => {
                      setEmployeeStatusAction(employee.isActive ? 'deactivate' : 'activate')
                      setIsMoreActionsOpen(false)
                    }}
                  >
                    {employee.isActive ? (
                      <UserX className="mr-2 h-4 w-4" />
                    ) : (
                      <UserCheck className="mr-2 h-4 w-4" />
                    )}
                    {employee.isActive ? "Deactivate Employee" : "Activate Employee"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        }
      />
      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card
            className={cn(
              'overflow-hidden rounded-2xl border shadow-sm',
              employee.isActive
                ? 'border-slate-200/80'
                : 'border-slate-300/90 bg-slate-100/80',
            )}
          >
            <div
              className={cn(
                'h-1.5 w-full',
                employee.isActive
                  ? 'bg-gradient-to-br from-[#ff6b35] to-[#ffc947]'
                  : 'bg-slate-300',
              )}
            />
            <CardContent className="space-y-4 p-5">
              <div className="flex flex-col items-center gap-3 text-center">
                {employee.photoUrl && employee.photoUrl.trim().length > 0 ? (
                  <img
                    src={employee.photoUrl}
                    alt={`${employee.prenom} ${employee.nom}`}
                    className={cn(
                      'h-24 w-24 rounded-full border object-cover',
                      isInactive && 'grayscale',
                    )}
                  />
                ) : (
                  <div
                    className={cn(
                      'flex h-24 w-24 items-center justify-center rounded-full border text-2xl font-semibold',
                      isInactive
                        ? 'bg-slate-200 text-slate-500'
                        : 'bg-slate-100 text-slate-600',
                    )}
                  >
                    {getInitials(employee.prenom, employee.nom)}
                  </div>
                )}

                <div>
                  <p
                    className={cn(
                      'text-lg font-semibold',
                      employee.isActive ? 'text-slate-900' : 'text-slate-700',
                    )}
                  >
                    {employee.prenom} {employee.nom}
                  </p>
                  <StatusBadge tone={employee.isActive ? 'success' : 'neutral'}>
                    {employee.isActive ? 'Active' : 'Inactive'}
                  </StatusBadge>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <InfoLine label="Employee ID" value={employee.matricule} mono />
                <InfoLine label="Department" value={departmentName} />
                <InfoLine
                  label="Regional Branch"
                  value={formatEmploymentValue(
                    getEmployeeRegionalBranchLabel(employee.regionalBranch),
                  )}
                />
                <InfoLine
                  label="Job Title"
                  value={formatOptionalValue(getEmployeePosteLabel(employee.poste))}
                />
                <InfoLine label="Sex" value={formatCivilValue(getEmployeeSexeLabel(employee.sexe))} />
                <InfoLine label="Birth Date" value={formatCivilDate(employee.dateNaissance)} />
                <InfoLine
                  label="Nationality"
                  value={formatCivilValue(getEmployeeNationaliteLabel(employee.nationalite))}
                />
                <InfoLine
                  label="Category"
                  value={formatEmploymentValue(
                    getEmployeeCategorieProfessionnelleLabel(employee.categorieProfessionnelle),
                  )}
                />
                <InfoLine
                  label="Contract"
                  value={formatEmploymentValue(
                    getEmployeeTypeContratLabel(employee.typeContrat),
                  )}
                />
                <InfoLine
                  label="Hire Date"
                  value={formatEmploymentDate(employee.dateRecrutement)}
                />
              </div>

              <Separator />

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  <span className="truncate">{formatOptionalValue(employee.email)}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-4 w-4" />
                  <span className="truncate">{formatOptionalValue(employee.telephone)}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => void onCopyEmployeeEmail()}>
                  <Copy className="mr-1 h-4 w-4" />
                  Copy Email
                </Button>
                <Button size="sm" variant="outline" onClick={() => void onCopyEmployeeMatricule()}>
                  <Copy className="mr-1 h-4 w-4" />
                  Copy Employee ID
                </Button>
                <Button
                  size="sm"
                  variant={employee.isActive ? 'destructive' : 'outline'}
                  className={
                    employee.isActive
                      ? undefined
                      : 'border-transparent bg-gradient-to-br from-[#ff6b35] to-[#ffc947] text-white hover:brightness-95'
                  }
                  disabled={isStatusMutationPending}
                  onClick={() => setEmployeeStatusAction(employee.isActive ? 'deactivate' : 'activate')}
                >
                  {employee.isActive ? (
                    <UserX className="mr-1 h-4 w-4" />
                  ) : (
                    <UserCheck className="mr-1 h-4 w-4" />
                  )}
                  {employee.isActive ? 'Deactivate' : 'Activate'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {needsQrRefresh ? (
            <Alert>
              <AlertTitle className="text-amber-800">QR refresh needed</AlertTitle>
              <AlertDescription className="text-amber-700">
                Employee information changed. Regenerate the QR to keep the public profile in sync.
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
                <div className="rounded-xl border border-slate-300 bg-slate-100/90 p-3 text-sm text-slate-700">
                  This employee is currently inactive. Reactivate the profile to make it available in the system again.
                </div>
              ) : null}

              <Card
                id="employee-info-section"
                className="scroll-mt-32 rounded-2xl border border-slate-200/80 shadow-sm"
              >
                <CardHeader>
                  <CardTitle>Overview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 text-sm sm:grid-cols-2">
                    <InfoGrid label="Last Name" value={employee.nom} />
                    <InfoGrid label="First Name" value={employee.prenom} />
                    <InfoGrid
                      label="Sex"
                      value={formatCivilValue(getEmployeeSexeLabel(employee.sexe))}
                    />
                    <InfoGrid
                      label="Birth Date"
                      value={formatCivilDate(employee.dateNaissance)}
                    />
                    <InfoGrid
                      label="Birth Place"
                      value={formatCivilValue(employee.lieuNaissance)}
                    />
                    <InfoGrid
                      label="Nationality"
                      value={formatCivilValue(getEmployeeNationaliteLabel(employee.nationalite))}
                    />
                    <InfoGrid label="Employee ID" value={employee.matricule} mono />
                    <InfoGrid
                      label="Job Title"
                      value={formatOptionalValue(getEmployeePosteLabel(employee.poste))}
                    />
                    <InfoGrid label="Department" value={departmentName} />
                    <InfoGrid
                      label="Regional Branch"
                      value={formatEmploymentValue(
                        getEmployeeRegionalBranchLabel(employee.regionalBranch),
                      )}
                    />
                    <InfoGrid
                      label="Professional Category"
                      value={formatEmploymentValue(
                        getEmployeeCategorieProfessionnelleLabel(employee.categorieProfessionnelle),
                      )}
                    />
                    <InfoGrid
                      label="Contract Type"
                      value={formatEmploymentValue(
                        getEmployeeTypeContratLabel(employee.typeContrat),
                      )}
                    />
                    <InfoGrid
                      label="Hire Date"
                      value={formatEmploymentDate(employee.dateRecrutement)}
                    />
                    <InfoGrid label="Email" value={formatOptionalValue(employee.email)} />
                    <InfoGrid label="Phone" value={formatOptionalValue(employee.telephone)} />
                    <InfoGrid label="Created At" value={formatDateTime(employee.createdAt)} />
                    <InfoGrid label="Updated At" value={formatDateTime(employee.updatedAt)} />
                    <InfoGrid label="Account Role" value={employeeProfile?.role ?? 'Not linked'} />
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border border-amber-200/80 shadow-sm">
                <CardHeader>
                  <CardTitle>Administrative Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    Sensitive HR and payroll-related data. Keep these details visible only to authorized administrators.
                  </div>

                  <div className="grid gap-3 text-sm sm:grid-cols-2">
                    <InfoGrid
                      label="Marital Status"
                      value={formatCivilValue(
                        getEmployeeSituationFamilialeLabel(employee.situationFamiliale),
                      )}
                    />
                    <InfoGrid
                      label="Number of Children"
                      value={formatAdministrativeNumber(employee.nombreEnfants)}
                    />
                    <InfoGrid label="Address" value={formatCivilValue(employee.adresse)} />
                    <InfoGrid
                      label="Social Security Number"
                      value={formatCivilValue(employee.numeroSecuriteSociale)}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border border-slate-200/80 shadow-sm">
                <CardHeader>
                  <CardTitle>Education & Career Background</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 text-sm sm:grid-cols-3">
                    <InfoGrid
                      label="Degree"
                      value={formatCivilValue(getEmployeeDiplomeLabel(employee.diplome))}
                    />
                    <InfoGrid
                      label="Specialization"
                      value={formatCivilValue(getEmployeeSpecialiteLabel(employee.specialite))}
                    />
                    <InfoGrid
                      label="University"
                      value={formatCivilValue(getEmployeeUniversiteLabel(employee.universite))}
                    />
                  </div>

                  <div className="rounded-lg border bg-slate-50/50 p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Career History
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-900">
                      {formatCivilValue(employee.historiquePostes)}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border border-amber-200/80 shadow-sm">
                <CardHeader>
                  <CardTitle>Internal Notes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    Notes reserved for HR/admin. This content is not shown to employees or in public profile flows.
                  </div>

                  <div className="rounded-lg border bg-slate-50/50 p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Observations
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-900">
                      {formatCivilValue(employee.observations)}
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card className="rounded-2xl border border-slate-200/80 shadow-sm">
                <CardHeader className="space-y-2">
                  <CardTitle>Edit Employee</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm text-slate-700">
                    Edit this employee from the dedicated update page. The form loads the current record so HR can update only the fields that changed.
                  </div>
                  {employee.isActive ? (
                    <Button
                      type="button"
                      className={BRAND_BUTTON_CLASS_NAME}
                      onClick={() => navigate(getAdminEmployeeEditRoute(employee.id))}
                    >
                      <UserPen className="mr-2 h-4 w-4" />
                      Open edit page
                    </Button>
                  ) : (
                    <div className="rounded-xl border border-slate-300 bg-slate-100/90 px-4 py-3 text-sm text-slate-700">
                      Reactivate this employee before editing the record.
                    </div>
                  )}
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
                          No authentication account linked yet.
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label htmlFor="account-email-input">Invitation Email</Label>
                        <Input
                          id="account-email-input"
                          type="email"
                          value={accountEmailSource}
                          onChange={(event) => setAccountEmailInput(event.target.value)}
                          placeholder="employe@entreprise.com"
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
                          {isInviting ? 'Sending...' : "Resend Invitation"}
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
                          {isInviting ? 'Sending...' : "Send Invitation"}
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
                        <Badge className="border-transparent bg-red-600 text-white">Refresh needed</Badge>
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
                                <AlertDialogTitle>Revoke le jeton QR actif ?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will immediately deactivate the current public profile link.
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
                              <p className="mb-1 text-xs text-muted-foreground">Public Profile URL</p>
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
                                Copy Link
                              </Button>
                              <Button type="button" variant="outline" onClick={onDownloadQr}>
                                <Download className="mr-2 h-4 w-4" />
                                Download QR
                              </Button>
                              <Button type="button" variant="outline" onClick={onOpenPublicPreview}>
                                <ExternalLink className="mr-2 h-4 w-4" />
                                Open Public Profile
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
                        {PUBLIC_QR_VISIBILITY_FIELDS.map((field) => (
                          <div
                            key={field.key}
                            className="flex items-center justify-between rounded-md border px-3 py-2"
                          >
                            <p className="text-sm">{field.label}</p>
                            <StatusBadge
                              tone={visibilityMap.get(field.key) ? 'success' : 'neutral'}
                              emphasis="outline"
                            >
                              {visibilityMap.get(field.key) ? 'Published' : 'Hidden'}
                            </StatusBadge>
                          </div>
                        ))}

                        <Alert className="border-slate-200 bg-slate-50">
                          <AlertTitle>Employee-owned visibility workflow</AlertTitle>
                          <AlertDescription>
                            Employees submit public visibility requests from their QR page. HR reviews those requests in the request center before any change reaches the live QR profile.
                          </AlertDescription>
                        </Alert>

                        {visibilityRequestsQuery.isPending ? (
                          <>
                            <Skeleton className="h-20 w-full" />
                            <Skeleton className="h-20 w-full" />
                          </>
                        ) : null}

                        {visibilityRequestsQuery.isError ? (
                          <Alert variant="destructive">
                            <AlertTitle>Visibility request history unavailable</AlertTitle>
                            <AlertDescription className="space-y-2">
                              <p>{visibilityRequestsQuery.error.message}</p>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => void visibilityRequestsQuery.refetch()}
                              >
                                Retry
                              </Button>
                            </AlertDescription>
                          </Alert>
                        ) : null}

                        {!visibilityRequestsQuery.isPending && !visibilityRequestsQuery.isError ? (
                          openVisibilityRequest ? (
                            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                              <div className="flex flex-wrap items-center gap-2">
                                <StatusBadge
                                  tone={getPublicProfileVisibilityRequestStatusMeta(openVisibilityRequest.status).tone}
                                >
                                  {getPublicProfileVisibilityRequestStatusMeta(openVisibilityRequest.status).label}
                                </StatusBadge>
                                <p className="text-xs text-amber-900/80">
                                  Submitted {new Date(openVisibilityRequest.createdAt).toLocaleString()}
                                </p>
                              </div>
                              <p className="mt-3 text-xs font-medium uppercase tracking-wide text-amber-900/70">
                                Requested public visibility
                              </p>
                              <p className="mt-2 text-sm text-amber-950">
                                {formatVisibilityFieldList(openVisibilityRequest.requestedFieldKeys)}
                              </p>
                              {openVisibilityRequest.requestNote ? (
                                <p className="mt-3 text-sm text-amber-950">
                                  <span className="font-medium">Employee note:</span> {openVisibilityRequest.requestNote}
                                </p>
                              ) : null}
                            </div>
                          ) : latestVisibilityRequest ? (
                            <div className="rounded-xl border p-4">
                              <div className="flex flex-wrap items-center gap-2">
                                <StatusBadge
                                  tone={getPublicProfileVisibilityRequestStatusMeta(latestVisibilityRequest.status).tone}
                                >
                                  {getPublicProfileVisibilityRequestStatusMeta(latestVisibilityRequest.status).label}
                                </StatusBadge>
                                <p className="text-xs text-muted-foreground">
                                  Reviewed {latestVisibilityRequest.reviewedAt ? new Date(latestVisibilityRequest.reviewedAt).toLocaleString() : 'Not reviewed'}
                                </p>
                              </div>
                              <p className="mt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                Most recent requested visibility
                              </p>
                              <p className="mt-2 text-sm text-slate-700">
                                {formatVisibilityFieldList(latestVisibilityRequest.requestedFieldKeys)}
                              </p>
                              {latestVisibilityRequest.reviewNote ? (
                                <p className="mt-3 text-sm text-slate-700">
                                  <span className="font-medium">HR review note:</span> {latestVisibilityRequest.reviewNote}
                                </p>
                              ) : null}
                            </div>
                          ) : (
                            <EmptyState
                              surface="plain"
                              title="No visibility requests yet"
                              description="This employee has not submitted a public profile visibility request yet."
                            />
                          )
                        ) : null}

                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => navigate(ROUTES.ADMIN_REQUESTS)}
                        >
                          Open Request Center
                        </Button>
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
                          Open Request Center
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

      <AlertDialog
        open={employeeStatusAction !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEmployeeStatusAction(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {employeeStatusAction === 'deactivate' ? "Deactivate Employee?" : "Activate Employee?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {employeeStatusAction === 'deactivate'
                ? `Deactivate ${employee.prenom} ${employee.nom}? This employee will be marked inactive and unavailable in the system. The active QR token will be revoked.`
                : `Activate ${employee.prenom} ${employee.nom}? This employee will be restored as active and available in the system.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isStatusMutationPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isStatusMutationPending}
              onClick={(event) => {
                event.preventDefault()
                void onConfirmEmployeeStatusChange()
              }}
            >
              {isStatusMutationPending
                ? employeeStatusAction === 'deactivate'
                  ? 'Deactivating...'
                  : 'Activating...'
                : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
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
