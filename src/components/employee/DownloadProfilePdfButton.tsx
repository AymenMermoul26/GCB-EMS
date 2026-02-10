import { Download, Loader2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { env } from '@/config/env'
import { getPublicProfileRoute } from '@/constants/routes'
import { useMyActiveTokenQuery } from '@/services/qrService'
import type { Employee } from '@/types/employee'
import { exportEmployeeProfilePdf } from '@/utils/pdf/exportEmployeeProfilePdf'

interface DownloadProfilePdfButtonProps {
  employee: Employee
  departementName: string
  employeId?: string | null
}

function isValidActiveToken(token: {
  statutToken: 'ACTIF' | 'REVOQUE'
  expiresAt: string | null
} | null): boolean {
  if (!token || token.statutToken !== 'ACTIF') {
    return false
  }

  if (!token.expiresAt) {
    return true
  }

  return new Date(token.expiresAt).getTime() > Date.now()
}

export function DownloadProfilePdfButton({
  employee,
  departementName,
  employeId,
}: DownloadProfilePdfButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const tokenQuery = useMyActiveTokenQuery(employeId)
  const token = tokenQuery.data

  const publicProfileUrl = useMemo(() => {
    if (!isValidActiveToken(token ?? null)) {
      return null
    }

    const activeToken = token as NonNullable<typeof token>
    return `${window.location.origin}${getPublicProfileRoute(activeToken.token)}`
  }, [token])

  const handleDownloadPdf = async () => {
    setIsGenerating(true)

    try {
      await exportEmployeeProfilePdf({
        appName: env.VITE_APP_NAME,
        employee: {
          matricule: employee.matricule,
          nom: employee.nom,
          prenom: employee.prenom,
          poste: employee.poste,
          departement: departementName,
          email: employee.email,
          telephone: employee.telephone,
          photoUrl: employee.photoUrl,
        },
        publicProfileUrl,
      })

      toast.success('Profile PDF downloaded successfully.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to generate PDF.')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => void handleDownloadPdf()}
      disabled={isGenerating || tokenQuery.isPending}
    >
      {isGenerating ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Download className="mr-2 h-4 w-4" />
      )}
      {isGenerating ? 'Generating PDF...' : 'Download my profile (PDF)'}
    </Button>
  )
}
