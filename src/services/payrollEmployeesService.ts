import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { supabase } from '@/lib/supabaseClient'
import { getDepartmentDisplayName } from '@/types/department'
import { sanitizeEmployeeTextValue } from '@/types/employee'
import type {
  PayrollEmployeeDetail,
  PayrollEmployeeListFilters,
  PayrollEmployeeListItem,
} from '@/types/payroll'

interface PayrollEmployeeListRow {
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
  is_active: boolean
}

interface PayrollEmployeeDetailRow extends PayrollEmployeeListRow {
  photo_url: string | null
  date_recrutement: string | null
  email: string | null
  telephone: string | null
  sexe: string | null
  date_naissance: string | null
  lieu_naissance: string | null
  nationalite: string | null
  situation_familiale: string | null
  nombre_enfants: number | null
  adresse: string | null
  numero_securite_sociale: string | null
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

function mapPayrollEmployeeListItem(row: PayrollEmployeeListRow): PayrollEmployeeListItem {
  return {
    id: row.id,
    departementId: row.departement_id,
    departementNom: getDepartmentDisplayName(row.departement_nom) ?? null,
    regionalBranch: sanitizeEmployeeTextValue(row.regional_branch),
    matricule: row.matricule,
    nom: row.nom,
    prenom: row.prenom,
    poste: sanitizeEmployeeTextValue(row.poste),
    categorieProfessionnelle: sanitizeEmployeeTextValue(row.categorie_professionnelle),
    typeContrat: sanitizeEmployeeTextValue(row.type_contrat),
    isActive: row.is_active,
  }
}

function mapPayrollEmployeeDetail(row: PayrollEmployeeDetailRow): PayrollEmployeeDetail {
  return {
    ...mapPayrollEmployeeListItem(row),
    photoUrl: sanitizeEmployeeTextValue(row.photo_url),
    categorieProfessionnelle: sanitizeEmployeeTextValue(row.categorie_professionnelle),
    dateRecrutement: sanitizeEmployeeTextValue(row.date_recrutement),
    email: sanitizeEmployeeTextValue(row.email),
    telephone: sanitizeEmployeeTextValue(row.telephone),
    sexe: sanitizeEmployeeTextValue(row.sexe),
    dateNaissance: sanitizeEmployeeTextValue(row.date_naissance),
    lieuNaissance: sanitizeEmployeeTextValue(row.lieu_naissance),
    nationalite: sanitizeEmployeeTextValue(row.nationalite),
    situationFamiliale: sanitizeEmployeeTextValue(row.situation_familiale),
    nombreEnfants: row.nombre_enfants ?? null,
    adresse: sanitizeEmployeeTextValue(row.adresse),
    numeroSecuriteSociale: sanitizeEmployeeTextValue(row.numero_securite_sociale),
  }
}

function normalizeFilters(filters: PayrollEmployeeListFilters = {}) {
  return {
    search: filters.search?.trim() || null,
    departementId: filters.departementId?.trim() || null,
    regionalBranch: filters.regionalBranch?.trim() || null,
    status: filters.status ?? 'ALL',
    typeContrat: filters.typeContrat?.trim() || null,
  }
}

function ensureArrayResult<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

export async function getPayrollEmployees(
  filters: PayrollEmployeeListFilters = {},
): Promise<PayrollEmployeeListItem[]> {
  const normalizedFilters = normalizeFilters(filters)

  const { data, error } = await supabase
    .rpc('get_payroll_employees', {
      p_search: normalizedFilters.search,
      p_departement_id: normalizedFilters.departementId,
      p_regional_branch: normalizedFilters.regionalBranch,
      p_status: normalizedFilters.status,
      p_type_contrat: normalizedFilters.typeContrat,
    })
    .returns<PayrollEmployeeListRow[]>()

  if (error) {
    throw new Error(error.message)
  }

  return ensureArrayResult<PayrollEmployeeListRow>(data).map(mapPayrollEmployeeListItem)
}

export async function getPayrollEmployeeById(
  employeeId: string,
): Promise<PayrollEmployeeDetail | null> {
  const { data, error } = await supabase
    .rpc('get_payroll_employee_by_id', { p_employee_id: employeeId })
    .returns<PayrollEmployeeDetailRow[]>()

  if (error) {
    throw new Error(error.message)
  }

  const { row, hasMultiple } = normalizeSingleRowResult(
    ensureArrayResult<PayrollEmployeeDetailRow>(data),
    'payrollEmployeesService.getPayrollEmployeeById',
  )

  if (hasMultiple) {
    throw new Error('Data integrity issue: multiple payroll employee rows matched this request.')
  }

  if (!row) {
    return null
  }

  return mapPayrollEmployeeDetail(row)
}

export function usePayrollEmployeesQuery() {
  return useQuery({
    queryKey: ['payrollEmployees'],
    queryFn: () => getPayrollEmployees(),
    placeholderData: keepPreviousData,
  })
}

export function usePayrollEmployeesDirectoryQuery(filters: PayrollEmployeeListFilters) {
  const normalizedFilters = normalizeFilters(filters)

  return useQuery({
    queryKey: [
      'payrollEmployees',
      normalizedFilters.search ?? '',
      normalizedFilters.departementId ?? 'all',
      normalizedFilters.regionalBranch ?? 'all',
      normalizedFilters.status,
      normalizedFilters.typeContrat ?? 'all',
    ],
    queryFn: () => getPayrollEmployees(filters),
    placeholderData: keepPreviousData,
  })
}

export function usePayrollEmployeeQuery(employeeId?: string | null) {
  return useQuery({
    queryKey: ['payrollEmployee', employeeId],
    queryFn: () => getPayrollEmployeeById(employeeId as string),
    enabled: Boolean(employeeId),
  })
}

export const payrollEmployeesService = {
  getPayrollEmployees,
  getPayrollEmployeeById,
}
