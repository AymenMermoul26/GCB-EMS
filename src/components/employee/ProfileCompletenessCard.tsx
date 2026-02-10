import { CheckCircle2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'

export type CompletenessField = 'photo_url' | 'email' | 'telephone' | 'poste'

interface ProfileCompletenessValues {
  photoUrl?: string | null
  email?: string | null
  telephone?: string | null
  poste?: string | null
}

interface ProfileCompletenessCardProps {
  values: ProfileCompletenessValues
  onAddNow: (field: CompletenessField) => void
}

const FIELD_CONFIG: Array<{
  key: CompletenessField
  weight: number
  suggestion: string
}> = [
  {
    key: 'photo_url',
    weight: 25,
    suggestion: 'Add a profile photo to complete your profile.',
  },
  {
    key: 'email',
    weight: 25,
    suggestion: 'Add your email address.',
  },
  {
    key: 'telephone',
    weight: 25,
    suggestion: 'Add your phone number.',
  },
  {
    key: 'poste',
    weight: 25,
    suggestion: 'Add your job title (poste).',
  },
]

function isPresent(value?: string | null): boolean {
  return Boolean(value && value.trim().length > 0)
}

function getLevel(score: number): 'Incomplete' | 'Good' | 'Very good' | 'Complete' {
  if (score === 100) {
    return 'Complete'
  }

  if (score >= 75) {
    return 'Very good'
  }

  if (score >= 50) {
    return 'Good'
  }

  return 'Incomplete'
}

function getBadgeClassName(level: 'Incomplete' | 'Good' | 'Very good' | 'Complete'): string {
  if (level === 'Complete') {
    return 'border-emerald-300 text-emerald-700'
  }

  if (level === 'Very good') {
    return 'border-blue-300 text-blue-700'
  }

  if (level === 'Good') {
    return 'border-amber-300 text-amber-700'
  }

  return 'border-destructive/40 text-destructive'
}

export function ProfileCompletenessCard({
  values,
  onAddNow,
}: ProfileCompletenessCardProps) {
  const score = FIELD_CONFIG.reduce((total, field) => {
    if (
      (field.key === 'photo_url' && isPresent(values.photoUrl)) ||
      (field.key === 'email' && isPresent(values.email)) ||
      (field.key === 'telephone' && isPresent(values.telephone)) ||
      (field.key === 'poste' && isPresent(values.poste))
    ) {
      return total + field.weight
    }

    return total
  }, 0)

  const level = getLevel(score)
  const missingFields = FIELD_CONFIG.filter((field) => {
    if (field.key === 'photo_url') {
      return !isPresent(values.photoUrl)
    }

    if (field.key === 'email') {
      return !isPresent(values.email)
    }

    if (field.key === 'telephone') {
      return !isPresent(values.telephone)
    }

    return !isPresent(values.poste)
  })

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>Profile completeness</CardTitle>
        <Badge variant="outline" className={getBadgeClassName(level)}>
          {level}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Completion</span>
            <span className="font-semibold">{score}%</span>
          </div>
          <Progress value={score} />
        </div>

        {missingFields.length === 0 ? (
          <div className="flex items-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800">
            <CheckCircle2 className="h-4 w-4" />
            Your profile is complete.
          </div>
        ) : (
          <div className="space-y-2">
            {missingFields.map((field) => (
              <div
                key={field.key}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3"
              >
                <p className="text-sm text-muted-foreground">{field.suggestion}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onAddNow(field.key)}
                >
                  Add now
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
