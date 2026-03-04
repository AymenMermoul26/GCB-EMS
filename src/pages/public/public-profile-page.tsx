import { Copy, ShieldCheck } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { CompanyLogo } from '@/components/common/company-logo'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ROUTES } from '@/constants/routes'
import { usePublicProfile } from '@/hooks/use-public-profile'
import type { PublicProfile } from '@/types/profile'
import { copyTextToClipboard } from '@/utils/clipboard'

type ProfileValue = string | number | boolean | null

interface ProfileEntry {
  key: string
  label: string
  value: string
}

const PUBLIC_FIELD_LABELS: Record<string, string> = {
  matricule: 'Matricule',
  nom: 'Last Name',
  prenom: 'First Name',
  poste: 'Position',
  email: 'Email',
  telephone: 'Phone',
  phone: 'Phone',
  departement: 'Department',
  department: 'Department',
  company: 'Company',
  bio: 'Bio',
  about: 'About',
  description: 'Description',
  fonction: 'Function',
}

const SUMMARY_EXCLUDED_KEYS = new Set([
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

const ABOUT_KEYS = new Set(['about', 'bio', 'description', 'summary', 'presentation'])
const CONTACT_KEYS = new Set(['email', 'telephone', 'phone', 'mobile'])
const WORK_KEYS = new Set(['poste', 'fonction', 'departement', 'department', 'matricule', 'company'])

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

  return String(value)
}

function normalizeEntries(profile: PublicProfile): ProfileEntry[] {
  return Object.entries(profile)
    .filter(([, value]) => hasVisibleValue(value))
    .map(([key, value]) => ({
      key,
      label: PUBLIC_FIELD_LABELS[key] ?? key.replaceAll('_', ' '),
      value: toDisplayValue(value).trim(),
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

function ProfileUnavailableCard({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <main className="min-h-screen bg-slate-100/70 px-4 py-10">
      <div className="mx-auto flex max-w-3xl justify-center">
        <Card className="w-full rounded-2xl border-slate-200/80 shadow-sm">
          <CardHeader>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="bg-gradient-to-br from-[#ff6b35] to-[#ffc947] text-white hover:brightness-95">
              <Link to={ROUTES.LOGIN}>Go to login</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

export function PublicProfilePage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { data, isPending, isError, error, refetch, isFetching } = usePublicProfile(token)

  const profile = data?.profile ?? null
  const entries = useMemo(() => (profile ? normalizeEntries(profile) : []), [profile])

  const fullName = useMemo(() => {
    if (!profile) {
      return 'Employee Profile'
    }
    const fromParts = [getStringField(profile, 'prenom'), getStringField(profile, 'nom')]
      .filter(Boolean)
      .join(' ')
      .trim()
    if (fromParts.length > 0) {
      return fromParts
    }
    return getStringField(profile, 'full_name') ?? 'Employee Profile'
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

  const aboutEntries = useMemo(
    () => entries.filter((entry) => ABOUT_KEYS.has(entry.key)),
    [entries],
  )
  const contactEntries = useMemo(
    () => entries.filter((entry) => CONTACT_KEYS.has(entry.key)),
    [entries],
  )
  const workEntries = useMemo(
    () => entries.filter((entry) => WORK_KEYS.has(entry.key)),
    [entries],
  )
  const usedSectionKeys = useMemo(
    () => new Set([...aboutEntries, ...contactEntries, ...workEntries].map((entry) => entry.key)),
    [aboutEntries, contactEntries, workEntries],
  )
  const additionalEntries = useMemo(
    () =>
      entries.filter(
        (entry) => !SUMMARY_EXCLUDED_KEYS.has(entry.key) && !usedSectionKeys.has(entry.key),
      ),
    [entries, usedSectionKeys],
  )

  const handleCopyProfileLink = async () => {
    try {
      await copyTextToClipboard(window.location.href)
      toast.success('Profile link copied.')
    } catch (copyError) {
      toast.error(copyError instanceof Error ? copyError.message : 'Unable to copy profile link.')
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
    return (
      <main className="min-h-screen bg-slate-100/70 px-4 py-10">
        <div className="mx-auto max-w-4xl space-y-6">
          <Card className="rounded-2xl border-slate-200/80 shadow-sm">
            <CardContent className="space-y-4 p-6">
              <Skeleton className="h-10 w-40" />
              <Skeleton className="h-6 w-80" />
              <Skeleton className="h-1 w-36" />
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-slate-200/80 shadow-sm">
            <CardContent className="p-6">
              <div className="grid gap-6 md:grid-cols-[140px,1fr]">
                <Skeleton className="h-32 w-32 rounded-xl" />
                <div className="space-y-3">
                  <Skeleton className="h-8 w-72" />
                  <Skeleton className="h-5 w-52" />
                  <Skeleton className="h-10 w-48" />
                </div>
              </div>
            </CardContent>
          </Card>
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="rounded-2xl border-slate-200/80 shadow-sm">
              <CardContent className="space-y-3 p-6">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
              </CardContent>
            </Card>
            <Card className="rounded-2xl border-slate-200/80 shadow-sm">
              <CardContent className="space-y-3 p-6">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/5" />
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    )
  }

  if (isError) {
    return (
      <main className="min-h-screen bg-slate-100/70 px-4 py-10">
        <div className="mx-auto max-w-3xl">
          <Alert variant="destructive" className="rounded-2xl">
            <AlertTitle>Unable to load public profile</AlertTitle>
            <AlertDescription className="mt-2 flex flex-wrap items-center gap-3">
              <span>{error.message}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void refetch()}
                disabled={isFetching}
              >
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      </main>
    )
  }

  if (data?.status === 'expired') {
    return (
      <ProfileUnavailableCard
        title="Profile unavailable"
        description="This QR link is invalid, expired, or has been revoked."
      />
    )
  }

  if (!data || data.status === 'invalid_or_revoked' || !profile) {
    return (
      <ProfileUnavailableCard
        title="Profile not found"
        description="This QR link is invalid, expired, or has been revoked."
      />
    )
  }

  if (entries.length === 0) {
    return (
      <ProfileUnavailableCard
        title="Profile unavailable"
        description="No public information is currently available for this employee."
      />
    )
  }

  return (
    <main className="min-h-screen bg-slate-100/70 px-4 py-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <div className="flex flex-col items-center gap-3 text-center">
            <CompanyLogo withName={false} imageClassName="h-14 w-14 rounded-none object-contain" />
            <Badge className="border-transparent bg-emerald-100 text-emerald-700">
              <ShieldCheck className="mr-1 h-3.5 w-3.5" />
              Verified
            </Badge>
            <h1 className="text-2xl font-semibold text-slate-900">Public Employee Profile</h1>
            <p className="text-sm text-slate-600">Verified information shared via QR code.</p>
            <div className="h-1 w-32 rounded-full bg-gradient-to-br from-[#ff6b35] to-[#ffc947]" />
          </div>
        </header>

        <Card className="rounded-2xl border-slate-200/80 shadow-sm">
          <CardContent className="space-y-5 p-6">
            <div className="grid gap-6 md:grid-cols-[160px,1fr] md:items-start">
              <div className="mx-auto flex h-36 w-36 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-100 text-2xl font-semibold text-slate-600 md:mx-0">
                {photoUrl ? (
                  <img src={photoUrl} alt={fullName} className="h-full w-full object-cover" />
                ) : (
                  <span>{getInitials(fullName)}</span>
                )}
              </div>

              <div className="space-y-3">
                <h2 className="text-3xl font-semibold text-slate-900">{fullName}</h2>
                {position ? <p className="text-lg text-slate-600">{position}</p> : null}
                <div className="flex flex-wrap items-center gap-2">
                  {department ? (
                    <Badge variant="secondary" className="bg-slate-100 text-slate-700">
                      {department}
                    </Badge>
                  ) : null}
                  <Badge variant="outline" className="border-slate-300 text-slate-600">
                    GCB
                  </Badge>
                </div>
                <p className="text-sm text-slate-600">
                  Only fields approved for public sharing are displayed.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => void handleCopyProfileLink()}>
                <Copy className="mr-2 h-4 w-4" />
                Copy profile link
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={handleBack}
              >
                Back
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          {aboutEntries.length > 0 ? (
            <Card className="rounded-2xl border-slate-200/80 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">About</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {aboutEntries.map((entry) => (
                  <div key={entry.key} className="space-y-1">
                    <p className="text-xs uppercase tracking-wide text-slate-500">{entry.label}</p>
                    <p className="text-sm text-slate-700">{entry.value}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {contactEntries.length > 0 ? (
            <Card className="rounded-2xl border-slate-200/80 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Contact</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {contactEntries.map((entry) => (
                  <div key={entry.key} className="rounded-lg border border-slate-200/80 bg-slate-50 px-3 py-2">
                    <p className="text-xs uppercase tracking-wide text-slate-500">{entry.label}</p>
                    <p className="text-sm font-medium text-slate-800">{entry.value}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {workEntries.length > 0 ? (
            <Card className="rounded-2xl border-slate-200/80 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Work Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {workEntries.map((entry) => (
                  <div key={entry.key} className="flex items-start justify-between gap-4">
                    <p className="text-sm text-slate-500">{entry.label}</p>
                    <p className="text-right text-sm font-medium text-slate-800">{entry.value}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {additionalEntries.length > 0 ? (
            <Card className="rounded-2xl border-slate-200/80 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Additional Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {additionalEntries.map((entry) => (
                  <div key={entry.key} className="flex items-start justify-between gap-4">
                    <p className="text-sm text-slate-500">{entry.label}</p>
                    <p className="text-right text-sm font-medium text-slate-800">{entry.value}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </div>

        <footer className="space-y-2 pb-2 text-center text-xs text-slate-500">
          <p>
            This profile is generated via a secure QR token and may be revoked or expire.
          </p>
          <p>{'\u00A9'} GCB</p>
        </footer>
      </div>
    </main>
  )
}

