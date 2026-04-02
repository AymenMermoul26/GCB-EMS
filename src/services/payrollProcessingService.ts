import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
} from '@tanstack/react-query'

import { supabase } from '@/lib/supabaseClient'
import { auditService } from '@/services/auditService'
import { notificationsService } from '@/services/notificationsService'
import { getPayrollEmployeeExportRows } from '@/services/payrollExportsService'
import { getDepartmentDisplayName } from '@/types/department'
import type {
  CreatePayrollPeriodPayload,
  CreatePayrollRunPayload,
  EmployeePayslipListItem,
  PayrollPayslipPdfData,
  PayrollCompensationProfile,
  PayrollCompensationProfileFilters,
  PayrollCalculationStatus,
  PayrollPeriod,
  PayrollPeriodStatus,
  PayrollProcessingActivityItem,
  PayrollProcessingActivityListOptions,
  PayrollProcessingAuditAction,
  PayrollRunCalculationResult,
  PayrollProcessingStatus,
  PayrollRunDetail,
  PayrollRunEmployeeEntry,
  PayrollRunSummary,
  PayrollRunType,
  UpsertPayrollCompensationProfilePayload,
  UpdatePayrollPeriodStatusPayload,
  UpdatePayrollRunStatusPayload,
} from '@/types/payroll'
import {
  isPayslipDocumentReady,
  resolvePayslipCanonicalSource,
  resolvePayslipDocumentContentType,
  resolvePayslipDocumentFileSizeBytes,
  resolvePayslipDocumentGeneratedAt,
  resolvePayslipDocumentGenerationError,
  resolvePayslipDocumentGenerationStatus,
  resolvePayslipDocumentRepresentationMode,
} from '@/types/payroll'
import { generatePayrollPayslipPdf, PAYROLL_EMPLOYER_NAME } from '@/utils/pdf/generatePayrollPayslipPdf'

interface PayrollPeriodRow {
  id: string
  code: string
  label: string
  period_start: string
  period_end: string
  status: string
  notes: string | null
  run_count: number | null
  published_payslip_count: number | null
  created_at: string
  updated_at: string
}

type PayrollPeriodMutationRow = Omit<
  PayrollPeriodRow,
  'run_count' | 'published_payslip_count'
>

interface PayrollRunSummaryRow {
  id: string
  payroll_period_id: string
  period_code: string
  period_label: string
  code: string
  run_type: string
  status: string
  notes: string | null
  employee_count: number | null
  calculated_employee_count: number | null
  excluded_employee_count: number | null
  failed_employee_count: number | null
  total_gross_pay: number | string | null
  total_deductions_amount: number | string | null
  total_net_pay: number | string | null
  published_payslip_count: number | null
  created_at: string
  calculated_at: string | null
  reviewed_at: string | null
  finalized_at: string | null
  published_at: string | null
  archived_at: string | null
}

interface PayrollRunDetailRow extends PayrollRunSummaryRow {
  period_start: string
  period_end: string
}

interface PayrollRunEmployeeEntryRow {
  id: string
  payroll_run_id: string
  employe_id: string
  matricule: string
  nom: string
  prenom: string
  departement_nom: string | null
  poste: string | null
  categorie_professionnelle: string | null
  type_contrat: string | null
  status: string
  calculation_status: string
  exclusion_reason: string | null
  calculation_notes: string | null
  has_payslip: boolean
  payslip_id: string | null
  payslip_status: string | null
  payslip_published_at: string | null
  payslip_document_ready: boolean | null
  payslip_document_representation_mode: string | null
  payslip_generation_status: string | null
  payslip_generated_at: string | null
  payslip_generation_error: string | null
  payslip_file_name: string | null
  payslip_storage_path: string | null
  payslip_content_type: string | null
  payslip_file_size_bytes: number | string | null
  issue_flags_json: unknown
  calculation_input_json: unknown
  employee_snapshot_json: unknown
  result_summary_json: unknown
  base_salary_amount: number | string | null
  total_allowances_amount: number | string | null
  gross_pay_amount: number | string | null
  total_deductions_amount: number | string | null
  net_pay_amount: number | string | null
  calculated_at: string | null
  created_at: string
  updated_at: string
}

interface PayrollCompensationProfileRow {
  compensation_profile_id: string | null
  employe_id: string
  matricule: string
  nom: string
  prenom: string
  departement_nom: string | null
  poste: string | null
  categorie_professionnelle: string | null
  type_contrat: string | null
  is_active: boolean
  has_profile: boolean
  is_payroll_eligible: boolean
  base_salary_amount: number | string | null
  fixed_allowance_amount: number | string | null
  fixed_deduction_amount: number | string | null
  notes: string | null
  updated_at: string | null
}

interface PayrollCompensationProfileMutationRow {
  id: string
  employe_id: string
}

interface PayrollRunCalculationResultRow {
  payroll_run_id: string
  employee_count: number | null
  calculated_employee_count: number | null
  excluded_employee_count: number | null
  failed_employee_count: number | null
  total_gross_pay: number | string | null
  total_deductions_amount: number | string | null
  total_net_pay: number | string | null
  calculated_at: string
}

interface EmployeePayslipRow {
  id: string
  payroll_run_id: string
  payroll_run_employe_id: string
  payroll_period_id: string
  payroll_period_code: string
  payroll_period_label: string
  period_start: string
  period_end: string
  payroll_run_code: string
  status: string
  published_at: string | null
  file_name: string | null
  storage_path: string | null
  publication_metadata_json: unknown
  created_at: string
}

interface PayrollProcessingAuditRow {
  id: string
  action: PayrollProcessingAuditAction
  target_type: string
  target_id: string | null
  details_json: unknown
  created_at: string
}

interface PayslipAuditInsertRow {
  actor_user_id: string
  action: PayrollProcessingAuditAction
  target_type: string
  target_id: string
  details_json: Record<string, unknown>
}

interface PayslipUpsertRow {
  payroll_run_id: string
  payroll_run_employe_id: string
  employe_id: string
  status: PayrollProcessingStatus
  file_name: string | null
  storage_path: string | null
  published_at: string
  published_by_user_id: string
  publication_metadata_json: Record<string, unknown>
}

interface PayslipLookupRow {
  id: string
  payroll_run_employe_id: string
  employe_id: string
}

interface ExistingPayslipPublicationRow extends PayslipLookupRow {
  file_name: string | null
  storage_path: string | null
  publication_metadata_json: unknown
}

const PAYROLL_PROCESSING_ACTIONS: PayrollProcessingAuditAction[] = [
  'PAYROLL_PERIOD_CREATED',
  'PAYROLL_RUN_CREATED',
  'PAYROLL_RUN_UPDATED',
  'PAYROLL_RUN_FINALIZED',
  'PAYROLL_CALCULATION_STARTED',
  'PAYROLL_CALCULATION_COMPLETED',
  'PAYROLL_CALCULATION_FAILED',
  'PAYROLL_PAYSLIP_PUBLISHED',
  'PAYSLIP_DOCUMENT_PUBLISHED',
]

const PAYSLIP_STORAGE_BUCKET = 'payslips'

function ensureArrayResult<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

function normalizeObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }

  return {}
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((item) => {
      if (typeof item === 'string') {
        const normalized = item.trim()
        return normalized.length > 0 ? normalized : null
      }

      return null
    })
    .filter((item): item is string => Boolean(item))
}

function normalizeText(value: string | null | undefined): string | null {
  const normalized = value?.trim()
  return normalized && normalized.length > 0 ? normalized : null
}

function requireText(value: string | null | undefined, fieldLabel: string): string {
  const normalized = normalizeText(value)

  if (!normalized) {
    throw new Error(`${fieldLabel} is required.`)
  }

  return normalized
}

function normalizeNumber(value: number | string | null | undefined): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function requireNonNegativeAmount(
  value: number,
  fieldLabel: string,
): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${fieldLabel} must be a non-negative number.`)
  }

  return Number(value.toFixed(2))
}

function toIsoNow(): string {
  return new Date().toISOString()
}

function resolvePayrollPeriodStatus(value: string): PayrollPeriodStatus {
  switch (value) {
    case 'OPEN':
    case 'CLOSED':
    case 'ARCHIVED':
      return value
    case 'DRAFT':
    default:
      return 'DRAFT'
  }
}

function resolvePayrollProcessingStatus(value: string | null | undefined): PayrollProcessingStatus {
  switch (value) {
    case 'CALCULATED':
    case 'UNDER_REVIEW':
    case 'FINALIZED':
    case 'PUBLISHED':
    case 'ARCHIVED':
      return value
    case 'DRAFT':
    default:
      return 'DRAFT'
  }
}

function resolvePayrollCalculationStatus(
  value: string | null | undefined,
): PayrollCalculationStatus {
  switch (value) {
    case 'CALCULATED':
    case 'EXCLUDED':
    case 'FAILED':
      return value
    case 'PENDING':
    default:
      return 'PENDING'
  }
}

function resolvePayrollRunType(value: string | null | undefined): PayrollRunType {
  const normalized = normalizeText(value)
  return (normalized ?? 'REGULAR') as PayrollRunType
}

function buildEmployeeName(prenom: string | null | undefined, nom: string | null | undefined): string | null {
  const fullName = `${prenom ?? ''} ${nom ?? ''}`.replace(/\s+/g, ' ').trim()
  return fullName.length > 0 ? fullName : null
}

function buildPayslipStoragePath(
  employeId: string,
  payrollPeriodId: string,
  payslipId: string,
  fileName: string,
): string {
  return `${employeId}/payroll-periods/${payrollPeriodId}/payslips/${payslipId}/${fileName}`
}

function readMetadataText(
  publicationMetadataJson: Record<string, unknown> | null | undefined,
  key: string,
): string | null {
  const value = publicationMetadataJson?.[key]
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function buildPayslipPublicationMetadata(
  run: PayrollRunDetail,
  entry: PayrollRunEmployeeEntry,
  options: {
    documentReady: boolean
    documentRepresentationMode: 'NONE' | 'MANUAL_UPLOAD' | 'GENERATED_PDF'
    documentAttachedAt: string | null
    generationStatus: 'PENDING' | 'GENERATED' | 'FAILED'
    generatedAt: string | null
    generationError: string | null
    fileName: string | null
    storagePath: string | null
    contentType: string | null
    fileSizeBytes: number | null
  },
): Record<string, unknown> {
  return {
    canonicalSource: 'PAYROLL_RUN_EMPLOYEE_RESULT',
    canonicalPayrollRunId: run.id,
    canonicalPayrollRunEmployeeId: entry.id,
    canonicalEmployeeId: entry.employeId,
    publicationSource: 'payroll_processing_foundation',
    payrollPeriodId: run.payrollPeriodId,
    payrollPeriodCode: run.periodCode,
    payrollPeriodLabel: run.periodLabel,
    documentReady: options.documentReady,
    documentRepresentationMode: options.documentRepresentationMode,
    documentAttachedAt: options.documentAttachedAt,
    documentFileName: options.fileName,
    documentStoragePath: options.storagePath,
    contentType: options.contentType,
    fileSizeBytes: options.fileSizeBytes,
    generationStatus: options.generationStatus,
    generatedAt: options.generatedAt,
    generationError: options.generationError,
    issueDate: options.generatedAt,
    payrollRunId: run.id,
    baseSalaryAmount: entry.baseSalaryAmount,
    totalAllowancesAmount: entry.totalAllowancesAmount,
    grossPayAmount: entry.grossPayAmount,
    totalDeductionsAmount: entry.totalDeductionsAmount,
    netPayAmount: entry.netPayAmount,
  }
}

function buildPayrollPayslipPdfData(
  run: PayrollRunDetail,
  entry: PayrollRunEmployeeEntry,
  issueDate: string,
): PayrollPayslipPdfData {
  const employeeFullName = requireText(
    buildEmployeeName(entry.prenom, entry.nom),
    'Employee name',
  )

  return {
    employerName: PAYROLL_EMPLOYER_NAME,
    employeeFullName,
    employeeMatricule: requireText(entry.matricule, 'Employee ID'),
    departmentName: normalizeText(entry.departementNom),
    jobTitle: normalizeText(entry.poste),
    payrollPeriodCode: requireText(run.periodCode, 'Payroll period code'),
    payrollPeriodLabel: requireText(run.periodLabel, 'Payroll period label'),
    payrollRunCode: requireText(run.code, 'Payroll run code'),
    periodStart: requireText(run.periodStart, 'Payroll period start'),
    periodEnd: requireText(run.periodEnd, 'Payroll period end'),
    issueDate,
    baseSalaryAmount: requireNonNegativeAmount(
      entry.baseSalaryAmount ?? Number.NaN,
      'Base salary',
    ),
    totalAllowancesAmount: requireNonNegativeAmount(
      entry.totalAllowancesAmount ?? Number.NaN,
      'Allowances total',
    ),
    totalDeductionsAmount: requireNonNegativeAmount(
      entry.totalDeductionsAmount ?? Number.NaN,
      'Deductions total',
    ),
    grossPayAmount: requireNonNegativeAmount(
      entry.grossPayAmount ?? Number.NaN,
      'Gross pay',
    ),
    netPayAmount: requireNonNegativeAmount(
      entry.netPayAmount ?? Number.NaN,
      'Net pay',
    ),
  }
}

function normalizeSingleRowResult<T>(
  rows: T[] | null,
  context: string,
): { row: T | null; hasMultiple: boolean } {
  if (!rows || rows.length === 0) {
    return { row: null, hasMultiple: false }
  }

  if (rows.length > 1) {
    console.error(`[${context}] expected at most one row but received`, rows.length)
    return { row: null, hasMultiple: true }
  }

  return { row: rows[0], hasMultiple: false }
}

function mapPayrollPeriod(row: PayrollPeriodRow): PayrollPeriod {
  return {
    id: row.id,
    code: row.code,
    label: row.label,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    status: resolvePayrollPeriodStatus(row.status),
    notes: normalizeText(row.notes),
    runCount: row.run_count ?? 0,
    publishedPayslipCount: row.published_payslip_count ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapPayrollRunSummary(row: PayrollRunSummaryRow): PayrollRunSummary {
  return {
    id: row.id,
    payrollPeriodId: row.payroll_period_id,
    periodCode: row.period_code,
    periodLabel: row.period_label,
    code: row.code,
    runType: resolvePayrollRunType(row.run_type),
    status: resolvePayrollProcessingStatus(row.status),
    notes: normalizeText(row.notes),
    employeeCount: row.employee_count ?? 0,
    calculatedEmployeeCount: row.calculated_employee_count ?? 0,
    excludedEmployeeCount: row.excluded_employee_count ?? 0,
    failedEmployeeCount: row.failed_employee_count ?? 0,
    totalGrossPay: normalizeNumber(row.total_gross_pay) ?? 0,
    totalDeductionsAmount: normalizeNumber(row.total_deductions_amount) ?? 0,
    totalNetPay: normalizeNumber(row.total_net_pay) ?? 0,
    publishedPayslipCount: row.published_payslip_count ?? 0,
    createdAt: row.created_at,
    calculatedAt: row.calculated_at,
    reviewedAt: row.reviewed_at,
    finalizedAt: row.finalized_at,
    publishedAt: row.published_at,
    archivedAt: row.archived_at,
  }
}

function mapPayrollRunDetail(row: PayrollRunDetailRow): PayrollRunDetail {
  return {
    ...mapPayrollRunSummary(row),
    periodStart: row.period_start,
    periodEnd: row.period_end,
  }
}

function mapPayrollRunEmployeeEntry(row: PayrollRunEmployeeEntryRow): PayrollRunEmployeeEntry {
  const publicationMetadataJson =
    row.payslip_document_representation_mode ||
    row.payslip_document_ready !== null ||
    row.payslip_generation_status ||
    row.payslip_generated_at ||
    row.payslip_generation_error
      ? {
          documentRepresentationMode: row.payslip_document_representation_mode ?? undefined,
          documentReady: row.payslip_document_ready ?? undefined,
          generationStatus: row.payslip_generation_status ?? undefined,
          generatedAt: row.payslip_generated_at ?? undefined,
          generationError: row.payslip_generation_error ?? undefined,
        }
      : undefined

  return {
    id: row.id,
    payrollRunId: row.payroll_run_id,
    employeId: row.employe_id,
    matricule: row.matricule,
    nom: row.nom,
    prenom: row.prenom,
    departementNom: getDepartmentDisplayName(normalizeText(row.departement_nom)),
    poste: normalizeText(row.poste),
    categorieProfessionnelle: normalizeText(row.categorie_professionnelle),
    typeContrat: normalizeText(row.type_contrat),
    status: resolvePayrollProcessingStatus(row.status),
    calculationStatus: resolvePayrollCalculationStatus(row.calculation_status),
    exclusionReason: normalizeText(row.exclusion_reason),
    calculationNotes: normalizeText(row.calculation_notes),
    hasPayslip: row.has_payslip,
    payslipId: row.payslip_id,
    payslipStatus: row.payslip_status
      ? resolvePayrollProcessingStatus(row.payslip_status)
      : null,
    payslipPublishedAt: row.payslip_published_at,
    payslipDocumentReady: Boolean(row.payslip_document_ready),
    payslipDocumentRepresentationMode: row.payslip_document_representation_mode
      ? resolvePayslipDocumentRepresentationMode(
          publicationMetadataJson,
          Boolean(row.payslip_document_ready),
        )
      : null,
    payslipGenerationStatus: row.has_payslip
      ? resolvePayslipDocumentGenerationStatus(
          publicationMetadataJson,
          Boolean(row.payslip_document_ready),
        )
      : null,
    payslipGeneratedAt: row.payslip_generated_at,
    payslipGenerationError: normalizeText(row.payslip_generation_error),
    payslipFileName: normalizeText(row.payslip_file_name),
    payslipStoragePath: normalizeText(row.payslip_storage_path),
    payslipContentType: normalizeText(row.payslip_content_type),
    payslipFileSizeBytes: normalizeNumber(row.payslip_file_size_bytes),
    issueFlags: normalizeStringArray(row.issue_flags_json),
    calculationInputJson: normalizeObject(row.calculation_input_json),
    employeeSnapshotJson: normalizeObject(row.employee_snapshot_json),
    resultSummaryJson: normalizeObject(row.result_summary_json),
    baseSalaryAmount: normalizeNumber(row.base_salary_amount),
    totalAllowancesAmount: normalizeNumber(row.total_allowances_amount),
    grossPayAmount: normalizeNumber(row.gross_pay_amount),
    totalDeductionsAmount: normalizeNumber(row.total_deductions_amount),
    netPayAmount: normalizeNumber(row.net_pay_amount),
    calculatedAt: row.calculated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapPayrollCompensationProfile(
  row: PayrollCompensationProfileRow,
): PayrollCompensationProfile {
  return {
    compensationProfileId: row.compensation_profile_id,
    employeId: row.employe_id,
    matricule: row.matricule,
    nom: row.nom,
    prenom: row.prenom,
    departementNom: getDepartmentDisplayName(normalizeText(row.departement_nom)),
    poste: normalizeText(row.poste),
    categorieProfessionnelle: normalizeText(row.categorie_professionnelle),
    typeContrat: normalizeText(row.type_contrat),
    isActive: row.is_active,
    hasProfile: row.has_profile,
    isPayrollEligible: row.is_payroll_eligible,
    baseSalaryAmount: normalizeNumber(row.base_salary_amount),
    fixedAllowanceAmount: normalizeNumber(row.fixed_allowance_amount),
    fixedDeductionAmount: normalizeNumber(row.fixed_deduction_amount),
    notes: normalizeText(row.notes),
    updatedAt: row.updated_at,
  }
}

function mapPayrollRunCalculationResult(
  row: PayrollRunCalculationResultRow,
): PayrollRunCalculationResult {
  return {
    payrollRunId: row.payroll_run_id,
    employeeCount: row.employee_count ?? 0,
    calculatedEmployeeCount: row.calculated_employee_count ?? 0,
    excludedEmployeeCount: row.excluded_employee_count ?? 0,
    failedEmployeeCount: row.failed_employee_count ?? 0,
    totalGrossPay: normalizeNumber(row.total_gross_pay) ?? 0,
    totalDeductionsAmount: normalizeNumber(row.total_deductions_amount) ?? 0,
    totalNetPay: normalizeNumber(row.total_net_pay) ?? 0,
    calculatedAt: row.calculated_at,
  }
}

function mapEmployeePayslip(row: EmployeePayslipRow): EmployeePayslipListItem {
  const fileName = normalizeText(row.file_name)
  const storagePath = normalizeText(row.storage_path)
  const publicationMetadataJson = normalizeObject(row.publication_metadata_json)
  const hasDocumentAttachment = Boolean(fileName && storagePath)

  return {
    id: row.id,
    payrollRunId: row.payroll_run_id,
    payrollRunEmployeId: row.payroll_run_employe_id,
    payrollPeriodId: row.payroll_period_id,
    payrollPeriodCode: row.payroll_period_code,
    payrollPeriodLabel: row.payroll_period_label,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    payrollRunCode: row.payroll_run_code,
    status: resolvePayrollProcessingStatus(row.status),
    publishedAt: row.published_at,
    fileName,
    storagePath,
    canonicalSource: resolvePayslipCanonicalSource(publicationMetadataJson),
    documentReady: isPayslipDocumentReady(publicationMetadataJson, hasDocumentAttachment),
    documentRepresentationMode: resolvePayslipDocumentRepresentationMode(
      publicationMetadataJson,
      hasDocumentAttachment,
    ),
    documentGenerationStatus: resolvePayslipDocumentGenerationStatus(
      publicationMetadataJson,
      hasDocumentAttachment,
    ),
    documentGeneratedAt: resolvePayslipDocumentGeneratedAt(publicationMetadataJson),
    documentGenerationError: resolvePayslipDocumentGenerationError(publicationMetadataJson),
    documentContentType: resolvePayslipDocumentContentType(
      publicationMetadataJson,
      hasDocumentAttachment,
    ),
    documentFileSizeBytes: resolvePayslipDocumentFileSizeBytes(publicationMetadataJson),
    publicationMetadataJson,
    createdAt: row.created_at,
  }
}

function buildProcessingActivitySummary(
  action: PayrollProcessingAuditAction,
  detailsJson: Record<string, unknown>,
): string {
  const periodLabel = normalizeText(String(detailsJson.period_label ?? ''))
  const periodCode = normalizeText(String(detailsJson.period_code ?? ''))
  const payrollRunCode = normalizeText(String(detailsJson.payroll_run_code ?? ''))
  const nextStatus = normalizeText(String(detailsJson.next_status ?? ''))
  const employeeName = normalizeText(String(detailsJson.employee_name ?? ''))
  const matricule = normalizeText(String(detailsJson.matricule ?? ''))
  const rowCount =
    typeof detailsJson.employee_count === 'number'
      ? detailsJson.employee_count
      : Number(detailsJson.employee_count ?? NaN)

  switch (action) {
    case 'PAYROLL_PERIOD_CREATED':
      return periodLabel
        ? `Created payroll period ${periodLabel}.`
        : periodCode
          ? `Created payroll period ${periodCode}.`
          : 'Created a payroll period.'
    case 'PAYROLL_RUN_CREATED':
      if (payrollRunCode && Number.isFinite(rowCount)) {
        return `Created payroll run ${payrollRunCode} with ${rowCount} seeded employee entries.`
      }

      return payrollRunCode
        ? `Created payroll run ${payrollRunCode}.`
        : 'Created a payroll run.'
    case 'PAYROLL_CALCULATION_STARTED':
      return payrollRunCode
        ? `Started payroll calculation for ${payrollRunCode}.`
        : 'Started payroll calculation.'
    case 'PAYROLL_CALCULATION_COMPLETED': {
      const calculatedCount =
        typeof detailsJson.calculated_employee_count === 'number'
          ? detailsJson.calculated_employee_count
          : Number(detailsJson.calculated_employee_count ?? NaN)
      const excludedCount =
        typeof detailsJson.excluded_employee_count === 'number'
          ? detailsJson.excluded_employee_count
          : Number(detailsJson.excluded_employee_count ?? NaN)

      if (
        payrollRunCode &&
        Number.isFinite(calculatedCount) &&
        Number.isFinite(excludedCount)
      ) {
        return `Completed payroll calculation for ${payrollRunCode}: ${calculatedCount} calculated, ${excludedCount} excluded.`
      }

      return payrollRunCode
        ? `Completed payroll calculation for ${payrollRunCode}.`
        : 'Completed payroll calculation.'
    }
    case 'PAYROLL_CALCULATION_FAILED': {
      const failureReason = normalizeText(String(detailsJson.failure_reason ?? ''))

      if (payrollRunCode && failureReason) {
        return `Payroll calculation failed for ${payrollRunCode}: ${failureReason}`
      }

      return payrollRunCode
        ? `Payroll calculation failed for ${payrollRunCode}.`
        : failureReason
          ? `Payroll calculation failed: ${failureReason}`
          : 'Payroll calculation failed.'
    }
    case 'PAYROLL_RUN_FINALIZED':
      return payrollRunCode
        ? `Finalized payroll run ${payrollRunCode}.`
        : 'Finalized a payroll run.'
    case 'PAYROLL_PAYSLIP_PUBLISHED': {
      const employeeReference = employeeName && matricule
        ? `${employeeName} (${matricule})`
        : employeeName ?? matricule

      return employeeReference
        ? `Published payslip metadata for ${employeeReference}.`
        : 'Published a payslip.'
    }
    case 'PAYSLIP_DOCUMENT_PUBLISHED': {
      const employeeReference = employeeName && matricule
        ? `${employeeName} (${matricule})`
        : employeeName ?? matricule
      const fileName = normalizeText(String(detailsJson.file_name ?? ''))

      if (employeeReference && fileName) {
        return `Generated payslip PDF ${fileName} for ${employeeReference}.`
      }

      return employeeReference
        ? `Generated a payslip PDF for ${employeeReference}.`
        : 'Generated a payslip PDF.'
    }
    case 'PAYROLL_RUN_UPDATED':
    default:
      if (payrollRunCode && nextStatus) {
        return `Updated payroll run ${payrollRunCode} to ${nextStatus.toLowerCase().replaceAll('_', ' ')}.`
      }

      return payrollRunCode
        ? `Updated payroll run ${payrollRunCode}.`
        : 'Updated a payroll run.'
  }
}

function mapPayrollProcessingActivity(
  row: PayrollProcessingAuditRow,
): PayrollProcessingActivityItem {
  const detailsJson = normalizeObject(row.details_json)

  return {
    id: row.id,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    payrollPeriodId: normalizeText(String(detailsJson.payroll_period_id ?? '')),
    payrollRunId: normalizeText(String(detailsJson.payroll_run_id ?? '')),
    payslipId: row.target_type === 'Payslip' ? row.target_id : null,
    employeeId: normalizeText(String(detailsJson.employee_id ?? '')),
    employeeName: normalizeText(String(detailsJson.employee_name ?? '')),
    matricule: normalizeText(String(detailsJson.matricule ?? '')),
    summary: buildProcessingActivitySummary(row.action, detailsJson),
    createdAt: row.created_at,
    detailsJson,
  }
}

function buildRunEntrySeeds(runId: string, employees: Awaited<ReturnType<typeof getPayrollEmployeeExportRows>>): Array<Record<string, unknown>> {
  const seededAt = toIsoNow()

  return employees.map((employee) => ({
    payroll_run_id: runId,
    employe_id: employee.id,
    status: 'DRAFT',
    employee_snapshot_json: {
      employeeId: employee.id,
      matricule: employee.matricule,
      nom: employee.nom,
      prenom: employee.prenom,
      departementNom: employee.departementNom,
      poste: employee.poste,
      categorieProfessionnelle: employee.categorieProfessionnelle,
      typeContrat: employee.typeContrat,
      dateRecrutement: employee.dateRecrutement,
      isActive: employee.isActive,
      seededAt,
    },
    result_summary_json: {
      lifecycleStage: 'DRAFT',
      calculationState: 'PENDING',
      publicationState: 'NOT_PUBLISHED',
    },
  }))
}

function normalizeCompensationFilters(
  filters: PayrollCompensationProfileFilters = {},
) {
  return {
    search: normalizeText(filters.search),
    payrollEligible:
      typeof filters.payrollEligible === 'boolean' ? filters.payrollEligible : null,
  }
}

function getRunUpdatePayload(
  status: PayrollProcessingStatus,
  notes?: string,
): Record<string, unknown> {
  const now = toIsoNow()
  const payload: Record<string, unknown> = { status }

  if (notes !== undefined) {
    payload.notes = normalizeText(notes)
  }

  switch (status) {
    case 'CALCULATED':
      payload.calculated_at = now
      break
    case 'UNDER_REVIEW':
      payload.reviewed_at = now
      break
    case 'FINALIZED':
      payload.finalized_at = now
      break
    case 'PUBLISHED':
      payload.published_at = now
      break
    case 'ARCHIVED':
      payload.archived_at = now
      break
    default:
      break
  }

  return payload
}

function getRunEntryUpdatePayload(status: PayrollProcessingStatus): Record<string, unknown> {
  const now = toIsoNow()
  const payload: Record<string, unknown> = { status }

  switch (status) {
    case 'FINALIZED':
      payload.finalized_at = now
      break
    case 'PUBLISHED':
      payload.published_at = now
      break
    default:
      break
  }

  return payload
}

async function resolveCurrentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser()

  if (error) {
    throw new Error(error.message)
  }

  if (!data.user?.id) {
    throw new Error('Unable to resolve the current authenticated user.')
  }

  return data.user.id
}

async function insertPayrollAuditRows(rows: PayslipAuditInsertRow[]): Promise<void> {
  if (rows.length === 0) {
    return
  }

  const { error } = await supabase.from('audit_log').insert(rows)

  if (error) {
    throw new Error(error.message)
  }
}

async function removePayslipStorageObject(storagePath: string): Promise<void> {
  const { error } = await supabase.storage.from(PAYSLIP_STORAGE_BUCKET).remove([storagePath])

  if (error) {
    throw new Error(error.message)
  }
}

export async function getPayrollPeriods(): Promise<PayrollPeriod[]> {
  const { data, error } = await supabase.rpc('get_payroll_periods').returns<PayrollPeriodRow[]>()

  if (error) {
    throw new Error(error.message)
  }

  return ensureArrayResult<PayrollPeriodRow>(data).map(mapPayrollPeriod)
}

export async function getPayrollCompensationProfiles(
  filters: PayrollCompensationProfileFilters = {},
): Promise<PayrollCompensationProfile[]> {
  const normalizedFilters = normalizeCompensationFilters(filters)
  const { data, error } = await supabase
    .rpc('get_payroll_compensation_profiles', {
      p_search: normalizedFilters.search,
      p_payroll_eligible: normalizedFilters.payrollEligible,
    })
    .returns<PayrollCompensationProfileRow[]>()

  if (error) {
    throw new Error(error.message)
  }

  return ensureArrayResult<PayrollCompensationProfileRow>(data).map(
    mapPayrollCompensationProfile,
  )
}

export async function upsertPayrollCompensationProfile(
  payload: UpsertPayrollCompensationProfilePayload,
): Promise<PayrollCompensationProfile> {
  const userId = await resolveCurrentUserId()
  const existingQuery = await supabase
    .from('PayrollCompensationProfile')
    .select('id, employe_id')
    .eq('employe_id', payload.employeId)
    .limit(1)
    .maybeSingle()
    .returns<PayrollCompensationProfileMutationRow | null>()

  if (existingQuery.error) {
    throw new Error(existingQuery.error.message)
  }

  const baseSalaryAmount = requireNonNegativeAmount(
    payload.baseSalaryAmount,
    'Base salary',
  )
  const fixedAllowanceAmount = requireNonNegativeAmount(
    payload.fixedAllowanceAmount,
    'Fixed allowances',
  )
  const fixedDeductionAmount = requireNonNegativeAmount(
    payload.fixedDeductionAmount,
    'Fixed deductions',
  )

  if (existingQuery.data?.id) {
    const { error: updateError } = await supabase
      .from('PayrollCompensationProfile')
      .update({
        base_salary_amount: baseSalaryAmount,
        fixed_allowance_amount: fixedAllowanceAmount,
        fixed_deduction_amount: fixedDeductionAmount,
        is_payroll_eligible: payload.isPayrollEligible,
        notes: normalizeText(payload.notes),
        updated_by_user_id: userId,
      })
      .eq('id', existingQuery.data.id)

    if (updateError) {
      throw new Error(updateError.message)
    }
  } else {
    const { error: insertError } = await supabase
      .from('PayrollCompensationProfile')
      .insert({
        employe_id: payload.employeId,
        base_salary_amount: baseSalaryAmount,
        fixed_allowance_amount: fixedAllowanceAmount,
        fixed_deduction_amount: fixedDeductionAmount,
        is_payroll_eligible: payload.isPayrollEligible,
        notes: normalizeText(payload.notes),
        created_by_user_id: userId,
        updated_by_user_id: userId,
      })

    if (insertError) {
      throw new Error(insertError.message)
    }
  }

  const refreshedProfiles = await getPayrollCompensationProfiles()
  const matchingProfile = refreshedProfiles.find(
    (profile) => profile.employeId === payload.employeId,
  )

  if (!matchingProfile) {
    throw new Error(
      'Compensation profile was saved but the refreshed profile could not be loaded.',
    )
  }

  return matchingProfile
}

export async function createPayrollPeriod(
  payload: CreatePayrollPeriodPayload,
): Promise<PayrollPeriod> {
  const userId = await resolveCurrentUserId()
  const code = requireText(payload.code, 'Period code')
  const label = requireText(payload.label, 'Period label')

  const { data, error } = await supabase
    .from('PayrollPeriod')
    .insert({
      code,
      label,
      period_start: payload.periodStart,
      period_end: payload.periodEnd,
      notes: normalizeText(payload.notes),
      created_by_user_id: userId,
    })
    .select(
      'id, code, label, period_start, period_end, status, notes, created_at, updated_at',
    )
    .returns<Array<Omit<PayrollPeriodRow, 'run_count' | 'published_payslip_count'> & { run_count?: number | null; published_payslip_count?: number | null }>>()

  if (error) {
    throw new Error(error.message)
  }

  const row = ensureArrayResult<PayrollPeriodMutationRow>(data)[0]

  if (!row) {
    throw new Error('Payroll period creation succeeded but no row was returned.')
  }

  const period = mapPayrollPeriod({
    ...row,
    run_count: 0,
    published_payslip_count: 0,
  })

  await auditService.insertAuditLog({
    action: 'PAYROLL_PERIOD_CREATED',
    targetType: 'PayrollPeriod',
    targetId: period.id,
    detailsJson: {
      payroll_period_id: period.id,
      period_code: period.code,
      period_label: period.label,
      period_start: period.periodStart,
      period_end: period.periodEnd,
      status: period.status,
    },
  })

  return period
}

export async function updatePayrollPeriodStatus(
  payload: UpdatePayrollPeriodStatusPayload,
): Promise<PayrollPeriod> {
  const { data, error } = await supabase
    .from('PayrollPeriod')
    .update({ status: payload.status })
    .eq('id', payload.periodId)
    .select(
      'id, code, label, period_start, period_end, status, notes, created_at, updated_at',
    )
    .returns<Array<Omit<PayrollPeriodRow, 'run_count' | 'published_payslip_count'> & { run_count?: number | null; published_payslip_count?: number | null }>>()

  if (error) {
    throw new Error(error.message)
  }

  const row = ensureArrayResult<PayrollPeriodMutationRow>(data)[0]

  if (!row) {
    throw new Error('Payroll period not found or unavailable.')
  }

  const allPeriods = await getPayrollPeriods()
  const matchingPeriod = allPeriods.find((period) => period.id === payload.periodId)

  return matchingPeriod ??
    mapPayrollPeriod({
      ...row,
      run_count: 0,
      published_payslip_count: 0,
    })
}

export async function getPayrollRuns(periodId?: string | null): Promise<PayrollRunSummary[]> {
  const { data, error } = await supabase
    .rpc('get_payroll_runs', { p_period_id: periodId ?? null })
    .returns<PayrollRunSummaryRow[]>()

  if (error) {
    throw new Error(error.message)
  }

  return ensureArrayResult<PayrollRunSummaryRow>(data).map(mapPayrollRunSummary)
}

export async function createPayrollRun(
  payload: CreatePayrollRunPayload,
): Promise<PayrollRunDetail> {
  const userId = await resolveCurrentUserId()
  const code = requireText(payload.code, 'Run code')
  const runType = resolvePayrollRunType(payload.runType)
  const activeEmployees = await getPayrollEmployeeExportRows({ status: 'ACTIVE' })

  if (activeEmployees.length === 0) {
    throw new Error('No active payroll-visible employees are available to seed this payroll run.')
  }

  const { data, error } = await supabase
    .from('PayrollRun')
    .insert({
      payroll_period_id: payload.payrollPeriodId,
      code,
      run_type: runType,
      status: 'DRAFT',
      notes: normalizeText(payload.notes),
      created_by_user_id: userId,
    })
    .select('id')
    .returns<Array<{ id: string }>>()

  if (error) {
    throw new Error(error.message)
  }

  const createdRow = ensureArrayResult<{ id: string }>(data)[0]

  if (!createdRow?.id) {
    throw new Error('Payroll run creation succeeded but no identifier was returned.')
  }

  const rollbackRun = async () => {
    await supabase.from('PayrollRun').delete().eq('id', createdRow.id)
  }

  try {
    const { error: entryInsertError } = await supabase
      .from('PayrollRunEmploye')
      .insert(buildRunEntrySeeds(createdRow.id, activeEmployees))

    if (entryInsertError) {
      throw new Error(entryInsertError.message)
    }

    const run = await getPayrollRunById(createdRow.id)

    if (!run) {
      throw new Error('Payroll run was created but could not be reloaded.')
    }

    await auditService.insertAuditLog({
      action: 'PAYROLL_RUN_CREATED',
      targetType: 'PayrollRun',
      targetId: run.id,
      detailsJson: {
        payroll_run_id: run.id,
        payroll_period_id: run.payrollPeriodId,
        period_code: run.periodCode,
        period_label: run.periodLabel,
        payroll_run_code: run.code,
        run_type: run.runType,
        status: run.status,
        employee_count: run.employeeCount,
      },
    })

    return run
  } catch (error) {
    await rollbackRun()
    throw error
  }
}

export async function getPayrollRunById(runId: string): Promise<PayrollRunDetail | null> {
  const { data, error } = await supabase
    .rpc('get_payroll_run_by_id', { p_run_id: runId })
    .returns<PayrollRunDetailRow[]>()

  if (error) {
    throw new Error(error.message)
  }

  const { row, hasMultiple } = normalizeSingleRowResult(
    ensureArrayResult<PayrollRunDetailRow>(data),
    'payrollProcessingService.getPayrollRunById',
  )

  if (hasMultiple) {
    throw new Error('Data integrity issue: multiple payroll runs matched this request.')
  }

  return row ? mapPayrollRunDetail(row) : null
}

export async function getPayrollRunEmployeeEntries(
  runId: string,
): Promise<PayrollRunEmployeeEntry[]> {
  const { data, error } = await supabase
    .rpc('get_payroll_run_employee_entries', { p_run_id: runId })
    .returns<PayrollRunEmployeeEntryRow[]>()

  if (error) {
    throw new Error(error.message)
  }

  return ensureArrayResult<PayrollRunEmployeeEntryRow>(data).map(mapPayrollRunEmployeeEntry)
}

export async function calculatePayrollRun(
  runId: string,
): Promise<PayrollRunCalculationResult> {
  const currentRun = await getPayrollRunById(runId)

  if (!currentRun) {
    throw new Error('Payroll run not found or unavailable.')
  }

  try {
    if (
      currentRun.status === 'FINALIZED' ||
      currentRun.status === 'PUBLISHED' ||
      currentRun.status === 'ARCHIVED'
    ) {
      throw new Error(
        `Payroll calculations are locked for runs in ${currentRun.status.toLowerCase().replaceAll('_', ' ')} status.`,
      )
    }

    await auditService.insertAuditLog({
      action: 'PAYROLL_CALCULATION_STARTED',
      targetType: 'PayrollRun',
      targetId: runId,
      detailsJson: {
        payroll_run_id: runId,
        payroll_run_code: currentRun.code,
        payroll_period_id: currentRun.payrollPeriodId,
        period_code: currentRun.periodCode,
        period_label: currentRun.periodLabel,
        employee_count: currentRun.employeeCount,
      },
    })

    const { data, error } = await supabase
      .rpc('calculate_payroll_run', { p_run_id: runId })
      .returns<PayrollRunCalculationResultRow[]>()

    if (error) {
      throw new Error(error.message)
    }

    const { row, hasMultiple } = normalizeSingleRowResult(
      ensureArrayResult<PayrollRunCalculationResultRow>(data),
      'payrollProcessingService.calculatePayrollRun',
    )

    if (hasMultiple || !row) {
      throw new Error('Payroll calculation completed but no valid summary row was returned.')
    }

    const result = mapPayrollRunCalculationResult(row)

    await auditService.insertAuditLog({
      action: 'PAYROLL_CALCULATION_COMPLETED',
      targetType: 'PayrollRun',
      targetId: runId,
      detailsJson: {
        payroll_run_id: runId,
        payroll_run_code: currentRun.code,
        payroll_period_id: currentRun.payrollPeriodId,
        period_code: currentRun.periodCode,
        period_label: currentRun.periodLabel,
        employee_count: result.employeeCount,
        calculated_employee_count: result.calculatedEmployeeCount,
        excluded_employee_count: result.excludedEmployeeCount,
        failed_employee_count: result.failedEmployeeCount,
        total_gross_pay: result.totalGrossPay,
        total_deductions_amount: result.totalDeductionsAmount,
        total_net_pay: result.totalNetPay,
        calculated_at: result.calculatedAt,
      },
    })

    return result
  } catch (error) {
    try {
      await auditService.insertAuditLog({
        action: 'PAYROLL_CALCULATION_FAILED',
        targetType: 'PayrollRun',
        targetId: runId,
        detailsJson: {
          payroll_run_id: runId,
          payroll_run_code: currentRun.code,
          payroll_period_id: currentRun.payrollPeriodId,
          period_code: currentRun.periodCode,
          period_label: currentRun.periodLabel,
          failure_reason:
            error instanceof Error ? error.message : 'Unknown payroll calculation failure.',
        },
      })
    } catch (auditError) {
      console.error('Failed to insert payroll calculation failure audit log.', auditError)
    }

    throw error
  }
}

export async function updatePayrollRunStatus(
  payload: UpdatePayrollRunStatusPayload,
): Promise<PayrollRunDetail> {
  const currentRun = await getPayrollRunById(payload.runId)

  if (!currentRun) {
    throw new Error('Payroll run not found or unavailable.')
  }

  if (currentRun.employeeCount === 0 && payload.status !== 'ARCHIVED') {
    throw new Error('This payroll run has no employee entries yet.')
  }

  if (payload.status === 'CALCULATED') {
    throw new Error(
      'Use the payroll calculation action to calculate this run. Status changes alone are not authoritative.',
    )
  }

  const runUpdatePayload = getRunUpdatePayload(payload.status, payload.notes)
  const { error: runUpdateError } = await supabase
    .from('PayrollRun')
    .update(runUpdatePayload)
    .eq('id', payload.runId)

  if (runUpdateError) {
    throw new Error(runUpdateError.message)
  }

  const { error: entryUpdateError } = await supabase
    .from('PayrollRunEmploye')
    .update(getRunEntryUpdatePayload(payload.status))
    .eq('payroll_run_id', payload.runId)

  if (entryUpdateError) {
    throw new Error(entryUpdateError.message)
  }

  if (payload.status === 'ARCHIVED') {
    const { error: payslipArchiveError } = await supabase
      .from('Payslip')
      .update({ status: 'ARCHIVED' })
      .eq('payroll_run_id', payload.runId)

    if (payslipArchiveError) {
      throw new Error(payslipArchiveError.message)
    }
  }

  if (payload.status === 'PUBLISHED') {
    const userId = await resolveCurrentUserId()
    const entries = await getPayrollRunEmployeeEntries(payload.runId)
    const publishableEntries = entries.filter(
      (entry) => entry.calculationStatus === 'CALCULATED',
    )
    const publishedAt = toIsoNow()

    if (publishableEntries.length === 0) {
      throw new Error(
        'Cannot publish payslips for a run with no calculated employee results.',
      )
    }

    const { data: existingPayslipRows, error: existingPayslipsError } = await supabase
      .from('Payslip')
      .select('id, payroll_run_employe_id, employe_id, file_name, storage_path, publication_metadata_json')
      .in(
        'payroll_run_employe_id',
        publishableEntries.map((entry) => entry.id),
      )
      .returns<ExistingPayslipPublicationRow[]>()

    if (existingPayslipsError) {
      throw new Error(existingPayslipsError.message)
    }

    const existingPayslipByRunEmployeeId = new Map(
      ensureArrayResult<ExistingPayslipPublicationRow>(existingPayslipRows).map((row) => [
        row.payroll_run_employe_id,
        row,
      ]),
    )

    const upsertRows: PayslipUpsertRow[] = publishableEntries.map((entry) => {
      const existingPayslip = existingPayslipByRunEmployeeId.get(entry.id)
      const existingFileName = normalizeText(existingPayslip?.file_name)
      const existingStoragePath = normalizeText(existingPayslip?.storage_path)
      const existingMetadata = normalizeObject(existingPayslip?.publication_metadata_json)
      const hasExistingDocument = Boolean(existingFileName && existingStoragePath)

      return {
        payroll_run_id: payload.runId,
        payroll_run_employe_id: entry.id,
        employe_id: entry.employeId,
        status: 'PUBLISHED',
        file_name: existingFileName,
        storage_path: existingStoragePath,
        published_at: publishedAt,
        published_by_user_id: userId,
        publication_metadata_json: buildPayslipPublicationMetadata(currentRun, entry, {
          documentReady: hasExistingDocument
            ? isPayslipDocumentReady(existingMetadata, true)
            : false,
          documentRepresentationMode: hasExistingDocument
            ? resolvePayslipDocumentRepresentationMode(existingMetadata, true)
            : 'NONE',
          documentAttachedAt: hasExistingDocument
            ? readMetadataText(existingMetadata, 'documentAttachedAt') ??
              readMetadataText(existingMetadata, 'generatedAt') ??
              publishedAt
            : null,
          fileName: existingFileName,
          storagePath: existingStoragePath,
          contentType: resolvePayslipDocumentContentType(existingMetadata, hasExistingDocument),
          fileSizeBytes: resolvePayslipDocumentFileSizeBytes(existingMetadata),
          generationStatus: 'PENDING',
          generatedAt: hasExistingDocument
            ? resolvePayslipDocumentGeneratedAt(existingMetadata) ?? publishedAt
            : null,
          generationError: null,
        }),
      }
    })

    const { data: payslipRows, error: payslipUpsertError } = await supabase
      .from('Payslip')
      .upsert(upsertRows, { onConflict: 'payroll_run_employe_id' })
      .select('id, payroll_run_employe_id, employe_id')
      .returns<PayslipLookupRow[]>()

    if (payslipUpsertError) {
      throw new Error(payslipUpsertError.message)
    }

    const payslipByRunEmployeeId = new Map(
      ensureArrayResult<PayslipLookupRow>(payslipRows).map((row) => [row.payroll_run_employe_id, row]),
    )

    const payslipAuditRows: PayslipAuditInsertRow[] = []
    const payslipDocumentAuditRows: PayslipAuditInsertRow[] = []

    for (const entry of publishableEntries) {
      const payslip = payslipByRunEmployeeId.get(entry.id)
      const existingPayslip = existingPayslipByRunEmployeeId.get(entry.id)
      const existingFileName = normalizeText(existingPayslip?.file_name)
      const existingStoragePath = normalizeText(existingPayslip?.storage_path)
      const existingMetadata = normalizeObject(existingPayslip?.publication_metadata_json)
      const hasExistingDocument = Boolean(existingFileName && existingStoragePath)

      if (!payslip?.id) {
        continue
      }

      payslipAuditRows.push({
        actor_user_id: userId,
        action: 'PAYROLL_PAYSLIP_PUBLISHED',
        target_type: 'Payslip',
        target_id: payslip.id,
        details_json: {
          payslip_id: payslip.id,
          payroll_run_id: payload.runId,
          payroll_run_code: currentRun.code,
          payroll_period_id: currentRun.payrollPeriodId,
          period_code: currentRun.periodCode,
          period_label: currentRun.periodLabel,
          employee_id: entry.employeId,
          employee_name: buildEmployeeName(entry.prenom, entry.nom),
          matricule: entry.matricule,
          payroll_run_employe_id: entry.id,
          published_at: publishedAt,
          canonical_source: 'PAYROLL_RUN_EMPLOYEE_RESULT',
          document_ready: hasExistingDocument
            ? isPayslipDocumentReady(existingMetadata, true)
            : false,
          document_representation_mode: hasExistingDocument
            ? resolvePayslipDocumentRepresentationMode(existingMetadata, true)
            : 'NONE',
        },
      })

      try {
        const pdfPayload = buildPayrollPayslipPdfData(currentRun, entry, publishedAt)
        const generatedPayslipDocument = await generatePayrollPayslipPdf(pdfPayload)
        const generatedFileSizeBytes = generatedPayslipDocument.blob.size
        const storagePath = buildPayslipStoragePath(
          entry.employeId,
          currentRun.payrollPeriodId,
          payslip.id,
          generatedPayslipDocument.fileName,
        )
        const contentType = 'application/pdf'

        const { error: uploadError } = await supabase.storage
          .from(PAYSLIP_STORAGE_BUCKET)
          .upload(storagePath, generatedPayslipDocument.blob, {
            contentType,
            upsert: true,
          })

        if (uploadError) {
          throw new Error(uploadError.message)
        }

        const { error: payslipDocumentUpdateError } = await supabase
          .from('Payslip')
          .update({
            file_name: generatedPayslipDocument.fileName,
            storage_path: storagePath,
            publication_metadata_json: buildPayslipPublicationMetadata(currentRun, entry, {
              documentReady: true,
              documentRepresentationMode: 'GENERATED_PDF',
              documentAttachedAt: publishedAt,
              fileName: generatedPayslipDocument.fileName,
              storagePath,
              contentType,
              fileSizeBytes: generatedFileSizeBytes,
              generationStatus: 'GENERATED',
              generatedAt: publishedAt,
              generationError: null,
            }),
          })
          .eq('id', payslip.id)

        if (payslipDocumentUpdateError) {
          if (!existingStoragePath || existingStoragePath !== storagePath) {
            try {
              await removePayslipStorageObject(storagePath)
            } catch (cleanupError) {
              console.error(
                'Failed to remove a newly uploaded payslip file after metadata update failure.',
                cleanupError,
              )
            }
          }
          throw new Error(payslipDocumentUpdateError.message)
        }

        if (existingStoragePath && existingStoragePath !== storagePath) {
          try {
            await removePayslipStorageObject(existingStoragePath)
          } catch (cleanupError) {
            console.error('Failed to remove superseded payslip storage object.', cleanupError)
          }
        }

        payslipDocumentAuditRows.push({
          actor_user_id: userId,
          action: 'PAYSLIP_DOCUMENT_PUBLISHED',
          target_type: 'Payslip',
          target_id: payslip.id,
          details_json: {
            payslip_id: payslip.id,
            payroll_run_id: payload.runId,
            payroll_run_code: currentRun.code,
            payroll_period_id: currentRun.payrollPeriodId,
            period_code: currentRun.periodCode,
            period_label: currentRun.periodLabel,
            employee_id: entry.employeId,
            employee_name: buildEmployeeName(entry.prenom, entry.nom),
            matricule: entry.matricule,
            payroll_run_employe_id: entry.id,
            published_at: publishedAt,
            file_name: generatedPayslipDocument.fileName,
            storage_path: storagePath,
            content_type: contentType,
            file_size_bytes: generatedFileSizeBytes,
            canonical_source: 'PAYROLL_RUN_EMPLOYEE_RESULT',
            document_ready: true,
            document_representation_mode: 'GENERATED_PDF',
          },
        })

        try {
          await notificationsService.notifyEmployeePayslipAvailable({
            employeId: entry.employeId,
            payslipId: payslip.id,
            payrollRunId: payload.runId,
            payrollPeriodId: currentRun.payrollPeriodId,
            payrollPeriodCode: currentRun.periodCode,
            payrollPeriodLabel: currentRun.periodLabel,
          })
        } catch (notificationError) {
          console.error(
            `Failed to notify employee ${entry.employeId} about payslip availability for payroll run ${payload.runId}.`,
            notificationError,
          )
        }
      } catch (error) {
        const generationError =
          error instanceof Error ? error.message : 'Unknown payslip document generation failure.'

        const { error: payslipFailureUpdateError } = await supabase
          .from('Payslip')
          .update({
            file_name: existingFileName,
            storage_path: existingStoragePath,
            publication_metadata_json: buildPayslipPublicationMetadata(currentRun, entry, {
              documentReady: hasExistingDocument
                ? isPayslipDocumentReady(existingMetadata, true)
                : false,
              documentRepresentationMode: hasExistingDocument
                ? resolvePayslipDocumentRepresentationMode(existingMetadata, true)
                : 'NONE',
              documentAttachedAt: hasExistingDocument
                ? readMetadataText(existingMetadata, 'documentAttachedAt') ??
                  readMetadataText(existingMetadata, 'generatedAt') ??
                  publishedAt
                : null,
              fileName: existingFileName,
              storagePath: existingStoragePath,
              contentType: resolvePayslipDocumentContentType(existingMetadata, hasExistingDocument),
              fileSizeBytes: resolvePayslipDocumentFileSizeBytes(existingMetadata),
              generationStatus: 'FAILED',
              generatedAt: hasExistingDocument
                ? resolvePayslipDocumentGeneratedAt(existingMetadata) ?? publishedAt
                : null,
              generationError,
            }),
          })
          .eq('id', payslip.id)

        if (payslipFailureUpdateError) {
          console.error(
            'Failed to persist payslip document generation failure state.',
            payslipFailureUpdateError,
          )
        }

        console.error(
          `Payslip PDF generation failed for payroll run employee entry ${entry.id}.`,
          error,
        )
      }
    }

    await insertPayrollAuditRows(payslipAuditRows)
    await insertPayrollAuditRows(payslipDocumentAuditRows)
  }

  await auditService.insertAuditLog({
    action: payload.status === 'FINALIZED' ? 'PAYROLL_RUN_FINALIZED' : 'PAYROLL_RUN_UPDATED',
    targetType: 'PayrollRun',
    targetId: payload.runId,
    detailsJson: {
      payroll_run_id: payload.runId,
      payroll_period_id: currentRun.payrollPeriodId,
      period_code: currentRun.periodCode,
      period_label: currentRun.periodLabel,
      payroll_run_code: currentRun.code,
      previous_status: currentRun.status,
      next_status: payload.status,
    },
  })

  const refreshedRun = await getPayrollRunById(payload.runId)

  if (!refreshedRun) {
    throw new Error('Payroll run status was updated but the refreshed run could not be loaded.')
  }

  return refreshedRun
}

export async function getEmployeePayslips(): Promise<EmployeePayslipListItem[]> {
  const { data, error } = await supabase
    .rpc('get_employee_payslips')
    .returns<EmployeePayslipRow[]>()

  if (error) {
    throw new Error(error.message)
  }

  return ensureArrayResult<EmployeePayslipRow>(data).map(mapEmployeePayslip)
}

export async function listMyPayrollProcessingActivity(
  userId?: string | null,
  options: PayrollProcessingActivityListOptions = {},
): Promise<PayrollProcessingActivityItem[]> {
  const resolvedUserId = await resolveCurrentUserId()

  if (userId && userId !== resolvedUserId) {
    console.warn(
      'payrollProcessingService.listMyPayrollProcessingActivity received mismatched user id input.',
    )
  }

  let query = supabase
    .from('audit_log')
    .select('id, action, target_type, target_id, details_json, created_at')
    .eq('actor_user_id', resolvedUserId)
    .in('action', PAYROLL_PROCESSING_ACTIONS)
    .order('created_at', { ascending: false })

  if (typeof options.limit === 'number' && Number.isFinite(options.limit) && options.limit > 0) {
    query = query.limit(options.limit)
  }

  const { data, error } = await query.returns<PayrollProcessingAuditRow[]>()

  if (error) {
    throw new Error(error.message)
  }

  return ensureArrayResult<PayrollProcessingAuditRow>(data).map(mapPayrollProcessingActivity)
}

export function usePayrollPeriodsQuery() {
  return useQuery({
    queryKey: ['payrollPeriods'],
    queryFn: getPayrollPeriods,
    placeholderData: keepPreviousData,
    refetchInterval: 15000,
  })
}

export function usePayrollCompensationProfilesQuery(
  filters: PayrollCompensationProfileFilters = {},
) {
  const normalizedFilters = normalizeCompensationFilters(filters)

  return useQuery({
    queryKey: [
      'payrollCompensationProfiles',
      normalizedFilters.search ?? '',
      normalizedFilters.payrollEligible === null
        ? 'all'
        : normalizedFilters.payrollEligible
          ? 'eligible'
          : 'ineligible',
    ],
    queryFn: () => getPayrollCompensationProfiles(filters),
    placeholderData: keepPreviousData,
    refetchInterval: 15000,
  })
}

export function usePayrollRunsQuery(periodId?: string | null) {
  return useQuery({
    queryKey: ['payrollRuns', periodId ?? 'all'],
    queryFn: () => getPayrollRuns(periodId),
    placeholderData: keepPreviousData,
    refetchInterval: 15000,
  })
}

export function usePayrollRunQuery(runId?: string | null) {
  return useQuery({
    queryKey: ['payrollRun', runId ?? null],
    queryFn: () => getPayrollRunById(runId as string),
    enabled: Boolean(runId),
    refetchInterval: 15000,
  })
}

export function usePayrollRunEmployeeEntriesQuery(runId?: string | null) {
  return useQuery({
    queryKey: ['payrollRunEmployeeEntries', runId ?? null],
    queryFn: () => getPayrollRunEmployeeEntries(runId as string),
    enabled: Boolean(runId),
    placeholderData: keepPreviousData,
    refetchInterval: 15000,
  })
}

export function useCalculatePayrollRunMutation(
  userId?: string | null,
  options?: UseMutationOptions<PayrollRunCalculationResult, Error, string>,
) {
  const queryClient = useQueryClient()
  const { onSuccess, onSettled, ...restOptions } = options ?? {}

  return useMutation({
    mutationFn: calculatePayrollRun,
    ...restOptions,
    onSuccess: async (data, variables, onMutateResult, context) => {
      await onSuccess?.(data, variables, onMutateResult, context)
    },
    onSettled: async (data, error, variables, onMutateResult, context) => {
      if (variables) {
        await queryClient.invalidateQueries({ queryKey: ['payrollRun', variables] })
        await queryClient.invalidateQueries({
          queryKey: ['payrollRunEmployeeEntries', variables],
        })
      }

      await queryClient.invalidateQueries({ queryKey: ['payrollRuns'] })
      await queryClient.invalidateQueries({ queryKey: ['employeePayslips'] })
      await queryClient.invalidateQueries({
        queryKey: ['payrollProcessingActivity', userId ?? null],
      })
      await onSettled?.(data, error, variables, onMutateResult, context)
    },
  })
}

export function useEmployeePayslipsQuery(userId?: string | null) {
  return useQuery({
    queryKey: ['employeePayslips', userId ?? null],
    queryFn: getEmployeePayslips,
    enabled: Boolean(userId),
    placeholderData: keepPreviousData,
    refetchInterval: 15000,
  })
}

export function useMyPayrollProcessingActivityQuery(
  userId?: string | null,
  options: PayrollProcessingActivityListOptions = {},
) {
  const limit = options.limit ?? null

  return useQuery({
    queryKey: ['payrollProcessingActivity', userId ?? null, limit],
    queryFn: () => listMyPayrollProcessingActivity(userId, options),
    enabled: Boolean(userId),
    refetchInterval: 15000,
  })
}

export function useCreatePayrollPeriodMutation(
  userId?: string | null,
  options?: UseMutationOptions<PayrollPeriod, Error, CreatePayrollPeriodPayload>,
) {
  const queryClient = useQueryClient()
  const { onSuccess, ...restOptions } = options ?? {}

  return useMutation({
    mutationFn: createPayrollPeriod,
    ...restOptions,
    onSuccess: async (data, variables, onMutateResult, context) => {
      await queryClient.invalidateQueries({ queryKey: ['payrollPeriods'] })
      await queryClient.invalidateQueries({ queryKey: ['payrollProcessingActivity', userId ?? null] })
      await onSuccess?.(data, variables, onMutateResult, context)
    },
  })
}

export function useUpsertPayrollCompensationProfileMutation(
  userId?: string | null,
  options?: UseMutationOptions<
    PayrollCompensationProfile,
    Error,
    UpsertPayrollCompensationProfilePayload
  >,
) {
  const queryClient = useQueryClient()
  const { onSuccess, ...restOptions } = options ?? {}

  return useMutation({
    mutationFn: upsertPayrollCompensationProfile,
    ...restOptions,
    onSuccess: async (data, variables, onMutateResult, context) => {
      await queryClient.invalidateQueries({ queryKey: ['payrollCompensationProfiles'] })
      await queryClient.invalidateQueries({ queryKey: ['payrollRuns'] })
      await queryClient.invalidateQueries({ queryKey: ['payrollRunEmployeeEntries'] })
      await queryClient.invalidateQueries({
        queryKey: ['payrollProcessingActivity', userId ?? null],
      })
      await onSuccess?.(data, variables, onMutateResult, context)
    },
  })
}

export function useUpdatePayrollPeriodStatusMutation(
  userId?: string | null,
  options?: UseMutationOptions<PayrollPeriod, Error, UpdatePayrollPeriodStatusPayload>,
) {
  const queryClient = useQueryClient()
  const { onSuccess, ...restOptions } = options ?? {}

  return useMutation({
    mutationFn: updatePayrollPeriodStatus,
    ...restOptions,
    onSuccess: async (data, variables, onMutateResult, context) => {
      await queryClient.invalidateQueries({ queryKey: ['payrollPeriods'] })
      await queryClient.invalidateQueries({ queryKey: ['payrollRuns'] })
      await queryClient.invalidateQueries({ queryKey: ['payrollProcessingActivity', userId ?? null] })
      await onSuccess?.(data, variables, onMutateResult, context)
    },
  })
}

export function useCreatePayrollRunMutation(
  userId?: string | null,
  options?: UseMutationOptions<PayrollRunDetail, Error, CreatePayrollRunPayload>,
) {
  const queryClient = useQueryClient()
  const { onSuccess, ...restOptions } = options ?? {}

  return useMutation({
    mutationFn: createPayrollRun,
    ...restOptions,
    onSuccess: async (data, variables, onMutateResult, context) => {
      await queryClient.invalidateQueries({ queryKey: ['payrollPeriods'] })
      await queryClient.invalidateQueries({ queryKey: ['payrollRuns'] })
      await queryClient.invalidateQueries({ queryKey: ['payrollRun', data.id] })
      await queryClient.invalidateQueries({ queryKey: ['payrollRunEmployeeEntries', data.id] })
      await queryClient.invalidateQueries({ queryKey: ['payrollProcessingActivity', userId ?? null] })
      await onSuccess?.(data, variables, onMutateResult, context)
    },
  })
}

export function useUpdatePayrollRunStatusMutation(
  userId?: string | null,
  options?: UseMutationOptions<PayrollRunDetail, Error, UpdatePayrollRunStatusPayload>,
) {
  const queryClient = useQueryClient()
  const { onSuccess, ...restOptions } = options ?? {}

  return useMutation({
    mutationFn: updatePayrollRunStatus,
    ...restOptions,
    onSuccess: async (data, variables, onMutateResult, context) => {
      await queryClient.invalidateQueries({ queryKey: ['payrollPeriods'] })
      await queryClient.invalidateQueries({ queryKey: ['payrollRuns'] })
      await queryClient.invalidateQueries({ queryKey: ['payrollRun', data.id] })
      await queryClient.invalidateQueries({ queryKey: ['payrollRunEmployeeEntries', data.id] })
      await queryClient.invalidateQueries({ queryKey: ['employeePayslips'] })
      await queryClient.invalidateQueries({ queryKey: ['employeePayslipDocuments'] })
      await queryClient.invalidateQueries({ queryKey: ['payrollProcessingActivity', userId ?? null] })
      await onSuccess?.(data, variables, onMutateResult, context)
    },
  })
}

export const payrollProcessingService = {
  getPayrollPeriods,
  getPayrollCompensationProfiles,
  upsertPayrollCompensationProfile,
  createPayrollPeriod,
  updatePayrollPeriodStatus,
  getPayrollRuns,
  createPayrollRun,
  getPayrollRunById,
  getPayrollRunEmployeeEntries,
  calculatePayrollRun,
  updatePayrollRunStatus,
  getEmployeePayslips,
  listMyPayrollProcessingActivity,
}
