import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
} from '@tanstack/react-query'

import { auditService } from '@/services/auditService'
import { supabase } from '@/lib/supabaseClient'
import { getDepartmentDisplayName } from '@/types/department'
import {
  getEmployeeCategorieProfessionnelleLabel,
  getEmployeePosteLabel,
  getEmployeeRegionalBranchLabel,
  getEmployeeSituationFamilialeLabel,
  getEmployeeTypeContratLabel,
} from '@/types/employee'
import type { PayrollEmployeeDetail } from '@/types/payroll'
import type {
  PayrollEmployeeExportRow,
  PayrollEmployeeListFilters,
  PayrollEmployeeStatusFilter,
  PayrollExportAction,
  PayrollExportHistoryItem,
  PayrollExportHistoryListOptions,
  PayrollExportType,
} from '@/types/payroll'
import { downloadCsv, toCsv, type CsvColumn } from '@/utils/csv'

interface PayrollEmployeeExportRowRecord {
  id: string
  departement_id: string | null
  departement_nom: string | null
  regional_branch: string | null
  matricule: string
  nom: string
  prenom: string
  poste: string | null
  categorie_professionnelle: string | null
  type_contrat: string | null
  date_recrutement: string | null
  email: string | null
  telephone: string | null
  adresse: string | null
  situation_familiale: string | null
  nombre_enfants: number | null
  is_active: boolean
}

interface PayrollExportAuditRow {
  id: string
  action: PayrollExportAction
  target_type: string
  target_id: string | null
  details_json: unknown
  created_at: string
}

interface PayrollExportCsvRow {
  matricule: string
  nom: string
  prenom: string
  departement: string
  regional_branch: string
  poste: string
  categorie_professionnelle: string
  type_contrat: string
  date_recrutement: string
  is_active: string
  email: string
  telephone: string
  adresse: string
  situation_familiale: string
  nombre_enfants: string
}

export interface GeneratePayrollCsvExportParams {
  filters?: PayrollEmployeeListFilters
  departmentName?: string | null
}

interface GeneratePayrollCsvExportResult {
  fileName: string
  rowCount: number
}

const PAYROLL_EXPORT_CSV_COLUMNS: CsvColumn<PayrollExportCsvRow>[] = [
  { key: 'matricule', header: 'matricule' },
  { key: 'nom', header: 'nom' },
  { key: 'prenom', header: 'prenom' },
  { key: 'departement', header: 'departement' },
  { key: 'regional_branch', header: 'regional_branch' },
  { key: 'poste', header: 'poste' },
  { key: 'categorie_professionnelle', header: 'categorie_professionnelle' },
  { key: 'type_contrat', header: 'type_contrat' },
  { key: 'date_recrutement', header: 'date_recrutement' },
  { key: 'is_active', header: 'is_active' },
  { key: 'email', header: 'email' },
  { key: 'telephone', header: 'telephone' },
  { key: 'adresse', header: 'adresse' },
  { key: 'situation_familiale', header: 'situation_familiale' },
  { key: 'nombre_enfants', header: 'nombre_enfants' },
]

function normalizeFilters(filters: PayrollEmployeeListFilters = {}) {
  return {
    search: filters.search?.trim() || null,
    departementId: filters.departementId?.trim() || null,
    regionalBranch: filters.regionalBranch?.trim() || null,
    status: filters.status ?? 'ALL',
    typeContrat: filters.typeContrat?.trim() || null,
  }
}

function normalizeDetailsJson(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }

  return {}
}

function readText(value: unknown): string | null {
  if (typeof value === 'string') {
    const normalized = value.trim()
    return normalized.length > 0 ? normalized : null
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  return null
}

function readNumber(value: unknown): number | null {
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

function currentDateStamp(): string {
  return new Date().toISOString().slice(0, 10)
}

function formatTextValue(value: string | null | undefined): string {
  return value?.trim() ?? ''
}

function formatDateValue(value: string | null | undefined): string {
  return value?.trim() ?? ''
}

function formatNumberValue(value: number | null | undefined): string {
  return value === null || value === undefined ? '' : String(value)
}

function buildPayrollExportFileName(): string {
  return `payroll_employees_${currentDateStamp()}.csv`
}

function mapPayrollEmployeeExportRow(
  row: PayrollEmployeeExportRowRecord,
): PayrollEmployeeExportRow {
  return {
    id: row.id,
    departementId: row.departement_id,
    departementNom: getDepartmentDisplayName(row.departement_nom) ?? null,
    regionalBranch: row.regional_branch ?? null,
    matricule: row.matricule,
    nom: row.nom,
    prenom: row.prenom,
    poste: row.poste ?? null,
    categorieProfessionnelle: row.categorie_professionnelle ?? null,
    typeContrat: row.type_contrat ?? null,
    dateRecrutement: row.date_recrutement ?? null,
    email: row.email ?? null,
    telephone: row.telephone ?? null,
    adresse: row.adresse ?? null,
    situationFamiliale: row.situation_familiale ?? null,
    nombreEnfants: row.nombre_enfants ?? null,
    isActive: row.is_active,
  }
}

function toPayrollCsvRow(row: PayrollEmployeeExportRow): PayrollExportCsvRow {
  return {
    matricule: row.matricule,
    nom: row.nom,
    prenom: row.prenom,
    departement: formatTextValue(row.departementNom),
    regional_branch: formatTextValue(getEmployeeRegionalBranchLabel(row.regionalBranch)),
    poste: formatTextValue(getEmployeePosteLabel(row.poste)),
    categorie_professionnelle: formatTextValue(
      getEmployeeCategorieProfessionnelleLabel(row.categorieProfessionnelle),
    ),
    type_contrat: formatTextValue(getEmployeeTypeContratLabel(row.typeContrat)),
    date_recrutement: formatDateValue(row.dateRecrutement),
    is_active: row.isActive ? 'true' : 'false',
    email: formatTextValue(row.email),
    telephone: formatTextValue(row.telephone),
    adresse: formatTextValue(row.adresse),
    situation_familiale: formatTextValue(
      getEmployeeSituationFamilialeLabel(row.situationFamiliale),
    ),
    nombre_enfants: formatNumberValue(row.nombreEnfants),
  }
}

function formatEmployeeName(prenom: string, nom: string): string | null {
  const fullName = `${prenom} ${nom}`.replace(/\s+/g, ' ').trim()
  return fullName.length > 0 ? fullName : null
}

function mapPayrollExportAuditRow(row: PayrollExportAuditRow): PayrollExportHistoryItem {
  const detailsJson = normalizeDetailsJson(row.details_json)
  const rawStatus = readText(detailsJson.status)
  const status: PayrollEmployeeStatusFilter =
    rawStatus === 'ACTIVE' || rawStatus === 'INACTIVE' || rawStatus === 'ALL'
      ? rawStatus
      : 'ALL'

  const exportType = readText(detailsJson.export_type)
  const employeeName =
    readText(detailsJson.employee_name) ??
    formatEmployeeName(
      readText(detailsJson.employee_prenom) ?? '',
      readText(detailsJson.employee_nom) ?? '',
    )

  return {
    id: row.id,
    action: row.action,
    exportType:
      exportType === 'PAYROLL_EMPLOYEE_INFORMATION_SHEET'
        ? 'PAYROLL_EMPLOYEE_INFORMATION_SHEET'
        : 'PAYROLL_EMPLOYEE_DIRECTORY_CSV',
    targetType: row.target_type,
    targetId: row.target_id,
    employeeId: readText(detailsJson.employee_id) ?? row.target_id,
    employeeName,
    matricule: readText(detailsJson.matricule),
    rowCount: readNumber(detailsJson.row_count),
    fileName: readText(detailsJson.file_name),
    format: readText(detailsJson.format),
    search: readText(detailsJson.search),
    departmentId: readText(detailsJson.department_id),
    departmentName: getDepartmentDisplayName(readText(detailsJson.department_name)),
    regionalBranch: readText(detailsJson.regional_branch),
    status,
    typeContrat: readText(detailsJson.type_contrat),
    createdAt: row.created_at,
  }
}

async function resolveCurrentUserId(): Promise<string | null> {
  const { data, error } = await supabase.auth.getUser()

  if (error) {
    throw new Error(error.message)
  }

  return data.user?.id ?? null
}

export async function getPayrollEmployeeExportRows(
  filters: PayrollEmployeeListFilters = {},
): Promise<PayrollEmployeeExportRow[]> {
  const normalizedFilters = normalizeFilters(filters)
  const { data, error } = await supabase
    .rpc('get_payroll_employee_export_rows', {
      p_search: normalizedFilters.search,
      p_departement_id: normalizedFilters.departementId,
      p_regional_branch: normalizedFilters.regionalBranch,
      p_status: normalizedFilters.status,
      p_type_contrat: normalizedFilters.typeContrat,
    })
    .returns<PayrollEmployeeExportRowRecord[]>()

  if (error) {
    throw new Error(error.message)
  }

  return ensureArrayResult<PayrollEmployeeExportRowRecord>(data).map(
    mapPayrollEmployeeExportRow,
  )
}

export async function generatePayrollEmployeesCsvExport({
  filters = {},
  departmentName,
}: GeneratePayrollCsvExportParams): Promise<GeneratePayrollCsvExportResult> {
  const rows = await getPayrollEmployeeExportRows(filters)

  if (rows.length === 0) {
    throw new Error('No payroll employees matched the selected export scope.')
  }

  const fileName = buildPayrollExportFileName()
  const csvRows = rows.map(toPayrollCsvRow)
  const csv = toCsv(csvRows, PAYROLL_EXPORT_CSV_COLUMNS)
  const normalizedFilters = normalizeFilters(filters)

  await auditService.insertAuditLog({
    action: 'PAYROLL_EXPORT_GENERATED',
    targetType: 'payroll_export',
    detailsJson: {
      export_type: 'PAYROLL_EMPLOYEE_DIRECTORY_CSV' satisfies PayrollExportType,
      format: 'csv',
      file_name: fileName,
      row_count: rows.length,
      search: normalizedFilters.search,
      department_id: normalizedFilters.departementId,
      department_name: departmentName ?? null,
      regional_branch: normalizedFilters.regionalBranch,
      status: normalizedFilters.status,
      type_contrat: normalizedFilters.typeContrat,
      columns: PAYROLL_EXPORT_CSV_COLUMNS.map((column) => column.header),
    },
  })

  downloadCsv(fileName, csv)

  return {
    fileName,
    rowCount: rows.length,
  }
}

export async function logPayrollEmployeeSheetPrintExport(
  employee: PayrollEmployeeDetail,
): Promise<void> {
  await auditService.insertAuditLog({
    action: 'PAYROLL_EXPORT_PRINT_INITIATED',
    targetType: 'Employe',
    targetId: employee.id,
    detailsJson: {
      export_type: 'PAYROLL_EMPLOYEE_INFORMATION_SHEET' satisfies PayrollExportType,
      format: 'print_pdf',
      employee_id: employee.id,
      employee_name: formatEmployeeName(employee.prenom, employee.nom),
      matricule: employee.matricule,
      row_count: 1,
    },
  })
}

export async function listMyPayrollExportHistory(
  userId?: string | null,
  options: PayrollExportHistoryListOptions = {},
): Promise<PayrollExportHistoryItem[]> {
  const resolvedUserId = await resolveCurrentUserId()

  if (!resolvedUserId) {
    return []
  }

  if (userId && userId !== resolvedUserId) {
    console.warn('payrollExportsService.listMyPayrollExportHistory received mismatched user id input.')
  }

  let query = supabase
    .from('audit_log')
    .select('id, action, target_type, target_id, details_json, created_at')
    .eq('actor_user_id', resolvedUserId)
    .in('action', ['PAYROLL_EXPORT_GENERATED', 'PAYROLL_EXPORT_PRINT_INITIATED'])
    .order('created_at', { ascending: false })

  if (typeof options.limit === 'number' && Number.isFinite(options.limit) && options.limit > 0) {
    query = query.limit(options.limit)
  }

  const { data, error } = await query.returns<PayrollExportAuditRow[]>()

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []).map(mapPayrollExportAuditRow)
}

export function useMyPayrollExportHistoryQuery(
  userId?: string | null,
  options: PayrollExportHistoryListOptions = {},
) {
  const limit = options.limit ?? null

  return useQuery({
    queryKey: ['payrollExportHistory', userId ?? null, limit],
    queryFn: () => listMyPayrollExportHistory(userId, options),
    enabled: Boolean(userId),
    refetchInterval: 15000,
  })
}

export function useGeneratePayrollEmployeesCsvExportMutation(
  userId?: string | null,
  options?: UseMutationOptions<
    GeneratePayrollCsvExportResult,
    Error,
    GeneratePayrollCsvExportParams
  >,
) {
  const queryClient = useQueryClient()
  const { onSuccess, ...restOptions } = options ?? {}

  return useMutation({
    mutationFn: generatePayrollEmployeesCsvExport,
    ...restOptions,
    onSuccess: async (data, variables, onMutateResult, context) => {
      await queryClient.invalidateQueries({ queryKey: ['payrollExportHistory', userId ?? null] })
      await onSuccess?.(data, variables, onMutateResult, context)
    },
  })
}

export function useLogPayrollEmployeeSheetExportMutation(
  userId?: string | null,
  options?: UseMutationOptions<void, Error, PayrollEmployeeDetail>,
) {
  const queryClient = useQueryClient()
  const { onSuccess, ...restOptions } = options ?? {}

  return useMutation({
    mutationFn: logPayrollEmployeeSheetPrintExport,
    ...restOptions,
    onSuccess: async (data, variables, onMutateResult, context) => {
      await queryClient.invalidateQueries({ queryKey: ['payrollExportHistory', userId ?? null] })
      await onSuccess?.(data, variables, onMutateResult, context)
    },
  })
}

export const payrollExportsService = {
  getPayrollEmployeeExportRows,
  generatePayrollEmployeesCsvExport,
  logPayrollEmployeeSheetPrintExport,
  listMyPayrollExportHistory,
}
