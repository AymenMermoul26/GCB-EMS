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

export type PayslipCanonicalSource = 'PAYROLL_RUN_EMPLOYEE_RESULT'

export type PayslipDocumentRepresentationMode =
  | 'NONE'
  | 'MANUAL_UPLOAD'
  | 'GENERATED_PDF'

export type PayslipDocumentGenerationStatus =
  | 'PENDING'
  | 'GENERATED'
  | 'FAILED'

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
  | 'PAYSLIP_DOCUMENT_PUBLISHED'

export interface PayrollPayslipPdfData {
  employerName: string
  employeeFullName: string
  employeeMatricule: string
  departmentName: string | null
  jobTitle: string | null
  payrollPeriodCode: string
  payrollPeriodLabel: string
  payrollRunCode: string
  periodStart: string
  periodEnd: string
  issueDate: string
  baseSalaryAmount: number
  totalAllowancesAmount: number
  totalDeductionsAmount: number
  grossPayAmount: number
  netPayAmount: number
}

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
  | 'PAYROLL_EXPORT_REQUESTED'
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
  isActive: boolean
}

export type PayrollEmployeeExportFieldKey =
  | 'matricule'
  | 'nom'
  | 'prenom'
  | 'departement'
  | 'regional_branch'
  | 'poste'
  | 'categorie_professionnelle'
  | 'type_contrat'
  | 'date_recrutement'
  | 'is_active'

export interface PayrollEmployeeExportFieldDefinition {
  key: PayrollEmployeeExportFieldKey
  label: string
  header: string
}

export const PAYROLL_EMPLOYEE_EXPORT_FIELD_DEFINITIONS: PayrollEmployeeExportFieldDefinition[] = [
  {
    key: 'matricule',
    label: 'Employee ID',
    header: 'matricule',
  },
  {
    key: 'nom',
    label: 'Last name',
    header: 'nom',
  },
  {
    key: 'prenom',
    label: 'First name',
    header: 'prenom',
  },
  {
    key: 'departement',
    label: 'Department',
    header: 'departement',
  },
  {
    key: 'regional_branch',
    label: 'Regional branch',
    header: 'regional_branch',
  },
  {
    key: 'poste',
    label: 'Job title',
    header: 'poste',
  },
  {
    key: 'categorie_professionnelle',
    label: 'Professional category',
    header: 'categorie_professionnelle',
  },
  {
    key: 'type_contrat',
    label: 'Contract type',
    header: 'type_contrat',
  },
  {
    key: 'date_recrutement',
    label: 'Hire date',
    header: 'date_recrutement',
  },
  {
    key: 'is_active',
    label: 'Status',
    header: 'is_active',
  },
] as const

export function buildPayrollEmployeeDirectoryExportFileName(date = new Date()): string {
  return `payroll_employees_${date.toISOString().slice(0, 10)}.csv`
}

export function getPayrollExportActionLabel(action: PayrollExportAction): string {
  switch (action) {
    case 'PAYROLL_EXPORT_REQUESTED':
      return 'CSV export requested'
    case 'PAYROLL_EXPORT_PRINT_INITIATED':
      return 'Information sheet export'
    case 'PAYROLL_EXPORT_GENERATED':
    default:
      return 'CSV export generated'
  }
}

export function getPayrollExportActionTone(
  action: PayrollExportAction,
): 'warning' | 'brand' | 'info' {
  switch (action) {
    case 'PAYROLL_EXPORT_REQUESTED':
      return 'warning'
    case 'PAYROLL_EXPORT_PRINT_INITIATED':
      return 'info'
    case 'PAYROLL_EXPORT_GENERATED':
    default:
      return 'brand'
  }
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
  payslipId: string | null
  payslipStatus: PayrollProcessingStatus | null
  payslipPublishedAt: string | null
  payslipDocumentReady: boolean
  payslipDocumentRepresentationMode: PayslipDocumentRepresentationMode | null
  payslipGenerationStatus: PayslipDocumentGenerationStatus | null
  payslipGeneratedAt: string | null
  payslipGenerationError: string | null
  payslipFileName: string | null
  payslipStoragePath: string | null
  payslipContentType: string | null
  payslipFileSizeBytes: number | null
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
  payrollRunEmployeId: string
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
  canonicalSource: PayslipCanonicalSource | null
  documentReady: boolean
  documentRepresentationMode: PayslipDocumentRepresentationMode
  documentGenerationStatus: PayslipDocumentGenerationStatus
  documentGeneratedAt: string | null
  documentGenerationError: string | null
  documentContentType: string | null
  documentFileSizeBytes: number | null
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
  canonicalSourcePayrollRunId: string | null
  canonicalSourcePayrollRunEmployeId: string | null
  canonicalPayslipId: string | null
  canonicalPayslipStatus: PayrollProcessingStatus | null
  canonicalPayslipPublishedAt: string | null
  canonicalDocumentReady: boolean
  canonicalDocumentRepresentationMode: PayslipDocumentRepresentationMode | null
  canonicalDocumentFileName: string | null
  canonicalDocumentStoragePath: string | null
  canonicalDocumentContentType: string | null
  canonicalDocumentFileSizeBytes: number | null
  documentId: string | null
  documentFileName: string | null
  documentStoragePath: string | null
  documentPublishedAt: string | null
  createdAt: string
  reviewedAt: string | null
  fulfilledAt: string | null
  updatedAt: string
}

export type PayslipWorkflowStepKey =
  | 'REQUESTED'
  | 'IN_REVIEW'
  | 'GENERATED'
  | 'AVAILABLE'
  | 'REJECTED'

export type PayslipWorkflowStepState =
  | 'completed'
  | 'current'
  | 'pending'
  | 'rejected'

export interface PayslipWorkflowRequestTimelineInput {
  status: PayslipRequestStatus
  createdAt: string
  reviewedAt: string | null
  canonicalPayslipPublishedAt: string | null
  canonicalDocumentReady: boolean
  documentPublishedAt?: string | null
  fulfilledAt?: string | null
}

export interface PayslipWorkflowPublishedTimelineInput {
  status: PayrollProcessingStatus | null
  publishedAt: string | null
  documentReady: boolean
  documentGeneratedAt?: string | null
}

export interface PayslipWorkflowRequestTimelineSource {
  kind: 'REQUEST'
  status: PayslipRequestStatus
  requestedAt: string
  reviewedAt: string | null
  generatedAt: string | null
  availableAt: string | null
}

export interface PayslipWorkflowPublishedTimelineSource {
  kind: 'PAYSLIP'
  status: PayrollProcessingStatus | null
  publishedAt: string | null
  generatedAt: string | null
  availableAt: string | null
}

export type PayslipWorkflowTimelineSource =
  | PayslipWorkflowRequestTimelineSource
  | PayslipWorkflowPublishedTimelineSource

export interface PayslipWorkflowTimelineStep {
  key: PayslipWorkflowStepKey
  label: string
  description: string
  state: PayslipWorkflowStepState
  timestamp: string | null
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
  canonicalSourcePayrollRunId: string | null
  canonicalSourcePayrollRunEmployeId: string | null
  canonicalPayslipId: string | null
  canonicalPayslipStatus: PayrollProcessingStatus | null
  canonicalPayslipPublishedAt: string | null
  canonicalDocumentReady: boolean
  canonicalDocumentRepresentationMode: PayslipDocumentRepresentationMode | null
  canonicalDocumentFileName: string | null
  canonicalDocumentStoragePath: string | null
  canonicalDocumentContentType: string | null
  canonicalDocumentFileSizeBytes: number | null
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

const PAYSLIP_WORKFLOW_STEP_COPY = {
  REQUESTED: {
    label: 'Requested',
    description: 'Employee submitted the payslip request.',
  },
  IN_REVIEW: {
    label: 'In Review',
    description: 'Payroll is reviewing the request and document availability.',
  },
  GENERATED: {
    label: 'Generated',
    description: 'Payroll published the canonical payslip record from the payroll result.',
  },
  AVAILABLE: {
    label: 'Available',
    description: 'A generated document representation is now available in the employee account.',
  },
  REJECTED: {
    label: 'Rejected',
    description: 'The request was closed without making a payslip document available.',
  },
} as const

export const PAYSLIP_DOCUMENT_SOURCE_LABELS: Record<PayslipDocumentSource, string> = {
  REQUEST_DELIVERY: 'Request delivery',
  PAYROLL_PUBLICATION: 'Payroll publication',
}

export const PAYSLIP_DOCUMENT_REPRESENTATION_MODE_LABELS: Record<
  PayslipDocumentRepresentationMode,
  string
> = {
  NONE: 'No document attached',
  MANUAL_UPLOAD: 'Legacy manual PDF',
  GENERATED_PDF: 'Generated PDF document',
}

export const PAYSLIP_DOCUMENT_GENERATION_STATUS_LABELS: Record<
  PayslipDocumentGenerationStatus,
  string
> = {
  PENDING: 'Document generation pending',
  GENERATED: 'Document generated',
  FAILED: 'Document generation failed',
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

export function getPayslipWorkflowStepCopy(
  step: PayslipWorkflowStepKey,
  t?: TranslateFn,
) {
  const base = PAYSLIP_WORKFLOW_STEP_COPY[step]
  const translatedLabel = t?.(`payroll.payslipWorkflow.steps.${step}.label`)
  const translatedDescription = t?.(`payroll.payslipWorkflow.steps.${step}.description`)

  return {
    label:
      !translatedLabel || translatedLabel === `payroll.payslipWorkflow.steps.${step}.label`
        ? base.label
        : translatedLabel,
    description:
      !translatedDescription ||
      translatedDescription === `payroll.payslipWorkflow.steps.${step}.description`
        ? base.description
        : translatedDescription,
  }
}

export function buildPayslipRequestTimelineSource(
  input: PayslipWorkflowRequestTimelineInput,
): PayslipWorkflowRequestTimelineSource {
  return {
    kind: 'REQUEST',
    status: input.status,
    requestedAt: input.createdAt,
    reviewedAt: input.reviewedAt,
    generatedAt: input.canonicalPayslipPublishedAt,
    availableAt:
      input.documentPublishedAt ??
      input.fulfilledAt ??
      (input.canonicalDocumentReady ? input.canonicalPayslipPublishedAt : null),
  }
}

export function buildPublishedPayslipTimelineSource(
  input: PayslipWorkflowPublishedTimelineInput,
): PayslipWorkflowPublishedTimelineSource {
  const availableAt = input.documentReady
    ? input.documentGeneratedAt ?? input.publishedAt
    : null

  return {
    kind: 'PAYSLIP',
    status: input.status,
    publishedAt: input.publishedAt,
    generatedAt: input.publishedAt,
    availableAt,
  }
}

export function buildPayslipWorkflowTimelineSteps(
  source: PayslipWorkflowTimelineSource,
  t?: TranslateFn,
): PayslipWorkflowTimelineStep[] {
  const generatedCopy = getPayslipWorkflowStepCopy('GENERATED', t)
  const availableCopy = getPayslipWorkflowStepCopy('AVAILABLE', t)

  if (source.kind === 'PAYSLIP') {
    const isClosed = source.status === 'ARCHIVED'

    return [
      {
        key: 'GENERATED',
        label: generatedCopy.label,
        description: generatedCopy.description,
        state: source.generatedAt
          ? source.availableAt
            ? 'completed'
            : 'current'
          : 'pending',
        timestamp: source.generatedAt,
      },
      {
        key: 'AVAILABLE',
        label: availableCopy.label,
        description: availableCopy.description,
        state: source.availableAt
          ? isClosed
            ? 'completed'
            : 'current'
          : 'pending',
        timestamp: source.availableAt,
      },
    ]
  }

  const requestedCopy = getPayslipWorkflowStepCopy('REQUESTED', t)
  const reviewCopy = getPayslipWorkflowStepCopy('IN_REVIEW', t)

  if (source.status === 'REJECTED') {
    const rejectedCopy = getPayslipWorkflowStepCopy('REJECTED', t)

    return [
      {
        key: 'REQUESTED',
        label: requestedCopy.label,
        description: requestedCopy.description,
        state: 'completed',
        timestamp: source.requestedAt,
      },
      {
        key: 'IN_REVIEW',
        label: reviewCopy.label,
        description: reviewCopy.description,
        state: 'completed',
        timestamp: source.reviewedAt,
      },
      {
        key: 'REJECTED',
        label: rejectedCopy.label,
        description: rejectedCopy.description,
        state: 'rejected',
        timestamp: source.reviewedAt,
      },
    ]
  }

  return [
    {
      key: 'REQUESTED',
      label: requestedCopy.label,
      description: requestedCopy.description,
      state: 'completed',
      timestamp: source.requestedAt,
    },
    {
      key: 'IN_REVIEW',
      label: reviewCopy.label,
      description: reviewCopy.description,
      state:
        source.status === 'PENDING'
          ? 'pending'
          : source.status === 'IN_REVIEW'
            ? 'current'
            : 'completed',
      timestamp: source.reviewedAt,
    },
    {
      key: 'GENERATED',
      label: generatedCopy.label,
      description: generatedCopy.description,
      state: source.generatedAt
        ? source.availableAt
          ? 'completed'
          : 'current'
        : 'pending',
      timestamp: source.generatedAt,
    },
    {
      key: 'AVAILABLE',
      label: availableCopy.label,
      description: availableCopy.description,
      state: source.availableAt ? 'current' : 'pending',
      timestamp: source.availableAt,
    },
  ]
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

function readMetadataText(
  publicationMetadataJson: Record<string, unknown> | null | undefined,
  key: string,
): string | null {
  const value = publicationMetadataJson?.[key]
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function readMetadataBoolean(
  publicationMetadataJson: Record<string, unknown> | null | undefined,
  key: string,
): boolean | null {
  const value = publicationMetadataJson?.[key]

  if (typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'string') {
    if (value === 'true') {
      return true
    }

    if (value === 'false') {
      return false
    }
  }

  return null
}

function readMetadataNumber(
  publicationMetadataJson: Record<string, unknown> | null | undefined,
  key: string,
): number | null {
  const value = publicationMetadataJson?.[key]

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

export function resolvePayslipCanonicalSource(
  publicationMetadataJson: Record<string, unknown> | null | undefined,
): PayslipCanonicalSource | null {
  const source = readMetadataText(publicationMetadataJson, 'canonicalSource')
  return source === 'PAYROLL_RUN_EMPLOYEE_RESULT' ? source : null
}

export function resolvePayslipDocumentRepresentationMode(
  publicationMetadataJson: Record<string, unknown> | null | undefined,
  hasDocumentAttachment = false,
): PayslipDocumentRepresentationMode {
  const mode = readMetadataText(publicationMetadataJson, 'documentRepresentationMode')
  const publicationSource = readMetadataText(publicationMetadataJson, 'publicationSource')

  switch (mode) {
    case 'MANUAL_UPLOAD':
    case 'GENERATED_PDF':
      return mode
    case 'NONE':
      return 'NONE'
    default:
      if (!hasDocumentAttachment) {
        return 'NONE'
      }

      return publicationSource === 'payslip_request_workflow'
        ? 'MANUAL_UPLOAD'
        : 'GENERATED_PDF'
  }
}

export function isPayslipDocumentReady(
  publicationMetadataJson: Record<string, unknown> | null | undefined,
  hasDocumentAttachment = false,
): boolean {
  return readMetadataBoolean(publicationMetadataJson, 'documentReady') ?? hasDocumentAttachment
}

export function resolvePayslipDocumentGenerationStatus(
  publicationMetadataJson: Record<string, unknown> | null | undefined,
  hasDocumentAttachment = false,
): PayslipDocumentGenerationStatus {
  const status = readMetadataText(publicationMetadataJson, 'generationStatus')

  switch (status) {
    case 'FAILED':
      return 'FAILED'
    case 'GENERATED':
      return 'GENERATED'
    case 'PENDING':
      return 'PENDING'
    default:
      return hasDocumentAttachment ? 'GENERATED' : 'PENDING'
  }
}

export function resolvePayslipDocumentGeneratedAt(
  publicationMetadataJson: Record<string, unknown> | null | undefined,
): string | null {
  return readMetadataText(publicationMetadataJson, 'generatedAt')
}

export function resolvePayslipDocumentGenerationError(
  publicationMetadataJson: Record<string, unknown> | null | undefined,
): string | null {
  return readMetadataText(publicationMetadataJson, 'generationError')
}

export function resolvePayslipDocumentContentType(
  publicationMetadataJson: Record<string, unknown> | null | undefined,
  hasDocumentAttachment = false,
): string | null {
  return (
    readMetadataText(publicationMetadataJson, 'contentType') ??
    (hasDocumentAttachment ? 'application/pdf' : null)
  )
}

export function resolvePayslipDocumentFileSizeBytes(
  publicationMetadataJson: Record<string, unknown> | null | undefined,
): number | null {
  return readMetadataNumber(publicationMetadataJson, 'fileSizeBytes')
}

export function getPayslipDocumentRepresentationModeLabel(
  mode: PayslipDocumentRepresentationMode,
  t?: TranslateFn,
): string {
  const translated = t?.(`payroll.documentRepresentationMode.${mode}`)
  return !translated || translated === `payroll.documentRepresentationMode.${mode}`
    ? PAYSLIP_DOCUMENT_REPRESENTATION_MODE_LABELS[mode]
    : translated
}

export function getPayslipDocumentGenerationStatusLabel(
  status: PayslipDocumentGenerationStatus,
  t?: TranslateFn,
): string {
  const translated = t?.(`payroll.documentGenerationStatus.${status}`)
  return !translated || translated === `payroll.documentGenerationStatus.${status}`
    ? PAYSLIP_DOCUMENT_GENERATION_STATUS_LABELS[status]
    : translated
}
