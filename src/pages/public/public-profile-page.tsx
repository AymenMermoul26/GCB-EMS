import {
  BriefcaseBusiness,
  Building2,
  ChevronLeft,
  Copy,
  IdCard,
  Mail,
  Phone,
  ShieldCheck,
} from 'lucide-react'
import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import gcbLogo from '@/assets/brand/gcb-logo.svg'
import {
  EmptyState,
  ErrorState,
  PageStateSkeleton,
} from '@/components/common/page-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ROUTES } from '@/constants/routes'
import { useI18n } from '@/hooks/use-i18n'
import { cn } from '@/lib/utils'
import { usePublicProfile } from '@/hooks/use-public-profile'
import { getDepartmentDisplayName } from '@/types/department'
import {
  getEmployeeCategorieProfessionnelleLabel,
  getEmployeeDiplomeLabel,
  getEmployeePosteLabel,
  getEmployeeSpecialiteLabel,
  getEmployeeUniversiteLabel,
} from '@/types/employee'
import { PUBLIC_PROFILE_FIELD_KEYS, type PublicProfile } from '@/types/profile'
import { copyTextToClipboard } from '@/utils/clipboard'

interface InfoRow {
  label: string
  value: string
}

interface InfoSection {
  id: string
  title: string
  description: string
  rows: InfoRow[]
}

function hasText(value: string | null | undefined): boolean {
  return Boolean(value && value.trim().length > 0)
}

function formatValue(value: string | null | undefined): string {
  return hasText(value) ? (value as string).trim() : ''
}

function buildFullName(profile: PublicProfile | null, fallback: string): string {
  if (!profile) {
    return fallback
  }

  const fullName = [formatValue(profile.prenom), formatValue(profile.nom)]
    .filter(Boolean)
    .join(' ')
    .trim()

  return fullName || fallback
}

function getInitials(fullName: string): string {
  const tokens = fullName
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)

  const initials = `${tokens[0]?.charAt(0) ?? ''}${tokens[1]?.charAt(0) ?? ''}`.toUpperCase()
  return initials || 'EM'
}

function buildSections(profile: PublicProfile, t: (key: string) => string): InfoSection[] {
  const professionalRows: InfoRow[] = []
  const educationRows: InfoRow[] = []
  const identityRows: InfoRow[] = []

  if (hasText(profile.poste)) {
    professionalRows.push({
      label: t('publicProfile.fields.jobTitle'),
      value: formatValue(getEmployeePosteLabel(profile.poste)),
    })
  }

  if (hasText(profile.categorie_professionnelle)) {
    professionalRows.push({
      label: t('publicProfile.fields.professionalCategory'),
      value: formatValue(
        getEmployeeCategorieProfessionnelleLabel(profile.categorie_professionnelle),
      ),
    })
  }

  if (hasText(profile.departement)) {
    professionalRows.push({
      label: t('publicProfile.fields.department'),
      value: formatValue(getDepartmentDisplayName(profile.departement)),
    })
  }

  if (hasText(profile.diplome)) {
    educationRows.push({
      label: t('publicProfile.fields.degree'),
      value: formatValue(getEmployeeDiplomeLabel(profile.diplome)),
    })
  }

  if (hasText(profile.specialite)) {
    educationRows.push({
      label: t('publicProfile.fields.specialization'),
      value: formatValue(getEmployeeSpecialiteLabel(profile.specialite)),
    })
  }

  if (hasText(profile.universite)) {
    educationRows.push({
      label: t('publicProfile.fields.university'),
      value: formatValue(getEmployeeUniversiteLabel(profile.universite)),
    })
  }

  if (hasText(profile.matricule)) {
    identityRows.push({
      label: t('publicProfile.fields.employeeId'),
      value: formatValue(profile.matricule),
    })
  }

  return [
    {
      id: 'professional',
      title: t('publicProfile.sections.professional.title'),
      description: t('publicProfile.sections.professional.description'),
      rows: professionalRows,
    },
    {
      id: 'education',
      title: t('publicProfile.sections.education.title'),
      description: t('publicProfile.sections.education.description'),
      rows: educationRows,
    },
    {
      id: 'identity',
      title: t('publicProfile.sections.identity.title'),
      description: t('publicProfile.sections.identity.description'),
      rows: identityRows,
    },
  ].filter((section) => section.rows.length > 0)
}

function hasVisiblePublicContent(profile: PublicProfile | null): boolean {
  if (!profile) {
    return false
  }

  return PUBLIC_PROFILE_FIELD_KEYS.some((fieldKey) => hasText(profile[fieldKey]))
}

function LoadingState() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(255,201,71,0.18),transparent_30%),linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <PageStateSkeleton variant="public-profile" />
      </div>
    </main>
  )
}

function UnavailableState({
  title,
  description,
  onBack,
  primaryActionLabel,
  showLoginButton = true,
}: {
  title: string
  description: string
  onBack: () => void
  primaryActionLabel?: string
  showLoginButton?: boolean
}) {
  const { isRTL, t } = useI18n()

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(255,201,71,0.18),transparent_30%),linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <EmptyState
          className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/95 shadow-[0_22px_65px_-36px_rgba(15,23,42,0.45)]"
          icon={ShieldCheck}
          title={title}
          description={description}
          actions={
            <>
              <Button type="button" variant="outline" className="rounded-xl" onClick={onBack}>
                <ChevronLeft className={cn('h-4 w-4', isRTL && 'rotate-180')} />
                <span>{primaryActionLabel ?? t('publicProfile.goBack')}</span>
              </Button>
              {showLoginButton ? (
                <Button
                  type="button"
                  className="rounded-xl bg-gradient-to-br from-[#ff6b35] to-[#ffc947] text-white hover:brightness-95"
                  onClick={() => window.location.assign(ROUTES.LOGIN)}
                >
                  {t('publicProfile.openLogin')}
                </Button>
              ) : null}
            </>
          }
        />
      </div>
    </main>
  )
}

function ProfileSectionCard({
  section,
  isRTL,
}: {
  section: InfoSection
  isRTL: boolean
}) {
  return (
    <Card className="rounded-[28px] border border-slate-200/80 bg-white/95 shadow-[0_22px_65px_-36px_rgba(15,23,42,0.45)]">
      <CardHeader className="space-y-2 pb-3">
        <CardTitle className="text-lg font-semibold text-slate-950">{section.title}</CardTitle>
        <p className="text-sm leading-6 text-slate-600">{section.description}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {section.rows.map((row) => (
          <div
            key={`${section.id}-${row.label}`}
            className="rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3"
          >
            <div
              className={cn(
                'flex flex-col gap-1.5 sm:items-start sm:justify-between sm:gap-6',
                isRTL ? 'sm:flex-row-reverse' : 'sm:flex-row',
              )}
            >
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                {row.label}
              </p>
              <p
                className={cn(
                  'text-sm font-medium leading-6 text-slate-900',
                  isRTL ? 'sm:text-left' : 'sm:text-right',
                )}
              >
                {row.value}
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export function PublicProfilePage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { isRTL, t } = useI18n()
  const { data, isPending, isError, refetch, isFetching } = usePublicProfile(token)

  const profile = data?.profile ?? null
  const fullName = useMemo(
    () => buildFullName(profile, t('publicProfile.verifiedEmployee')),
    [profile, t],
  )
  const position = formatValue(getEmployeePosteLabel(profile?.poste))
  const professionalCategory = formatValue(
    getEmployeeCategorieProfessionnelleLabel(profile?.categorie_professionnelle),
  )
  const department = formatValue(getDepartmentDisplayName(profile?.departement))
  const employeeId = formatValue(profile?.matricule)
  const email = formatValue(profile?.email)
  const telephone = formatValue(profile?.telephone)
  const photoUrl = formatValue(profile?.photo_url)
  const sections = useMemo(
    () => (profile ? buildSections(profile, t) : []),
    [profile, t],
  )

  const handleCopyProfileLink = async () => {
    try {
      await copyTextToClipboard(window.location.href)
      toast.success(t('publicProfile.profileLinkCopied'))
    } catch {
      toast.error(t('publicProfile.profileLinkCopyError'))
    }
  }

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1)
      return
    }

    navigate(ROUTES.LOGIN)
  }

  if (isPending) {
    return <LoadingState />
  }

  if (isError) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(255,201,71,0.18),transparent_30%),linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)] px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <ErrorState
            className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/95 shadow-[0_22px_65px_-36px_rgba(15,23,42,0.45)]"
            icon={ShieldCheck}
            title={t('publicProfile.profileUnavailableTitle')}
            description={t('publicProfile.profileUnavailableLoadDescription')}
            onRetry={() => {
              void refetch()
            }}
            retryLabel={t('publicProfile.loadingRetry')}
          />
        </div>
      </main>
    )
  }

  if (data?.status === 'expired' || data?.status === 'invalid_or_revoked' || !profile) {
    return (
      <UnavailableState
        title={t('publicProfile.profileUnavailableTitle')}
        description={t('publicProfile.profileUnavailableTokenDescription')}
        onBack={handleBack}
      />
    )
  }

  if (!hasVisiblePublicContent(profile)) {
    return (
      <UnavailableState
        title={t('publicProfile.profileUnavailableTitle')}
        description={t('publicProfile.profileUnavailableNoContentDescription')}
        onBack={handleBack}
      />
    )
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(255,201,71,0.18),transparent_30%),linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/95 shadow-[0_22px_65px_-36px_rgba(15,23,42,0.45)]">
          <div className="h-1.5 w-full bg-gradient-to-br from-[#ff6b35] to-[#ffc947]" />
          <div className="px-6 py-8 sm:px-8">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-slate-100">
                <img src={gcbLogo} alt={t('common.appSystemName')} className="h-10 w-10 object-contain" />
              </div>
              <div className="space-y-3">
                <Badge className="gap-1.5 border-transparent bg-slate-100 text-slate-700">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  <span>{t('publicProfile.verifiedBadge')}</span>
                </Badge>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                    {t('publicProfile.companyName')}
                  </p>
                  <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                    {t('publicProfile.heroTitle')}
                  </h1>
                  <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                    {t('publicProfile.subtitle')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <Card className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/95 shadow-[0_22px_65px_-36px_rgba(15,23,42,0.45)]">
          <CardContent className="p-6 sm:p-8">
            <div className="grid gap-6 md:grid-cols-[160px,minmax(0,1fr)] md:items-center">
              <div className="mx-auto flex h-36 w-36 items-center justify-center overflow-hidden rounded-[28px] border border-slate-200 bg-slate-100 text-3xl font-semibold text-slate-600 shadow-inner md:mx-0">
                {photoUrl ? (
                  <img src={photoUrl} alt={fullName} className="h-full w-full object-cover" />
                ) : (
                  <span>{getInitials(fullName)}</span>
                )}
              </div>

              <div className={cn('space-y-4 text-center', isRTL ? 'md:text-right' : 'md:text-left')}>
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    {t('publicProfile.publicProfileVerified')}
                  </div>
                  <div>
                    <h2 className="text-3xl font-semibold tracking-tight text-slate-950">
                      {fullName}
                    </h2>
                    {position ? (
                      <p className="mt-2 text-lg text-slate-600">{position}</p>
                    ) : professionalCategory ? (
                      <p className="mt-2 text-lg text-slate-600">{professionalCategory}</p>
                    ) : null}
                    <p className="mt-1 text-sm font-medium text-slate-500">GCB</p>
                  </div>
                </div>

                <div
                  className={cn(
                    'flex flex-wrap justify-center gap-2',
                    isRTL ? 'md:justify-end' : 'md:justify-start',
                  )}
                >
                  {position ? (
                    <Badge className="gap-1.5 border-transparent bg-orange-50 text-[#d35b2d]">
                      <BriefcaseBusiness className="h-3.5 w-3.5" />
                      {position}
                    </Badge>
                  ) : null}
                  {department ? (
                    <Badge className="gap-1.5 border-transparent bg-slate-100 text-slate-700">
                      <Building2 className="h-3.5 w-3.5" />
                      {department}
                    </Badge>
                  ) : null}
                  {professionalCategory ? (
                    <Badge className="border-transparent bg-slate-100 text-slate-700">
                      {professionalCategory}
                    </Badge>
                  ) : null}
                  {employeeId ? (
                    <Badge className="gap-1.5 border-transparent bg-slate-100 text-slate-700">
                      <IdCard className="h-3.5 w-3.5" />
                      {employeeId}
                    </Badge>
                  ) : null}
                </div>

                <div
                  className={cn(
                    'flex flex-col gap-3 sm:flex-row sm:justify-center',
                    isRTL ? 'md:justify-end' : 'md:justify-start',
                  )}
                >
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2 rounded-xl"
                    onClick={() => void handleCopyProfileLink()}
                  >
                    <Copy className="h-4 w-4" />
                    {t('publicProfile.copyProfileLink')}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="gap-2 rounded-xl text-slate-600"
                    onClick={handleBack}
                  >
                    <ChevronLeft className={cn('h-4 w-4', isRTL && 'rotate-180')} />
                    {t('publicProfile.goBack')}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {(email || telephone) && (
          <Card className="rounded-[28px] border border-slate-200/80 bg-white/95 shadow-[0_22px_65px_-36px_rgba(15,23,42,0.45)]">
            <CardHeader className="space-y-2 pb-3">
              <CardTitle className="text-lg font-semibold text-slate-950">
                {t('publicProfile.quickContactTitle')}
              </CardTitle>
              <p className="text-sm leading-6 text-slate-600">
                {t('publicProfile.quickContactDescription')}
              </p>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {email ? (
                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3">
                  <div className="flex items-start gap-3">
                    <Mail className="mt-0.5 h-4 w-4 text-slate-500" />
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                        {t('publicProfile.professionalEmail')}
                      </p>
                      <p className="mt-1 break-all text-sm font-medium text-slate-900">
                        {email}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}
              {telephone ? (
                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3">
                  <div className="flex items-start gap-3">
                    <Phone className="mt-0.5 h-4 w-4 text-slate-500" />
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                        {t('publicProfile.professionalPhone')}
                      </p>
                      <p className="mt-1 text-sm font-medium text-slate-900">{telephone}</p>
                    </div>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          {sections.map((section) => (
            <ProfileSectionCard key={section.id} section={section} isRTL={isRTL} />
          ))}
        </div>

        <Card className="rounded-[28px] border border-slate-200/80 bg-white/95 shadow-[0_22px_65px_-36px_rgba(15,23,42,0.45)]">
          <CardContent className="p-6 sm:p-7">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div className="space-y-2">
                <h3 className="text-base font-semibold text-slate-950">
                  {t('publicProfile.secureProfileTitle')}
                </h3>
                <p className="text-sm leading-6 text-slate-600">
                  {t('publicProfile.secureProfileDescription')}
                </p>
                <div className="flex flex-wrap gap-3 text-xs font-medium text-slate-500">
                  <span className="inline-flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                    {t('publicProfile.tokenValidated')}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                    {t('publicProfile.visibilityFiltered')}
                  </span>
                  <span>
                    {isFetching
                      ? t('publicProfile.refreshingVerification')
                      : t('publicProfile.verifiedBadge')}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
