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
import { useI18n } from '@/hooks/use-i18n'
import { cn } from '@/lib/utils'
import { useMyActiveTokenQuery } from '@/services/qrService'
import type { TokenQR } from '@/types/token'
import { copyTextToClipboard } from '@/utils/clipboard'
import { downloadQrPng } from '@/utils/qrDownload'

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

function statusBadge(
  status: MyQrStatus,
  t: (key: string) => string,
): {
  label: string
  tone: 'success' | 'warning' | 'danger' | 'neutral'
} {
  if (status === 'ACTIVE') {
    return { label: t('employee.qr.card.status.active'), tone: 'success' }
  }

  if (status === 'EXPIRED') {
    return { label: t('employee.qr.card.status.expired'), tone: 'warning' }
  }

  if (status === 'REVOKED') {
    return { label: t('employee.qr.card.status.revoked'), tone: 'danger' }
  }

  return { label: t('employee.qr.card.status.notAssigned'), tone: 'neutral' }
}

function formatDate(value: string | null, locale: string, emptyLabel: string): string {
  if (!value) {
    return emptyLabel
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function MyQrCard({ employeId, className }: MyQrCardProps) {
  const { isRTL, locale, t } = useI18n()
  const tokenQuery = useMyActiveTokenQuery(employeId)
  const token = tokenQuery.data
  const status = resolveQrStatus(token ?? null)
  const statusMeta = statusBadge(status, t)
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
      toast.success(t('employee.qr.card.copyLinkSuccess'))
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('employee.qr.card.copyLinkError'),
      )
    }
  }

  const handleDownloadQr = () => {
    if (!publicUrl || !token || !isValidToken) {
      return
    }

    try {
      downloadQrPng(qrCanvasId, `ems_my_qr_${token.employeId}.png`)
      toast.success(t('employee.qr.card.downloadQrSuccess'))
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('employee.qr.card.downloadQrError'),
      )
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
          {t('employee.qr.card.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {tokenQuery.isPending ? (
          <SectionSkeleton lines={4} titleWidthClassName="w-36" />
        ) : null}

        {tokenQuery.isError ? (
          <ErrorState
            surface="plain"
            title={t('employee.qr.card.loadErrorTitle')}
            description={t('employee.qr.card.loadErrorDescription')}
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
                {t('employee.qr.card.expiresLabel')}:{' '}
                {formatDate(
                  token?.expiresAt ?? null,
                  locale,
                  t('employee.qr.card.noExpiration'),
                )}
              </p>
            </div>

            {status === 'NONE' ? (
              <EmptyState
                surface="plain"
                title={t('employee.qr.card.notAvailableTitle')}
                description={t('employee.qr.card.notAvailableDescription')}
              />
            ) : null}

            {status === 'EXPIRED' ? (
              <EmptyState
                surface="plain"
                title={t('employee.qr.card.expiredTitle')}
                description={t('employee.qr.card.expiredDescription')}
              />
            ) : null}

            {status === 'REVOKED' ? (
              <EmptyState
                surface="plain"
                title={t('employee.qr.card.revokedTitle')}
                description={t('employee.qr.card.revokedDescription')}
              />
            ) : null}

            {publicUrl ? (
              <div className="rounded-md border p-3">
                <p className="mb-1 text-xs text-muted-foreground">
                  {t('employee.qr.card.publicLinkLabel')}
                </p>
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
                title={t('employee.qr.card.previewUnavailableTitle')}
                description={t('employee.qr.card.previewUnavailableDescription')}
              />
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={!isValidToken}
                onClick={() => void handleCopyLink()}
                className="gap-2"
              >
                <Copy className="h-4 w-4" />
                {t('employee.qr.card.copyLink')}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={!isValidToken}
                onClick={handleDownloadQr}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                {t('employee.qr.card.downloadQr')}
              </Button>
              <Button
                type="button"
                disabled={!isValidToken}
                onClick={handleOpenPreview}
                className="gap-2"
              >
                <ExternalLink className={cn('h-4 w-4', isRTL && 'scale-x-[-1]')} />
                {t('employee.qr.card.openPreview')}
              </Button>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}
