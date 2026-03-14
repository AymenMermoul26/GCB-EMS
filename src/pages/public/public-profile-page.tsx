import {
  BriefcaseBusiness,
  Building2,
  ChevronLeft,
  Copy,
  ShieldCheck,
} from 'lucide-react'
import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import gcbLogo from '@/assets/brand/gcb-logo.svg'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ROUTES } from '@/constants/routes'
import { usePublicProfile } from '@/hooks/use-public-profile'
import { cn } from '@/lib/utils'
import type { PublicProfile } from '@/types/profile'
import { copyTextToClipboard } from '@/utils/clipboard'

type ProfileValue = string | number | boolean | null

interface ProfileEntry {
  key: string
  label: string
  value: string
}

interface ProfileSectionDefinition {
  id: string
  title: string
  description: string
  entries: ProfileEntry[]
}

const COMPANY_NAME_FULL = 'LA SOCIETE NATIONALE DE GENIE-CIVIL & BATIMENT'
const PAGE_SUBTITLE =
  'Information shared securely through the GCB Employee Management System.'

const PUBLIC_FIELD_LABELS: Record<string, string> = {
  matricule: 'Employee ID',
  nom: 'Last Name',
  prenom: 'First Name',
  poste: 'Job Title',
  email: 'Professional Email',
  telephone: 'Professional Phone',
  phone: 'Professional Phone',
  mobile: 'Mobile Phone',
  departement: 'Department',
  department: 'Department',
  company: 'Company',
  bio: 'Profile Summary',
  about: 'Profile Summary',
  description: 'Description',
  fonction: 'Function',
}

const HERO_EXCLUDED_KEYS = new Set([
  'nom',
  'prenom',
  'full_name',
  'first_name',
  'last_name',
  'photo_url',
  'photo',
  'avatar',
  'avatar_url',
])

const SUMMARY_KEYS = new Set(['about', 'bio', 'description', 'summary', 'presentation'])
const CONTACT_KEYS = new Set(['email', 'telephone', 'phone', 'mobile'])
const PROFESSIONAL_KEYS = new Set(['poste', 'fonction', 'company'])
const ASSIGNMENT_KEYS = new Set(['departement', 'department', 'matricule'])

function hasVisibleValue(value: ProfileValue): boolean {
  if (value === null) {
    return false
  }

  if (typeof value === 'string') {
    return value.trim().length > 0
  }

  return true
}

function toDisplayValue(value: ProfileValue): string {
  if (value === null) {
    return ''
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No'
  }

  return String(value).trim()
}

function humanizeKey(key: string): string {
  return key
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function normalizeEntries(profile: PublicProfile): ProfileEntry[] {
  return Object.entries(profile)
    .filter(([, value]) => hasVisibleValue(value))
    .map(([key, value]) => ({
      key,
      label: PUBLIC_FIELD_LABELS[key] ?? humanizeKey(key),
      value: toDisplayValue(value),
    }))
}

function getStringField(profile: PublicProfile, key: string): string | null {
  const value = profile[key]

  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

function getInitials(fullName: string): string {
  const tokens = fullName
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)

  const first = tokens[0]?.charAt(0) ?? ''
  const second = tokens[1]?.charAt(0) ?? ''
  const initials = `${first}${second}`.toUpperCase()
  return initials || 'EM'
}

function buildSections(entries: ProfileEntry[]): ProfileSectionDefinition[] {
  const profileSummaryEntries = entries.filter((entry) => SUMMARY_KEYS.has(entry.key))
  const contactEntries = entries.filter((entry) => CONTACT_KEYS.has(entry.key))
  const professionalEntries = entries.filter((entry) => PROFESSIONAL_KEYS.has(entry.key))
  const assignmentEntries = entries.filter((entry) => ASSIGNMENT_KEYS.has(entry.key))

  const claimedKeys = new Set(
    [
      ...profileSummaryEntries,
      ...contactEntries,
      ...professionalEntries,
      ...assignmentEntries,
    ].map((entry) => entry.key),
  )

  const additionalEntries = entries.filter(
    (entry) => !HERO_EXCLUDED_KEYS.has(entry.key) && !claimedKeys.has(entry.key),
  )

  return [
    {
      id: 'professional',
      title: 'Professional Information',
      description: 'Role and company details approved for public viewing.',
      entries: professionalEntries,
    },
    {
      id: 'contact',
      title: 'Contact Information',
      description: 'Official contact details shared for this employee.',
      entries: contactEntries,
    },
    {
      id: 'assignment',
      title: 'Department / Assignment Information',
      description: 'Organizational information currently shared through EMS.',
      entries: assignmentEntries,
    },
    {
      id: 'summary',
      title: 'Profile Summary',
      description: 'Additional employee information approved for public display.',
      entries: profileSummaryEntries,
    },
    {
      id: 'additional',
      title: 'Additional Information',
      description: 'Other public data returned by the secure profile token.',
      entries: additionalEntries,
    },
  ].filter((section) => section.entries.length > 0)
}

function LoadingState() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(255,201,71,0.18),transparent_30%),linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <Card className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/95 shadow-[0_22px_65px_-36px_rgba(15,23,42,0.45)]">
          <div className="h-1.5 w-full bg-gradient-to-br from-[#ff6b35] to-[#ffc947]" />
          <CardContent className="space-y-4 p-6 sm:p-8">
            <div className="flex flex-col items-center gap-4 text-center">
              <Skeleton className="h-16 w-16 rounded-2xl" />
              <div className="space-y-2">
                <Skeleton className="mx-auto h-4 w-52" />
                <Skeleton className="mx-auto h-8 w-72" />
                <Skeleton className="mx-auto h-4 w-80 max-w-full" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border border-slate-200/80 bg-white/95 shadow-[0_22px_65px_-36px_rgba(15,23,42,0.45)]">
          <CardContent className="p-6 sm:p-8">
            <div className="grid gap-6 md:grid-cols-[140px,minmax(0,1fr)] md:items-center">
              <Skeleton className="mx-auto h-32 w-32 rounded-[26px] md:mx-0" />
              <div className="space-y-3">
                <Skeleton className="h-8 w-64 max-w-full" />
                <Skeleton className="h-5 w-52 max-w-full" />
                <div className="flex gap-2">
                  <Skeleton className="h-7 w-28 rounded-full" />
                  <Skeleton className="h-7 w-24 rounded-full" />
                </div>
                <Skeleton className="h-10 w-48 rounded-xl" />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <Card
              key={`public-profile-skeleton-${index}`}
              className="rounded-[28px] border border-slate-200/80 bg-white/95 shadow-[0_22px_65px_-36px_rgba(15,23,42,0.45)]"
            >
              <CardContent className="space-y-4 p-6">
                <Skeleton className="h-5 w-44" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-12 w-full rounded-xl" />
              </CardContent>
            </Card>
          ))}
        </div>
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
        <Card className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/95 shadow-[0_22px_65px_-36px_rgba(15,23,42,0.45)]">
          <div className="h-1.5 w-full bg-gradient-to-br from-[#ff6b35] to-[#ffc947]" />
          <CardContent className="space-y-6 p-6 text-center sm:p-8">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
              <ShieldCheck className="h-8 w-8" />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                Verified Employee Profile
              </p>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-950">{title}</h1>
              <p className="text-sm leading-6 text-slate-600">{description}</p>
            </div>
            <div className="flex flex-col justify-center gap-3 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={onBack}
              >
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
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

function ProfileSectionCard({ section }: { section: ProfileSectionDefinition }) {
  return (
    <Card className="rounded-[28px] border border-slate-200/80 bg-white/95 shadow-[0_22px_65px_-36px_rgba(15,23,42,0.45)]">
      <CardHeader className="space-y-2 pb-3">
        <CardTitle className="text-lg font-semibold text-slate-950">{section.title}</CardTitle>
        <p className="text-sm leading-6 text-slate-600">{section.description}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {section.entries.map((entry) => (
          <div
            key={entry.key}
            className="rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3"
          >
            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                {entry.label}
              </p>
              <p className="text-sm font-medium leading-6 text-slate-900 sm:text-right">
                {entry.value}
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
  const entries = useMemo(() => (profile ? normalizeEntries(profile) : []), [profile])

  const fullName = useMemo(() => {
    if (!profile) {
      return 'Verified Employee'
    }

    const fromParts = [getStringField(profile, 'prenom'), getStringField(profile, 'nom')]
      .filter(Boolean)
      .join(' ')
      .trim()

    if (fromParts.length > 0) {
      return fromParts
    }

    return getStringField(profile, 'full_name') ?? 'Verified Employee'
  }, [profile])

  const position = useMemo(() => {
    if (!profile) {
      return null
    }

    return getStringField(profile, 'poste') ?? getStringField(profile, 'fonction')
  }, [profile])

  const department = useMemo(() => {
    if (!profile) {
      return null
    }

    return getStringField(profile, 'departement') ?? getStringField(profile, 'department')
  }, [profile])

  const photoUrl = useMemo(() => {
    if (!profile) {
      return null
    }

    return (
      getStringField(profile, 'photo_url') ??
      getStringField(profile, 'photo') ??
      getStringField(profile, 'avatar_url') ??
      getStringField(profile, 'avatar')
    )
  }, [profile])

  const companyName = useMemo(() => {
    if (!profile) {
      return 'GCB'
    }

    return getStringField(profile, 'company') ?? 'GCB'
  }, [profile])

  const sections = useMemo(() => buildSections(entries), [entries])

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
      <UnavailableState
        title="Profile unavailable"
        description="We could not load this employee profile right now. Please try again in a moment."
        onBack={() => {
          void refetch()
        }}
        primaryActionLabel="Retry"
        showLoginButton={false}
      />
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

  if (entries.length === 0) {
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
                <img
                  src={gcbLogo}
                  alt="GCB logo"
                  className="h-10 w-10 object-contain"
                />
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
                    {position ? (
                      <p className="mt-2 text-lg text-slate-600">{position}</p>
                    ) : null}
                    <p className="mt-1 text-sm font-medium text-slate-500">{companyName}</p>
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
                  This profile is shared through a secure QR token and only displays information
                  approved for public viewing through the GCB Employee Management System.
                </p>
                <div className="flex flex-wrap gap-3 text-xs font-medium text-slate-500">
                  <span className="inline-flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                    Token validated
                  </span>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5',
                      isFetching && 'text-[#d35b2d]',
                    )}
                  >
                    {isFetching ? 'Refreshing verification...' : 'Verified via EMS'}
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
