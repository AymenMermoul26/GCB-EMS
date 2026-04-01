import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
} from '@tanstack/react-query'

import { supabase } from '@/lib/supabaseClient'
import {
  getQrLifecycleContext,
  logQrRevoked,
  type QrLifecycleContext,
} from '@/services/qrAuditService'
import type {
  AdminEmployee,
  CreateEmployeePayload,
  Employee,
  EmployeesListParams,
  EmployeesListResponse,
  UpdateEmployeePayload,
} from '@/types/employee'
import { sanitizeEmployeeTextValue } from '@/types/employee'

const EMPLOYEE_LIST_SELECT =
  'id, departement_id, regional_branch, matricule, nom, prenom, nationalite, diplome, specialite, universite, poste, type_contrat, email, telephone, photo_url, is_active, created_at, updated_at'
const EMPLOYEE_SELF_SELECT =
  'id, departement_id, regional_branch, matricule, nom, prenom, sexe, date_naissance, lieu_naissance, nationalite, situation_familiale, nombre_enfants, adresse, diplome, specialite, universite, historique_postes, poste, categorie_professionnelle, type_contrat, date_recrutement, email, telephone, photo_url, is_active, created_at, updated_at'
const EMPLOYEE_ADMIN_SELECT =
  'id, departement_id, regional_branch, matricule, nom, prenom, sexe, date_naissance, lieu_naissance, nationalite, situation_familiale, nombre_enfants, adresse, numero_securite_sociale, diplome, specialite, universite, historique_postes, poste, categorie_professionnelle, type_contrat, date_recrutement, email, telephone, photo_url, is_active, created_at, updated_at, observations'

interface EmployeeRow {
  id: string
  departement_id: string
  regional_branch?: string | null
  matricule: string
  nom: string
  prenom: string
  sexe?: string | null
  date_naissance?: string | null
  lieu_naissance?: string | null
  nationalite?: string | null
  situation_familiale?: string | null
  nombre_enfants?: number | null
  adresse?: string | null
  numero_securite_sociale?: string | null
  diplome?: string | null
  specialite?: string | null
  universite?: string | null
  historique_postes?: string | null
  poste?: string | null
  categorie_professionnelle?: string | null
  type_contrat?: string | null
  date_recrutement?: string | null
  email?: string | null
  telephone?: string | null
  photo_url?: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

interface AdminEmployeeRow extends EmployeeRow {
  observations: string | null
}

interface EmployeeRoleRow {
  employe_id: string
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

function ensureArrayResult<T>(value: unknown): T[] | null {
  return Array.isArray(value) ? (value as T[]) : null
}

function mapEmployee(row: EmployeeRow): Employee {
  return {
    id: row.id,
    departementId: row.departement_id,
    regionalBranch: sanitizeEmployeeTextValue(row.regional_branch),
    matricule: row.matricule,
    nom: row.nom,
    prenom: row.prenom,
    sexe: sanitizeEmployeeTextValue(row.sexe),
    dateNaissance: sanitizeEmployeeTextValue(row.date_naissance),
    lieuNaissance: sanitizeEmployeeTextValue(row.lieu_naissance),
    nationalite: sanitizeEmployeeTextValue(row.nationalite),
    situationFamiliale: sanitizeEmployeeTextValue(row.situation_familiale),
    nombreEnfants: row.nombre_enfants ?? null,
    adresse: sanitizeEmployeeTextValue(row.adresse),
    diplome: sanitizeEmployeeTextValue(row.diplome),
    specialite: sanitizeEmployeeTextValue(row.specialite),
    universite: sanitizeEmployeeTextValue(row.universite),
    historiquePostes: sanitizeEmployeeTextValue(row.historique_postes),
    poste: sanitizeEmployeeTextValue(row.poste),
    categorieProfessionnelle: sanitizeEmployeeTextValue(row.categorie_professionnelle),
    typeContrat: sanitizeEmployeeTextValue(row.type_contrat),
    dateRecrutement: sanitizeEmployeeTextValue(row.date_recrutement),
    email: sanitizeEmployeeTextValue(row.email),
    telephone: sanitizeEmployeeTextValue(row.telephone),
    photoUrl: sanitizeEmployeeTextValue(row.photo_url),
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapAdminEmployee(row: AdminEmployeeRow): AdminEmployee {
  return {
    ...mapEmployee(row),
    numeroSecuriteSociale: sanitizeEmployeeTextValue(row.numero_securite_sociale),
    observations: sanitizeEmployeeTextValue(row.observations),
  }
}

function normalizePayloadText(
  value: string | null | undefined,
): string | null | undefined {
  if (value === undefined) {
    return undefined
  }

  return sanitizeEmployeeTextValue(value)
}

function normalizePayloadEmail(
  value: string | null | undefined,
): string | null | undefined {
  if (value === undefined) {
    return undefined
  }

  const sanitized = sanitizeEmployeeTextValue(value)
  return sanitized ? sanitized.toLowerCase() : null
}

function toInsertPayload(payload: CreateEmployeePayload) {
  const normalizedMatricule = payload.matricule?.trim()

  return {
    departement_id: payload.departementId,
    regional_branch: normalizePayloadText(payload.regionalBranch) ?? null,
    matricule: normalizedMatricule && normalizedMatricule.length > 0 ? normalizedMatricule : null,
    nom: payload.nom,
    prenom: payload.prenom,
    sexe: normalizePayloadText(payload.sexe) ?? null,
    date_naissance: normalizePayloadText(payload.dateNaissance) ?? null,
    lieu_naissance: normalizePayloadText(payload.lieuNaissance) ?? null,
    nationalite: normalizePayloadText(payload.nationalite) ?? null,
    situation_familiale: normalizePayloadText(payload.situationFamiliale) ?? null,
    nombre_enfants: payload.nombreEnfants ?? null,
    adresse: normalizePayloadText(payload.adresse) ?? null,
    numero_securite_sociale: normalizePayloadText(payload.numeroSecuriteSociale) ?? null,
    diplome: normalizePayloadText(payload.diplome) ?? null,
    specialite: normalizePayloadText(payload.specialite) ?? null,
    universite: normalizePayloadText(payload.universite) ?? null,
    historique_postes: normalizePayloadText(payload.historiquePostes) ?? null,
    observations: normalizePayloadText(payload.observations) ?? null,
    poste: normalizePayloadText(payload.poste) ?? null,
    categorie_professionnelle: normalizePayloadText(payload.categorieProfessionnelle) ?? null,
    type_contrat: normalizePayloadText(payload.typeContrat) ?? null,
    date_recrutement: normalizePayloadText(payload.dateRecrutement) ?? null,
    email: normalizePayloadEmail(payload.email) ?? null,
    telephone: normalizePayloadText(payload.telephone) ?? null,
    photo_url: normalizePayloadText(payload.photoUrl) ?? null,
    is_active: payload.isActive ?? true,
  }
}

function toUpdatePayload(payload: UpdateEmployeePayload) {
  const updatePayload: Record<string, unknown> = {}

  if (payload.departementId !== undefined) {
    updatePayload.departement_id = payload.departementId
  }
  if (payload.regionalBranch !== undefined) {
    updatePayload.regional_branch = normalizePayloadText(payload.regionalBranch)
  }
  if (payload.matricule !== undefined) {
    updatePayload.matricule = payload.matricule
  }
  if (payload.nom !== undefined) {
    updatePayload.nom = payload.nom
  }
  if (payload.prenom !== undefined) {
    updatePayload.prenom = payload.prenom
  }
  if (payload.sexe !== undefined) {
    updatePayload.sexe = normalizePayloadText(payload.sexe)
  }
  if (payload.dateNaissance !== undefined) {
    updatePayload.date_naissance = normalizePayloadText(payload.dateNaissance)
  }
  if (payload.lieuNaissance !== undefined) {
    updatePayload.lieu_naissance = normalizePayloadText(payload.lieuNaissance)
  }
  if (payload.nationalite !== undefined) {
    updatePayload.nationalite = normalizePayloadText(payload.nationalite)
  }
  if (payload.situationFamiliale !== undefined) {
    updatePayload.situation_familiale = normalizePayloadText(payload.situationFamiliale)
  }
  if (payload.nombreEnfants !== undefined) {
    updatePayload.nombre_enfants = payload.nombreEnfants
  }
  if (payload.adresse !== undefined) {
    updatePayload.adresse = normalizePayloadText(payload.adresse)
  }
  if (payload.numeroSecuriteSociale !== undefined) {
    updatePayload.numero_securite_sociale = normalizePayloadText(payload.numeroSecuriteSociale)
  }
  if (payload.diplome !== undefined) {
    updatePayload.diplome = normalizePayloadText(payload.diplome)
  }
  if (payload.specialite !== undefined) {
    updatePayload.specialite = normalizePayloadText(payload.specialite)
  }
  if (payload.universite !== undefined) {
    updatePayload.universite = normalizePayloadText(payload.universite)
  }
  if (payload.historiquePostes !== undefined) {
    updatePayload.historique_postes = normalizePayloadText(payload.historiquePostes)
  }
  if (payload.observations !== undefined) {
    updatePayload.observations = normalizePayloadText(payload.observations)
  }
  if (payload.poste !== undefined) {
    updatePayload.poste = normalizePayloadText(payload.poste)
  }
  if (payload.categorieProfessionnelle !== undefined) {
    updatePayload.categorie_professionnelle = normalizePayloadText(payload.categorieProfessionnelle)
  }
  if (payload.typeContrat !== undefined) {
    updatePayload.type_contrat = normalizePayloadText(payload.typeContrat)
  }
  if (payload.dateRecrutement !== undefined) {
    updatePayload.date_recrutement = normalizePayloadText(payload.dateRecrutement)
  }
  if (payload.email !== undefined) {
    updatePayload.email = normalizePayloadEmail(payload.email)
  }
  if (payload.telephone !== undefined) {
    updatePayload.telephone = normalizePayloadText(payload.telephone)
  }
  if (payload.photoUrl !== undefined) {
    updatePayload.photo_url = normalizePayloadText(payload.photoUrl)
  }
  if (payload.isActive !== undefined) {
    updatePayload.is_active = payload.isActive
  }

  return updatePayload
}

async function getAdminEmployeeIds(): Promise<string[]> {
  const { data, error } = await supabase
    .from('ProfilUtilisateur')
    .select('employe_id')
    .eq('role', 'ADMIN_RH')
    .returns<EmployeeRoleRow[]>()

  if (error) {
    throw new Error(error.message)
  }

  return [...new Set((data ?? []).map((row) => row.employe_id).filter(Boolean))]
}

export async function listEmployees(
  params: EmployeesListParams = {},
): Promise<EmployeesListResponse> {
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 10
  const sortField = params.sort?.field ?? 'created_at'
  const ascending = params.sort?.direction === 'asc'
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  const adminEmployeeIds = await getAdminEmployeeIds()

  let query = supabase
    .from('Employe')
    .select(EMPLOYEE_LIST_SELECT, { count: 'exact' })
    .order(sortField, { ascending })

  if (params.search) {
    const value = `%${params.search.trim()}%`
    query = query.or(
      `matricule.ilike.${value},nom.ilike.${value},prenom.ilike.${value},email.ilike.${value},regional_branch.ilike.${value},nationalite.ilike.${value},poste.ilike.${value},diplome.ilike.${value},specialite.ilike.${value},universite.ilike.${value}`,
    )
  }

  if (params.departementId) {
    query = query.eq('departement_id', params.departementId)
  }

  if (params.regionalBranch) {
    query = query.eq('regional_branch', params.regionalBranch)
  }

  if (params.nationalite) {
    query = query.eq('nationalite', params.nationalite)
  }

  if (params.poste) {
    query = query.eq('poste', params.poste)
  }

  if (params.diplome) {
    query = query.eq('diplome', params.diplome)
  }

  if (params.specialite) {
    query = query.eq('specialite', params.specialite)
  }

  if (params.universite) {
    query = query.eq('universite', params.universite)
  }

  if (params.isActive !== undefined) {
    query = query.eq('is_active', params.isActive)
  }

  if (adminEmployeeIds.length > 0) {
    query = query.not('id', 'in', `(${adminEmployeeIds.join(',')})`)
  }

  const { data, count, error } = await query.range(from, to).returns<EmployeeRow[]>()

  if (error) {
    throw new Error(error.message)
  }

  const mappedEmployees = (data ?? []).map(mapEmployee)

  return {
    data: mappedEmployees,
    items: mappedEmployees,
    total: count ?? 0,
    page,
    pageSize,
  }
}

export async function getEmployee(id: string): Promise<Employee | null> {
  const { data, error } = await supabase
    .rpc('get_employee_self_profile', { p_employee_id: id })
    .returns<EmployeeRow[]>()

  if (error) {
    throw new Error(error.message)
  }

  const { row, hasMultiple } = normalizeSingleRowResult(
    ensureArrayResult<EmployeeRow>(data),
    'employeesService.getEmployee',
  )

  if (hasMultiple) {
    throw new Error('Data integrity issue: multiple employee rows matched this profile.')
  }

  if (!row) {
    return null
  }

  return mapEmployee(row)
}

export async function getAdminEmployee(id: string): Promise<AdminEmployee | null> {
  const { data, error } = await supabase
    .from('Employe')
    .select(EMPLOYEE_ADMIN_SELECT)
    .eq('id', id)
    .limit(2)
    .returns<AdminEmployeeRow[]>()

  if (error) {
    throw new Error(error.message)
  }

  const { row, hasMultiple } = normalizeSingleRowResult(
    data ?? null,
    'employeesService.getAdminEmployee',
  )

  if (hasMultiple) {
    throw new Error('Data integrity issue: multiple employee rows matched this profile.')
  }

  if (!row) {
    return null
  }

  return mapAdminEmployee(row)
}

export async function createEmployee(
  payload: CreateEmployeePayload,
): Promise<Employee> {
  const { data, error } = await supabase
    .from('Employe')
    .insert(toInsertPayload(payload))
    .select(EMPLOYEE_SELF_SELECT)
    .single<EmployeeRow>()

  if (error) {
    throw new Error(error.message)
  }

  return mapEmployee(data)
}

export async function updateEmployee(
  id: string,
  payload: UpdateEmployeePayload,
): Promise<Employee> {
  const { data, error } = await supabase
    .from('Employe')
    .update(toUpdatePayload(payload))
    .eq('id', id)
    .select(EMPLOYEE_SELF_SELECT)
    .returns<EmployeeRow[]>()

  if (error) {
    throw new Error(error.message)
  }

  const { row, hasMultiple } = normalizeSingleRowResult(data ?? null, 'employeesService.updateEmployee')

  if (hasMultiple) {
    throw new Error('Data integrity issue: multiple employee rows were updated.')
  }

  if (!row) {
    throw new Error('Unable to update employee profile. Record not found or access denied.')
  }

  return mapEmployee(row)
}

export async function updateAdminEmployee(
  id: string,
  payload: UpdateEmployeePayload,
): Promise<AdminEmployee> {
  const { data, error } = await supabase
    .from('Employe')
    .update(toUpdatePayload(payload))
    .eq('id', id)
    .select(EMPLOYEE_ADMIN_SELECT)
    .returns<AdminEmployeeRow[]>()

  if (error) {
    throw new Error(error.message)
  }

  const { row, hasMultiple } = normalizeSingleRowResult(
    data ?? null,
    'employeesService.updateAdminEmployee',
  )

  if (hasMultiple) {
    throw new Error('Data integrity issue: multiple employee rows were updated.')
  }

  if (!row) {
    throw new Error('Unable to update employee profile. Record not found or access denied.')
  }

  return mapAdminEmployee(row)
}

export async function deactivateEmployee(id: string): Promise<Employee> {
  let qrLifecycleContext: QrLifecycleContext | null = null

  try {
    qrLifecycleContext = await getQrLifecycleContext(id)
  } catch (error) {
    console.error('Failed to load QR lifecycle audit context before employee deactivation', error)
  }

  const employee = await updateEmployee(id, { isActive: false })

  const { error } = await supabase
    .from('TokenQR')
    .update({ statut_token: 'REVOQUE' })
    .eq('employe_id', id)
    .eq('statut_token', 'ACTIF')

  if (error) {
    throw new Error(error.message)
  }

  if (qrLifecycleContext?.activeToken) {
    await logQrRevoked({
      employeId: id,
      employee: qrLifecycleContext.employee,
      tokenId: qrLifecycleContext.activeToken.id,
      previousTokenStatus: qrLifecycleContext.activeToken.statut_token,
      triggerSource: 'employee_status_change',
      reason: 'employee_deactivated',
    })
  }

  return employee
}

export async function activateEmployee(id: string): Promise<Employee> {
  return updateEmployee(id, { isActive: true })
}

export function useEmployeesQuery(params: EmployeesListParams = {}) {
  return useQuery({
    queryKey: ['employees', params],
    queryFn: () => listEmployees(params),
  })
}

export function useEmployeeQuery(employeeId?: string | null) {
  return useQuery({
    queryKey: ['employee', employeeId],
    queryFn: () => getEmployee(employeeId as string),
    enabled: Boolean(employeeId),
  })
}

export function useAdminEmployeeQuery(employeeId?: string | null) {
  return useQuery({
    queryKey: ['adminEmployee', employeeId],
    queryFn: () => getAdminEmployee(employeeId as string),
    enabled: Boolean(employeeId),
    refetchOnMount: 'always',
  })
}

export function useCreateEmployeeMutation(
  options?: UseMutationOptions<Employee, Error, CreateEmployeePayload>,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createEmployee,
    onSuccess: async (data, variables, onMutateResult, context) => {
      await queryClient.invalidateQueries({ queryKey: ['employees'] })
      await queryClient.invalidateQueries({ queryKey: ['employee', data.id] })
      await options?.onSuccess?.(data, variables, onMutateResult, context)
    },
    ...options,
  })
}

export function useUpdateEmployeeMutation(
  options?: UseMutationOptions<
    Employee,
    Error,
    { id: string; payload: UpdateEmployeePayload }
  >,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, payload }) => updateEmployee(id, payload),
    onSuccess: async (data, variables, onMutateResult, context) => {
      await queryClient.invalidateQueries({ queryKey: ['employees'] })
      await queryClient.invalidateQueries({ queryKey: ['employee', data.id] })
      await options?.onSuccess?.(data, variables, onMutateResult, context)
    },
    ...options,
  })
}

export function useUpdateAdminEmployeeMutation(
  options?: UseMutationOptions<
    AdminEmployee,
    Error,
    { id: string; payload: UpdateEmployeePayload }
  >,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, payload }) => updateAdminEmployee(id, payload),
    onSuccess: async (data, variables, onMutateResult, context) => {
      queryClient.setQueryData(['adminEmployee', data.id], data)
      await queryClient.invalidateQueries({ queryKey: ['employees'] })
      await queryClient.invalidateQueries({ queryKey: ['employee', data.id] })
      await queryClient.invalidateQueries({ queryKey: ['adminEmployee', data.id] })
      await options?.onSuccess?.(data, variables, onMutateResult, context)
    },
    ...options,
  })
}

export function useDeactivateEmployeeMutation(
  options?: UseMutationOptions<Employee, Error, string>,
) {
  const queryClient = useQueryClient()
  const { onSuccess, onSettled, ...restOptions } = options ?? {}

  return useMutation({
    mutationFn: deactivateEmployee,
    ...restOptions,
    onSuccess: async (data, variables, onMutateResult, context) => {
      await queryClient.invalidateQueries({ queryKey: ['employees'] })
      await queryClient.invalidateQueries({ queryKey: ['employee', data.id] })
      await queryClient.invalidateQueries({ queryKey: ['adminEmployee', data.id] })
      await queryClient.invalidateQueries({ queryKey: ['employeeToken', data.id] })
      await queryClient.invalidateQueries({ queryKey: ['adminDashboard'] })
      await onSuccess?.(data, variables, onMutateResult, context)
    },
    onSettled: async (data, error, variables, onMutateResult, context) => {
      await queryClient.invalidateQueries({ queryKey: ['auditLog'] })
      await onSettled?.(data, error, variables, onMutateResult, context)
    },
  })
}

export function useActivateEmployeeMutation(
  options?: UseMutationOptions<Employee, Error, string>,
) {
  const queryClient = useQueryClient()
  const { onSuccess, onSettled, ...restOptions } = options ?? {}

  return useMutation({
    mutationFn: activateEmployee,
    ...restOptions,
    onSuccess: async (data, variables, onMutateResult, context) => {
      await queryClient.invalidateQueries({ queryKey: ['employees'] })
      await queryClient.invalidateQueries({ queryKey: ['employee', data.id] })
      await queryClient.invalidateQueries({ queryKey: ['adminEmployee', data.id] })
      await queryClient.invalidateQueries({ queryKey: ['employeeToken', data.id] })
      await queryClient.invalidateQueries({ queryKey: ['adminDashboard'] })
      await onSuccess?.(data, variables, onMutateResult, context)
    },
    onSettled: async (data, error, variables, onMutateResult, context) => {
      await queryClient.invalidateQueries({ queryKey: ['auditLog'] })
      await onSettled?.(data, error, variables, onMutateResult, context)
    },
  })
}

export const employeesService = {
  listEmployees,
  getEmployee,
  getAdminEmployee,
  createEmployee,
  updateEmployee,
  updateAdminEmployee,
  activateEmployee,
  deactivateEmployee,
}
