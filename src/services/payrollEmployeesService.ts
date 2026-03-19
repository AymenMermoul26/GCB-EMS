import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { supabase } from '@/lib/supabaseClient'
import type {
  PayrollEmployeeDetail,
  PayrollEmployeeListFilters,
  PayrollEmployeeListItem,
} from '@/types/payroll'

interface PayrollEmployeeListRow {
  id: string
  departement_id: string | null
  departement_nom: string | null
  matricule: string
  nom: string
  prenom: string
  poste: string | null
  type_contrat: string | null
  is_active: boolean
}

interface PayrollEmployeeDetailRow extends PayrollEmployeeListRow {
  photo_url: string | null
  categorie_professionnelle: string | null
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
    departementNom: row.departement_nom ?? null,
    matricule: row.matricule,
    nom: row.nom,
    prenom: row.prenom,
    poste: row.poste ?? null,
    typeContrat: row.type_contrat ?? null,
    isActive: row.is_active,
  }
}

function mapPayrollEmployeeDetail(row: PayrollEmployeeDetailRow): PayrollEmployeeDetail {
  return {
    ...mapPayrollEmployeeListItem(row),
    photoUrl: row.photo_url ?? null,
    categorieProfessionnelle: row.categorie_professionnelle ?? null,
    dateRecrutement: row.date_recrutement ?? null,
    email: row.email ?? null,
    telephone: row.telephone ?? null,
    sexe: row.sexe ?? null,
    dateNaissance: row.date_naissance ?? null,
    lieuNaissance: row.lieu_naissance ?? null,
    nationalite: row.nationalite ?? null,
    situationFamiliale: row.situation_familiale ?? null,
    nombreEnfants: row.nombre_enfants ?? null,
    adresse: row.adresse ?? null,
    numeroSecuriteSociale: row.numero_securite_sociale ?? null,
  }
}

function normalizeFilters(filters: PayrollEmployeeListFilters = {}) {
  return {
    search: filters.search?.trim() || null,
    departementId: filters.departementId?.trim() || null,
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
