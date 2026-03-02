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

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { getPublicProfileRoute, ROUTES } from '@/constants/routes'
import { useAuth } from '@/hooks/use-auth'
import { useRole } from '@/hooks/use-role'
import { DashboardLayout } from '@/layouts/dashboard-layout'
import { useDepartmentsQuery } from '@/services/departmentsService'
import { useEmployeeQuery } from '@/services/employeesService'
import { useMyActiveTokenQuery } from '@/services/qrService'
import type { Employee } from '@/types/employee'
import type { TokenQR } from '@/types/token'

function getInitials(prenom: string, nom: string) {
  return `${prenom.trim().charAt(0)}${nom.trim().charAt(0)}`.toUpperCase() || 'EM'
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString()
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
      departmentsQuery.data.find((department) => department.id === employeeData.departementId)?.nom ??
      null
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
  const securityRoute = `${ROUTES.EMPLOYEE_PROFILE_MANAGE}#security`
  const myQrRoute = `${ROUTES.EMPLOYEE_PROFILE_MANAGE}#my-qr`

  const handlePreviewPublicProfile = () => {
    if (!publicProfileUrl) {
      return
    }

    window.open(publicProfileUrl, '_blank', 'noopener,noreferrer')
  }

  if (employeeQuery.isPending) {
    return (
      <DashboardLayout title="My Profile" subtitle="View your verified employee information.">
        <div className="space-y-4">
          <Skeleton className="h-16 w-full rounded-2xl" />
          <div className="grid gap-4 lg:grid-cols-[320px,1fr]">
            <Skeleton className="h-[420px] w-full rounded-2xl" />
            <div className="grid gap-4 md:grid-cols-2">
              <Skeleton className="h-48 w-full rounded-2xl" />
              <Skeleton className="h-48 w-full rounded-2xl" />
              <Skeleton className="h-48 w-full rounded-2xl" />
              <Skeleton className="h-48 w-full rounded-2xl" />
            </div>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (employeeQuery.isError) {
    return (
      <DashboardLayout title="My Profile" subtitle="View your verified employee information.">
        <Alert variant="destructive">
          <AlertTitle>Failed to load profile</AlertTitle>
          <AlertDescription className="mt-2 flex flex-wrap items-center gap-3">
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
      <DashboardLayout title="My Profile" subtitle="View your verified employee information.">
        <Card className="rounded-2xl border-slate-200/80 shadow-sm">
          <CardHeader>
            <CardTitle>Profile not available</CardTitle>
            <CardDescription>Your employee profile is not linked yet. Contact HR support.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => void signOut()}>
              Logout
            </Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    )
  }

  const employee = employeeQuery.data
  const fullName = `${employee.prenom} ${employee.nom}`
  const completeness = computeCompleteness(employee)

  return (
    <DashboardLayout title="My Profile" subtitle="View your verified employee information.">
      {mustChangePassword ? (
        <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          You must change your password before using the application.
        </div>
      ) : null}

      <section className="mb-5 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-3 h-1 w-28 rounded-full bg-gradient-to-br from-[#ff6b35] to-[#ffc947]" />
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Profile Overview</h2>
            <p className="text-sm text-slate-600">
              Keep your information up to date using the profile management workflow.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handlePreviewPublicProfile}
              disabled={!publicProfileUrl}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Preview Public Profile
            </Button>
            <Button
              asChild
              className="border-0 bg-gradient-to-br from-[#ff6b35] to-[#ffc947] text-white shadow-sm hover:shadow-md"
            >
              <Link to={requestChangesRoute}>
                Request Changes
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[320px,1fr]">
        <Card className="rounded-2xl border-slate-200/80 shadow-sm">
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
              <p className="text-sm text-slate-500">{employee.poste ?? 'Position not set'}</p>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                <Badge variant="secondary" className="gap-1 bg-slate-100 text-slate-700">
                  <Building2 className="h-3.5 w-3.5" />
                  {departmentName ?? 'Department not set'}
                </Badge>
                <Badge
                  variant="outline"
                  className={employee.isActive ? 'border-emerald-300 text-emerald-700' : ''}
                >
                  {employee.isActive ? 'Active' : 'Inactive'}
                </Badge>
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
          <Card className="rounded-2xl border-slate-200/80 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <UserRound className="h-4 w-4 text-slate-600" />
                Personal Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <DetailRow label="Full name" value={fullName} />
              <DetailRow label="Email" value={employee.email ?? 'Not provided'} />
              <DetailRow label="Phone" value={employee.telephone ?? 'Not provided'} />
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-slate-200/80 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BriefcaseBusiness className="h-4 w-4 text-slate-600" />
                Work Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <DetailRow label="Job title" value={employee.poste ?? 'Not set'} />
              <DetailRow label="Department" value={departmentName ?? 'Not assigned'} />
              <DetailRow label="Matricule" value={employee.matricule} />
              <DetailRow label="Profile updated" value={formatDate(employee.updatedAt)} />
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-slate-200/80 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-4 w-4 text-slate-600" />
                Account & Security
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <DetailRow label="Auth email" value={user?.email ?? employee.email ?? 'Not available'} />
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
                <Badge
                  variant="outline"
                  className={
                    hasValidPublicToken
                      ? 'border-emerald-300 text-emerald-700'
                      : 'border-amber-300 text-amber-700'
                  }
                >
                  {hasValidPublicToken ? 'Public link active' : 'Public link unavailable'}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePreviewPublicProfile}
                  disabled={!publicProfileUrl}
                >
                  Preview QR Profile
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
