import { Copy, Download, ExternalLink, QrCode } from 'lucide-react'
import { QRCodeCanvas } from 'qrcode.react'
import { useMemo } from 'react'
import { toast } from 'sonner'

import {
  EmptyState,
  ErrorState,
  SectionSkeleton,
} from '@/components/common/page-state'
import { SURFACE_CARD_CLASS_NAME } from '@/components/common/page-header'
import { StatusBadge } from '@/components/common/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getPublicProfileRoute } from '@/constants/routes'
import { useMyActiveTokenQuery } from '@/services/qrService'
import type { TokenQR } from '@/types/token'
import { copyTextToClipboard } from '@/utils/clipboard'
import { downloadQrPng } from '@/utils/qrDownload'
import { cn } from '@/lib/utils'

type MyQrStatus = 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'NONE'

interface MyQrCardProps {
  employeId?: string | null
  className?: string
}

function resolveQrStatus(token: TokenQR | null): MyQrStatus {
  if (!token) {
    return 'NONE'
  }

  if (token.statutToken === 'REVOQUE') {
    return 'REVOKED'
  }

  if (token.expiresAt && new Date(token.expiresAt).getTime() <= Date.now()) {
    return 'EXPIRED'
  }

  return 'ACTIVE'
}

function statusBadge(status: MyQrStatus): {
  label: string
  tone: 'success' | 'warning' | 'danger' | 'neutral'
} {
  if (status === 'ACTIVE') {
    return { label: 'Active', tone: 'success' }
  }

  if (status === 'EXPIRED') {
    return { label: 'Expired', tone: 'warning' }
  }

  if (status === 'REVOKED') {
    return { label: 'Revoked', tone: 'danger' }
  }

  return { label: 'Not assigned', tone: 'neutral' }
}

function formatDate(value: string | null): string {
  if (!value) {
    return 'No expiration'
  }

  return new Date(value).toLocaleString()
}

export function MyQrCard({ employeId, className }: MyQrCardProps) {
  const tokenQuery = useMyActiveTokenQuery(employeId)
  const token = tokenQuery.data
  const status = resolveQrStatus(token ?? null)
  const statusMeta = statusBadge(status)
  const isValidToken = Boolean(token && status === 'ACTIVE')
  const publicUrl = useMemo(() => {
    if (!token) {
      return null
    }

    return `${window.location.origin}${getPublicProfileRoute(token.token)}`
  }, [token])

  const qrCanvasId = `my-qr-canvas-${employeId ?? 'unknown'}`

  const handleCopyLink = async () => {
    if (!publicUrl || !isValidToken) {
      return
    }

    try {
      await copyTextToClipboard(publicUrl)
      toast.success('Public link copied.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to copy link')
    }
  }

  const handleDownloadQr = () => {
    if (!publicUrl || !token || !isValidToken) {
      return
    }

    try {
      downloadQrPng(qrCanvasId, `ems_my_qr_${token.employeId}.png`)
      toast.success('QR code downloaded.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to download QR')
    }
  }

  const handleOpenPreview = () => {
    if (!publicUrl || !isValidToken) {
      return
    }

    window.open(publicUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <Card className={cn(SURFACE_CARD_CLASS_NAME, 'mt-4', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <QrCode className="h-4 w-4" />
          My QR Code
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {tokenQuery.isPending ? (
          <SectionSkeleton lines={4} titleWidthClassName="w-36" />
        ) : null}

        {tokenQuery.isError ? (
          <ErrorState
            surface="plain"
            title="QR code unavailable"
            description="We couldn't load your QR status right now."
            message={tokenQuery.error.message}
            onRetry={() => void tokenQuery.refetch()}
          />
        ) : null}

        {!tokenQuery.isPending && !tokenQuery.isError ? (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge tone={statusMeta.tone} emphasis="outline">
                {statusMeta.label}
              </StatusBadge>
              <p className="text-xs text-muted-foreground">
                Expires: {formatDate(token?.expiresAt ?? null)}
              </p>
            </div>

            {status === 'NONE' ? (
              <EmptyState
                surface="plain"
                title="QR code not available"
                description="No QR token is assigned yet. Contact HR to publish your public profile."
              />
            ) : null}

            {status === 'EXPIRED' ? (
              <EmptyState
                surface="plain"
                title="QR link expired"
                description="Your public profile link has expired. Contact HR to refresh it."
              />
            ) : null}

            {status === 'REVOKED' ? (
              <EmptyState
                surface="plain"
                title="QR link revoked"
                description="This QR link is no longer active. Contact HR if you need a new one."
              />
            ) : null}

            {publicUrl ? (
              <div className="rounded-md border p-3">
                <p className="mb-1 text-xs text-muted-foreground">Public profile link</p>
                <p className="select-all break-all text-sm">{publicUrl}</p>
              </div>
            ) : null}

            {isValidToken && publicUrl ? (
              <div className="flex items-center justify-center rounded-md border p-4">
                <QRCodeCanvas
                  id={qrCanvasId}
                  value={publicUrl}
                  size={172}
                  level="M"
                  includeMargin
                />
              </div>
            ) : (
              <EmptyState
                surface="plain"
                title="QR preview unavailable"
                description="A valid QR token is required before the preview can be displayed."
              />
            )}

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" disabled={!isValidToken} onClick={() => void handleCopyLink()}>
                <Copy className="mr-2 h-4 w-4" />
                Copy Link
              </Button>
              <Button type="button" variant="outline" disabled={!isValidToken} onClick={handleDownloadQr}>
                <Download className="mr-2 h-4 w-4" />
                Download QR
              </Button>
              <Button type="button" disabled={!isValidToken} onClick={handleOpenPreview}>
                <ExternalLink className="mr-2 h-4 w-4" />
                Open Preview
              </Button>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}
