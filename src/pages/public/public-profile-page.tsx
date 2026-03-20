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
import { usePublicProfile } from '@/hooks/use-public-profile'
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

const COMPANY_NAME_FULL = 'LA SOCIETE NATIONALE DE GENIE-CIVIL & BATIMENT'
const PAGE_SUBTITLE =
  'Only approved employee profile fields are shared through this secure QR token.'

function hasText(value: string | null | undefined): boolean {
  return Boolean(value && value.trim().length > 0)
}

function formatValue(value: string | null | undefined): string {
  return hasText(value) ? (value as string).trim() : ''
}

function buildFullName(profile: PublicProfile | null): string {
  if (!profile) {
    return 'Verified Employee'
  }

  const fullName = [formatValue(profile.prenom), formatValue(profile.nom)]
    .filter(Boolean)
    .join(' ')
    .trim()

  return fullName || 'Verified Employee'
}

function getInitials(fullName: string): string {
  const tokens = fullName
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)

  const initials = `${tokens[0]?.charAt(0) ?? ''}${tokens[1]?.charAt(0) ?? ''}`.toUpperCase()
  return initials || 'EM'
}

function buildSections(profile: PublicProfile): InfoSection[] {
  const professionalRows: InfoRow[] = []
  const contactRows: InfoRow[] = []
  const identityRows: InfoRow[] = []

  if (hasText(profile.poste)) {
    professionalRows.push({
      label: 'Job Title',
      value: formatValue(profile.poste),
    })
  }

  if (hasText(profile.departement)) {
    professionalRows.push({
      label: 'Department',
      value: formatValue(profile.departement),
    })
  }

  if (hasText(profile.email)) {
    contactRows.push({
      label: 'Professional Email',
      value: formatValue(profile.email),
    })
  }

  if (hasText(profile.telephone)) {
    contactRows.push({
      label: 'Professional Phone',
      value: formatValue(profile.telephone),
    })
  }

  if (hasText(profile.matricule)) {
    identityRows.push({
      label: 'Employee ID',
      value: formatValue(profile.matricule),
    })
  }

  return [
    {
      id: 'professional',
      title: 'Professional Information',
      description: 'Role and department details approved for public display.',
      rows: professionalRows,
    },
    {
      id: 'contact',
      title: 'Contact Information',
      description: 'Official contact details currently shared through EMS.',
      rows: contactRows,
    },
    {
      id: 'identity',
      title: 'Employee Reference',
      description: 'Internal employee identifiers that have been approved for public viewing.',
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
  primaryActionLabel = 'Go back',
  showLoginButton = true,
}: {
  title: string
  description: string
  onBack: () => void
  primaryActionLabel?: string
  showLoginButton?: boolean
}) {
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
                <ChevronLeft className="mr-2 h-4 w-4" />
                {primaryActionLabel}
              </Button>
              {showLoginButton ? (
                <Button
                  type="button"
                  className="rounded-xl bg-gradient-to-br from-[#ff6b35] to-[#ffc947] text-white hover:brightness-95"
                  onClick={() => window.location.assign(ROUTES.LOGIN)}
                >
                  Open login
                </Button>
              ) : null}
            </>
          }
        />
      </div>
    </main>
  )
}

function ProfileSectionCard({ section }: { section: InfoSection }) {
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
            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                {row.label}
              </p>
              <p className="text-sm font-medium leading-6 text-slate-900 sm:text-right">
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
  const { data, isPending, isError, refetch, isFetching } = usePublicProfile(token)

  const profile = data?.profile ?? null
  const fullName = useMemo(() => buildFullName(profile), [profile])
  const position = formatValue(profile?.poste)
  const department = formatValue(profile?.departement)
  const employeeId = formatValue(profile?.matricule)
  const email = formatValue(profile?.email)
  const telephone = formatValue(profile?.telephone)
  const photoUrl = formatValue(profile?.photo_url)
  const sections = useMemo(
    () => (profile ? buildSections(profile) : []),
    [profile],
  )

  const handleCopyProfileLink = async () => {
    try {
      await copyTextToClipboard(window.location.href)
      toast.success('Profile link copied.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to copy profile link.')
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
            title="Profile unavailable"
            description="We couldn't load this employee profile right now."
            onRetry={() => {
              void refetch()
            }}
            retryLabel="Retry"
          />
        </div>
      </main>
    )
  }

  if (data?.status === 'expired' || data?.status === 'invalid_or_revoked' || !profile) {
    return (
      <UnavailableState
        title="Profile unavailable"
        description="This QR link is invalid, expired, or no longer active."
        onBack={handleBack}
      />
    )
  }

  if (!hasVisiblePublicContent(profile)) {
    return (
      <UnavailableState
        title="Profile unavailable"
        description="No public information is currently available for this employee."
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
                <img src={gcbLogo} alt="GCB logo" className="h-10 w-10 object-contain" />
              </div>
              <div className="space-y-3">
                <Badge className="border-transparent bg-slate-100 text-slate-700">
                  <ShieldCheck className="mr-2 h-4 w-4 text-emerald-600" />
                  Verified via EMS
                </Badge>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                    {COMPANY_NAME_FULL}
                  </p>
                  <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                    Verified Employee Profile
                  </h1>
                  <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                    {PAGE_SUBTITLE}
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

              <div className="space-y-4 text-center md:text-left">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Public profile verified
                  </div>
                  <div>
                    <h2 className="text-3xl font-semibold tracking-tight text-slate-950">
                      {fullName}
                    </h2>
                    {position ? <p className="mt-2 text-lg text-slate-600">{position}</p> : null}
                    <p className="mt-1 text-sm font-medium text-slate-500">GCB</p>
                  </div>
                </div>

                <div className="flex flex-wrap justify-center gap-2 md:justify-start">
                  {position ? (
                    <Badge className="border-transparent bg-orange-50 text-[#d35b2d]">
                      <BriefcaseBusiness className="mr-1.5 h-3.5 w-3.5" />
                      {position}
                    </Badge>
                  ) : null}
                  {department ? (
                    <Badge className="border-transparent bg-slate-100 text-slate-700">
                      <Building2 className="mr-1.5 h-3.5 w-3.5" />
                      {department}
                    </Badge>
                  ) : null}
                  {employeeId ? (
                    <Badge className="border-transparent bg-slate-100 text-slate-700">
                      <IdCard className="mr-1.5 h-3.5 w-3.5" />
                      {employeeId}
                    </Badge>
                  ) : null}
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:justify-center md:justify-start">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => void handleCopyProfileLink()}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copy profile link
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="rounded-xl text-slate-600"
                    onClick={handleBack}
                  >
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    Back
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
                Quick Contact
              </CardTitle>
              <p className="text-sm leading-6 text-slate-600">
                Contact channels approved for this public profile.
              </p>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {email ? (
                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3">
                  <div className="flex items-start gap-3">
                    <Mail className="mt-0.5 h-4 w-4 text-slate-500" />
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                        Professional Email
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
                        Professional Phone
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
            <ProfileSectionCard key={section.id} section={section} />
          ))}
        </div>

        <Card className="rounded-[28px] border border-slate-200/80 bg-white/95 shadow-[0_22px_65px_-36px_rgba(15,23,42,0.45)]">
          <CardContent className="p-6 sm:p-7">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div className="space-y-2">
                <h3 className="text-base font-semibold text-slate-950">Secure public profile</h3>
                <p className="text-sm leading-6 text-slate-600">
                  This public profile is built from structured employee records and field-level
                  visibility settings. Activity logs are not used to render employee profile data.
                </p>
                <div className="flex flex-wrap gap-3 text-xs font-medium text-slate-500">
                  <span className="inline-flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                    Token validated
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                    Visibility filtered
                  </span>
                  <span>{isFetching ? 'Refreshing verification...' : 'Verified via EMS'}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
