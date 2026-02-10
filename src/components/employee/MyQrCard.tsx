import { Copy, Download, ExternalLink, QrCode } from 'lucide-react'
import { QRCodeCanvas } from 'qrcode.react'
import { useMemo } from 'react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { getPublicProfileRoute } from '@/constants/routes'
import { useMyActiveTokenQuery } from '@/services/qrService'
import type { TokenQR } from '@/types/token'
import { copyTextToClipboard } from '@/utils/clipboard'
import { downloadQrPng } from '@/utils/qrDownload'

type MyQrStatus = 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'NONE'

interface MyQrCardProps {
  employeId?: string | null
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

function statusBadge(status: MyQrStatus): { label: string; className?: string } {
  if (status === 'ACTIVE') {
    return { label: 'Active' }
  }

  if (status === 'EXPIRED') {
    return { label: 'Expired', className: 'border-amber-300 text-amber-700' }
  }

  if (status === 'REVOKED') {
    return { label: 'Revoked', className: 'border-destructive text-destructive' }
  }

  return { label: 'Not assigned' }
}

function formatDate(value: string | null): string {
  if (!value) {
    return 'No expiration'
  }

  return new Date(value).toLocaleString()
}

export function MyQrCard({ employeId }: MyQrCardProps) {
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
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <QrCode className="h-4 w-4" />
          My QR Code
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {tokenQuery.isPending ? (
          <div className="space-y-2">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : null}

        {tokenQuery.isError ? (
          <div className="space-y-2">
            <p className="text-sm text-destructive">{tokenQuery.error.message}</p>
            <Button variant="outline" size="sm" onClick={() => void tokenQuery.refetch()}>
              Retry
            </Button>
          </div>
        ) : null}

        {!tokenQuery.isPending && !tokenQuery.isError ? (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="outline" className={statusMeta.className}>
                {statusMeta.label}
              </Badge>
              <p className="text-xs text-muted-foreground">
                Expires: {formatDate(token?.expiresAt ?? null)}
              </p>
            </div>

            {status === 'NONE' ? (
              <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                No QR token assigned. Contact HR.
              </p>
            ) : null}

            {status === 'EXPIRED' ? (
              <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                Your link is expired. Contact HR.
              </p>
            ) : null}

            {status === 'REVOKED' ? (
              <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                Your QR link is revoked. Contact HR.
              </p>
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
              <div className="flex h-[204px] items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
                QR preview unavailable
              </div>
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
