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
import { useI18n } from '@/hooks/use-i18n'
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
  getEmployeeVisibilityFieldLabel,
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
import { getRequestFieldLabel } from '@/utils/modification-requests'
import { copyTextToClipboard } from '@/utils/clipboard'
import { downloadCanvasAsPng } from '@/utils/qr'

function getInitials(prenom: string, nom: string) {
  const initials = `${prenom.trim().charAt(0)}${nom.trim().charAt(0)}`.toUpperCase()
  return initials || 'NA'
}


function formatDateTime(value: string | null, locale: string, emptyLabel: string): string {
  if (!value) {
    return emptyLabel
  }

  return new Date(value).toLocaleString(locale)
}

function formatVisibilityFieldList(fieldKeys: string[], t: ReturnType<typeof useI18n>['t']): string {
  if (fieldKeys.length === 0) {
    return t('admin.employeeDetail.visibility.noPublicFields')
  }

  return fieldKeys
    .map((fieldKey) =>
      getEmployeeVisibilityFieldLabel(fieldKey as EmployeeVisibilityFieldKey, t) ?? fieldKey,
    )
    .join(', ')
}

function findOpenVisibilityRequest(
  requests: AdminPublicProfileVisibilityRequestItem[],
): AdminPublicProfileVisibilityRequestItem | null {
  return (
    requests.find((request) => request.status === 'PENDING' || request.status === 'IN_REVIEW') ?? null
  )
}

function formatOptionalValue(
  value: string | null | undefined,
  emptyLabel: string,
): string {
  return sanitizeEmployeeTextValue(value) ?? emptyLabel
}

function formatEmploymentValue(
  value: string | null | undefined,
  emptyLabel: string,
): string {
  return sanitizeEmployeeTextValue(value) ?? emptyLabel
}

function formatEmploymentDate(
  value: string | null | undefined,
  locale: string,
  emptyLabel: string,
): string {
  if (!value) {
    return emptyLabel
  }

  return new Date(`${value}T00:00:00`).toLocaleDateString(locale)
}

function formatCivilValue(
  value: string | null | undefined,
  emptyLabel: string,
): string {
  return sanitizeEmployeeTextValue(value) ?? emptyLabel
}

function formatCivilDate(
  value: string | null | undefined,
  locale: string,
  emptyLabel: string,
): string {
  if (!value) {
    return emptyLabel
  }

  return new Date(`${value}T00:00:00`).toLocaleDateString(locale)
}

function formatAdministrativeNumber(
  value: number | null | undefined,
  emptyLabel: string,
): string {
  return value === null || value === undefined ? emptyLabel : String(value)
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function getInviteSuccessMessage(params: {
  email: string
  resend: boolean
  deliveryType?: 'invite' | 'magiclink'
  t: ReturnType<typeof useI18n>['t']
}): string {
  const actionLabel = params.resend
    ? params.t('admin.employeeDetail.account.inviteResent')
    : params.t('admin.employeeDetail.account.inviteSent')

  if (params.deliveryType === 'magiclink') {
    return params.t('admin.employeeDetail.feedback.accessEmailDelivered', {
      action: actionLabel,
      email: params.email,
    })
  }

  return params.t('admin.employeeDetail.feedback.invitationDelivered', {
    action: actionLabel,
    email: params.email,
  })
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
  const { t, locale, isRTL } = useI18n()
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
      toast.success(t('admin.employeeDetail.feedback.activated'))
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
      toast.success(t('admin.employeeDetail.feedback.deactivated'))
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
            t,
          }),
        )
      } else {
        toast.info(t('admin.employeeDetail.feedback.accountLinkedWithoutInvite', { email: result.email }))
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
            t,
          }),
        )
      } else {
        toast.info(t('admin.employeeDetail.feedback.accountLinkedWithoutNewInvite', { email: result.email }))
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
  const notProvidedLabel = t('common.notProvided')
  const notAvailableLabel = t('common.notAvailable')

  const departmentName = useMemo(() => {
    if (!employee) {
      return notProvidedLabel
    }

    return (
      getDepartmentDisplayName(
        departmentsQuery.data?.find((department) => department.id === employee.departementId)?.nom,
      ) ?? employee.departementId
    )
  }, [departmentsQuery.data, employee, notProvidedLabel])

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
      toast.error(t('admin.employeeDetail.feedback.inactiveQrError'))
      return
    }

    const hadActiveToken = token?.statutToken === 'ACTIF'

    try {
      await generateTokenMutation.mutateAsync(employee.id)
      toast.success(
        hadActiveToken
          ? t('admin.employeeDetail.feedback.qrRegenerated')
          : t('admin.employeeDetail.feedback.qrGenerated'),
      )

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
      toast.error(error instanceof Error ? error.message : t('admin.employeeDetail.feedback.qrGenerateError'))
    }
  }

  const onRevokeToken = async () => {
    if (!employee) {
      return
    }

    try {
      const revokedToken = await revokeTokenMutation.mutateAsync(employee.id)
      if (revokedToken) {
        toast.success(t('admin.employeeDetail.feedback.qrRevoked'))
      } else {
        toast.success(t('admin.employeeDetail.feedback.noActiveQrToken'))
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('admin.employeeDetail.feedback.qrRevokeError'))
    }
  }
  const onCopyPublicLink = async () => {
    if (!publicProfileUrl) {
      toast.error(t('admin.employeeDetail.feedback.noPublicLink'))
      return
    }

    try {
      await copyTextToClipboard(publicProfileUrl)
      toast.success(t('admin.employeeDetail.feedback.publicLinkCopied'))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('admin.employeeDetail.feedback.copyLinkError'))
    }
  }

  const onOpenPublicPreview = () => {
    if (!publicProfileUrl) {
      toast.error(t('admin.employeeDetail.feedback.noPublicLink'))
      return
    }

    window.open(publicProfileUrl, '_blank', 'noopener,noreferrer')
  }

  const onCopyEmployeeEmail = async () => {
    if (!employee?.email) {
      toast.error(t('admin.employeeDetail.feedback.noEmployeeEmail'))
      return
    }

    try {
      await copyTextToClipboard(employee.email)
      toast.success(t('admin.employeeDetail.feedback.emailCopied'))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('admin.employeeDetail.feedback.copyEmailError'))
    }
  }

  const onCopyEmployeeMatricule = async () => {
    if (!employee) {
      return
    }

    try {
      await copyTextToClipboard(employee.matricule)
      toast.success(t('admin.employeeDetail.feedback.employeeIdCopied'))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('admin.employeeDetail.feedback.copyEmployeeIdError'))
    }
  }

  const onDownloadQr = () => {
    if (!employee || !publicProfileUrl) {
      return
    }

    try {
      downloadCanvasAsPng(qrCanvasId, `ems_public_qr_${employee.matricule}.png`)
      toast.success(t('admin.employeeDetail.feedback.qrDownloaded'))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('admin.employeeDetail.feedback.qrDownloadError'))
    }
  }

  const onSendInvite = async () => {
    if (!employee) {
      return
    }

    const normalizedEmail = effectiveInviteEmail

    if (!isValidEmail(normalizedEmail)) {
      toast.error(t('admin.employeeDetail.feedback.validInvitationEmailRequired'))
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
      toast.error(t('admin.employeeDetail.feedback.validInvitationEmailRequired'))
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
  const displayAccountEmail = normalizedAccountEmail || fallbackProfileEmail || notAvailableLabel
  const canTriggerInvite =
    !isInviting &&
    effectiveInviteEmail.length > 0 &&
    isValidEmail(effectiveInviteEmail)

  if (!id) {
    return (
      <DashboardLayout
        title={t('admin.employeeDetail.title')}
        subtitle={t('admin.employeeDetail.invalidRouteSubtitle')}
      >
        <Card>
          <CardContent className="space-y-3 p-6">
            <p className="text-sm text-destructive">{t('admin.employeeDetail.invalidRouteMessage')}</p>
            <Button variant="outline" onClick={() => navigate(ROUTES.ADMIN_EMPLOYEES)}>
              {t('admin.employeeDetail.backToEmployees')}
            </Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    )
  }

  if (employeeQuery.isPending) {
    return (
      <DashboardLayout
        title={t('admin.employeeDetail.title')}
        subtitle={t('admin.employeeDetail.loadingSubtitle')}
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
        title={t('admin.employeeDetail.title')}
        subtitle={t('admin.employeeDetail.loadErrorSubtitle')}
      >
        <ErrorState
          title={t('admin.employeeDetail.loadErrorTitle')}
          description={t('admin.employeeDetail.loadErrorDescription')}
          message={employeeQuery.error.message}
          onRetry={() => void employeeQuery.refetch()}
        />
      </DashboardLayout>
    )
  }

  if (!employee) {
    return (
      <DashboardLayout
        title={t('admin.employeeDetail.title')}
        subtitle={t('admin.employeeDetail.emptySubtitle')}
      >
        <EmptyState
          title={t('admin.employeeDetail.emptyTitle')}
          description={t('admin.employeeDetail.emptyDescription')}
          actions={
            <Button variant="outline" onClick={() => navigate(ROUTES.ADMIN_EMPLOYEES)}>
              <ArrowLeft className={cn('h-4 w-4', isRTL ? 'ml-2 rotate-180' : 'mr-2')} />
              {t('admin.employeeDetail.backToEmployees')}
            </Button>
          }
        />
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout
      title={t('admin.employeeDetail.title')}
      subtitle={t('admin.employeeDetail.subtitle')}
    >
      <PageHeader
        title={t('admin.employeeDetail.title')}
        description={t('admin.employeeDetail.headerDescription')}
        className="sticky top-2 z-20 mb-6"
        backAction={
          <Button
            type="button"
            variant="ghost"
            className="px-0 text-muted-foreground"
            onClick={() => navigate(ROUTES.ADMIN_EMPLOYEES)}
          >
            <ArrowLeft className={cn('h-4 w-4', isRTL ? 'ml-2 rotate-180' : 'mr-2')} />
            {t('admin.employeeDetail.backToEmployees')}
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
                <UserPen className={cn('h-4 w-4', isRTL ? 'ml-2' : 'mr-2')} />
                {t('admin.employeeDetail.actions.editEmployee')}
              </Button>
            ) : (
              <Button
                type="button"
                className={BRAND_BUTTON_CLASS_NAME}
                disabled={isStatusMutationPending}
                onClick={() => setEmployeeStatusAction('activate')}
              >
                {activateMutation.isPending ? (
                  <Loader2 className={cn('h-4 w-4 animate-spin', isRTL ? 'ml-2' : 'mr-2')} />
                ) : (
                  <UserCheck className={cn('h-4 w-4', isRTL ? 'ml-2' : 'mr-2')} />
                )}
                {activateMutation.isPending
                  ? t('admin.employeeDetail.actions.activating')
                  : t('admin.employeeDetail.actions.activateEmployee')}
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
                <UserX className={cn('h-4 w-4', isRTL ? 'ml-2' : 'mr-2')} />
                {t('admin.employeeDetail.actions.deactivateEmployee')}
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
                <Loader2 className={cn('h-4 w-4 animate-spin', isRTL ? 'ml-2' : 'mr-2')} />
              ) : (
                <RefreshCcw className={cn('h-4 w-4', isRTL ? 'ml-2' : 'mr-2')} />
              )}
              {t('admin.employeeDetail.actions.regenerateQr')}
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
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label={t('admin.employeeDetail.actions.moreActionsTitle')}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                  <DialogTitle>{t('admin.employeeDetail.actions.moreActionsTitle')}</DialogTitle>
                  <DialogDescription>
                    {t('admin.employeeDetail.actions.moreActionsDescription')}
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
                    <Mail className={cn('h-4 w-4', isRTL ? 'ml-2' : 'mr-2')} />
                    {t('admin.employeeDetail.actions.copyEmail')}
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
                    <Copy className={cn('h-4 w-4', isRTL ? 'ml-2' : 'mr-2')} />
                    {t('admin.employeeDetail.actions.copyEmployeeId')}
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
                    <ExternalLink className={cn('h-4 w-4', isRTL ? 'ml-2' : 'mr-2')} />
                    {t('admin.employeeDetail.actions.openPublicProfile')}
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
                      <UserX className={cn('h-4 w-4', isRTL ? 'ml-2' : 'mr-2')} />
                    ) : (
                      <UserCheck className={cn('h-4 w-4', isRTL ? 'ml-2' : 'mr-2')} />
                    )}
                    {employee.isActive
                      ? t('admin.employeeDetail.actions.deactivateEmployee')
                      : t('admin.employeeDetail.actions.activateEmployee')}
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
                    {employee.isActive ? t('status.common.active') : t('status.common.inactive')}
                  </StatusBadge>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <InfoLine label={t('employee.profile.fields.employeeId')} value={employee.matricule} mono />
                <InfoLine label={t('common.department')} value={departmentName} />
                <InfoLine
                  label={t('employee.profile.fields.regionalBranch')}
                  value={formatEmploymentValue(
                    getEmployeeRegionalBranchLabel(employee.regionalBranch),
                    notProvidedLabel,
                  )}
                />
                <InfoLine
                  label={t('common.jobTitle')}
                  value={formatOptionalValue(getEmployeePosteLabel(employee.poste), notProvidedLabel)}
                />
                <InfoLine
                  label={t('employee.profile.fields.sex')}
                  value={formatCivilValue(getEmployeeSexeLabel(employee.sexe), notProvidedLabel)}
                />
                <InfoLine
                  label={t('employee.profile.fields.birthDate')}
                  value={formatCivilDate(employee.dateNaissance, locale, notProvidedLabel)}
                />
                <InfoLine
                  label={t('employee.profile.fields.nationality')}
                  value={formatCivilValue(getEmployeeNationaliteLabel(employee.nationalite), notProvidedLabel)}
                />
                <InfoLine
                  label={t('employee.profile.fields.professionalCategory')}
                  value={formatEmploymentValue(
                    getEmployeeCategorieProfessionnelleLabel(employee.categorieProfessionnelle),
                    notProvidedLabel,
                  )}
                />
                <InfoLine
                  label={t('employee.profile.fields.contractType')}
                  value={formatEmploymentValue(
                    getEmployeeTypeContratLabel(employee.typeContrat),
                    notProvidedLabel,
                  )}
                />
                <InfoLine
                  label={t('employee.profile.fields.hireDate')}
                  value={formatEmploymentDate(employee.dateRecrutement, locale, notProvidedLabel)}
                />
              </div>

              <Separator />

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  <span className="truncate">{formatOptionalValue(employee.email, notProvidedLabel)}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-4 w-4" />
                  <span className="truncate">{formatOptionalValue(employee.telephone, notProvidedLabel)}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => void onCopyEmployeeEmail()}>
                  <Copy className={cn('h-4 w-4', isRTL ? 'ml-1' : 'mr-1')} />
                  {t('admin.employeeDetail.actions.copyEmail')}
                </Button>
                <Button size="sm" variant="outline" onClick={() => void onCopyEmployeeMatricule()}>
                  <Copy className={cn('h-4 w-4', isRTL ? 'ml-1' : 'mr-1')} />
                  {t('admin.employeeDetail.actions.copyEmployeeId')}
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
                    <UserX className={cn('h-4 w-4', isRTL ? 'ml-1' : 'mr-1')} />
                  ) : (
                    <UserCheck className={cn('h-4 w-4', isRTL ? 'ml-1' : 'mr-1')} />
                  )}
                  {employee.isActive
                    ? t('admin.employeeDetail.actions.deactivate')
                    : t('admin.employeeDetail.actions.activate')}
                </Button>
              </div>
            </CardContent>
          </Card>

          {needsQrRefresh ? (
            <Alert>
              <AlertTitle className="text-amber-800">{t('admin.employeeDetail.qr.refreshNeededTitle')}</AlertTitle>
              <AlertDescription className="text-amber-700">
                {t('admin.employeeDetail.qr.refreshNeededDescription')}
              </AlertDescription>
            </Alert>
          ) : null}
        </div>

        <div>
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as DetailTab)}>
            <TabsList className="w-full justify-start gap-1 overflow-x-auto">
              <TabsTrigger value="overview">{t('admin.employeeDetail.tabs.overview')}</TabsTrigger>
              <TabsTrigger value="qr-visibility">{t('admin.employeeDetail.tabs.qrVisibility')}</TabsTrigger>
              <TabsTrigger value="requests">{t('admin.employeeDetail.tabs.requests')}</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              {isInactive ? (
                <div className="rounded-xl border border-slate-300 bg-slate-100/90 p-3 text-sm text-slate-700">
                  {t('admin.employeeDetail.inactiveBanner')}
                </div>
              ) : null}

              <Card
                id="employee-info-section"
                className="scroll-mt-32 rounded-2xl border border-slate-200/80 shadow-sm"
              >
                <CardHeader>
                  <CardTitle>{t('admin.employeeDetail.sections.overview.title')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 text-sm sm:grid-cols-2">
                    <InfoGrid label={t('requests.fields.nom')} value={employee.nom} />
                    <InfoGrid label={t('requests.fields.prenom')} value={employee.prenom} />
                    <InfoGrid
                      label={t('employee.profile.fields.sex')}
                      value={formatCivilValue(getEmployeeSexeLabel(employee.sexe), notProvidedLabel)}
                    />
                    <InfoGrid
                      label={t('employee.profile.fields.birthDate')}
                      value={formatCivilDate(employee.dateNaissance, locale, notProvidedLabel)}
                    />
                    <InfoGrid
                      label={t('employee.profile.fields.birthPlace')}
                      value={formatCivilValue(employee.lieuNaissance, notProvidedLabel)}
                    />
                    <InfoGrid
                      label={t('employee.profile.fields.nationality')}
                      value={formatCivilValue(getEmployeeNationaliteLabel(employee.nationalite), notProvidedLabel)}
                    />
                    <InfoGrid label={t('employee.profile.fields.employeeId')} value={employee.matricule} mono />
                    <InfoGrid
                      label={t('common.jobTitle')}
                      value={formatOptionalValue(getEmployeePosteLabel(employee.poste), notProvidedLabel)}
                    />
                    <InfoGrid label={t('common.department')} value={departmentName} />
                    <InfoGrid
                      label={t('employee.profile.fields.regionalBranch')}
                      value={formatEmploymentValue(
                        getEmployeeRegionalBranchLabel(employee.regionalBranch),
                        notProvidedLabel,
                      )}
                    />
                    <InfoGrid
                      label={t('employee.profile.fields.professionalCategory')}
                      value={formatEmploymentValue(
                        getEmployeeCategorieProfessionnelleLabel(employee.categorieProfessionnelle),
                        notProvidedLabel,
                      )}
                    />
                    <InfoGrid
                      label={t('employee.profile.fields.contractType')}
                      value={formatEmploymentValue(
                        getEmployeeTypeContratLabel(employee.typeContrat),
                        notProvidedLabel,
                      )}
                    />
                    <InfoGrid
                      label={t('employee.profile.fields.hireDate')}
                      value={formatEmploymentDate(employee.dateRecrutement, locale, notProvidedLabel)}
                    />
                    <InfoGrid label={t('common.email')} value={formatOptionalValue(employee.email, notProvidedLabel)} />
                    <InfoGrid label={t('employee.profile.fields.phone')} value={formatOptionalValue(employee.telephone, notProvidedLabel)} />
                    <InfoGrid label={t('common.created')} value={formatDateTime(employee.createdAt, locale, notAvailableLabel)} />
                    <InfoGrid label={t('employee.profile.fields.updatedAt')} value={formatDateTime(employee.updatedAt, locale, notAvailableLabel)} />
                    <InfoGrid label={t('employee.profile.fields.role')} value={employeeProfile?.role ?? t('admin.employeeDetail.account.notLinked')} />
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border border-amber-200/80 shadow-sm">
                <CardHeader>
                  <CardTitle>{t('admin.employeeDetail.sections.administrative.title')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    {t('admin.employeeDetail.sections.administrative.description')}
                  </div>

                  <div className="grid gap-3 text-sm sm:grid-cols-2">
                    <InfoGrid
                      label={t('employee.profile.fields.maritalStatus')}
                      value={formatCivilValue(
                        getEmployeeSituationFamilialeLabel(employee.situationFamiliale),
                        notProvidedLabel,
                      )}
                    />
                    <InfoGrid
                      label={t('employee.profile.fields.children')}
                      value={formatAdministrativeNumber(employee.nombreEnfants, notProvidedLabel)}
                    />
                    <InfoGrid label={t('employee.profile.fields.address')} value={formatCivilValue(employee.adresse, notProvidedLabel)} />
                    <InfoGrid
                      label={t('employee.profile.fields.socialSecurityNumber')}
                      value={formatCivilValue(employee.numeroSecuriteSociale, notProvidedLabel)}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border border-slate-200/80 shadow-sm">
                <CardHeader>
                  <CardTitle>{t('admin.employeeDetail.sections.education.title')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 text-sm sm:grid-cols-3">
                    <InfoGrid
                      label={t('employee.profile.fields.degree')}
                      value={formatCivilValue(getEmployeeDiplomeLabel(employee.diplome), notProvidedLabel)}
                    />
                    <InfoGrid
                      label={t('employee.profile.fields.specialization')}
                      value={formatCivilValue(getEmployeeSpecialiteLabel(employee.specialite), notProvidedLabel)}
                    />
                    <InfoGrid
                      label={t('employee.profile.fields.university')}
                      value={formatCivilValue(getEmployeeUniversiteLabel(employee.universite), notProvidedLabel)}
                    />
                  </div>

                  <div className="rounded-lg border bg-slate-50/50 p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {t('employee.profile.fields.careerHistory')}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-900">
                      {formatCivilValue(employee.historiquePostes, notProvidedLabel)}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border border-amber-200/80 shadow-sm">
                <CardHeader>
                  <CardTitle>{t('admin.employeeDetail.sections.internalNotes.title')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    {t('admin.employeeDetail.sections.internalNotes.description')}
                  </div>

                  <div className="rounded-lg border bg-slate-50/50 p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {t('admin.employeeDetail.sections.internalNotes.observations')}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-900">
                      {formatCivilValue(employee.observations, notProvidedLabel)}
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card className="rounded-2xl border border-slate-200/80 shadow-sm">
                <CardHeader className="space-y-2">
                  <CardTitle>{t('admin.employeeDetail.sections.edit.title')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm text-slate-700">
                    {t('admin.employeeDetail.sections.edit.description')}
                  </div>
                  {employee.isActive ? (
                    <Button
                      type="button"
                      className={BRAND_BUTTON_CLASS_NAME}
                      onClick={() => navigate(getAdminEmployeeEditRoute(employee.id))}
                    >
                      <UserPen className={cn('h-4 w-4', isRTL ? 'ml-2' : 'mr-2')} />
                      {t('admin.employeeDetail.sections.edit.openPage')}
                    </Button>
                  ) : (
                    <div className="rounded-xl border border-slate-300 bg-slate-100/90 px-4 py-3 text-sm text-slate-700">
                      {t('admin.employeeDetail.sections.edit.reactivateFirst')}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-2xl border border-slate-200/80 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    {t('admin.employeeDetail.account.title')}
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
                      <AlertTitle>{t('admin.employeeDetail.account.unavailableTitle')}</AlertTitle>
                      <AlertDescription className="space-y-2">
                        <p>{employeeProfileQuery.error.message}</p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void employeeProfileQuery.refetch()}
                        >
                          {t('common.retry')}
                        </Button>
                      </AlertDescription>
                    </Alert>
                  ) : null}

                  {!employeeProfileQuery.isPending && !employeeProfileQuery.isError ? (
                    <>
                      {employeeProfile?.userId ? (
                        <div className="space-y-2 rounded-md border p-3 text-sm">
                          <div className="flex items-center justify-between">
                            <p className="font-medium">{t('admin.employeeDetail.account.linkedAccount')}</p>
                            <Badge variant="secondary">{t('admin.employeeDetail.account.linkedBadge')}</Badge>
                          </div>
                          <p>
                            <span className="font-medium">{t('common.email')}:</span> {displayAccountEmail}
                          </p>
                          <p className="break-all text-xs text-muted-foreground">
                            user_id: {employeeProfile.userId}
                          </p>
                        </div>
                      ) : (
                        <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                          {t('admin.employeeDetail.account.notLinkedYet')}
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label htmlFor="account-email-input">{t('admin.employeeDetail.account.invitationEmail')}</Label>
                        <Input
                          id="account-email-input"
                          type="email"
                          value={accountEmailSource}
                          onChange={(event) => setAccountEmailInput(event.target.value)}
                          placeholder={t('admin.employeeDetail.account.invitationEmailPlaceholder')}
                          disabled={isInviting}
                        />
                        {normalizedAccountEmail.length > 0 && !isValidEmail(normalizedAccountEmail) ? (
                          <p className="text-xs text-destructive">{t('validation.validEmail')}</p>
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
                            <Loader2 className={cn('h-4 w-4 animate-spin', isRTL ? 'ml-2' : 'mr-2')} />
                          ) : (
                            <Send className={cn('h-4 w-4', isRTL ? 'ml-2' : 'mr-2')} />
                          )}
                          {isInviting
                            ? t('admin.employeeDetail.account.sending')
                            : t('admin.employeeDetail.account.resendInvitation')}
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          className="w-full"
                          disabled={!canTriggerInvite}
                          onClick={() => void onSendInvite()}
                        >
                          {isInviting ? (
                            <Loader2 className={cn('h-4 w-4 animate-spin', isRTL ? 'ml-2' : 'mr-2')} />
                          ) : (
                            <Send className={cn('h-4 w-4', isRTL ? 'ml-2' : 'mr-2')} />
                          )}
                          {isInviting
                            ? t('admin.employeeDetail.account.sending')
                            : t('admin.employeeDetail.account.sendInvitation')}
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
                      {t('admin.employeeDetail.qr.title')}
                      {needsQrRefresh ? (
                        <Badge className="border-transparent bg-red-600 text-white">
                          {t('admin.employeeDetail.qr.refreshNeededBadge')}
                        </Badge>
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
                        <AlertTitle>{t('admin.employeeDetail.qr.loadErrorTitle')}</AlertTitle>
                        <AlertDescription className="space-y-2">
                          <p>{employeeTokenQuery.error.message}</p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void employeeTokenQuery.refetch()}
                          >
                            {t('common.retry')}
                          </Button>
                        </AlertDescription>
                      </Alert>
                    ) : null}
                    {!employeeTokenQuery.isPending && !employeeTokenQuery.isError ? (
                      <>
                        {token ? (
                          <div className="space-y-2 rounded-xl border p-3 text-sm">
                            <p className="break-all">
                              <span className="font-medium">{t('admin.employeeDetail.qr.token')}:</span> {token.token}
                            </p>
                            <p>
                              <span className="font-medium">{t('common.status')}:</span>{' '}
                              <Badge
                                className={
                                  token.statutToken === 'ACTIF'
                                    ? 'border-transparent bg-emerald-100 text-emerald-800'
                                    : 'border-transparent bg-slate-100 text-slate-700'
                                }
                              >
                                {token.statutToken === 'ACTIF'
                                  ? t('status.common.active')
                                  : t('status.common.inactive')}
                              </Badge>
                            </p>
                            <p>
                              <span className="font-medium">{t('admin.employeeDetail.qr.expiresAt')}:</span>{' '}
                              {formatDateTime(token.expiresAt, locale, notAvailableLabel)}
                            </p>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            {t('admin.employeeDetail.qr.noToken')}
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
                              <Loader2 className={cn('h-4 w-4 animate-spin', isRTL ? 'ml-2' : 'mr-2')} />
                            ) : (
                              <RefreshCcw className={cn('h-4 w-4', isRTL ? 'ml-2' : 'mr-2')} />
                            )}
                            {token && token.statutToken === 'ACTIF'
                              ? t('admin.employeeDetail.actions.regenerateQr')
                              : t('admin.employeeDetail.actions.generateQr')}
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
                                <AlertDialogTitle>{t('admin.employeeDetail.qr.revokeTitle')}</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {t('admin.employeeDetail.qr.revokeDescription')}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel disabled={revokeTokenMutation.isPending}>
                                  {t('actions.cancel')}
                                </AlertDialogCancel>
                                <AlertDialogAction
                                  disabled={revokeTokenMutation.isPending}
                                  onClick={(event) => {
                                    event.preventDefault()
                                    void onRevokeToken()
                                  }}
                                >
                                  {revokeTokenMutation.isPending
                                    ? t('admin.employeeDetail.qr.revoking')
                                    : t('admin.employeeDetail.qr.confirm')}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>

                        {publicProfileUrl ? (
                          <>
                            <div className="rounded-xl border p-3">
                              <p className="mb-1 text-xs text-muted-foreground">
                                {t('admin.employeeDetail.qr.publicProfileUrl')}
                              </p>
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
                                <Copy className={cn('h-4 w-4', isRTL ? 'ml-2' : 'mr-2')} />
                                {t('admin.employeeDetail.qr.copyLink')}
                              </Button>
                              <Button type="button" variant="outline" onClick={onDownloadQr}>
                                <Download className={cn('h-4 w-4', isRTL ? 'ml-2' : 'mr-2')} />
                                {t('admin.employeeDetail.qr.downloadQr')}
                              </Button>
                              <Button type="button" variant="outline" onClick={onOpenPublicPreview}>
                                <ExternalLink className={cn('h-4 w-4', isRTL ? 'ml-2' : 'mr-2')} />
                                {t('admin.employeeDetail.actions.openPublicProfile')}
                              </Button>
                            </div>
                          </>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            {t('admin.employeeDetail.qr.generateToPreview')}
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
                      {t('admin.employeeDetail.visibility.title')}
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
                        <AlertTitle>{t('admin.employeeDetail.visibility.unavailableTitle')}</AlertTitle>
                        <AlertDescription className="space-y-2">
                          <p>{visibilityQuery.error.message}</p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void visibilityQuery.refetch()}
                          >
                            {t('common.retry')}
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
                            <p className="text-sm">{getEmployeeVisibilityFieldLabel(field.key, t)}</p>
                            <StatusBadge
                              tone={visibilityMap.get(field.key) ? 'success' : 'neutral'}
                              emphasis="outline"
                            >
                              {visibilityMap.get(field.key) ? t('status.common.published') : t('status.common.hidden')}
                            </StatusBadge>
                          </div>
                        ))}

                        <Alert className="border-slate-200 bg-slate-50">
                          <AlertTitle>{t('admin.employeeDetail.visibility.workflowTitle')}</AlertTitle>
                          <AlertDescription>
                            {t('admin.employeeDetail.visibility.workflowDescription')}
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
                            <AlertTitle>{t('admin.employeeDetail.visibility.historyUnavailableTitle')}</AlertTitle>
                            <AlertDescription className="space-y-2">
                              <p>{visibilityRequestsQuery.error.message}</p>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => void visibilityRequestsQuery.refetch()}
                              >
                                {t('common.retry')}
                              </Button>
                            </AlertDescription>
                          </Alert>
                        ) : null}

                        {!visibilityRequestsQuery.isPending && !visibilityRequestsQuery.isError ? (
                          openVisibilityRequest ? (
                            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                              <div className="flex flex-wrap items-center gap-2">
                                <StatusBadge
                                  tone={getPublicProfileVisibilityRequestStatusMeta(openVisibilityRequest.status, t).tone}
                                >
                                  {getPublicProfileVisibilityRequestStatusMeta(openVisibilityRequest.status, t).label}
                                </StatusBadge>
                                <p className="text-xs text-amber-900/80">
                                  {t('admin.employeeDetail.visibility.submittedAt', {
                                    value: new Date(openVisibilityRequest.createdAt).toLocaleString(locale),
                                  })}
                                </p>
                              </div>
                              <p className="mt-3 text-xs font-medium uppercase tracking-wide text-amber-900/70">
                                {t('admin.employeeDetail.visibility.requestedVisibility')}
                              </p>
                              <p className="mt-2 text-sm text-amber-950">
                                {formatVisibilityFieldList(openVisibilityRequest.requestedFieldKeys, t)}
                              </p>
                              {openVisibilityRequest.requestNote ? (
                                <p className="mt-3 text-sm text-amber-950">
                                  <span className="font-medium">{t('admin.employeeDetail.visibility.employeeNote')}:</span> {openVisibilityRequest.requestNote}
                                </p>
                              ) : null}
                            </div>
                          ) : latestVisibilityRequest ? (
                            <div className="rounded-xl border p-4">
                              <div className="flex flex-wrap items-center gap-2">
                                <StatusBadge
                                  tone={getPublicProfileVisibilityRequestStatusMeta(latestVisibilityRequest.status, t).tone}
                                >
                                  {getPublicProfileVisibilityRequestStatusMeta(latestVisibilityRequest.status, t).label}
                                </StatusBadge>
                                <p className="text-xs text-muted-foreground">
                                  {t('admin.employeeDetail.visibility.reviewedAt', {
                                    value: latestVisibilityRequest.reviewedAt
                                      ? new Date(latestVisibilityRequest.reviewedAt).toLocaleString(locale)
                                      : t('common.notReviewed'),
                                  })}
                                </p>
                              </div>
                              <p className="mt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                {t('admin.employeeDetail.visibility.mostRecentRequestedVisibility')}
                              </p>
                              <p className="mt-2 text-sm text-slate-700">
                                {formatVisibilityFieldList(latestVisibilityRequest.requestedFieldKeys, t)}
                              </p>
                              {latestVisibilityRequest.reviewNote ? (
                                <p className="mt-3 text-sm text-slate-700">
                                  <span className="font-medium">{t('admin.employeeDetail.visibility.hrReviewNote')}:</span> {latestVisibilityRequest.reviewNote}
                                </p>
                              ) : null}
                            </div>
                          ) : (
                            <EmptyState
                              surface="plain"
                              title={t('admin.employeeDetail.visibility.emptyTitle')}
                              description={t('admin.employeeDetail.visibility.emptyDescription')}
                            />
                          )
                        ) : null}

                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => navigate(ROUTES.ADMIN_REQUESTS)}
                        >
                          {t('admin.employeeDetail.visibility.openRequestCenter')}
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
                  <CardTitle>{t('admin.employeeDetail.requests.title')}</CardTitle>
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
                      <AlertTitle>{t('admin.employeeDetail.requests.loadErrorTitle')}</AlertTitle>
                      <AlertDescription className="space-y-2">
                        <p>{employeeRequestsQuery.error.message}</p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void employeeRequestsQuery.refetch()}
                        >
                          {t('common.retry')}
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
                                  {getRequestFieldLabel(request.champCible, t)}:{' '}
                                  {formatOptionalValue(request.ancienneValeur, notProvidedLabel)} ?{' '}
                                  {formatOptionalValue(request.nouvelleValeur, notProvidedLabel)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {new Date(request.createdAt).toLocaleString(locale)}
                                </p>
                              </div>
                              <Badge className={requestStatusBadgeClass(request.statutDemande)}>
                                {t(`status.modification.${request.statutDemande}`)}
                              </Badge>
                            </div>
                            {request.commentaireTraitement ? (
                              <p className="mt-2 text-xs text-muted-foreground">
                                {t('admin.employeeDetail.requests.adminComment')}: {request.commentaireTraitement}
                              </p>
                            ) : null}
                          </div>
                        ))}
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => navigate(ROUTES.ADMIN_REQUESTS)}
                        >
                          {t('admin.employeeDetail.visibility.openRequestCenter')}
                        </Button>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                        {t('admin.employeeDetail.requests.empty')}
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
              {employeeStatusAction === 'deactivate'
                ? t('admin.employeeDetail.statusDialog.deactivateTitle')
                : t('admin.employeeDetail.statusDialog.activateTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {employeeStatusAction === 'deactivate'
                ? t('admin.employeeDetail.statusDialog.deactivateDescription', {
                    employee: `${employee.prenom} ${employee.nom}`,
                  })
                : t('admin.employeeDetail.statusDialog.activateDescription', {
                    employee: `${employee.prenom} ${employee.nom}`,
                  })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isStatusMutationPending}>{t('actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={isStatusMutationPending}
              onClick={(event) => {
                event.preventDefault()
                void onConfirmEmployeeStatusChange()
              }}
            >
              {isStatusMutationPending
                ? employeeStatusAction === 'deactivate'
                  ? t('admin.employeeDetail.statusDialog.deactivating')
                  : t('admin.employeeDetail.statusDialog.activating')
                : t('admin.employeeDetail.statusDialog.confirm')}
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
