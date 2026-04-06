import {
  BriefcaseBusiness,
  Building2,
  ChevronLeft,
  FileText,
  IdCard,
  type LucideIcon,
  Mail,
  Phone,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'

import { EmptyState, ErrorState, PageStateSkeleton } from '@/components/common/page-state'
import { PageHeader, SURFACE_CARD_CLASS_NAME } from '@/components/common/page-header'
import { StatusBadge } from '@/components/common/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ROUTES, getPayrollEmployeeSheetRoute } from '@/constants/routes'
import { useAuth } from '@/hooks/use-auth'
import { useI18n } from '@/hooks/use-i18n'
import { PayrollLayout } from '@/layouts/payroll-layout'
import { cn } from '@/lib/utils'
import { usePayrollEmployeeQuery } from '@/services/payrollEmployeesService'
import {
  getEmployeeCategorieProfessionnelleLabel,
  getEmployeeNationaliteLabel,
  getEmployeePosteLabel,
  getEmployeeRegionalBranchLabel,
  getEmployeeSexeLabel,
  getEmployeeSituationFamilialeLabel,
  getEmployeeTypeContratLabel,
} from '@/types/employee'

const EMPTY_FIELD_VALUE = '\u2014'

function formatTextValue(value: string | null | undefined): string {
  const normalized = value?.trim()
  return normalized && normalized.length > 0 ? normalized : EMPTY_FIELD_VALUE
}

function formatDateValue(value: string | null | undefined, locale: string): string {
  if (!value) {
    return EMPTY_FIELD_VALUE
  }

  return new Date(`${value}T00:00:00`).toLocaleDateString(locale)
}

function formatNumberValue(value: number | null | undefined): string {
  return value === null || value === undefined ? EMPTY_FIELD_VALUE : String(value)
}

function getInitials(prenom: string, nom: string): string {
  return `${prenom.trim().charAt(0)}${nom.trim().charAt(0)}`.toUpperCase() || 'NA'
}

interface DetailRowProps {
  label: string
  value: string
  mono?: boolean
}

function DetailRow({ label, value, mono = false }: DetailRowProps) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white px-3 py-2.5">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-sm font-medium text-slate-900 ${mono ? 'font-mono' : ''}`}>
        {value}
      </p>
    </div>
  )
}

interface DetailSectionCardProps {
  title: string
  description?: string
  icon: LucideIcon
  children: ReactNode
}

function DetailSectionCard({
  title,
  description,
  icon: Icon,
  children,
}: DetailSectionCardProps) {
  return (
    <Card className={SURFACE_CARD_CLASS_NAME}>
      <CardHeader className="space-y-2">
        <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-950">
          <Icon className="h-4 w-4 text-slate-600" />
          {title}
        </CardTitle>
        {description ? <p className="text-sm leading-6 text-slate-600">{description}</p> : null}
      </CardHeader>
      <CardContent className="space-y-2">{children}</CardContent>
    </Card>
  )
}

export function PayrollEmployeeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { signOut, user } = useAuth()
  const { isRTL, locale, t } = useI18n()
  const employeeQuery = usePayrollEmployeeQuery(id)

  if (employeeQuery.isPending) {
    return (
      <PayrollLayout
        title={t('payroll.employeeDetail.title')}
        subtitle={t('payroll.employeeDetail.subtitle')}
        onSignOut={signOut}
        userEmail={user?.email ?? null}
      >
        <PageStateSkeleton variant="detail" />
      </PayrollLayout>
    )
  }

  if (employeeQuery.isError) {
    return (
      <PayrollLayout
        title={t('payroll.employeeDetail.title')}
        subtitle={t('payroll.employeeDetail.subtitle')}
        onSignOut={signOut}
        userEmail={user?.email ?? null}
      >
        <ErrorState
          title={t('payroll.employeeDetail.loadErrorTitle')}
          description={t('payroll.employeeDetail.loadErrorDescription')}
          message={employeeQuery.error.message}
          onRetry={() => void employeeQuery.refetch()}
        />
      </PayrollLayout>
    )
  }

  if (!employeeQuery.data) {
    return (
      <PayrollLayout
        title={t('payroll.employeeDetail.title')}
        subtitle={t('payroll.employeeDetail.subtitle')}
        onSignOut={signOut}
        userEmail={user?.email ?? null}
      >
        <EmptyState
          title={t('payroll.employeeDetail.emptyTitle')}
          description={t('payroll.employeeDetail.emptyDescription')}
          actions={
            <Button asChild variant="outline">
              <Link to={ROUTES.PAYROLL_EMPLOYEES}>
                <ChevronLeft className={cn('h-4 w-4', isRTL ? 'ml-2 rotate-180' : 'mr-2')} />
                {t('payroll.employeeDetail.backToEmployees')}
              </Link>
            </Button>
          }
        />
      </PayrollLayout>
    )
  }

  const employee = employeeQuery.data
  const fullName = `${employee.prenom} ${employee.nom}`

  return (
    <PayrollLayout
      title={t('payroll.employeeDetail.title')}
      subtitle={t('payroll.employeeDetail.subtitle')}
      onSignOut={signOut}
      userEmail={user?.email ?? null}
    >
      <PageHeader
        title={fullName}
        description={t('payroll.employeeDetail.headerDescription')}
        className="mb-6"
        backAction={
          <Button asChild variant="outline" size="sm">
            <Link to={ROUTES.PAYROLL_EMPLOYEES}>
              <ChevronLeft className={cn('h-4 w-4', isRTL ? 'ml-2 rotate-180' : 'mr-2')} />
              {t('payroll.employeeDetail.backToEmployees')}
            </Link>
          </Button>
        }
        badges={
          <>
            <StatusBadge tone={employee.isActive ? 'success' : 'neutral'}>
              {employee.isActive ? t('status.common.active') : t('status.common.inactive')}
            </StatusBadge>
            <StatusBadge tone="neutral" emphasis="outline">
              {t('payroll.employeeDirectory.readOnlyBadge')}
            </StatusBadge>
          </>
        }
        actions={
          <Button asChild variant="outline">
            <Link to={getPayrollEmployeeSheetRoute(employee.id)}>
              <FileText className={cn('h-4 w-4', isRTL ? 'ml-2' : 'mr-2')} />
              {t('payroll.employeeDetail.informationSheetAction')}
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[320px,1fr]">
        <Card className={SURFACE_CARD_CLASS_NAME}>
          <CardHeader className="space-y-4">
            <div className="h-1.5 w-20 rounded-full bg-gradient-to-br from-[#ff6b35] to-[#ffc947]" />
            <div className="flex flex-col items-center text-center">
              <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 text-2xl font-semibold text-slate-600">
                {employee.photoUrl ? (
                  <img
                    src={employee.photoUrl}
                    alt={fullName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span>{getInitials(employee.prenom, employee.nom)}</span>
                )}
              </div>
              <h2 className="mt-4 text-xl font-semibold text-slate-950">{fullName}</h2>
              <p className="text-sm text-slate-500">
                {formatTextValue(getEmployeePosteLabel(employee.poste))}
              </p>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                <StatusBadge tone="brand">
                  <Building2 className={cn('h-3.5 w-3.5', isRTL ? 'ml-1.5' : 'mr-1.5')} />
                  {formatTextValue(employee.departementNom)}
                </StatusBadge>
                {employee.regionalBranch ? (
                  <StatusBadge tone="neutral" emphasis="outline">
                    {getEmployeeRegionalBranchLabel(employee.regionalBranch)}
                  </StatusBadge>
                ) : null}
                <StatusBadge tone="info" emphasis="outline">
                  <IdCard className={cn('h-3.5 w-3.5', isRTL ? 'ml-1.5' : 'mr-1.5')} />
                  {employee.matricule}
                </StatusBadge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2 rounded-xl border border-slate-200/80 bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                {t('payroll.employeeDetail.payrollSummaryTitle')}
              </p>
              <div className="space-y-2">
                <div className="flex items-start gap-2 text-sm text-slate-700">
                  <Mail className="mt-0.5 h-4 w-4 text-slate-500" />
                  <span className="break-all">{formatTextValue(employee.email)}</span>
                </div>
                <div className="flex items-start gap-2 text-sm text-slate-700">
                  <Phone className="mt-0.5 h-4 w-4 text-slate-500" />
                  <span>{formatTextValue(employee.telephone)}</span>
                </div>
                <div className="flex items-start gap-2 text-sm text-slate-700">
                  <BriefcaseBusiness className="mt-0.5 h-4 w-4 text-slate-500" />
                  <span>{formatTextValue(getEmployeeTypeContratLabel(employee.typeContrat))}</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm leading-6 text-amber-900">
              {t('payroll.employeeDetail.restrictedWarning')}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          <DetailSectionCard
            title={t('payroll.employeeDetail.sections.identity.title')}
            description={t('payroll.employeeDetail.sections.identity.description')}
            icon={UserRound}
          >
            <DetailRow label={t('employee.profile.fields.fullName')} value={fullName} />
            <DetailRow
              label={t('employee.profile.fields.sex')}
              value={formatTextValue(getEmployeeSexeLabel(employee.sexe))}
            />
            <DetailRow
              label={t('employee.profile.fields.birthDate')}
              value={formatDateValue(employee.dateNaissance, locale)}
            />
            <DetailRow
              label={t('employee.profile.fields.birthPlace')}
              value={formatTextValue(employee.lieuNaissance)}
            />
            <DetailRow
              label={t('employee.profile.fields.nationality')}
              value={formatTextValue(getEmployeeNationaliteLabel(employee.nationalite))}
            />
            <DetailRow label={t('common.email')} value={formatTextValue(employee.email)} />
            <DetailRow label={t('employee.profile.fields.phone')} value={formatTextValue(employee.telephone)} />
          </DetailSectionCard>

          <DetailSectionCard
            title={t('payroll.employeeDetail.sections.employment.title')}
            description={t('payroll.employeeDetail.sections.employment.description')}
            icon={BriefcaseBusiness}
          >
            <DetailRow label={t('employee.profile.fields.employeeId')} value={employee.matricule} mono />
            <DetailRow label={t('employee.profile.fields.department')} value={formatTextValue(employee.departementNom)} />
            <DetailRow
              label={t('employee.profile.fields.regionalBranch')}
              value={formatTextValue(getEmployeeRegionalBranchLabel(employee.regionalBranch))}
            />
            <DetailRow
              label={t('employee.profile.fields.jobTitle')}
              value={formatTextValue(getEmployeePosteLabel(employee.poste))}
            />
            <DetailRow
              label={t('employee.profile.fields.professionalCategory')}
              value={formatTextValue(
                getEmployeeCategorieProfessionnelleLabel(employee.categorieProfessionnelle),
              )}
            />
            <DetailRow
              label={t('employee.profile.fields.contractType')}
              value={formatTextValue(getEmployeeTypeContratLabel(employee.typeContrat))}
            />
            <DetailRow
              label={t('employee.profile.fields.hireDate')}
              value={formatDateValue(employee.dateRecrutement, locale)}
            />
            <DetailRow
              label={t('common.status')}
              value={employee.isActive ? t('status.common.active') : t('status.common.inactive')}
            />
          </DetailSectionCard>

          <DetailSectionCard
            title={t('payroll.employeeDetail.sections.administrative.title')}
            description={t('payroll.employeeDetail.sections.administrative.description')}
            icon={Mail}
          >
            <DetailRow label={t('common.email')} value={formatTextValue(employee.email)} />
            <DetailRow label={t('employee.profile.fields.phone')} value={formatTextValue(employee.telephone)} />
            <DetailRow label={t('employee.profile.fields.address')} value={formatTextValue(employee.adresse)} />
          </DetailSectionCard>

          <DetailSectionCard
            title={t('payroll.employeeDetail.sections.family.title')}
            description={t('payroll.employeeDetail.sections.family.description')}
            icon={ShieldCheck}
          >
            <DetailRow
              label={t('employee.profile.fields.maritalStatus')}
              value={formatTextValue(
                getEmployeeSituationFamilialeLabel(employee.situationFamiliale),
              )}
            />
            <DetailRow
              label={t('employee.profile.fields.children')}
              value={formatNumberValue(employee.nombreEnfants)}
            />
            <DetailRow
              label={t('employee.profile.fields.socialSecurityNumber')}
              value={formatTextValue(employee.numeroSecuriteSociale)}
              mono
            />
          </DetailSectionCard>
        </div>
      </div>
    </PayrollLayout>
  )
}
