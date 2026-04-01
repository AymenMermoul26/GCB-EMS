import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  ExternalLink,
  IdCard,
  Mail,
  Phone,
  QrCode,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'

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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { getPublicProfileRoute, ROUTES } from '@/constants/routes'
import { useAuth } from '@/hooks/use-auth'
import { useI18n } from '@/hooks/use-i18n'
import { useRole } from '@/hooks/use-role'
import { DashboardLayout } from '@/layouts/dashboard-layout'
import { cn } from '@/lib/utils'
import { useDepartmentsQuery } from '@/services/departmentsService'
import { useEmployeeQuery } from '@/services/employeesService'
import { useMyActiveTokenQuery } from '@/services/qrService'
import { getDepartmentDisplayName } from '@/types/department'
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
  type Employee,
} from '@/types/employee'
import type { TokenQR } from '@/types/token'

const EMPTY_FIELD_VALUE = '\u2014'

function getInitials(prenom: string, nom: string) {
  return `${prenom.trim().charAt(0)}${nom.trim().charAt(0)}`.toUpperCase() || 'EM'
}

function formatDate(value: string, locale: string): string {
  return new Date(value).toLocaleDateString(locale)
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

function isTokenValid(token: TokenQR | null): boolean {
  if (!token || token.statutToken !== 'ACTIF') {
    return false
  }

  if (!token.expiresAt) {
    return true
  }

  return new Date(token.expiresAt).getTime() > Date.now()
}

function computeCompleteness(employee: Employee): number {
  const weightedFields: Array<string | null> = [
    employee.photoUrl,
    employee.email,
    employee.telephone,
    employee.poste,
  ]

  const filled = weightedFields.filter((value) => Boolean(value?.trim())).length
  return filled * 25
}

interface DetailRowProps {
  label: string
  value: string
}

function DetailRow({ label, value }: DetailRowProps) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white px-3 py-2.5">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-900">{value}</p>
    </div>
  )
}

export function EmployeeProfilePage() {
  const { employeId } = useRole()
  const { user, signOut, mustChangePassword } = useAuth()
  const { t, locale, isRTL } = useI18n()

  const employeeQuery = useEmployeeQuery(employeId)
  const departmentsQuery = useDepartmentsQuery()
  const tokenQuery = useMyActiveTokenQuery(employeId)

  const departmentName = useMemo(() => {
    const employeeData = employeeQuery.data
    if (!employeeData || !departmentsQuery.data) {
      return null
    }

    return (
      getDepartmentDisplayName(
        departmentsQuery.data.find((department) => department.id === employeeData.departementId)
          ?.nom,
      ) ?? null
    )
  }, [departmentsQuery.data, employeeQuery.data])

  const currentToken = tokenQuery.data ?? null
  const hasValidPublicToken = isTokenValid(currentToken)

  const publicProfileUrl = useMemo(() => {
    if (!currentToken || !hasValidPublicToken) {
      return null
    }

    return `${window.location.origin}${getPublicProfileRoute(currentToken.token)}`
  }, [currentToken, hasValidPublicToken])

  const requestChangesRoute = `${ROUTES.EMPLOYEE_PROFILE_MANAGE}#requests`
  const securityRoute = ROUTES.EMPLOYEE_SECURITY
  const myQrRoute = ROUTES.EMPLOYEE_MY_QR

  const handlePreviewPublicProfile = () => {
    if (!publicProfileUrl) {
      return
    }

    window.open(publicProfileUrl, '_blank', 'noopener,noreferrer')
  }

  if (employeeQuery.isPending) {
    return (
      <DashboardLayout
        title={t('employee.profile.title')}
        subtitle={t('employee.profile.subtitle')}
      >
        <PageStateSkeleton variant="detail" />
      </DashboardLayout>
    )
  }

  if (employeeQuery.isError) {
    return (
      <DashboardLayout
        title={t('employee.profile.title')}
        subtitle={t('employee.profile.subtitle')}
      >
        <ErrorState
          title={t('employee.profile.loadErrorTitle')}
          description={t('employee.profile.loadErrorDescription')}
          message={employeeQuery.error.message}
          onRetry={() => void employeeQuery.refetch()}
        />
      </DashboardLayout>
    )
  }

  if (!employeeQuery.data) {
    return (
      <DashboardLayout
        title={t('employee.profile.title')}
        subtitle={t('employee.profile.subtitle')}
      >
        <EmptyState
          title={t('employee.profile.emptyTitle')}
          description={t('employee.profile.emptyDescription')}
          actions={
            <Button variant="outline" onClick={() => void signOut()}>
              {t('common.logout')}
            </Button>
          }
        />
      </DashboardLayout>
    )
  }

  const employee = employeeQuery.data
  const fullName = `${employee.prenom} ${employee.nom}`
  const completeness = computeCompleteness(employee)

  return (
    <DashboardLayout
      title={t('employee.profile.title')}
      subtitle={t('employee.profile.subtitle')}
    >
      {mustChangePassword ? (
        <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {t('employee.profile.passwordWarning')}
        </div>
      ) : null}

      <PageHeader
        title={t('employee.profile.overviewTitle')}
        description={t('employee.profile.overviewDescription')}
        className="mb-5"
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={handlePreviewPublicProfile}
              disabled={!publicProfileUrl}
            >
              <ExternalLink className={cn('h-4 w-4', isRTL ? 'ml-2' : 'mr-2')} />
              {t('actions.previewPublicProfile')}
            </Button>
            <Button asChild className={BRAND_BUTTON_CLASS_NAME}>
              <Link to={requestChangesRoute}>
                {t('actions.requestChange')}
                <ArrowRight
                  className={cn('h-4 w-4', isRTL ? 'mr-2 rotate-180' : 'ml-2')}
                />
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[320px,1fr]">
        <Card className={SURFACE_CARD_CLASS_NAME}>
          <CardHeader className="space-y-4">
            <div className="h-1.5 w-20 rounded-full bg-gradient-to-br from-[#ff6b35] to-[#ffc947]" />
            <div className="flex flex-col items-center text-center">
              <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                {employee.photoUrl ? (
                  <img
                    src={employee.photoUrl}
                    alt={fullName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-2xl font-semibold text-slate-600">
                    {getInitials(employee.prenom, employee.nom)}
                  </span>
                )}
              </div>
              <h3 className="mt-4 text-xl font-semibold text-slate-900">{fullName}</h3>
              <p className="text-sm text-slate-500">
                {getEmployeePosteLabel(employee.poste) ?? t('common.notSet')}
              </p>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                <Badge variant="secondary" className="gap-1 bg-slate-100 text-slate-700">
                  <Building2 className="h-3.5 w-3.5" />
                  {departmentName ?? t('common.notSet')}
                </Badge>
                <StatusBadge
                  tone={employee.isActive ? 'success' : 'neutral'}
                  emphasis={employee.isActive ? 'outline' : 'soft'}
                >
                  {employee.isActive
                    ? t('status.common.active')
                    : t('status.common.inactive')}
                </StatusBadge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-xl border border-slate-200/80 bg-slate-50 px-3 py-2">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                {t('employee.profile.fields.employeeId')}
              </p>
              <p className="mt-1 font-mono text-sm font-semibold text-slate-900">
                ID: {employee.matricule}
              </p>
            </div>

            <div className="space-y-2 rounded-xl border border-slate-200/80 bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                {t('employee.profile.fields.accountEmail')}
              </p>
              <div className="flex items-start gap-2 text-sm text-slate-700">
                <Mail className="mt-0.5 h-4 w-4 text-slate-500" />
                <span className="break-all">{employee.email ?? t('common.notProvided')}</span>
              </div>
              <div className="flex items-start gap-2 text-sm text-slate-700">
                <Phone className="mt-0.5 h-4 w-4 text-slate-500" />
                <span>{employee.telephone ?? t('common.notProvided')}</span>
              </div>
            </div>

            <div className="space-y-2 rounded-xl border border-slate-200/80 bg-slate-50 p-3">
              <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-500">
                <span>{t('employee.profile.profileCompleteness')}</span>
                <span>{completeness}%</span>
              </div>
              <Progress value={completeness} />
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className={SURFACE_CARD_CLASS_NAME}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <UserRound className="h-4 w-4 text-slate-600" />
                {t('employee.profile.sections.personal')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <DetailRow label={t('employee.profile.fields.fullName')} value={fullName} />
              <DetailRow
                label={t('employee.profile.fields.sex')}
                value={formatProfileValue(getEmployeeSexeLabel(employee.sexe), t('common.notSet'))}
              />
              <DetailRow
                label={t('employee.profile.fields.birthDate')}
                value={formatProfileDate(employee.dateNaissance, locale)}
              />
              <DetailRow
                label={t('employee.profile.fields.birthPlace')}
                value={formatProfileValue(employee.lieuNaissance, t('common.notProvided'))}
              />
              <DetailRow
                label={t('employee.profile.fields.nationality')}
                value={formatProfileValue(
                  getEmployeeNationaliteLabel(employee.nationalite),
                  t('common.notProvided'),
                )}
              />
              <DetailRow
                label={t('common.email')}
                value={employee.email ?? t('common.notProvided')}
              />
              <DetailRow
                label={t('employee.profile.fields.phone')}
                value={employee.telephone ?? t('common.notProvided')}
              />
            </CardContent>
          </Card>

          <Card className={SURFACE_CARD_CLASS_NAME}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-4 w-4 text-slate-600" />
                {t('employee.profile.sections.administrative')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <DetailRow
                label={t('employee.profile.fields.maritalStatus')}
                value={formatProfileValue(
                  getEmployeeSituationFamilialeLabel(employee.situationFamiliale),
                  t('common.notProvided'),
                )}
              />
              <DetailRow
                label={t('employee.profile.fields.children')}
                value={formatProfileNumber(employee.nombreEnfants)}
              />
              <DetailRow
                label={t('employee.profile.fields.address')}
                value={formatProfileValue(employee.adresse, t('common.notProvided'))}
              />
            </CardContent>
          </Card>

          <Card className={SURFACE_CARD_CLASS_NAME}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BriefcaseBusiness className="h-4 w-4 text-slate-600" />
                {t('employee.profile.sections.education')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <DetailRow
                label={t('employee.profile.fields.degree')}
                value={formatProfileValue(
                  getEmployeeDiplomeLabel(employee.diplome),
                  t('common.notProvided'),
                )}
              />
              <DetailRow
                label={t('employee.profile.fields.specialization')}
                value={formatProfileValue(
                  getEmployeeSpecialiteLabel(employee.specialite),
                  t('common.notProvided'),
                )}
              />
              <DetailRow
                label={t('employee.profile.fields.university')}
                value={formatProfileValue(
                  getEmployeeUniversiteLabel(employee.universite),
                  t('common.notProvided'),
                )}
              />
              <div className="rounded-xl border border-slate-200/80 bg-white px-3 py-2.5">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  {t('employee.profile.fields.careerHistory')}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm font-medium text-slate-900">
                  {formatProfileValue(employee.historiquePostes, t('common.notProvided'))}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className={SURFACE_CARD_CLASS_NAME}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BriefcaseBusiness className="h-4 w-4 text-slate-600" />
                {t('employee.profile.sections.employment')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <DetailRow
                label={t('employee.profile.fields.jobTitle')}
                value={getEmployeePosteLabel(employee.poste) ?? t('common.notProvided')}
              />
              <DetailRow
                label={t('employee.profile.fields.department')}
                value={departmentName ?? t('common.notAssigned')}
              />
              <DetailRow
                label={t('employee.profile.fields.regionalBranch')}
                value={formatProfileValue(
                  getEmployeeRegionalBranchLabel(employee.regionalBranch),
                  t('common.notAssigned'),
                )}
              />
              <DetailRow label={t('employee.profile.fields.employeeId')} value={employee.matricule} />
              <DetailRow
                label={t('employee.profile.fields.professionalCategory')}
                value={formatProfileValue(
                  getEmployeeCategorieProfessionnelleLabel(employee.categorieProfessionnelle),
                  t('common.notAssigned'),
                )}
              />
              <DetailRow
                label={t('employee.profile.fields.contractType')}
                value={formatProfileValue(
                  getEmployeeTypeContratLabel(employee.typeContrat),
                  t('common.notAssigned'),
                )}
              />
              <DetailRow
                label={t('employee.profile.fields.hireDate')}
                value={formatProfileDate(employee.dateRecrutement, locale)}
              />
              <DetailRow
                label={t('employee.profile.fields.updatedAt')}
                value={formatDate(employee.updatedAt, locale)}
              />
            </CardContent>
          </Card>

          <Card className={SURFACE_CARD_CLASS_NAME}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-4 w-4 text-slate-600" />
                {t('employee.profile.sections.account')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <DetailRow
                label={t('employee.profile.fields.accountEmail')}
                value={user?.email ?? employee.email ?? t('common.notAvailable')}
              />
              <DetailRow
                label={t('employee.profile.fields.role')}
                value={t('employee.profile.roleValue')}
              />
              <Button asChild variant="outline" className="w-full">
                <Link to={securityRoute}>{t('actions.changePassword')}</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-slate-200/80 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <QrCode className="h-4 w-4 text-slate-600" />
                {t('employee.profile.sections.qr')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-slate-600">{t('employee.profile.qrDescription')}</p>
              <div className="flex items-center gap-2">
                <StatusBadge
                  tone={hasValidPublicToken ? 'success' : 'warning'}
                  emphasis="outline"
                >
                  {hasValidPublicToken
                    ? t('employee.profile.publicLinkActive')
                    : t('employee.profile.publicLinkUnavailable')}
                </StatusBadge>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePreviewPublicProfile}
                  disabled={!publicProfileUrl}
                >
                  {t('actions.previewPublicProfile')}
                </Button>
                <Button asChild variant="outline">
                  <Link to={myQrRoute}>
                    {t('actions.openMyQr')}
                    <IdCard className={cn('h-4 w-4', isRTL ? 'mr-2' : 'ml-2')} />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}
