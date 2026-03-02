import html2canvas from 'html2canvas'
import { Building2, Download, Loader2, Printer, QrCode } from 'lucide-react'
import { QRCodeCanvas } from 'qrcode.react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

import gcbLogo from '@/assets/brand/gcb-logo.svg'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface EmployeeBadgeDialogProps {
  employee: {
    matricule: string
    nom: string
    prenom: string
    poste: string | null
    photoUrl: string | null
  }
  departmentName?: string
  publicProfileUrl: string | null
  isTokenLoading?: boolean
  tokenError?: string | null
  isGeneratingQr?: boolean
  onGenerateQr?: () => void
}

type BadgeSide = 'front' | 'back'

const BADGE_WIDTH_PX = 856
const BADGE_HEIGHT_PX = 540
const COMPANY_NAME_FULL = 'LA SOCIÉTÉ NATIONALE DE GÉNIE-CIVIL & BÂTIMENT'

function getInitials(nom: string, prenom: string): string {
  const first = prenom.trim().charAt(0)
  const second = nom.trim().charAt(0)
  return `${first}${second}`.toUpperCase() || 'NA'
}

function getDateStamp(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

async function exportElementAsPng(node: HTMLElement, filename: string) {
  const canvas = await html2canvas(node, {
    backgroundColor: '#ffffff',
    scale: 3,
    useCORS: true,
    logging: false,
  })

  const pngUrl = canvas.toDataURL('image/png')
  const link = document.createElement('a')
  link.href = pngUrl
  link.download = filename
  link.click()
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Unable to load image.'))
    image.src = src
  })
}

async function toPngDataUrl(url: string): Promise<string> {
  try {
    const image = await loadImageElement(url)
    const canvas = document.createElement('canvas')
    canvas.width = image.width
    canvas.height = image.height
    const context = canvas.getContext('2d')
    if (!context) {
      return url
    }

    context.drawImage(image, 0, 0)
    return canvas.toDataURL('image/png')
  } catch {
    return url
  }
}

interface BadgeFaceProps {
  side: BadgeSide
  fullName: string
  poste: string
  matricule: string
  departmentName?: string
  photoUrl: string | null
  initials: string
  publicProfileUrl: string | null
  qrCanvasId: string
  logoSrc: string
}

function BadgeFace({
  side,
  fullName,
  poste,
  matricule,
  departmentName,
  photoUrl,
  initials,
  publicProfileUrl,
  qrCanvasId,
  logoSrc,
}: BadgeFaceProps) {
  if (side === 'front') {
    return (
      <div
        className="badge-face relative overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-sm"
        style={{ width: BADGE_WIDTH_PX, height: BADGE_HEIGHT_PX }}
      >
        <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-br from-[#ff6b35] to-[#ffc947]" />
        <div className="absolute -right-16 top-16 h-52 w-52 rounded-full bg-[#ffc947]/20 blur-2xl" />
        <div className="absolute -left-16 bottom-10 h-52 w-52 rounded-full bg-[#ff6b35]/15 blur-2xl" />
        <div className="absolute right-8 top-36 grid grid-cols-6 gap-2 opacity-20">
          {Array.from({ length: 24 }).map((_, index) => (
            <span key={index} className="h-1.5 w-1.5 rounded-full bg-slate-400" />
          ))}
        </div>

        <div className="relative z-10 flex h-full flex-col p-8">
          <div className="flex items-center justify-between text-white">
            <div className="inline-flex items-center gap-4 rounded-2xl bg-white/15 px-4 py-3">
              <img
                src={logoSrc}
                alt="Company logo"
                className="h-16 w-16 flex-shrink-0 object-contain"
              />
              <div className="leading-tight">
                <p className="max-w-[330px] text-xs font-extrabold uppercase tracking-[0.06em] text-white">
                  LA SOCIÉTÉ NATIONALE DE GÉNIE-CIVIL & BÂTIMENT
                </p>
              </div>
            </div>
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/90">
              Employee Badge
            </span>
          </div>

          <div className="mt-7 flex flex-1 items-center gap-8">
            <div className="h-56 w-44 overflow-hidden rounded-2xl border-4 border-white bg-slate-100 shadow-lg">
              {photoUrl ? (
                <img src={photoUrl} alt={fullName} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-slate-200 text-4xl font-bold text-slate-700">
                  {initials}
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Employee</p>
              <p className="mt-2 text-4xl font-bold leading-tight text-slate-900">{fullName}</p>
              <p className="mt-2 text-xl text-slate-600">{poste}</p>
              {departmentName ? (
                <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-700">
                  <Building2 className="h-4 w-4" />
                  <span>{departmentName}</span>
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-slate-200 pt-4 text-sm">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
              <span className="text-slate-500">ID:</span>
              <span className="font-mono font-semibold text-slate-900">{matricule}</span>
            </div>
            <span className="text-xs uppercase tracking-[0.16em] text-slate-500">Verified Badge</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="badge-face relative overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-sm"
      style={{ width: BADGE_WIDTH_PX, height: BADGE_HEIGHT_PX }}
    >
      <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-br from-[#ff6b35] to-[#ffc947]" />
      <div className="absolute bottom-6 left-6 h-32 w-32 rounded-full bg-[#ff6b35]/10 blur-2xl" />
      <div className="absolute right-8 top-36 grid grid-cols-6 gap-2 opacity-20">
        {Array.from({ length: 30 }).map((_, index) => (
          <span key={index} className="h-1.5 w-1.5 rounded-full bg-slate-400" />
        ))}
      </div>

      <div className="relative z-10 flex h-full flex-col p-8">
        <div className="flex items-center justify-between text-white">
          <div className="inline-flex items-center gap-4 rounded-2xl bg-white/15 px-4 py-3">
            <img
                src={logoSrc}
                alt="Company logo"
                className="h-14 w-14 flex-shrink-0 object-contain"
              />
            <div className="leading-tight">
              <p className="max-w-[300px] text-[10px] font-extrabold uppercase tracking-[0.06em] text-white">
                LA SOCIÉTÉ NATIONALE DE GÉNIE-CIVIL & BÂTIMENT
              </p>
              <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-white/80">
                Employee Identification Badge
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/90">
            Scan to verify
          </span>
        </div>

        <div className="mt-7 flex flex-1 items-center gap-8">
          <div className="flex h-56 w-56 items-center justify-center rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            {publicProfileUrl ? (
              <QRCodeCanvas id={qrCanvasId} value={publicProfileUrl} size={180} includeMargin level="M" />
            ) : (
              <div className="flex flex-col items-center gap-2 text-slate-400">
                <QrCode className="h-12 w-12" />
                <span className="text-xs uppercase tracking-wide">No active QR token</span>
              </div>
            )}
          </div>

          <div className="flex-1 space-y-4 text-sm leading-relaxed text-slate-700">
            <p className="text-base font-semibold text-slate-900">Professional Verification</p>
            <p>
              This badge belongs to <span className="font-semibold">{fullName}</span>,{' '}
              <span className="font-semibold">{poste}</span> at{' '}
              <span className="font-semibold">{COMPANY_NAME_FULL}</span>. Scan the QR code to view
              the employee&apos;s verified public profile and professional details.
            </p>
            <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs">
              ID: {matricule}
            </p>
          </div>
        </div>

        <div className="mt-4 border-t border-slate-200 pt-3 text-xs text-slate-500">
          If found, please return to the HR Department.
        </div>
      </div>
    </div>
  )
}

export function EmployeeBadgeDialog({
  employee,
  departmentName,
  publicProfileUrl,
  isTokenLoading = false,
  tokenError,
  isGeneratingQr = false,
  onGenerateQr,
}: EmployeeBadgeDialogProps) {
  const [open, setOpen] = useState(false)
  const [activeSide, setActiveSide] = useState<BadgeSide>('front')
  const [isExportingSide, setIsExportingSide] = useState<BadgeSide | null>(null)
  const [logoSrc, setLogoSrc] = useState(gcbLogo)
  const frontPreviewRef = useRef<HTMLDivElement | null>(null)
  const backPreviewRef = useRef<HTMLDivElement | null>(null)
  const qrCanvasId = useId()

  const fullName = useMemo(
    () => `${employee.prenom} ${employee.nom}`.replace(/\s+/g, ' ').trim(),
    [employee.nom, employee.prenom],
  )
  const safePoste = employee.poste?.trim() ? employee.poste : 'Employee'
  const initials = useMemo(
    () => getInitials(employee.nom, employee.prenom),
    [employee.nom, employee.prenom],
  )

  useEffect(() => {
    let isMounted = true

    const loadLogo = async () => {
      const rasterized = await toPngDataUrl(gcbLogo)
      if (!isMounted) {
        return
      }
      setLogoSrc(rasterized)
    }

    void loadLogo()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    const onAfterPrint = () => {
      document.body.classList.remove('badge-printing')
    }

    window.addEventListener('afterprint', onAfterPrint)
    return () => {
      window.removeEventListener('afterprint', onAfterPrint)
      document.body.classList.remove('badge-printing')
    }
  }, [])

  const handlePrint = () => {
    document.body.classList.add('badge-printing')
    window.requestAnimationFrame(() => {
      window.print()
      window.setTimeout(() => {
        document.body.classList.remove('badge-printing')
      }, 200)
    })
  }

  const handleExportSide = async (side: BadgeSide) => {
    const target = side === 'front' ? frontPreviewRef.current : backPreviewRef.current
    if (!target) {
      toast.error('Badge preview is not ready.')
      return
    }

    try {
      setIsExportingSide(side)
      const filename = `badge_${employee.matricule}_${side}_${getDateStamp()}.png`
      await exportElementAsPng(target, filename)
      toast.success(`${side === 'front' ? 'Front' : 'Back'} badge downloaded.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to export badge PNG.')
    } finally {
      setIsExportingSide(null)
    }
  }

  return (
    <>
      <style>
        {`
          @media print {
            body.badge-printing * {
              visibility: hidden !important;
            }

            body.badge-printing .employee-badge-print-root,
            body.badge-printing .employee-badge-print-root * {
              visibility: visible !important;
            }

            body.badge-printing .employee-badge-print-root {
              display: block !important;
              position: fixed;
              inset: 0;
              background: #ffffff;
              z-index: 9999;
              padding: 0;
              margin: 0;
            }

            body.badge-printing .employee-badge-print-page {
              display: flex !important;
              min-height: 100vh;
              align-items: center;
              justify-content: center;
              page-break-after: always;
              break-after: page;
              padding: 0;
            }

            body.badge-printing .employee-badge-print-page:last-child {
              page-break-after: auto;
              break-after: auto;
            }

            body.badge-printing .badge-face {
              width: 85.6mm !important;
              height: 53.98mm !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
          }
        `}
      </style>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button type="button" variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Download Badge
          </Button>
        </DialogTrigger>

        <DialogContent className="max-h-[90vh] w-[95vw] max-w-[1080px] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Employee Badge Preview</DialogTitle>
            <DialogDescription>
              Preview both badge sides, then print/save as PDF or export PNG files.
            </DialogDescription>
          </DialogHeader>

          {isTokenLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-56" />
              <Skeleton className="h-[420px] w-full rounded-2xl" />
            </div>
          ) : null}

          {!isTokenLoading ? (
            <div className="space-y-4">
              {tokenError ? (
                <Alert variant="destructive">
                  <AlertTitle>Unable to load active QR token</AlertTitle>
                  <AlertDescription>{tokenError}</AlertDescription>
                </Alert>
              ) : null}

              {!publicProfileUrl && !tokenError ? (
                <Alert>
                  <AlertTitle>No active QR token</AlertTitle>
                  <AlertDescription className="flex flex-wrap items-center gap-3">
                    <span>Generate a token to include the employee public profile QR.</span>
                    {onGenerateQr ? (
                      <Button
                        type="button"
                        size="sm"
                        onClick={onGenerateQr}
                        disabled={isGeneratingQr}
                        className="bg-gradient-to-br from-[#ff6b35] to-[#ffc947] text-white hover:brightness-95"
                      >
                        {isGeneratingQr ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <QrCode className="mr-2 h-4 w-4" />
                        )}
                        {isGeneratingQr ? 'Generating...' : 'Generate QR'}
                      </Button>
                    ) : null}
                  </AlertDescription>
                </Alert>
              ) : null}

              <Tabs value={activeSide} onValueChange={(value) => setActiveSide(value as BadgeSide)}>
                <TabsList>
                  <TabsTrigger value="front">Front</TabsTrigger>
                  <TabsTrigger value="back">Back</TabsTrigger>
                </TabsList>

                <TabsContent value="front">
                  <div className="overflow-x-auto rounded-2xl border bg-slate-50 p-4">
                    <div ref={frontPreviewRef} className="mx-auto w-fit">
                      <BadgeFace
                        side="front"
                        fullName={fullName}
                        poste={safePoste}
                        matricule={employee.matricule}
                        departmentName={departmentName}
                        photoUrl={employee.photoUrl}
                        initials={initials}
                        publicProfileUrl={publicProfileUrl}
                        qrCanvasId={`${qrCanvasId}-front`}
                        logoSrc={logoSrc}
                      />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="back">
                  <div className="overflow-x-auto rounded-2xl border bg-slate-50 p-4">
                    <div ref={backPreviewRef} className="mx-auto w-fit">
                      <BadgeFace
                        side="back"
                        fullName={fullName}
                        poste={safePoste}
                        matricule={employee.matricule}
                        departmentName={departmentName}
                        photoUrl={employee.photoUrl}
                        initials={initials}
                        publicProfileUrl={publicProfileUrl}
                        qrCanvasId={`${qrCanvasId}-back`}
                        logoSrc={logoSrc}
                      />
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          ) : null}

          <DialogFooter className="gap-2 sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">85.60mm x 53.98mm</Badge>
              <Badge variant="outline">Employee Badge</Badge>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" onClick={handlePrint}>
                <Printer className="mr-2 h-4 w-4" />
                Print / Save PDF
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={isExportingSide !== null}
                onClick={() => void handleExportSide('front')}
              >
                {isExportingSide === 'front' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Download PNG Front
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={isExportingSide !== null}
                onClick={() => void handleExportSide('back')}
              >
                {isExportingSide === 'back' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Download PNG Back
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="employee-badge-print-root hidden">
        <div className="employee-badge-print-page">
          <BadgeFace
            side="front"
            fullName={fullName}
            poste={safePoste}
            matricule={employee.matricule}
            departmentName={departmentName}
            photoUrl={employee.photoUrl}
            initials={initials}
            publicProfileUrl={publicProfileUrl}
            qrCanvasId={`${qrCanvasId}-print-front`}
            logoSrc={logoSrc}
          />
        </div>
        <div className="employee-badge-print-page">
          <BadgeFace
            side="back"
            fullName={fullName}
            poste={safePoste}
            matricule={employee.matricule}
            departmentName={departmentName}
            photoUrl={employee.photoUrl}
            initials={initials}
            publicProfileUrl={publicProfileUrl}
            qrCanvasId={`${qrCanvasId}-print-back`}
            logoSrc={logoSrc}
          />
        </div>
      </div>
    </>
  )
}
