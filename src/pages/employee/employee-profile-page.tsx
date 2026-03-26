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
import { useRole } from '@/hooks/use-role'
import { DashboardLayout } from '@/layouts/dashboard-layout'
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

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString()
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
      <DashboardLayout title="My Profile" subtitle="Review your verified employee information.">
        <PageStateSkeleton variant="detail" />
      </DashboardLayout>
    )
  }

  if (employeeQuery.isError) {
    return (
      <DashboardLayout title="My Profile" subtitle="Review your verified employee information.">
        <ErrorState
          title="Could not load profile"
          description="We couldn't load your employee profile right now."
          message={employeeQuery.error.message}
          onRetry={() => void employeeQuery.refetch()}
        />
      </DashboardLayout>
    )
  }

  if (!employeeQuery.data) {
    return (
      <DashboardLayout title="My Profile" subtitle="Review your verified employee information.">
        <EmptyState
          title="Profile unavailable"
          description="Your employee profile is not linked yet. Contact HR support."
          actions={
            <Button variant="outline" onClick={() => void signOut()}>
              Sign out
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
    <DashboardLayout title="My Profile" subtitle="Review your verified employee information.">
      {mustChangePassword ? (
        <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          You must change your password before using the application.
        </div>
      ) : null}

      <PageHeader
        title="Profile Overview"
        description="Keep your information up to date through the profile management workflow."
        className="mb-5"
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={handlePreviewPublicProfile}
              disabled={!publicProfileUrl}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Preview Public Profile
            </Button>
            <Button asChild className={BRAND_BUTTON_CLASS_NAME}>
              <Link to={requestChangesRoute}>
                Request a Change
                <ArrowRight className="ml-2 h-4 w-4" />
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
                {getEmployeePosteLabel(employee.poste) ?? 'Job title not set'}
              </p>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                <Badge variant="secondary" className="gap-1 bg-slate-100 text-slate-700">
                  <Building2 className="h-3.5 w-3.5" />
                  {departmentName ?? 'Department not set'}
                </Badge>
                <StatusBadge
                  tone={employee.isActive ? 'success' : 'neutral'}
                  emphasis={employee.isActive ? 'outline' : 'soft'}
                >
                  {employee.isActive ? 'Active' : 'Inactive'}
                </StatusBadge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-xl border border-slate-200/80 bg-slate-50 px-3 py-2">
              <p className="text-xs uppercase tracking-wide text-slate-500">Employee ID</p>
              <p className="mt-1 font-mono text-sm font-semibold text-slate-900">
                ID: {employee.matricule}
              </p>
            </div>

            <div className="space-y-2 rounded-xl border border-slate-200/80 bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Contact</p>
              <div className="flex items-start gap-2 text-sm text-slate-700">
                <Mail className="mt-0.5 h-4 w-4 text-slate-500" />
                <span className="break-all">{employee.email ?? 'Not provided'}</span>
              </div>
              <div className="flex items-start gap-2 text-sm text-slate-700">
                <Phone className="mt-0.5 h-4 w-4 text-slate-500" />
                <span>{employee.telephone ?? 'Not provided'}</span>
              </div>
            </div>

            <div className="space-y-2 rounded-xl border border-slate-200/80 bg-slate-50 p-3">
              <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-500">
                <span>Profile completeness</span>
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
                Personal Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <DetailRow label="Full Name" value={fullName} />
              <DetailRow
                label="Sex"
                value={formatProfileValue(getEmployeeSexeLabel(employee.sexe))}
              />
              <DetailRow label="Birth Date" value={formatProfileDate(employee.dateNaissance)} />
              <DetailRow label="Birth Place" value={formatProfileValue(employee.lieuNaissance)} />
              <DetailRow
                label="Nationality"
                value={formatProfileValue(getEmployeeNationaliteLabel(employee.nationalite))}
              />
              <DetailRow label="Email" value={employee.email ?? 'Not provided'} />
              <DetailRow label="Phone" value={employee.telephone ?? 'Not provided'} />
            </CardContent>
          </Card>

          <Card className={SURFACE_CARD_CLASS_NAME}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-4 w-4 text-slate-600" />
                Administrative Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <DetailRow
                label="Marital Status"
                value={formatProfileValue(
                  getEmployeeSituationFamilialeLabel(employee.situationFamiliale),
                )}
              />
              <DetailRow
                label="Number of Children"
                value={formatProfileNumber(employee.nombreEnfants)}
              />
              <DetailRow label="Address" value={formatProfileValue(employee.adresse)} />
            </CardContent>
          </Card>

          <Card className={SURFACE_CARD_CLASS_NAME}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BriefcaseBusiness className="h-4 w-4 text-slate-600" />
                Education & Career Background
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <DetailRow
                label="Degree"
                value={formatProfileValue(getEmployeeDiplomeLabel(employee.diplome))}
              />
              <DetailRow
                label="Specialization"
                value={formatProfileValue(getEmployeeSpecialiteLabel(employee.specialite))}
              />
              <DetailRow
                label="University"
                value={formatProfileValue(getEmployeeUniversiteLabel(employee.universite))}
              />
              <div className="rounded-xl border border-slate-200/80 bg-white px-3 py-2.5">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Career History
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm font-medium text-slate-900">
                  {formatProfileValue(employee.historiquePostes)}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className={SURFACE_CARD_CLASS_NAME}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BriefcaseBusiness className="h-4 w-4 text-slate-600" />
                Employment Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <DetailRow
                label="Job Title"
                value={getEmployeePosteLabel(employee.poste) ?? 'Not provided'}
              />
              <DetailRow label="Department" value={departmentName ?? 'Not assigned'} />
              <DetailRow
                label="Regional Branch"
                value={formatProfileValue(getEmployeeRegionalBranchLabel(employee.regionalBranch))}
              />
              <DetailRow label="Employee ID" value={employee.matricule} />
              <DetailRow
                label="Professional Category"
                value={formatProfileValue(
                  getEmployeeCategorieProfessionnelleLabel(employee.categorieProfessionnelle),
                )}
              />
              <DetailRow
                label="Contract Type"
                value={formatProfileValue(getEmployeeTypeContratLabel(employee.typeContrat))}
              />
              <DetailRow
                label="Hire Date"
                value={formatProfileDate(employee.dateRecrutement)}
              />
              <DetailRow label="Profile updated" value={formatDate(employee.updatedAt)} />
            </CardContent>
          </Card>

          <Card className={SURFACE_CARD_CLASS_NAME}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-4 w-4 text-slate-600" />
                Account & Security
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <DetailRow label="Account Email" value={user?.email ?? employee.email ?? 'Not available'} />
              <DetailRow label="Role" value="Employee" />
              <Button asChild variant="outline" className="w-full">
                <Link to={securityRoute}>Change Password</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-slate-200/80 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <QrCode className="h-4 w-4 text-slate-600" />
                QR & Public Visibility
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-slate-600">
                Your public profile is available through your QR token and HR visibility settings.
              </p>
              <div className="flex items-center gap-2">
                <StatusBadge
                  tone={hasValidPublicToken ? 'success' : 'warning'}
                  emphasis="outline"
                >
                  {hasValidPublicToken ? 'Public link active' : 'Public link unavailable'}
                </StatusBadge>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePreviewPublicProfile}
                  disabled={!publicProfileUrl}
                >
                  Preview Public Profile
                </Button>
                <Button asChild variant="outline">
                  <Link to={myQrRoute}>
                    Open My QR
                    <IdCard className="ml-2 h-4 w-4" />
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
