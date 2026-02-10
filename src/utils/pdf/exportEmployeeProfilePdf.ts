import { jsPDF } from 'jspdf'
import * as QRCode from 'qrcode'

interface ExportEmployeeProfilePdfPayload {
  appName: string
  logoUrl?: string | null
  employee: {
    matricule: string
    nom: string
    prenom: string
    poste: string | null
    departement: string
    email: string | null
    telephone: string | null
    photoUrl: string | null
  }
  publicProfileUrl?: string | null
}

function sanitizeFilePart(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .toLowerCase()
}

function getTodayFileDate(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
        return
      }

      reject(new Error('Unable to read image file.'))
    }
    reader.onerror = () => {
      reject(new Error('Unable to read image file.'))
    }
    reader.readAsDataURL(blob)
  })
}

async function loadImageAsDataUrl(url: string | null): Promise<string | null> {
  if (!url || url.trim().length === 0) {
    return null
  }

  if (url.startsWith('data:image/')) {
    return url
  }

  try {
    const response = await fetch(url)
    if (!response.ok) {
      return null
    }

    const blob = await response.blob()
    return await blobToDataUrl(blob)
  } catch {
    return null
  }
}

function resolveImageFormat(dataUrl: string): 'PNG' | 'JPEG' {
  if (dataUrl.startsWith('data:image/png')) {
    return 'PNG'
  }

  return 'JPEG'
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Unable to load image.'))
    image.src = src
  })
}

async function toPngDataUrl(url: string | null): Promise<string | null> {
  const dataUrl = await loadImageAsDataUrl(url)
  if (!dataUrl) {
    return null
  }

  try {
    const image = await loadImageElement(dataUrl)
    const canvas = document.createElement('canvas')
    canvas.width = image.width
    canvas.height = image.height

    const context = canvas.getContext('2d')
    if (!context) {
      return null
    }

    context.drawImage(image, 0, 0)
    return canvas.toDataURL('image/png')
  } catch {
    return null
  }
}

function valueOrFallback(value: string | null): string {
  if (!value || value.trim().length === 0) {
    return 'Not provided'
  }

  return value
}

function drawLabelValue(doc: jsPDF, label: string, value: string, x: number, y: number): void {
  doc.setFont('helvetica', 'bold')
  doc.text(`${label}:`, x, y)
  doc.setFont('helvetica', 'normal')
  doc.text(value, x + 28, y)
}

export async function exportEmployeeProfilePdf(
  payload: ExportEmployeeProfilePdfPayload,
): Promise<string> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  })

  const pageWidth = 210
  const leftMargin = 15
  const rightMargin = 15
  const contentWidth = pageWidth - leftMargin - rightMargin

  const fullName = `${payload.employee.prenom} ${payload.employee.nom}`.trim()
  const generatedAt = new Date().toLocaleString()
  const photoDataUrl = await loadImageAsDataUrl(payload.employee.photoUrl)
  const logoDataUrl = await toPngDataUrl(payload.logoUrl ?? '/gcb-logo.svg')

  const logoWidth = 26
  const logoHeight = 26
  const logoX = pageWidth - rightMargin - logoWidth
  const logoY = 8

  if (logoDataUrl) {
    doc.addImage(logoDataUrl, 'PNG', logoX, logoY, logoWidth, logoHeight)
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text(payload.appName, leftMargin, 16)
  doc.setFontSize(18)
  doc.text('Professional Profile', leftMargin, 25)
  doc.setDrawColor(210)
  doc.line(leftMargin, 30, pageWidth - rightMargin, 30)

  const photoX = leftMargin
  const photoY = 37
  const photoSize = 40
  doc.setDrawColor(180)
  doc.rect(photoX, photoY, photoSize, photoSize)
  if (photoDataUrl) {
    doc.addImage(
      photoDataUrl,
      resolveImageFormat(photoDataUrl),
      photoX + 1,
      photoY + 1,
      photoSize - 2,
      photoSize - 2,
    )
  } else {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text('No profile photo', photoX + 8, photoY + 22)
  }

  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Identity', 62, 43)
  doc.setFontSize(11)
  drawLabelValue(doc, 'Name', fullName || 'Not provided', 62, 51)
  drawLabelValue(doc, 'Matricule', payload.employee.matricule, 62, 58)
  drawLabelValue(doc, 'Poste', valueOrFallback(payload.employee.poste), 62, 65)
  drawLabelValue(doc, 'Department', payload.employee.departement, 62, 72)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('Contact', leftMargin, 92)
  doc.setFontSize(11)
  drawLabelValue(doc, 'Email', valueOrFallback(payload.employee.email), leftMargin, 100)
  drawLabelValue(doc, 'Phone', valueOrFallback(payload.employee.telephone), leftMargin, 107)

  doc.setDrawColor(220)
  doc.line(leftMargin, 118, pageWidth - rightMargin, 118)

  if (payload.publicProfileUrl) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text('Public Profile', leftMargin, 128)

    try {
      const qrDataUrl = await QRCode.toDataURL(payload.publicProfileUrl, {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 320,
      })
      doc.addImage(qrDataUrl, 'PNG', leftMargin, 133, 36, 36)
    } catch {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.text('QR could not be generated.', leftMargin, 147)
    }

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    const wrappedUrl = doc.splitTextToSize(payload.publicProfileUrl, contentWidth - 45)
    doc.text(wrappedUrl, leftMargin + 43, 141)
  } else {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text('Public Profile', leftMargin, 128)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text('No active public link assigned.', leftMargin, 136)
  }

  doc.setDrawColor(220)
  doc.line(leftMargin, 276, pageWidth - rightMargin, 276)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(`Generated on ${generatedAt}`, leftMargin, 282)

  const filename = `profile_${sanitizeFilePart(payload.employee.matricule)}_${getTodayFileDate()}.pdf`
  doc.save(filename)
  return filename
}
