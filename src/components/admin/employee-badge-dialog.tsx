import { Download, Loader2, Printer, QrCode } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import {
  type CSSProperties,
  type ReactNode,
  type Ref,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
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
import { getEmployeePosteLabel, getEmployeeRegionalBranchLabel } from '@/types/employee'

interface EmployeeBadgeDialogProps {
  employee: {
    matricule: string
    nom: string
    prenom: string
    poste: string | null
    regionalBranch?: string | null
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
const BADGE_PRINT_WIDTH_MM = 85.6
const BADGE_PRINT_HEIGHT_MM = 53.98
const BADGE_EXPORT_SCALE = 3
const COMPANY_NAME_FULL = 'LA SOCIETE NATIONALE DE GENIE-CIVIL & BATIMENT'
const SVG_NS = 'http://www.w3.org/2000/svg'
const XLINK_NS = 'http://www.w3.org/1999/xlink'

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

function ellipsize(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text
  }
  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`
}

function splitIntoLines(text: string, maxLength: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length === 0) {
    return ['']
  }

  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (next.length <= maxLength) {
      current = next
      continue
    }

    if (current) {
      lines.push(current)
      current = word
    } else {
      lines.push(word)
      current = ''
    }

    if (lines.length === maxLines - 1) {
      break
    }
  }

  const consumedWords = lines.join(' ').split(/\s+/).filter(Boolean).length
  const remainder = current || words.slice(consumedWords).join(' ')
  if (lines.length < maxLines) {
    lines.push(ellipsize(remainder || current, maxLength))
  }

  return lines.slice(0, maxLines)
}

function waitForAnimationFrame(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => resolve())
    })
  })
}

async function waitForFonts() {
  if ('fonts' in document) {
    await document.fonts.ready.catch(() => undefined)
  }
  await waitForAnimationFrame()
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.decoding = 'async'
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

function serializeSvg(svg: SVGSVGElement): string {
  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.setAttribute('xmlns', SVG_NS)
  clone.setAttribute('xmlns:xlink', XLINK_NS)
  clone.setAttribute('width', String(BADGE_WIDTH_PX))
  clone.setAttribute('height', String(BADGE_HEIGHT_PX))
  clone.setAttribute('viewBox', `0 0 ${BADGE_WIDTH_PX} ${BADGE_HEIGHT_PX}`)
  return new XMLSerializer().serializeToString(clone)
}

async function exportSvgAsPng(svg: SVGSVGElement, filename: string) {
  await waitForFonts()

  const serialized = serializeSvg(svg)
  const blob = new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  try {
    const image = await loadImageElement(url)
    const canvas = document.createElement('canvas')
    canvas.width = BADGE_WIDTH_PX * BADGE_EXPORT_SCALE
    canvas.height = BADGE_HEIGHT_PX * BADGE_EXPORT_SCALE
    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('Unable to prepare badge export canvas.')
    }

    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)

    const pngBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!pngBlob) {
      throw new Error('Unable to render badge PNG.')
    }

    const pngUrl = URL.createObjectURL(pngBlob)
    const link = document.createElement('a')
    link.href = pngUrl
    link.download = filename
    link.click()
    URL.revokeObjectURL(pngUrl)
  } finally {
    URL.revokeObjectURL(url)
  }
}

function BadgePreviewFrame({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border bg-slate-50 p-4">
      <div className="mx-auto w-fit rounded-[28px] bg-white/70 p-3 shadow-sm">{children}</div>
    </div>
  )
}

function BadgeDotGrid({
  startX,
  startY,
  rows,
  columns,
  spacing = 16,
}: {
  startX: number
  startY: number
  rows: number
  columns: number
  spacing?: number
}) {
  const dots: ReactNode[] = []
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      dots.push(
        <circle
          key={`${row}-${column}`}
          cx={startX + column * spacing}
          cy={startY + row * spacing}
          r={3}
          fill="#64748b"
          opacity="0.18"
        />,
      )
    }
  }
  return <>{dots}</>
}

interface BadgeSvgFaceProps {
  side: BadgeSide
  fullName: string
  poste: string
  matricule: string
  departmentName?: string
  regionalBranch?: string | null
  photoUrl: string | null
  initials: string
  publicProfileUrl: string | null
  logoSrc: string
  svgRef?: Ref<SVGSVGElement>
  qrIdSuffix: string
  className?: string
  style?: CSSProperties
}

function BadgeSvgFace({
  side,
  fullName,
  poste,
  matricule,
  departmentName,
  regionalBranch,
  photoUrl,
  initials,
  publicProfileUrl,
  logoSrc,
  svgRef,
  qrIdSuffix,
  className,
  style,
}: BadgeSvgFaceProps) {
  const safeDepartmentName =
    typeof departmentName === 'string' && departmentName.trim().length > 0
      ? departmentName.trim()
      : 'Department not assigned'
  const safeRegionalBranch =
    typeof regionalBranch === 'string' && regionalBranch.trim().length > 0
      ? getEmployeeRegionalBranchLabel(regionalBranch)?.trim() ?? regionalBranch.trim()
      : null
  const departmentLabel = ellipsize(
    safeRegionalBranch ? `${safeDepartmentName} | ${safeRegionalBranch}` : safeDepartmentName,
    44,
  )
  const nameLines = splitIntoLines(fullName, 20, 2)
  const titleLine = ellipsize(poste, 34)
  const qrLabel = `badge-qr-${side}-${qrIdSuffix}`

  return (
    <svg
      ref={svgRef}
      xmlns={SVG_NS}
      xmlnsXlink={XLINK_NS}
      viewBox={`0 0 ${BADGE_WIDTH_PX} ${BADGE_HEIGHT_PX}`}
      width={BADGE_WIDTH_PX}
      height={BADGE_HEIGHT_PX}
      className={className}
      style={style}
      role="img"
      aria-label={`Employee badge ${side}`}
    >
      <defs>
        <linearGradient id={`badge-gradient-${side}-${qrIdSuffix}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ff6b35" />
          <stop offset="55%" stopColor="#ff9a3d" />
          <stop offset="100%" stopColor="#ffc947" />
        </linearGradient>
        <clipPath id={`badge-photo-clip-${side}-${qrIdSuffix}`}>
          <rect x="54" y="166" width="196" height="252" rx="24" ry="24" />
        </clipPath>
      </defs>

      <rect x="1" y="1" width="854" height="538" rx="30" fill="#ffffff" stroke="#e2e8f0" strokeWidth="2" />
      <rect x="0" y="0" width="856" height="16" fill={`url(#badge-gradient-${side}-${qrIdSuffix})`} />

      {side === 'front' ? (
        <>
          <circle cx="804" cy="118" r="76" fill="#ffc947" opacity="0.20" />
          <circle cx="76" cy="458" r="64" fill="#ff6b35" opacity="0.12" />
          <BadgeDotGrid startX={696} startY={132} rows={4} columns={6} />

          <rect x="680" y="28" width="132" height="34" rx="17" fill="#fff7ed" stroke="#fdba74" />
          <text x="746" y="49" textAnchor="middle" fontSize="11" fontWeight="700" letterSpacing="3.5" fill="#ea580c">
            Employee Badge
          </text>

          <rect x="42" y="38" width="78" height="78" rx="18" fill="#ffffff" stroke="#e2e8f0" />
          <image href={logoSrc} x="50" y="46" width="62" height="62" preserveAspectRatio="xMidYMid meet" />

          <text x="140" y="64" fontSize="15" fontWeight="800" letterSpacing="1.4" fill="#0f172a">
            {COMPANY_NAME_FULL}
          </text>
          <text x="140" y="88" fontSize="11" fontWeight="600" letterSpacing="3" fill="#64748b">
            Corporate identification card
          </text>

          <rect x="54" y="166" width="196" height="252" rx="24" fill="#e2e8f0" stroke="#cbd5e1" />
          {photoUrl ? (
            <image
              href={photoUrl}
              x="54"
              y="166"
              width="196"
              height="252"
              preserveAspectRatio="xMidYMid slice"
              clipPath={`url(#badge-photo-clip-${side}-${qrIdSuffix})`}
            />
          ) : null}
          {!photoUrl ? (
            <text x="152" y="316" textAnchor="middle" fontSize="58" fontWeight="700" letterSpacing="4" fill="#475569">
              {initials}
            </text>
          ) : null}

          <text x="300" y="206" fontSize="12" fontWeight="700" letterSpacing="4" fill="#64748b">
            VERIFIED EMPLOYEE
          </text>
          <text x="300" y="262" fontSize="40" fontWeight="700" fill="#0f172a">
            {nameLines[0]}
          </text>
          {nameLines[1] ? (
            <text x="300" y="308" fontSize="40" fontWeight="700" fill="#0f172a">
              {nameLines[1]}
            </text>
          ) : null}
          <text x="300" y="356" fontSize="22" fontWeight="500" fill="#475569">
            {titleLine}
          </text>

          <rect x="300" y="384" width="410" height="42" rx="21" fill="#f8fafc" stroke="#e2e8f0" />
          <text x="324" y="410" fontSize="15" fontWeight="500" fill="#334155">
            {departmentLabel}
          </text>

          <rect x="54" y="454" width="196" height="42" rx="21" fill="#f8fafc" stroke="#e2e8f0" />
          <text x="82" y="480" fontSize="11" fontWeight="700" letterSpacing="2.4" fill="#64748b">
            ID
          </text>
          <text
            x="118"
            y="480"
            fontSize="17"
            fontWeight="700"
            fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace"
            fill="#0f172a"
          >
            {matricule}
          </text>

          <rect x="594" y="454" width="218" height="42" rx="21" fill="#ecfdf5" stroke="#a7f3d0" />
          <text x="624" y="480" fontSize="14" fontWeight="600" fill="#047857">
            Verified profile
          </text>
        </>
      ) : (
        <>
          <circle cx="86" cy="468" r="60" fill="#ff6b35" opacity="0.10" />
          <BadgeDotGrid startX={700} startY={124} rows={4} columns={6} />

          <rect x="42" y="40" width="64" height="64" rx="18" fill="#ffffff" stroke="#e2e8f0" />
          <image href={logoSrc} x="50" y="48" width="48" height="48" preserveAspectRatio="xMidYMid meet" />

          <text x="126" y="62" fontSize="13" fontWeight="800" letterSpacing="1.2" fill="#0f172a">
            {COMPANY_NAME_FULL}
          </text>
          <text x="126" y="84" fontSize="11" fontWeight="600" letterSpacing="3" fill="#64748b">
            Badge verification panel
          </text>

          <rect x="670" y="34" width="146" height="32" rx="16" fill="#f8fafc" stroke="#e2e8f0" />
          <text x="743" y="54" textAnchor="middle" fontSize="11" fontWeight="700" letterSpacing="3.2" fill="#64748b">
            Scan to verify
          </text>

          <rect x="52" y="160" width="236" height="236" rx="24" fill="#ffffff" stroke="#e2e8f0" />
          {publicProfileUrl ? (
            <QRCodeSVG
              value={publicProfileUrl}
              size={192}
              includeMargin
              level="M"
              bgColor="#ffffff"
              fgColor="#0f172a"
              aria-label={qrLabel}
              x={74}
              y={182}
            />
          ) : (
            <>
              <rect x="74" y="182" width="192" height="192" rx="18" fill="#f8fafc" />
              <text x="170" y="266" textAnchor="middle" fontSize="16" fontWeight="700" letterSpacing="3" fill="#94a3b8">
                NO ACTIVE QR TOKEN
              </text>
            </>
          )}

          <text x="330" y="194" fontSize="20" fontWeight="700" fill="#0f172a">
            Professional verification
          </text>
          <text x="330" y="238" fontSize="16" fill="#334155">
            This card identifies
          </text>
          <text x="330" y="264" fontSize="18" fontWeight="700" fill="#0f172a">
            {ellipsize(fullName, 28)}
          </text>
          <text x="330" y="294" fontSize="16" fill="#334155">
            as {ellipsize(poste, 26)} at
          </text>
          <text x="330" y="324" fontSize="16" fontWeight="700" fill="#0f172a">
            {ellipsize(COMPANY_NAME_FULL, 32)}
          </text>
          <text x="330" y="372" fontSize="15" fill="#475569">
            Scan the QR code to open the verified public profile
          </text>
          <text x="330" y="396" fontSize="15" fill="#475569">
            linked to this employee badge.
          </text>

          <rect x="54" y="456" width="188" height="40" rx="20" fill="#f8fafc" stroke="#e2e8f0" />
          <text
            x="84"
            y="481"
            fontSize="15"
            fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace"
            fill="#334155"
          >
            ID: {matricule}
          </text>
          <text x="812" y="480" textAnchor="end" fontSize="15" fontWeight="500" fill="#475569">
            If found, please return it to the HR Department.
          </text>
        </>
      )}
    </svg>
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
  const [isPreparingPrint, setIsPreparingPrint] = useState(false)
  const [logoSrc, setLogoSrc] = useState(gcbLogo)
  const [photoSrc, setPhotoSrc] = useState<string | null>(employee.photoUrl)
  const frontExportRef = useRef<SVGSVGElement | null>(null)
  const backExportRef = useRef<SVGSVGElement | null>(null)
  const qrIdSuffix = useId().replace(/[:]/g, '-')

  const fullName = useMemo(
    () => `${employee.prenom} ${employee.nom}`.replace(/\s+/g, ' ').trim(),
    [employee.nom, employee.prenom],
  )
  const safePoste = getEmployeePosteLabel(employee.poste)?.trim() || 'Employee'
  const initials = useMemo(() => getInitials(employee.nom, employee.prenom), [employee.nom, employee.prenom])

  useEffect(() => {
    let isMounted = true

    const loadLogo = async () => {
      const rasterized = await toPngDataUrl(gcbLogo)
      if (isMounted) {
        setLogoSrc(rasterized)
      }
    }

    void loadLogo()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    if (!employee.photoUrl) {
      setPhotoSrc(null)
      return () => {
        isMounted = false
      }
    }

    const currentPhotoUrl = employee.photoUrl
    setPhotoSrc(currentPhotoUrl)

    const loadPhoto = async () => {
      const rasterized = await toPngDataUrl(currentPhotoUrl)
      if (isMounted) {
        setPhotoSrc(rasterized)
      }
    }

    void loadPhoto()

    return () => {
      isMounted = false
    }
  }, [employee.photoUrl])

  useEffect(() => {
    const onAfterPrint = () => {
      document.body.classList.remove('badge-printing')
      setIsPreparingPrint(false)
    }

    window.addEventListener('afterprint', onAfterPrint)
    return () => {
      window.removeEventListener('afterprint', onAfterPrint)
      document.body.classList.remove('badge-printing')
    }
  }, [])

  const faceProps = {
    fullName,
    poste: safePoste,
    matricule: employee.matricule,
    departmentName,
    regionalBranch: employee.regionalBranch,
    photoUrl: photoSrc,
    initials,
    publicProfileUrl,
    logoSrc,
  } as const

  const handleExportSide = async (side: BadgeSide) => {
    const target = side === 'front' ? frontExportRef.current : backExportRef.current
    if (!target) {
      toast.error('Badge export layout is not ready.')
      return
    }

    try {
      setIsExportingSide(side)
      const filename = `badge_${employee.matricule}_${side}_${getDateStamp()}.png`
      await exportSvgAsPng(target, filename)
      toast.success(`${side === 'front' ? 'Front' : 'Back'} badge downloaded.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to export badge PNG.')
    } finally {
      setIsExportingSide(null)
    }
  }

  const handlePrint = async () => {
    try {
      setIsPreparingPrint(true)
      await waitForFonts()
      document.body.classList.add('badge-printing')
      window.requestAnimationFrame(() => {
        window.print()
        window.setTimeout(() => {
          document.body.classList.remove('badge-printing')
          setIsPreparingPrint(false)
        }, 300)
      })
    } catch {
      document.body.classList.remove('badge-printing')
      setIsPreparingPrint(false)
      toast.error('Unable to prepare badge for printing.')
    }
  }

  return (
    <>
      <style>
        {`
          .employee-badge-export-root {
            position: fixed;
            left: -10000px;
            top: 0;
            width: 0;
            height: 0;
            overflow: hidden;
            pointer-events: none;
          }

          .employee-badge-print-root {
            display: none;
          }

          @media print {
            @page {
              size: ${BADGE_PRINT_WIDTH_MM}mm ${BADGE_PRINT_HEIGHT_MM}mm;
              margin: 0;
            }

            html,
            body {
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
            }

            body.badge-printing > *:not(.employee-badge-print-root) {
              display: none !important;
            }

            body.badge-printing .employee-badge-print-root {
              display: block !important;
              background: #ffffff !important;
              padding: 0;
              margin: 0;
            }

            body.badge-printing .employee-badge-print-page {
              width: ${BADGE_PRINT_WIDTH_MM}mm;
              height: ${BADGE_PRINT_HEIGHT_MM}mm;
              page-break-after: always;
              break-after: page;
              overflow: hidden;
            }

            body.badge-printing .employee-badge-print-page:last-child {
              page-break-after: auto;
              break-after: auto;
            }

            body.badge-printing .employee-badge-print-svg {
              width: ${BADGE_PRINT_WIDTH_MM}mm !important;
              height: ${BADGE_PRINT_HEIGHT_MM}mm !important;
              display: block;
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
              Preview both badge sides, then export PNGs or print/save as PDF from the same badge template.
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
                  <BadgePreviewFrame>
                    <BadgeSvgFace side="front" {...faceProps} qrIdSuffix={`${qrIdSuffix}-preview-front`} />
                  </BadgePreviewFrame>
                </TabsContent>

                <TabsContent value="back">
                  <BadgePreviewFrame>
                    <BadgeSvgFace side="back" {...faceProps} qrIdSuffix={`${qrIdSuffix}-preview-back`} />
                  </BadgePreviewFrame>
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
              <Button
                type="button"
                variant="outline"
                onClick={() => void handlePrint()}
                disabled={isPreparingPrint || isExportingSide !== null}
              >
                {isPreparingPrint ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Printer className="mr-2 h-4 w-4" />
                )}
                {isPreparingPrint ? 'Preparing print...' : 'Print / Save PDF'}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={isExportingSide !== null || isPreparingPrint}
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
                disabled={isExportingSide !== null || isPreparingPrint}
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

      {typeof document !== 'undefined'
        ? createPortal(
            <>
              <div className="employee-badge-export-root" aria-hidden="true">
                <BadgeSvgFace
                  side="front"
                  {...faceProps}
                  qrIdSuffix={`${qrIdSuffix}-export-front`}
                  svgRef={frontExportRef}
                />
                <BadgeSvgFace
                  side="back"
                  {...faceProps}
                  qrIdSuffix={`${qrIdSuffix}-export-back`}
                  svgRef={backExportRef}
                  style={{ marginTop: 32 }}
                />
              </div>

              <div className="employee-badge-print-root" aria-hidden="true">
                <div className="employee-badge-print-page">
                  <BadgeSvgFace
                    side="front"
                    {...faceProps}
                    qrIdSuffix={`${qrIdSuffix}-print-front`}
                    className="employee-badge-print-svg"
                    style={{ width: `${BADGE_PRINT_WIDTH_MM}mm`, height: `${BADGE_PRINT_HEIGHT_MM}mm` }}
                  />
                </div>
                <div className="employee-badge-print-page">
                  <BadgeSvgFace
                    side="back"
                    {...faceProps}
                    qrIdSuffix={`${qrIdSuffix}-print-back`}
                    className="employee-badge-print-svg"
                    style={{ width: `${BADGE_PRINT_WIDTH_MM}mm`, height: `${BADGE_PRINT_HEIGHT_MM}mm` }}
                  />
                </div>
              </div>
            </>,
            document.body,
          )
        : null}
    </>
  )
}
