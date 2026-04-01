import type { NotificationsFilter } from '@/types/notification'
import type { TranslateFn } from '@/i18n/messages'

export type PayrollEmployeeStatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE'

export type PayrollNotificationCategory =
  | 'employment'
  | 'family_admin'
  | 'status_change'
  | 'new_employee'

export type PayrollChangeFieldKey =
  | 'regionalBranch'
  | 'categorieProfessionnelle'
  | 'typeContrat'
  | 'dateRecrutement'
  | 'situationFamiliale'
  | 'nombreEnfants'
  | 'adresse'
  | 'numeroSecuriteSociale'
  | 'isActive'

export type PayrollPeriodStatus = 'DRAFT' | 'OPEN' | 'CLOSED' | 'ARCHIVED'

export type PayrollProcessingStatus =
  | 'DRAFT'
  | 'CALCULATED'
  | 'UNDER_REVIEW'
  | 'FINALIZED'
  | 'PUBLISHED'
  | 'ARCHIVED'

export type PayrollCalculationStatus =
  | 'PENDING'
  | 'CALCULATED'
  | 'EXCLUDED'
  | 'FAILED'

export type PayslipRequestStatus =
  | 'PENDING'
  | 'IN_REVIEW'
  | 'FULFILLED'
  | 'REJECTED'

export type PayslipRequestStatusFilter = 'ALL' | PayslipRequestStatus

export type PayslipDocumentSource =
  | 'REQUEST_DELIVERY'
  | 'PAYROLL_PUBLICATION'

export type PayrollRunType =
  | 'REGULAR'
  | 'SUPPLEMENTAL'
  | 'ADJUSTMENT'
  | 'CORRECTION'
  | (string & {})

export type PayrollProcessingAuditAction =
  | 'PAYROLL_PERIOD_CREATED'
  | 'PAYROLL_RUN_CREATED'
  | 'PAYROLL_RUN_UPDATED'
  | 'PAYROLL_RUN_FINALIZED'
  | 'PAYROLL_CALCULATION_STARTED'
  | 'PAYROLL_CALCULATION_COMPLETED'
  | 'PAYROLL_CALCULATION_FAILED'
  | 'PAYROLL_PAYSLIP_PUBLISHED'

export interface PayrollEmployeeListItem {
  id: string
  departementId: string | null
  departementNom: string | null
  regionalBranch: string | null
  matricule: string
  nom: string
  prenom: string
  poste: string | null
  categorieProfessionnelle: string | null
  typeContrat: string | null
  isActive: boolean
}

export interface PayrollEmployeeDetail {
  id: string
  departementId: string | null
  departementNom: string | null
  regionalBranch: string | null
  matricule: string
  nom: string
  prenom: string
  photoUrl: string | null
  poste: string | null
  categorieProfessionnelle: string | null
  typeContrat: string | null
  dateRecrutement: string | null
  email: string | null
  telephone: string | null
  sexe: string | null
  dateNaissance: string | null
  lieuNaissance: string | null
  nationalite: string | null
  situationFamiliale: string | null
  nombreEnfants: number | null
  adresse: string | null
  isActive: boolean
  numeroSecuriteSociale: string | null
}

export interface PayrollEmployeeListFilters {
  search?: string
  departementId?: string
  regionalBranch?: string
  status?: PayrollEmployeeStatusFilter
  typeContrat?: string
}

export interface PayrollNotificationItem {
  id: string
  userId: string
  title: string
  body: string
  link: string | null
  isRead: boolean
  createdAt: string
  updatedAt: string
  category: PayrollNotificationCategory
  employeeId: string | null
  employeeName: string | null
  matricule: string | null
  changedFields: PayrollChangeFieldKey[]
  summary: string
}

export interface PayrollNotificationsListOptions {
  filter?: NotificationsFilter
  limit?: number
}

export type PayrollExportType =
  | 'PAYROLL_EMPLOYEE_DIRECTORY_CSV'
  | 'PAYROLL_EMPLOYEE_INFORMATION_SHEET'

export type PayrollExportAction =
  | 'PAYROLL_EXPORT_GENERATED'
  | 'PAYROLL_EXPORT_PRINT_INITIATED'

export interface PayrollEmployeeExportRow {
  id: string
  departementId: string | null
  departementNom: string | null
  regionalBranch: string | null
  matricule: string
  nom: string
  prenom: string
  poste: string | null
  categorieProfessionnelle: string | null
  typeContrat: string | null
  dateRecrutement: string | null
  email: string | null
  telephone: string | null
  adresse: string | null
  situationFamiliale: string | null
  nombreEnfants: number | null
  isActive: boolean
}

export interface PayrollExportHistoryItem {
  id: string
  action: PayrollExportAction
  exportType: PayrollExportType
  targetType: string
  targetId: string | null
  employeeId: string | null
  employeeName: string | null
  matricule: string | null
  rowCount: number | null
  fileName: string | null
  format: string | null
  search: string | null
  departmentId: string | null
  departmentName: string | null
  regionalBranch: string | null
  status: PayrollEmployeeStatusFilter
  typeContrat: string | null
  createdAt: string
}

export interface PayrollExportHistoryListOptions {
  limit?: number
}

export interface PayrollPeriod {
  id: string
  code: string
  label: string
  periodStart: string
  periodEnd: string
  status: PayrollPeriodStatus
  notes: string | null
  runCount: number
  publishedPayslipCount: number
  createdAt: string
  updatedAt: string
}

export interface PayrollCompensationProfile {
  compensationProfileId: string | null
  employeId: string
  matricule: string
  nom: string
  prenom: string
  departementNom: string | null
  poste: string | null
  categorieProfessionnelle: string | null
  typeContrat: string | null
  isActive: boolean
  hasProfile: boolean
  isPayrollEligible: boolean
  baseSalaryAmount: number | null
  fixedAllowanceAmount: number | null
  fixedDeductionAmount: number | null
  notes: string | null
  updatedAt: string | null
}

export interface PayrollCompensationProfileFilters {
  search?: string
  payrollEligible?: boolean | null
}

export interface UpsertPayrollCompensationProfilePayload {
  employeId: string
  baseSalaryAmount: number
  fixedAllowanceAmount: number
  fixedDeductionAmount: number
  isPayrollEligible: boolean
  notes?: string
}

export interface PayrollRunSummary {
  id: string
  payrollPeriodId: string
  periodCode: string
  periodLabel: string
  code: string
  runType: PayrollRunType
  status: PayrollProcessingStatus
  notes: string | null
  employeeCount: number
  calculatedEmployeeCount: number
  excludedEmployeeCount: number
  failedEmployeeCount: number
  totalGrossPay: number
  totalDeductionsAmount: number
  totalNetPay: number
  publishedPayslipCount: number
  createdAt: string
  calculatedAt: string | null
  reviewedAt: string | null
  finalizedAt: string | null
  publishedAt: string | null
  archivedAt: string | null
}

export interface PayrollRunDetail extends PayrollRunSummary {
  periodStart: string
  periodEnd: string
}

export interface PayrollRunEmployeeEntry {
  id: string
  payrollRunId: string
  employeId: string
  matricule: string
  nom: string
  prenom: string
  departementNom: string | null
  poste: string | null
  categorieProfessionnelle: string | null
  typeContrat: string | null
  status: PayrollProcessingStatus
  calculationStatus: PayrollCalculationStatus
  exclusionReason: string | null
  calculationNotes: string | null
  hasPayslip: boolean
  payslipStatus: PayrollProcessingStatus | null
  payslipPublishedAt: string | null
  issueFlags: string[]
  calculationInputJson: Record<string, unknown>
  employeeSnapshotJson: Record<string, unknown>
  resultSummaryJson: Record<string, unknown>
  baseSalaryAmount: number | null
  totalAllowancesAmount: number | null
  grossPayAmount: number | null
  totalDeductionsAmount: number | null
  netPayAmount: number | null
  calculatedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface PayrollRunCalculationResult {
  payrollRunId: string
  employeeCount: number
  calculatedEmployeeCount: number
  excludedEmployeeCount: number
  failedEmployeeCount: number
  totalGrossPay: number
  totalDeductionsAmount: number
  totalNetPay: number
  calculatedAt: string
}

export interface EmployeePayslipListItem {
  id: string
  payrollRunId: string
  payrollPeriodId: string
  payrollPeriodCode: string
  payrollPeriodLabel: string
  periodStart: string
  periodEnd: string
  payrollRunCode: string
  status: PayrollProcessingStatus
  publishedAt: string | null
  fileName: string | null
  storagePath: string | null
  publicationMetadataJson: Record<string, unknown>
  createdAt: string
}

export interface PayslipRequestPeriodOption {
  id: string
  code: string
  label: string
  periodStart: string
  periodEnd: string
  status: PayrollPeriodStatus
}

export interface EmployeePayslipRequestItem {
  id: string
  payrollPeriodId: string
  payrollPeriodCode: string
  payrollPeriodLabel: string
  periodStart: string
  periodEnd: string
  status: PayslipRequestStatus
  requestNote: string | null
  reviewNote: string | null
  linkedPayslipId: string | null
  documentId: string | null
  documentFileName: string | null
  documentStoragePath: string | null
  documentPublishedAt: string | null
  createdAt: string
  reviewedAt: string | null
  fulfilledAt: string | null
  updatedAt: string
}

export interface AvailablePayslipDocumentItem {
  id: string
  payslipId: string | null
  payslipRequestId: string | null
  source: PayslipDocumentSource
  payrollPeriodId: string
  payrollPeriodCode: string
  payrollPeriodLabel: string
  periodStart: string
  periodEnd: string
  fileName: string
  storagePath: string
  contentType: string
  fileSizeBytes: number | null
  publishedAt: string
  createdAt: string
  auditTargetType: 'PayslipDelivery' | 'Payslip'
  auditTargetId: string
}

export interface PayrollPayslipRequestItem {
  id: string
  employeId: string
  employeMatricule: string
  employeNom: string
  employePrenom: string
  employeEmail: string | null
  departementNom: string | null
  payrollPeriodId: string
  payrollPeriodCode: string
  payrollPeriodLabel: string
  periodStart: string
  periodEnd: string
  status: PayslipRequestStatus
  requestNote: string | null
  reviewNote: string | null
  linkedPayslipId: string | null
  documentId: string | null
  documentFileName: string | null
  documentStoragePath: string | null
  documentPublishedAt: string | null
  reviewedByUserId: string | null
  fulfilledByUserId: string | null
  createdAt: string
  reviewedAt: string | null
  fulfilledAt: string | null
  updatedAt: string
}

export interface CreatePayslipRequestPayload {
  payrollPeriodId: string
  requestNote?: string
}

export interface UpdatePayslipRequestStatusPayload {
  requestId: string
  status: Extract<PayslipRequestStatus, 'IN_REVIEW' | 'REJECTED'>
  reviewNote?: string
}

export interface FulfillPayslipRequestPayload {
  requestId: string
  employeId: string
  file: File
  reviewNote?: string
}

export interface CreatePayrollPeriodPayload {
  code: string
  label: string
  periodStart: string
  periodEnd: string
  notes?: string
}

export interface UpdatePayrollPeriodStatusPayload {
  periodId: string
  status: PayrollPeriodStatus
}

export interface CreatePayrollRunPayload {
  payrollPeriodId: string
  code: string
  runType: PayrollRunType
  notes?: string
}

export interface UpdatePayrollRunStatusPayload {
  runId: string
  status: PayrollProcessingStatus
  notes?: string
}

export interface PayrollProcessingActivityItem {
  id: string
  action: PayrollProcessingAuditAction
  targetType: string
  targetId: string | null
  payrollPeriodId: string | null
  payrollRunId: string | null
  payslipId: string | null
  employeeId: string | null
  employeeName: string | null
  matricule: string | null
  summary: string
  createdAt: string
  detailsJson: Record<string, unknown>
}

export interface PayrollProcessingActivityListOptions {
  limit?: number
}

export const PAYROLL_PERIOD_STATUS_META = {
  DRAFT: { label: 'Draft', tone: 'neutral' },
  OPEN: { label: 'Open', tone: 'brand' },
  CLOSED: { label: 'Closed', tone: 'info' },
  ARCHIVED: { label: 'Archived', tone: 'neutral' },
} as const

export const PAYROLL_PROCESSING_STATUS_META = {
  DRAFT: { label: 'Draft', tone: 'neutral' },
  CALCULATED: { label: 'Calculated', tone: 'info' },
  UNDER_REVIEW: { label: 'Under review', tone: 'warning' },
  FINALIZED: { label: 'Finalized', tone: 'brand' },
  PUBLISHED: { label: 'Published', tone: 'success' },
  ARCHIVED: { label: 'Archived', tone: 'neutral' },
} as const

export const PAYROLL_CALCULATION_STATUS_META = {
  PENDING: { label: 'Pending', tone: 'neutral' },
  CALCULATED: { label: 'Calculated', tone: 'success' },
  EXCLUDED: { label: 'Excluded', tone: 'warning' },
  FAILED: { label: 'Failed', tone: 'danger' },
} as const

export const PAYSLIP_REQUEST_STATUS_META = {
  PENDING: { label: 'Pending', tone: 'warning' },
  IN_REVIEW: { label: 'In review', tone: 'info' },
  FULFILLED: { label: 'Fulfilled', tone: 'success' },
  REJECTED: { label: 'Rejected', tone: 'danger' },
} as const

export const PAYSLIP_DOCUMENT_SOURCE_LABELS: Record<PayslipDocumentSource, string> = {
  REQUEST_DELIVERY: 'Request delivery',
  PAYROLL_PUBLICATION: 'Payroll publication',
}

export const PAYROLL_RUN_TYPE_LABELS: Record<string, string> = {
  REGULAR: 'Regular',
  SUPPLEMENTAL: 'Supplemental',
  ADJUSTMENT: 'Adjustment',
  CORRECTION: 'Correction',
}

export function getPayrollPeriodStatusMeta(
  status: PayrollPeriodStatus,
  t?: TranslateFn,
) {
  const base = PAYROLL_PERIOD_STATUS_META[status]
  const translated = t?.(`status.payrollPeriod.${status}`)

  return {
    ...base,
    label:
      !translated || translated === `status.payrollPeriod.${status}`
        ? base.label
        : translated,
  }
}

export function getPayrollProcessingStatusMeta(
  status: PayrollProcessingStatus,
  t?: TranslateFn,
) {
  const base = PAYROLL_PROCESSING_STATUS_META[status]
  const translated = t?.(`status.payrollProcessing.${status}`)

  return {
    ...base,
    label:
      !translated || translated === `status.payrollProcessing.${status}`
        ? base.label
        : translated,
  }
}

export function getPayrollCalculationStatusMeta(
  status: PayrollCalculationStatus,
  t?: TranslateFn,
) {
  const base = PAYROLL_CALCULATION_STATUS_META[status]
  const translated = t?.(`status.payrollCalculation.${status}`)

  return {
    ...base,
    label:
      !translated || translated === `status.payrollCalculation.${status}`
        ? base.label
        : translated,
  }
}

export function getPayslipRequestStatusMeta(
  status: PayslipRequestStatus,
  t?: TranslateFn,
) {
  const base = PAYSLIP_REQUEST_STATUS_META[status]
  const translated = t?.(`status.payslipRequest.${status}`)

  return {
    ...base,
    label:
      !translated || translated === `status.payslipRequest.${status}`
        ? base.label
        : translated,
  }
}

export function getPayslipDocumentSourceLabel(
  source: PayslipDocumentSource,
  t?: TranslateFn,
): string {
  const translated = t?.(`payroll.documentSource.${source}`)
  return !translated || translated === `payroll.documentSource.${source}`
    ? PAYSLIP_DOCUMENT_SOURCE_LABELS[source]
    : translated
}

export function getPayrollRunTypeLabel(
  runType: PayrollRunType,
  t?: TranslateFn,
): string {
  const fallback = PAYROLL_RUN_TYPE_LABELS[runType] ?? runType.replaceAll('_', ' ')
  const translated = t?.(`payroll.runType.${runType}`)
  return !translated || translated === `payroll.runType.${runType}`
    ? fallback
    : translated
}
