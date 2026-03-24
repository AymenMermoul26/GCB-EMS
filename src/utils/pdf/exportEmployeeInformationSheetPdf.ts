import { jsPDF } from 'jspdf'

import gcbLogo from '@/assets/brand/gcb-logo.svg'
import type { EmployeeInformationSheetDocumentEmployee } from '@/components/admin/employee-information-sheet-document'
import {
  getEmployeeCategorieProfessionnelleLabel,
  getEmployeeNationaliteLabel,
  getEmployeePosteLabel,
  getEmployeeRegionalBranchLabel,
  getEmployeeSexeLabel,
  getEmployeeSituationFamilialeLabel,
  getEmployeeTypeContratLabel,
} from '@/types/employee'

const COMPANY_NAME = 'LA SOCIETE NATIONALE DE GENIE-CIVIL & BATIMENT'
const DOCUMENT_TITLE = 'Employee Information Sheet'

interface ExportEmployeeInformationSheetPdfPayload {
  employee: EmployeeInformationSheetDocumentEmployee
  departmentName?: string | null
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

function valueOrFallback(value: string | null | undefined): string {
  if (!value || value.trim().length === 0) {
    return 'Not provided'
  }

  return value
}

function formatDateValue(value: string | null | undefined): string {
  if (!value) {
    return 'Not provided'
  }

  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
  }).format(new Date(`${value}T00:00:00`))
}

function formatNumberValue(value: number | null | undefined): string {
  return value === null || value === undefined ? 'Not provided' : String(value)
}

function drawLabelValue(doc: jsPDF, label: string, value: string, x: number, y: number): void {
  doc.setFont('helvetica', 'bold')
  doc.text(`${label}:`, x, y)
  doc.setFont('helvetica', 'normal')
  doc.text(value, x + 36, y)
}

function drawWrappedValue(
  doc: jsPDF,
  label: string,
  value: string,
  x: number,
  y: number,
  width: number,
): number {
  doc.setFont('helvetica', 'bold')
  doc.text(`${label}:`, x, y)
  doc.setFont('helvetica', 'normal')
  const wrapped = doc.splitTextToSize(value, width)
  doc.text(wrapped, x + 36, y)
  return y + Math.max(wrapped.length, 1) * 5
}

export async function exportEmployeeInformationSheetPdf(
  payload: ExportEmployeeInformationSheetPdfPayload,
): Promise<string> {
  const employee = payload.employee
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
  const fullName = `${employee.prenom} ${employee.nom}`.trim()
  const departmentName = valueOrFallback(payload.departmentName)
  const logoDataUrl = await toPngDataUrl(gcbLogo)
  const photoDataUrl = await loadImageAsDataUrl(employee.photoUrl)
  const generatedAt = new Date().toLocaleString()

  if (logoDataUrl) {
    doc.addImage(logoDataUrl, 'PNG', pageWidth - rightMargin - 24, 8, 24, 24)
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text(COMPANY_NAME, leftMargin, 15)
  doc.setFontSize(18)
  doc.text(DOCUMENT_TITLE, leftMargin, 24)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`Generated on ${generatedAt}`, leftMargin, 30)
  doc.setDrawColor(210)
  doc.line(leftMargin, 34, pageWidth - rightMargin, 34)

  const photoX = leftMargin
  const photoY = 40
  const photoSize = 38
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
    doc.text('No profile photo', photoX + 6, photoY + 20)
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text(fullName || 'Unnamed employee', 60, 48)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.text(valueOrFallback(getEmployeePosteLabel(employee.poste)), 60, 55)
  drawLabelValue(doc, 'Employee ID', employee.matricule, 60, 63)
  drawLabelValue(doc, 'Department', departmentName, 60, 70)
  drawLabelValue(
    doc,
    'Branch',
    valueOrFallback(getEmployeeRegionalBranchLabel(employee.regionalBranch)),
    60,
    77,
  )
  drawLabelValue(doc, 'Status', employee.isActive ? 'Active' : 'Inactive', 60, 84)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('Identity & Contact', leftMargin, 99)
  doc.setFontSize(10)
  drawLabelValue(doc, 'Sex', valueOrFallback(getEmployeeSexeLabel(employee.sexe)), leftMargin, 107)
  drawLabelValue(doc, 'Birth date', formatDateValue(employee.dateNaissance), leftMargin, 114)
  drawLabelValue(doc, 'Birth place', valueOrFallback(employee.lieuNaissance), leftMargin, 121)
  drawLabelValue(
    doc,
    'Nationality',
    valueOrFallback(getEmployeeNationaliteLabel(employee.nationalite)),
    leftMargin,
    128,
  )
  drawLabelValue(doc, 'Email', valueOrFallback(employee.email), leftMargin, 135)
  drawLabelValue(doc, 'Phone', valueOrFallback(employee.telephone), leftMargin, 142)
  const addressEndY = drawWrappedValue(
    doc,
    'Address',
    valueOrFallback(employee.adresse),
    leftMargin,
    149,
    contentWidth - 36,
  )

  doc.setDrawColor(220)
  doc.line(leftMargin, addressEndY + 4, pageWidth - rightMargin, addressEndY + 4)

  const employmentStartY = addressEndY + 14
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('Employment Information', leftMargin, employmentStartY)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  drawLabelValue(
    doc,
    'Job title',
    valueOrFallback(getEmployeePosteLabel(employee.poste)),
    leftMargin,
    employmentStartY + 8,
  )
  drawLabelValue(
    doc,
    'Branch',
    valueOrFallback(getEmployeeRegionalBranchLabel(employee.regionalBranch)),
    leftMargin,
    employmentStartY + 15,
  )
  drawLabelValue(
    doc,
    'Category',
    valueOrFallback(getEmployeeCategorieProfessionnelleLabel(employee.categorieProfessionnelle)),
    leftMargin,
    employmentStartY + 22,
  )
  drawLabelValue(
    doc,
    'Contract',
    valueOrFallback(getEmployeeTypeContratLabel(employee.typeContrat)),
    leftMargin,
    employmentStartY + 29,
  )
  drawLabelValue(doc, 'Hire date', formatDateValue(employee.dateRecrutement), leftMargin, employmentStartY + 36)

  doc.setDrawColor(220)
  doc.line(leftMargin, employmentStartY + 43, pageWidth - rightMargin, employmentStartY + 43)

  const adminStartY = employmentStartY + 53
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('Administrative Information', leftMargin, adminStartY)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  drawLabelValue(
    doc,
    'Marital status',
    valueOrFallback(getEmployeeSituationFamilialeLabel(employee.situationFamiliale)),
    leftMargin,
    adminStartY + 8,
  )
  drawLabelValue(doc, 'Children', formatNumberValue(employee.nombreEnfants), leftMargin, adminStartY + 15)

  doc.setDrawColor(220)
  doc.line(leftMargin, 276, pageWidth - rightMargin, 276)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(
    'Controlled employee information sheet. Internal HR notes, social security numbers, QR settings, and audit metadata are intentionally excluded.',
    leftMargin,
    282,
    { maxWidth: contentWidth },
  )

  const fileName = `employee_information_sheet_${sanitizeFilePart(employee.matricule)}_${getTodayFileDate()}.pdf`
  doc.save(fileName)
  return fileName
}
