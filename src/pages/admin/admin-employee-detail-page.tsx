
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
  UserCheck,
  UserPen,
  UserX,
} from 'lucide-react'
import { QRCodeCanvas } from 'qrcode.react'
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
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
import { Textarea } from '@/components/ui/textarea'
import { EmployeeBadgeDialog } from '@/components/admin/employee-badge-dialog'
import { EmployeeInformationSheetDialog } from '@/components/admin/employee-information-sheet-dialog'
import { env } from '@/config/env'
import { ROUTES, getPublicProfileRoute } from '@/constants/routes'
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
  useUpdateAdminEmployeeMutation,
} from '@/services/employeesService'
import {
  notificationsService,
  useHasUnreadQrRefreshForEmployeeQuery,
} from '@/services/notificationsService'
import {
  notifyPayrollUsersOfEmployeeStatusChange,
  notifyPayrollUsersOfEmployeeUpdate,
} from '@/services/payrollNotificationsService'
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
  normalizeOptionalInteger,
  normalizePhoneNumberInput,
  type EmployeeFormValues,
} from '@/schemas/employeeSchema'
import type { EmployeeVisibilityFieldKey } from '@/types/visibility'
import {
  EMPLOYEE_CATEGORIE_PROFESSIONNELLE_LABELS,
  EMPLOYEE_SITUATION_FAMILIALE_OPTIONS,
  EMPLOYEE_SITUATION_FAMILIALE_LABELS,
  EMPLOYEE_SEXE_OPTIONS,
  EMPLOYEE_CATEGORIE_PROFESSIONNELLE_OPTIONS,
  EMPLOYEE_SEXE_LABELS,
  EMPLOYEE_TYPE_CONTRAT_OPTIONS,
  EMPLOYEE_TYPE_CONTRAT_LABELS,
  getEmployeeCategorieProfessionnelleLabel,
  getEmployeeSituationFamilialeLabel,
  getEmployeeSexeLabel,
  getEmployeeTypeContratLabel,
} from '@/types/employee'
import { PUBLIC_QR_VISIBILITY_FIELDS } from '@/types/employee-governance'
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
    return 'Not provided'
  }

  return value
}

function formatEmploymentValue(value: string | null | undefined): string {
  const normalized = value?.trim()
  return normalized && normalized.length > 0 ? normalized : '—'
}

function formatEmploymentDate(value: string | null | undefined): string {
  if (!value) {
    return '—'
  }

  return new Date(`${value}T00:00:00`).toLocaleDateString()
}

function formatCivilValue(value: string | null | undefined): string {
  const normalized = value?.trim()
  return normalized && normalized.length > 0 ? normalized : '—'
}

function formatCivilDate(value: string | null | undefined): string {
  if (!value) {
    return '—'
  }

  return new Date(`${value}T00:00:00`).toLocaleDateString()
}

function formatAdministrativeNumber(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : String(value)
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

const EMPTY_SELECT_VALUE = '__none__'

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
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [employeeStatusAction, setEmployeeStatusAction] = useState<'activate' | 'deactivate' | null>(null)
  const [accountEmailInput, setAccountEmailInput] = useState<string | null>(null)
  const [isMoreActionsOpen, setIsMoreActionsOpen] = useState(false)
  const editSectionRef = useRef<HTMLDivElement | null>(null)

  const employeeQuery = useAdminEmployeeQuery(id)
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

  useEffect(() => {
    if (!employeeQuery.data) {
      return
    }

    form.reset({
      matricule: employeeQuery.data.matricule,
      nom: employeeQuery.data.nom,
      prenom: employeeQuery.data.prenom,
      departementId: employeeQuery.data.departementId,
      sexe: employeeQuery.data.sexe ?? '',
      dateNaissance: employeeQuery.data.dateNaissance ?? '',
      lieuNaissance: employeeQuery.data.lieuNaissance ?? '',
      nationalite: employeeQuery.data.nationalite ?? '',
      situationFamiliale: employeeQuery.data.situationFamiliale ?? '',
      nombreEnfants:
        employeeQuery.data.nombreEnfants !== null && employeeQuery.data.nombreEnfants !== undefined
          ? String(employeeQuery.data.nombreEnfants)
          : '',
      adresse: employeeQuery.data.adresse ?? '',
      numeroSecuriteSociale: employeeQuery.data.numeroSecuriteSociale ?? '',
      diplome: employeeQuery.data.diplome ?? '',
      specialite: employeeQuery.data.specialite ?? '',
      historiquePostes: employeeQuery.data.historiquePostes ?? '',
      observations: employeeQuery.data.observations ?? '',
      poste: employeeQuery.data.poste ?? '',
      categorieProfessionnelle: employeeQuery.data.categorieProfessionnelle ?? '',
      typeContrat: employeeQuery.data.typeContrat ?? '',
      dateRecrutement: employeeQuery.data.dateRecrutement ?? '',
      email: employeeQuery.data.email ?? '',
      telephone: employeeQuery.data.telephone ?? '',
      photoUrl: employeeQuery.data.photoUrl ?? '',
    })
  }, [employeeQuery.data, form])
  const updateMutation = useUpdateAdminEmployeeMutation({
    onSuccess: (employee) => {
      setSubmitError(null)
      toast.success('Employee updated successfully.')
      form.reset({
        matricule: employee.matricule,
        nom: employee.nom,
        prenom: employee.prenom,
        departementId: employee.departementId,
        sexe: employee.sexe ?? '',
        dateNaissance: employee.dateNaissance ?? '',
        lieuNaissance: employee.lieuNaissance ?? '',
        nationalite: employee.nationalite ?? '',
        situationFamiliale: employee.situationFamiliale ?? '',
        nombreEnfants:
          employee.nombreEnfants !== null && employee.nombreEnfants !== undefined
            ? String(employee.nombreEnfants)
            : '',
        adresse: employee.adresse ?? '',
        numeroSecuriteSociale: employee.numeroSecuriteSociale ?? '',
        diplome: employee.diplome ?? '',
        specialite: employee.specialite ?? '',
        historiquePostes: employee.historiquePostes ?? '',
        observations: employee.observations ?? '',
        poste: employee.poste ?? '',
        categorieProfessionnelle: employee.categorieProfessionnelle ?? '',
        typeContrat: employee.typeContrat ?? '',
        dateRecrutement: employee.dateRecrutement ?? '',
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

  const upsertVisibilityMutation = useUpsertVisibilityMutation()

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
      return 'Not provided'
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

  const scrollToEditForm = useCallback(() => {
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
  }, [])

  const goToEditSection = () => {
    if (activeTab !== 'overview') {
      setActiveTab('overview')
      window.setTimeout(scrollToEditForm, 140)
      return
    }

    scrollToEditForm()
  }

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

  useEffect(() => {
    if (location.hash !== '#edit') {
      return
    }

    const timerId = window.setTimeout(() => {
      scrollToEditForm()
    }, 140)

    return () => {
      window.clearTimeout(timerId)
    }
  }, [location.hash, scrollToEditForm])

  const onToggleVisibility = async (fieldKey: EmployeeVisibilityFieldKey, isPublic: boolean) => {
    try {
      await upsertVisibilityMutation.mutateAsync({
        employeId: employeeId,
        fieldKey,
        isPublic,
      })

      toast.success(`Visibility updated for ${fieldKey}.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update visibility')
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

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null)

    const previousEmployee = employee

    const updatedEmployee = await updateMutation.mutateAsync({
      id: employeeId,
      payload: {
        matricule: values.matricule.trim(),
        nom: values.nom.trim(),
        prenom: values.prenom.trim(),
        departementId: values.departementId,
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
        historiquePostes: normalizeOptional(values.historiquePostes),
        observations: normalizeOptional(values.observations),
        poste: normalizeOptional(values.poste),
        categorieProfessionnelle: normalizeOptional(values.categorieProfessionnelle),
        typeContrat: normalizeOptional(values.typeContrat),
        dateRecrutement: normalizeOptional(values.dateRecrutement),
        email: normalizeOptional(values.email),
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
                onClick={goToEditSection}
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
                {currentPhotoUrl && currentPhotoUrl.trim().length > 0 ? (
                  <img
                    src={currentPhotoUrl}
                    alt={`${currentPrenom || employee.prenom} ${currentNom || employee.nom}`}
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
                    {getInitials(currentPrenom || employee.prenom, currentNom || employee.nom)}
                  </div>
                )}

                <div>
                  <p
                    className={cn(
                      'text-lg font-semibold',
                      employee.isActive ? 'text-slate-900' : 'text-slate-700',
                    )}
                  >
                    {currentPrenom || employee.prenom} {currentNom || employee.nom}
                  </p>
                  <StatusBadge tone={employee.isActive ? 'success' : 'neutral'}>
                    {employee.isActive ? 'Active' : 'Inactive'}
                  </StatusBadge>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <InfoLine label="Employee ID" value={employee.matricule} mono />
                <InfoLine label="Department" value={departmentName} />
                <InfoLine label="Job Title" value={formatOptionalValue(currentPoste || employee.poste)} />
                <InfoLine label="Sex" value={formatCivilValue(getEmployeeSexeLabel(employee.sexe))} />
                <InfoLine label="Birth Date" value={formatCivilDate(employee.dateNaissance)} />
                <InfoLine label="Nationality" value={formatCivilValue(employee.nationalite)} />
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
                ref={editSectionRef}
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
                      value={formatCivilValue(employee.nationalite)}
                    />
                    <InfoGrid label="Employee ID" value={employee.matricule} mono />
                    <InfoGrid label="Job Title" value={formatOptionalValue(employee.poste)} />
                    <InfoGrid label="Department" value={departmentName} />
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
                  <div className="grid gap-3 text-sm sm:grid-cols-2">
                    <InfoGrid label="Degree" value={formatCivilValue(employee.diplome)} />
                    <InfoGrid label="Specialization" value={formatCivilValue(employee.specialite)} />
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
                        <Label htmlFor="matricule">Employee ID</Label>
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
                        <Label htmlFor="nom">Last Name</Label>
                        <Input id="nom" disabled={isFormDisabled} {...form.register('nom')} />
                      </FieldError>

                      <FieldError message={form.formState.errors.prenom?.message}>
                        <Label htmlFor="prenom">First Name</Label>
                        <Input id="prenom" disabled={isFormDisabled} {...form.register('prenom')} />
                      </FieldError>

                      <FieldError message={form.formState.errors.poste?.message}>
                        <Label htmlFor="poste">Job Title</Label>
                        <Input id="poste" disabled={isFormDisabled} {...form.register('poste')} />
                      </FieldError>
                    </div>

                    <Separator />

                    <div className="space-y-1">
                      <h3 className="text-sm font-semibold text-slate-900">Personal Information</h3>
                      <p className="text-xs text-muted-foreground">
                        Sensitive civil details stored only in the internal HR record.
                      </p>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
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
                          disabled={isFormDisabled}
                          {...form.register('lieuNaissance')}
                        />
                      </FieldError>

                      <FieldError message={form.formState.errors.nationalite?.message}>
                        <Label htmlFor="nationalite">Nationality</Label>
                        <Input
                          id="nationalite"
                          disabled={isFormDisabled}
                          {...form.register('nationalite')}
                        />
                      </FieldError>
                    </div>

                    <Separator />

                    <div className="space-y-1">
                      <h3 className="text-sm font-semibold text-slate-900">Employment Information</h3>
                      <p className="text-xs text-muted-foreground">
                        Employment data managed by HR for payroll-ready employee records.
                      </p>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
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
                    </div>

                    <Separator />

                    <div className="space-y-1">
                      <h3 className="text-sm font-semibold text-slate-900">Education & Career Background</h3>
                      <p className="text-xs text-muted-foreground">
                        Education level, specialization, and career background summarized for HR reference.
                      </p>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <FieldError message={form.formState.errors.diplome?.message}>
                        <Label htmlFor="diplome">Degree / Diploma</Label>
                        <Input
                          id="diplome"
                          disabled={isFormDisabled}
                          {...form.register('diplome')}
                        />
                      </FieldError>

                      <FieldError message={form.formState.errors.specialite?.message}>
                        <Label htmlFor="specialite">Specialization</Label>
                        <Input
                          id="specialite"
                          disabled={isFormDisabled}
                          {...form.register('specialite')}
                        />
                      </FieldError>
                    </div>

                    <FieldError message={form.formState.errors.historiquePostes?.message}>
                      <Label htmlFor="historiquePostes">Career History</Label>
                      <Textarea
                        id="historiquePostes"
                        rows={5}
                        disabled={isFormDisabled}
                        {...form.register('historiquePostes')}
                      />
                    </FieldError>

                    <Separator />

                    <div className="space-y-1">
                      <h3 className="text-sm font-semibold text-slate-900">Administrative Information</h3>
                      <p className="text-xs text-muted-foreground">
                        Sensitive data used for HR administration and future payroll workflows.
                      </p>
                    </div>

                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                      This section contains sensitive administrative data. Limit access to HR administrators.
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
                          disabled={isFormDisabled}
                          {...form.register('numeroSecuriteSociale')}
                        />
                        <p className="text-xs text-muted-foreground">
                          Sensitive administrative identifier.
                        </p>
                      </FieldError>
                    </div>

                    <FieldError message={form.formState.errors.adresse?.message}>
                      <Label htmlFor="adresse">Address</Label>
                      <Textarea
                        id="adresse"
                        rows={3}
                        disabled={isFormDisabled}
                        {...form.register('adresse')}
                      />
                    </FieldError>

                    <Separator />

                    <div className="space-y-1">
                      <h3 className="text-sm font-semibold text-slate-900">HR Internal Notes</h3>
                      <p className="text-xs text-muted-foreground">
                        Internal comments visible only to HR administrators.
                      </p>
                    </div>

                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                      This note field is restricted to administration and should not contain content intended for employees.
                    </div>

                    <FieldError message={form.formState.errors.observations?.message}>
                      <Label htmlFor="observations">Internal Notes</Label>
                      <Textarea
                        id="observations"
                        rows={5}
                        disabled={isFormDisabled}
                        {...form.register('observations')}
                      />
                    </FieldError>

                    <Separator />

                    <div className="grid gap-4 md:grid-cols-2">

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
                        <Label htmlFor="telephone">Phone</Label>
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
                          Format : +213 suivi de 5, 6 ou 7 puis de 8 chiffres.
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
                        {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
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
