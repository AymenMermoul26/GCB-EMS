import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
} from '@tanstack/react-query'

import { supabase } from '@/lib/supabaseClient'
import { auditService } from '@/services/auditService'
import { getDepartmentDisplayName } from '@/types/department'
import type {
  AvailablePayslipDocumentItem,
  CreatePayslipRequestPayload,
  EmployeePayslipRequestItem,
  EmployeePayslipListItem,
  FulfillPayslipRequestPayload,
  PayrollPeriodStatus,
  PayrollPayslipRequestItem,
  PayrollProcessingStatus,
  PayrollRunEmployeeEntry,
  PayslipDocumentSource,
  PayslipDocumentRepresentationMode,
  PayslipRequestPeriodOption,
  PayslipRequestStatus,
  PayslipRequestStatusFilter,
  UpdatePayslipRequestStatusPayload,
} from '@/types/payroll'
import {
  isPayslipDocumentReady,
  resolvePayslipDocumentRepresentationMode,
} from '@/types/payroll'

const PAYSLIP_STORAGE_BUCKET = 'payslips'

interface PayslipRequestPeriodRow {
  id: string
  code: string
  label: string
  period_start: string
  period_end: string
  status: string
}

interface EmployeePayslipRequestRow {
  id: string
  payroll_period_id: string
  payroll_period_code: string
  payroll_period_label: string
  period_start: string
  period_end: string
  status: string
  request_note: string | null
  review_note: string | null
  linked_payslip_id: string | null
  canonical_source_payroll_run_id: string | null
  canonical_source_payroll_run_employe_id: string | null
  canonical_payslip_id: string | null
  canonical_payslip_status: string | null
  canonical_payslip_published_at: string | null
  canonical_document_ready: boolean | null
  canonical_document_representation_mode: string | null
  canonical_document_file_name: string | null
  canonical_document_storage_path: string | null
  canonical_document_content_type: string | null
  canonical_document_file_size_bytes: number | string | null
  document_id: string | null
  document_file_name: string | null
  document_storage_path: string | null
  document_published_at: string | null
  created_at: string
  reviewed_at: string | null
  fulfilled_at: string | null
  updated_at: string
}

interface AvailablePayslipDocumentRow {
  id: string
  payslip_id: string | null
  payslip_request_id: string | null
  source: string
  payroll_period_id: string
  payroll_period_code: string
  payroll_period_label: string
  period_start: string
  period_end: string
  file_name: string
  storage_path: string
  content_type: string
  file_size_bytes: number | string | null
  published_at: string
  created_at: string
  audit_target_type: string
  audit_target_id: string
}

interface PayrollPayslipRequestRow {
  id: string
  employe_id: string
  employe_matricule: string
  employe_nom: string
  employe_prenom: string
  employe_email: string | null
  departement_nom: string | null
  payroll_period_id: string
  payroll_period_code: string
  payroll_period_label: string
  period_start: string
  period_end: string
  status: string
  request_note: string | null
  review_note: string | null
  linked_payslip_id: string | null
  canonical_source_payroll_run_id: string | null
  canonical_source_payroll_run_employe_id: string | null
  canonical_payslip_id: string | null
  canonical_payslip_status: string | null
  canonical_payslip_published_at: string | null
  canonical_document_ready: boolean | null
  canonical_document_representation_mode: string | null
  canonical_document_file_name: string | null
  canonical_document_storage_path: string | null
  canonical_document_content_type: string | null
  canonical_document_file_size_bytes: number | string | null
  document_id: string | null
  document_file_name: string | null
  document_storage_path: string | null
  document_published_at: string | null
  reviewed_by_user_id: string | null
  fulfilled_by_user_id: string | null
  created_at: string
  reviewed_at: string | null
  fulfilled_at: string | null
  updated_at: string
}

export interface PayslipDocumentAccessDescriptor {
  auditTargetType: 'PayslipDelivery' | 'Payslip'
  auditTargetId: string
  storagePath: string
  fileName: string
  payrollPeriodId?: string
  payrollPeriodCode?: string
  payrollPeriodLabel?: string
}

interface PayslipDocumentAccessDescriptorInput {
  auditTargetType: 'PayslipDelivery' | 'Payslip'
  auditTargetId: string | null | undefined
  storagePath: string | null | undefined
  fileName: string | null | undefined
  payrollPeriodId?: string | null | undefined
  payrollPeriodCode?: string | null | undefined
  payrollPeriodLabel?: string | null | undefined
}

export interface PayrollPayslipRequestFilters {
  status?: PayslipRequestStatusFilter
  search?: string
}

function normalizeText(value: string | null | undefined): string | null {
  const normalized = value?.trim()
  return normalized && normalized.length > 0 ? normalized : null
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

function ensureArrayResult<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

function normalizeScalarUuid(value: unknown, context: string): string {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value
  }

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const firstValue = Object.values(value)[0]
    if (typeof firstValue === 'string' && firstValue.trim().length > 0) {
      return firstValue
    }
  }

  throw new Error(`Unexpected RPC result for ${context}.`)
}

function resolvePayrollPeriodStatus(value: string | null | undefined): PayrollPeriodStatus {
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

function resolvePayslipRequestStatus(value: string | null | undefined): PayslipRequestStatus {
  switch (value) {
    case 'IN_REVIEW':
    case 'FULFILLED':
    case 'REJECTED':
      return value
    case 'PENDING':
    default:
      return 'PENDING'
  }
}

function resolvePayrollProcessingStatus(
  value: string | null | undefined,
): PayrollProcessingStatus | null {
  switch (value) {
    case 'DRAFT':
    case 'CALCULATED':
    case 'UNDER_REVIEW':
    case 'FINALIZED':
    case 'PUBLISHED':
    case 'ARCHIVED':
      return value
    default:
      return null
  }
}

function resolvePayslipDocumentSource(value: string | null | undefined): PayslipDocumentSource {
  return value === 'PAYROLL_PUBLICATION' ? 'PAYROLL_PUBLICATION' : 'REQUEST_DELIVERY'
}

function mapPayslipRequestPeriod(row: PayslipRequestPeriodRow): PayslipRequestPeriodOption {
  return {
    id: row.id,
    code: row.code,
    label: row.label,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    status: resolvePayrollPeriodStatus(row.status),
  }
}

function mapEmployeePayslipRequest(row: EmployeePayslipRequestRow): EmployeePayslipRequestItem {
  const hasCanonicalDocumentAttachment = Boolean(
    row.canonical_document_file_name && row.canonical_document_storage_path,
  )
  const canonicalDocumentRepresentationMode = row.canonical_document_representation_mode
    ? resolvePayslipDocumentRepresentationMode(
        { documentRepresentationMode: row.canonical_document_representation_mode },
        hasCanonicalDocumentAttachment,
      )
    : null

  return {
    id: row.id,
    payrollPeriodId: row.payroll_period_id,
    payrollPeriodCode: row.payroll_period_code,
    payrollPeriodLabel: row.payroll_period_label,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    status: resolvePayslipRequestStatus(row.status),
    requestNote: normalizeText(row.request_note),
    reviewNote: normalizeText(row.review_note),
    linkedPayslipId: row.linked_payslip_id,
    canonicalSourcePayrollRunId: row.canonical_source_payroll_run_id,
    canonicalSourcePayrollRunEmployeId: row.canonical_source_payroll_run_employe_id,
    canonicalPayslipId: row.canonical_payslip_id,
    canonicalPayslipStatus: resolvePayrollProcessingStatus(row.canonical_payslip_status),
    canonicalPayslipPublishedAt: row.canonical_payslip_published_at,
    canonicalDocumentReady: isPayslipDocumentReady(
      row.canonical_document_representation_mode || row.canonical_document_ready !== null
        ? {
            documentRepresentationMode: row.canonical_document_representation_mode ?? undefined,
            documentReady: row.canonical_document_ready ?? undefined,
          }
        : undefined,
      hasCanonicalDocumentAttachment,
    ),
    canonicalDocumentRepresentationMode,
    canonicalDocumentFileName: normalizeText(row.canonical_document_file_name),
    canonicalDocumentStoragePath: normalizeText(row.canonical_document_storage_path),
    canonicalDocumentContentType: normalizeText(row.canonical_document_content_type),
    canonicalDocumentFileSizeBytes: normalizeNumber(row.canonical_document_file_size_bytes),
    documentId: row.document_id,
    documentFileName: normalizeText(row.document_file_name),
    documentStoragePath: normalizeText(row.document_storage_path),
    documentPublishedAt: row.document_published_at,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
    fulfilledAt: row.fulfilled_at,
    updatedAt: row.updated_at,
  }
}

function mapAvailablePayslipDocument(
  row: AvailablePayslipDocumentRow,
): AvailablePayslipDocumentItem {
  return {
    id: row.id,
    payslipId: row.payslip_id,
    payslipRequestId: row.payslip_request_id,
    source: resolvePayslipDocumentSource(row.source),
    payrollPeriodId: row.payroll_period_id,
    payrollPeriodCode: row.payroll_period_code,
    payrollPeriodLabel: row.payroll_period_label,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    fileName: row.file_name,
    storagePath: row.storage_path,
    contentType: row.content_type,
    fileSizeBytes: normalizeNumber(row.file_size_bytes),
    publishedAt: row.published_at,
    createdAt: row.created_at,
    auditTargetType: row.audit_target_type === 'Payslip' ? 'Payslip' : 'PayslipDelivery',
    auditTargetId: row.audit_target_id,
  }
}

function mapPayrollPayslipRequest(row: PayrollPayslipRequestRow): PayrollPayslipRequestItem {
  const hasCanonicalDocumentAttachment = Boolean(
    row.canonical_document_file_name && row.canonical_document_storage_path,
  )
  const canonicalDocumentRepresentationMode: PayslipDocumentRepresentationMode | null =
    row.canonical_document_representation_mode
      ? resolvePayslipDocumentRepresentationMode(
          { documentRepresentationMode: row.canonical_document_representation_mode },
          hasCanonicalDocumentAttachment,
        )
      : null

  return {
    id: row.id,
    employeId: row.employe_id,
    employeMatricule: row.employe_matricule,
    employeNom: row.employe_nom,
    employePrenom: row.employe_prenom,
    employeEmail: normalizeText(row.employe_email),
    departementNom: getDepartmentDisplayName(normalizeText(row.departement_nom)),
    payrollPeriodId: row.payroll_period_id,
    payrollPeriodCode: row.payroll_period_code,
    payrollPeriodLabel: row.payroll_period_label,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    status: resolvePayslipRequestStatus(row.status),
    requestNote: normalizeText(row.request_note),
    reviewNote: normalizeText(row.review_note),
    linkedPayslipId: row.linked_payslip_id,
    canonicalSourcePayrollRunId: row.canonical_source_payroll_run_id,
    canonicalSourcePayrollRunEmployeId: row.canonical_source_payroll_run_employe_id,
    canonicalPayslipId: row.canonical_payslip_id,
    canonicalPayslipStatus: resolvePayrollProcessingStatus(row.canonical_payslip_status),
    canonicalPayslipPublishedAt: row.canonical_payslip_published_at,
    canonicalDocumentReady: isPayslipDocumentReady(
      row.canonical_document_representation_mode || row.canonical_document_ready !== null
        ? {
            documentRepresentationMode: row.canonical_document_representation_mode ?? undefined,
            documentReady: row.canonical_document_ready ?? undefined,
          }
        : undefined,
      hasCanonicalDocumentAttachment,
    ),
    canonicalDocumentRepresentationMode,
    canonicalDocumentFileName: normalizeText(row.canonical_document_file_name),
    canonicalDocumentStoragePath: normalizeText(row.canonical_document_storage_path),
    canonicalDocumentContentType: normalizeText(row.canonical_document_content_type),
    canonicalDocumentFileSizeBytes: normalizeNumber(row.canonical_document_file_size_bytes),
    documentId: row.document_id,
    documentFileName: normalizeText(row.document_file_name),
    documentStoragePath: normalizeText(row.document_storage_path),
    documentPublishedAt: row.document_published_at,
    reviewedByUserId: row.reviewed_by_user_id,
    fulfilledByUserId: row.fulfilled_by_user_id,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
    fulfilledAt: row.fulfilled_at,
    updatedAt: row.updated_at,
  }
}

async function loadStorageBlobUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(PAYSLIP_STORAGE_BUCKET)
    .download(storagePath)

  if (error) {
    throw new Error(error.message)
  }

  return URL.createObjectURL(data)
}

async function writePayslipDocumentAudit(
  action: 'PAYSLIP_DOCUMENT_VIEWED' | 'PAYSLIP_DOCUMENT_DOWNLOADED',
  document: PayslipDocumentAccessDescriptor,
) {
  try {
    await auditService.insertAuditLog({
      action,
      targetType: document.auditTargetType,
      targetId: document.auditTargetId,
      detailsJson: {
        storage_path: document.storagePath,
        file_name: document.fileName,
        payroll_period_id: document.payrollPeriodId ?? null,
        payroll_period_code: document.payrollPeriodCode ?? null,
        payroll_period_label: document.payrollPeriodLabel ?? null,
      },
    })
  } catch (error) {
    console.error(`Unable to log ${action.toLowerCase()} event`, error)
  }
}

export function createPayslipDocumentAccessDescriptor(
  input: PayslipDocumentAccessDescriptorInput,
): PayslipDocumentAccessDescriptor | null {
  const auditTargetId = normalizeText(input.auditTargetId)
  const storagePath = normalizeText(input.storagePath)
  const fileName = normalizeText(input.fileName)

  if (!auditTargetId || !storagePath || !fileName) {
    return null
  }

  return {
    auditTargetType: input.auditTargetType,
    auditTargetId,
    storagePath,
    fileName,
    payrollPeriodId: normalizeText(input.payrollPeriodId) ?? undefined,
    payrollPeriodCode: normalizeText(input.payrollPeriodCode) ?? undefined,
    payrollPeriodLabel: normalizeText(input.payrollPeriodLabel) ?? undefined,
  }
}

export function createAvailablePayslipDocumentAccessDescriptor(
  document: AvailablePayslipDocumentItem,
): PayslipDocumentAccessDescriptor {
  return {
    auditTargetType: document.auditTargetType,
    auditTargetId: document.auditTargetId,
    storagePath: document.storagePath,
    fileName: document.fileName,
    payrollPeriodId: document.payrollPeriodId,
    payrollPeriodCode: document.payrollPeriodCode,
    payrollPeriodLabel: document.payrollPeriodLabel,
  }
}

export function createEmployeePublishedPayslipAccessDescriptor(
  payslip: EmployeePayslipListItem,
): PayslipDocumentAccessDescriptor | null {
  return createPayslipDocumentAccessDescriptor({
    auditTargetType: 'Payslip',
    auditTargetId: payslip.id,
    storagePath: payslip.storagePath,
    fileName: payslip.fileName,
    payrollPeriodId: payslip.payrollPeriodId,
    payrollPeriodCode: payslip.payrollPeriodCode,
    payrollPeriodLabel: payslip.payrollPeriodLabel,
  })
}

export function createPayslipRequestCanonicalDocumentAccessDescriptor(
  request: EmployeePayslipRequestItem | PayrollPayslipRequestItem,
): PayslipDocumentAccessDescriptor | null {
  return createPayslipDocumentAccessDescriptor({
    auditTargetType: 'Payslip',
    auditTargetId: request.canonicalPayslipId,
    storagePath: request.canonicalDocumentStoragePath,
    fileName: request.canonicalDocumentFileName,
    payrollPeriodId: request.payrollPeriodId,
    payrollPeriodCode: request.payrollPeriodCode,
    payrollPeriodLabel: request.payrollPeriodLabel,
  })
}

export function createPayslipRequestDeliveredDocumentAccessDescriptor(
  request: EmployeePayslipRequestItem | PayrollPayslipRequestItem,
): PayslipDocumentAccessDescriptor | null {
  return createPayslipDocumentAccessDescriptor({
    auditTargetType: 'PayslipDelivery',
    auditTargetId: request.documentId,
    storagePath: request.documentStoragePath,
    fileName: request.documentFileName,
    payrollPeriodId: request.payrollPeriodId,
    payrollPeriodCode: request.payrollPeriodCode,
    payrollPeriodLabel: request.payrollPeriodLabel,
  })
}

export function createPayrollRunEmployeePayslipAccessDescriptor(
  run: { payrollPeriodId: string; periodCode: string; periodLabel: string },
  entry: PayrollRunEmployeeEntry,
): PayslipDocumentAccessDescriptor | null {
  return createPayslipDocumentAccessDescriptor({
    auditTargetType: 'Payslip',
    auditTargetId: entry.payslipId,
    storagePath: entry.payslipStoragePath,
    fileName: entry.payslipFileName,
    payrollPeriodId: run.payrollPeriodId,
    payrollPeriodCode: run.periodCode,
    payrollPeriodLabel: run.periodLabel,
  })
}

export async function getEmployeePayslipRequestPeriods(): Promise<PayslipRequestPeriodOption[]> {
  const { data, error } = await supabase
    .rpc('get_employee_payslip_request_periods')
    .returns<PayslipRequestPeriodRow[]>()

  if (error) {
    throw new Error(error.message)
  }

  return ensureArrayResult<PayslipRequestPeriodRow>(data).map(mapPayslipRequestPeriod)
}

export async function getEmployeePayslipRequests(): Promise<EmployeePayslipRequestItem[]> {
  const { data, error } = await supabase
    .rpc('get_employee_payslip_requests')
    .returns<EmployeePayslipRequestRow[]>()

  if (error) {
    throw new Error(error.message)
  }

  return ensureArrayResult<EmployeePayslipRequestRow>(data).map(mapEmployeePayslipRequest)
}

export async function getEmployeeAvailablePayslipDocuments(): Promise<
  AvailablePayslipDocumentItem[]
> {
  const { data, error } = await supabase
    .rpc('get_employee_available_payslip_documents')
    .returns<AvailablePayslipDocumentRow[]>()

  if (error) {
    throw new Error(error.message)
  }

  return ensureArrayResult<AvailablePayslipDocumentRow>(data).map(
    mapAvailablePayslipDocument,
  )
}

export async function getPayrollPayslipRequests(
  filters: PayrollPayslipRequestFilters = {},
): Promise<PayrollPayslipRequestItem[]> {
  const normalizedStatus = filters.status ?? 'ALL'
  const normalizedSearch = normalizeText(filters.search)

  const { data, error } = await supabase
    .rpc('get_payroll_payslip_requests', {
      p_status: normalizedStatus,
      p_search: normalizedSearch,
    })
    .returns<PayrollPayslipRequestRow[]>()

  if (error) {
    throw new Error(error.message)
  }

  return ensureArrayResult<PayrollPayslipRequestRow>(data).map(mapPayrollPayslipRequest)
}

export async function createEmployeePayslipRequest(
  payload: CreatePayslipRequestPayload,
): Promise<string> {
  const { data, error } = await supabase.rpc('create_employee_payslip_request', {
    p_payroll_period_id: payload.payrollPeriodId,
    p_request_note: normalizeText(payload.requestNote),
  })

  if (error) {
    throw new Error(error.message)
  }

  return normalizeScalarUuid(data, 'create_employee_payslip_request')
}

export async function updatePayslipRequestStatus(
  payload: UpdatePayslipRequestStatusPayload,
): Promise<string> {
  const { data, error } = await supabase.rpc('set_payslip_request_status', {
    p_request_id: payload.requestId,
    p_status: payload.status,
    p_review_note: normalizeText(payload.reviewNote),
  })

  if (error) {
    throw new Error(error.message)
  }

  return normalizeScalarUuid(data, 'set_payslip_request_status')
}

export async function fulfillPayslipRequest(
  payload: FulfillPayslipRequestPayload,
): Promise<string> {
  const { data, error } = await supabase.rpc('fulfill_payslip_request', {
    p_request_id: payload.requestId,
    p_review_note: normalizeText(payload.reviewNote),
  })

  if (error) {
    throw new Error(error.message)
  }

  return normalizeScalarUuid(data, 'fulfill_payslip_request')
}

export async function openPayslipDocument(
  document: PayslipDocumentAccessDescriptor,
): Promise<void> {
  const objectUrl = await loadStorageBlobUrl(document.storagePath)

  await writePayslipDocumentAudit('PAYSLIP_DOCUMENT_VIEWED', document)

  const previewWindow = window.open(objectUrl, '_blank', 'noopener,noreferrer')

  if (!previewWindow) {
    const link = window.document.createElement('a')
    link.href = objectUrl
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
    link.click()
  }

  window.setTimeout(() => {
    URL.revokeObjectURL(objectUrl)
  }, 60_000)
}

export async function downloadPayslipDocument(
  document: PayslipDocumentAccessDescriptor,
): Promise<void> {
  const objectUrl = await loadStorageBlobUrl(document.storagePath)

  await writePayslipDocumentAudit('PAYSLIP_DOCUMENT_DOWNLOADED', document)

  const link = window.document.createElement('a')
  link.href = objectUrl
  link.download = document.fileName
  link.rel = 'noopener noreferrer'
  link.click()

  window.setTimeout(() => {
    URL.revokeObjectURL(objectUrl)
  }, 30_000)
}

export function useEmployeePayslipRequestPeriodsQuery(userId?: string | null) {
  return useQuery({
    queryKey: ['employeePayslipRequestPeriods', userId ?? null],
    queryFn: getEmployeePayslipRequestPeriods,
    enabled: Boolean(userId),
    placeholderData: keepPreviousData,
  })
}

export function useEmployeePayslipRequestsQuery(userId?: string | null) {
  return useQuery({
    queryKey: ['employeePayslipRequests', userId ?? null],
    queryFn: getEmployeePayslipRequests,
    enabled: Boolean(userId),
    placeholderData: keepPreviousData,
    refetchInterval: 15000,
  })
}

export function useEmployeeAvailablePayslipDocumentsQuery(userId?: string | null) {
  return useQuery({
    queryKey: ['employeePayslipDocuments', userId ?? null],
    queryFn: getEmployeeAvailablePayslipDocuments,
    enabled: Boolean(userId),
    placeholderData: keepPreviousData,
    refetchInterval: 15000,
  })
}

export function usePayrollPayslipRequestsQuery(
  userId?: string | null,
  filters: PayrollPayslipRequestFilters = {},
) {
  const normalizedStatus = filters.status ?? 'ALL'
  const normalizedSearch = normalizeText(filters.search) ?? ''

  return useQuery({
    queryKey: ['payrollPayslipRequests', userId ?? null, normalizedStatus, normalizedSearch],
    queryFn: () => getPayrollPayslipRequests(filters),
    enabled: Boolean(userId),
    placeholderData: keepPreviousData,
    refetchInterval: 15000,
  })
}

export function useCreatePayslipRequestMutation(
  userId?: string | null,
  options?: UseMutationOptions<string, Error, CreatePayslipRequestPayload>,
) {
  const queryClient = useQueryClient()
  const { onSuccess, ...restOptions } = options ?? {}

  return useMutation({
    mutationFn: createEmployeePayslipRequest,
    ...restOptions,
    onSuccess: async (data, variables, onMutateResult, context) => {
      await queryClient.invalidateQueries({ queryKey: ['employeePayslipRequestPeriods', userId ?? null] })
      await queryClient.invalidateQueries({ queryKey: ['employeePayslipRequests', userId ?? null] })
      await queryClient.invalidateQueries({ queryKey: ['employeePayslipDocuments', userId ?? null] })
      await queryClient.invalidateQueries({ queryKey: ['notifications', userId ?? null] })
      await queryClient.invalidateQueries({ queryKey: ['notificationsUnreadCount', userId ?? null] })
      await onSuccess?.(data, variables, onMutateResult, context)
    },
  })
}

export function useUpdatePayslipRequestStatusMutation(
  userId?: string | null,
  options?: UseMutationOptions<string, Error, UpdatePayslipRequestStatusPayload>,
) {
  const queryClient = useQueryClient()
  const { onSuccess, ...restOptions } = options ?? {}

  return useMutation({
    mutationFn: updatePayslipRequestStatus,
    ...restOptions,
    onSuccess: async (data, variables, onMutateResult, context) => {
      await queryClient.invalidateQueries({ queryKey: ['payrollPayslipRequests', userId ?? null] })
      await onSuccess?.(data, variables, onMutateResult, context)
    },
  })
}

export function useFulfillPayslipRequestMutation(
  userId?: string | null,
  options?: UseMutationOptions<string, Error, FulfillPayslipRequestPayload>,
) {
  const queryClient = useQueryClient()
  const { onSuccess, ...restOptions } = options ?? {}

  return useMutation({
    mutationFn: fulfillPayslipRequest,
    ...restOptions,
    onSuccess: async (data, variables, onMutateResult, context) => {
      await queryClient.invalidateQueries({ queryKey: ['payrollPayslipRequests', userId ?? null] })
      await onSuccess?.(data, variables, onMutateResult, context)
    },
  })
}

export const payslipRequestsService = {
  getEmployeePayslipRequestPeriods,
  getEmployeePayslipRequests,
  getEmployeeAvailablePayslipDocuments,
  getPayrollPayslipRequests,
  createEmployeePayslipRequest,
  updatePayslipRequestStatus,
  fulfillPayslipRequest,
  openPayslipDocument,
  downloadPayslipDocument,
}
