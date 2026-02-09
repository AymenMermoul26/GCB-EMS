import { useParams } from 'react-router-dom'

import { CompanyLogo } from '@/components/common/company-logo'
import { FullScreenLoader } from '@/components/common/full-screen-loader'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { env } from '@/config/env'
import { usePublicProfile } from '@/hooks/use-public-profile'

const PUBLIC_FIELD_LABELS: Record<string, string> = {
  matricule: 'Matricule',
  nom: 'Nom',
  prenom: 'Prenom',
  poste: 'Poste',
  email: 'Email',
  telephone: 'Telephone',
  departement: 'Departement',
  photo_url: 'Photo',
}

export function PublicProfilePage() {
  const { token } = useParams<{ token: string }>()
  const { data, isPending, isError, error } = usePublicProfile(token)

  if (isPending) {
    return <FullScreenLoader label="Loading public profile..." />
  }

  if (isError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>Public profile unavailable</CardTitle>
            <CardDescription>{error.message}</CardDescription>
          </CardHeader>
        </Card>
      </main>
    )
  }

  if (!data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>Profile not found</CardTitle>
            <CardDescription>
              This QR token is invalid, expired, or not published.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    )
  }

  const entries = Object.entries(data)
  const fullName = [data.prenom, data.nom].filter(Boolean).join(' ').trim()
  const photoUrl =
    typeof data.photo_url === 'string' && data.photo_url.length > 0
      ? data.photo_url
      : null
  const infoEntries = entries.filter(([key]) => key !== 'photo_url')

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <div className="mb-3 flex items-center justify-between">
            <Badge variant="secondary">Public Employee Profile</Badge>
            <CompanyLogo withName={false} imageClassName="h-10 w-10 rounded-none" />
          </div>
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={fullName || 'Employee photo'}
              className="mb-2 h-24 w-24 rounded-full border object-cover"
            />
          ) : null}
          <CardTitle>{fullName || 'Employee Profile'}</CardTitle>
          <CardDescription>{env.VITE_APP_NAME}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {infoEntries.length ? (
            infoEntries.map(([key, value]) => (
              <p key={key}>
                <span className="font-medium">{PUBLIC_FIELD_LABELS[key] ?? key}:</span>{' '}
                {value === null ? 'Not shared' : String(value)}
              </p>
            ))
          ) : (
            <p className="text-muted-foreground">No public fields are visible for this profile.</p>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
