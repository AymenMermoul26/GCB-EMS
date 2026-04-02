import { jsPDF } from 'jspdf'

import gcbLogo from '@/assets/brand/gcb-logo.svg'
import type { PayrollPayslipPdfData } from '@/types/payroll'

const EMPLOYER_NAME = 'LA SOCIETE NATIONALE DE GENIE-CIVIL & BATIMENT'
const DOCUMENT_TITLE = 'Payroll Payslip'
let logoDataUrlPromise: Promise<string | null> | null = null

interface GeneratePayrollPayslipPdfResult {
  blob: Blob
  fileName: string
}

function sanitizeFilePart(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .toLowerCase()
}

function formatDateValue(value: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
  }).format(new Date(value))
}

function formatPeriodValue(start: string, end: string): string {
  return `${formatDateValue(`${start}T00:00:00`)} - ${formatDateValue(`${end}T00:00:00`)}`
}

function formatAmount(value: number): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function valueOrFallback(value: string | null | undefined): string {
  if (!value || value.trim().length === 0) {
    return 'Not provided'
  }

  return value
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
    reader.onerror = () => reject(new Error('Unable to read image file.'))
    reader.readAsDataURL(blob)
  })
}

async function toPngDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      return null
    }

    const blob = await response.blob()
    const sourceDataUrl = await blobToDataUrl(blob)
    const image = await loadImageElement(sourceDataUrl)
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

function loadLogoDataUrl(): Promise<string | null> {
  if (!logoDataUrlPromise) {
    logoDataUrlPromise = toPngDataUrl(gcbLogo)
  }

  return logoDataUrlPromise
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Unable to load image.'))
    image.src = src
  })
}

function drawSectionTitle(doc: jsPDF, title: string, y: number): void {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(30, 41, 59)
  doc.text(title, 16, y)
  doc.setDrawColor(226, 232, 240)
  doc.line(16, y + 2, 194, y + 2)
}

function drawLabelValue(
  doc: jsPDF,
  label: string,
  value: string,
  x: number,
  y: number,
): void {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(100, 116, 139)
  doc.text(label.toUpperCase(), x, y)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(15, 23, 42)
  doc.text(value, x, y + 6)
}

function drawAmountRow(
  doc: jsPDF,
  label: string,
  amount: number,
  x: number,
  y: number,
  width: number,
): void {
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(51, 65, 85)
  doc.text(label, x, y)
  doc.text(formatAmount(amount), x + width, y, { align: 'right' })
}

function buildFileName(payload: PayrollPayslipPdfData): string {
  return `payslip_${sanitizeFilePart(payload.employeeMatricule)}_${sanitizeFilePart(payload.payrollPeriodCode)}.pdf`
}

export async function generatePayrollPayslipPdf(
  payload: PayrollPayslipPdfData,
): Promise<GeneratePayrollPayslipPdfResult> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  })

  const logoDataUrl = await loadLogoDataUrl()
  const left = 16
  const right = 194
  const columnGap = 8
  const columnWidth = (right - left - columnGap) / 2
  let y = 18

  if (logoDataUrl) {
    doc.addImage(logoDataUrl, 'PNG', right - 20, 10, 16, 16)
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(15, 23, 42)
  doc.text(payload.employerName, left, y)

  y += 8
  doc.setFontSize(19)
  doc.text(DOCUMENT_TITLE, left, y)

  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(71, 85, 105)
  doc.text(`Issue date: ${formatDateValue(payload.issueDate)}`, left, y)
  doc.text(`Payroll run: ${payload.payrollRunCode}`, 120, y)

  y += 8
  doc.setDrawColor(226, 232, 240)
  doc.line(left, y, right, y)

  y += 10
  drawSectionTitle(doc, 'Employee Information', y)

  y += 8
  drawLabelValue(doc, 'Employee', payload.employeeFullName, left, y)
  drawLabelValue(doc, 'Employee ID', payload.employeeMatricule, left + columnWidth + columnGap, y)

  y += 18
  drawLabelValue(doc, 'Department', valueOrFallback(payload.departmentName), left, y)
  drawLabelValue(doc, 'Job title', valueOrFallback(payload.jobTitle), left + columnWidth + columnGap, y)

  y += 22
  drawSectionTitle(doc, 'Payroll Period', y)

  y += 8
  drawLabelValue(doc, 'Period', payload.payrollPeriodLabel, left, y)
  drawLabelValue(doc, 'Period code', payload.payrollPeriodCode, left + columnWidth + columnGap, y)

  y += 18
  drawLabelValue(doc, 'Coverage', formatPeriodValue(payload.periodStart, payload.periodEnd), left, y)

  y += 24
  drawSectionTitle(doc, 'Earnings and Deductions', y)

  y += 8
  doc.setFillColor(248, 250, 252)
  doc.roundedRect(left, y, right - left, 52, 3, 3, 'F')

  const amountLeft = left + 8
  const amountRight = right - 8

  drawAmountRow(doc, 'Base salary', payload.baseSalaryAmount, amountLeft, y + 10, amountRight - amountLeft)
  drawAmountRow(
    doc,
    'Allowances total',
    payload.totalAllowancesAmount,
    amountLeft,
    y + 20,
    amountRight - amountLeft,
  )
  drawAmountRow(doc, 'Gross pay', payload.grossPayAmount, amountLeft, y + 30, amountRight - amountLeft)
  drawAmountRow(
    doc,
    'Deductions total',
    payload.totalDeductionsAmount,
    amountLeft,
    y + 40,
    amountRight - amountLeft,
  )

  y += 60
  doc.setFillColor(241, 245, 249)
  doc.roundedRect(left, y, right - left, 20, 3, 3, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(15, 23, 42)
  doc.text('Net pay', amountLeft, y + 12)
  doc.text(formatAmount(payload.netPayAmount), amountRight, y + 12, { align: 'right' })

  y += 30
  doc.setDrawColor(226, 232, 240)
  doc.line(left, y, right, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(100, 116, 139)
  doc.text(
    'This payroll-derived payslip is generated automatically from the published payroll result for one employee and one payroll period.',
    left,
    y + 8,
    { maxWidth: right - left },
  )

  return {
    blob: new Blob([doc.output('arraybuffer')], { type: 'application/pdf' }),
    fileName: buildFileName(payload),
  }
}

export { EMPLOYER_NAME as PAYROLL_EMPLOYER_NAME }
