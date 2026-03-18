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

const EMPLOYEE_LIST_SELECT =
  'id, departement_id, matricule, nom, prenom, poste, email, telephone, photo_url, is_active, created_at, updated_at'
const EMPLOYEE_SELF_SELECT =
  'id, departement_id, matricule, nom, prenom, sexe, date_naissance, lieu_naissance, nationalite, situation_familiale, nombre_enfants, adresse, diplome, specialite, historique_postes, poste, categorie_professionnelle, type_contrat, date_recrutement, email, telephone, photo_url, is_active, created_at, updated_at'
const EMPLOYEE_ADMIN_SELECT =
  'id, departement_id, matricule, nom, prenom, sexe, date_naissance, lieu_naissance, nationalite, situation_familiale, nombre_enfants, adresse, numero_securite_sociale, diplome, specialite, historique_postes, poste, categorie_professionnelle, type_contrat, date_recrutement, email, telephone, photo_url, is_active, created_at, updated_at, observations'

interface EmployeeRow {
  id: string
  departement_id: string
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

function mapEmployee(row: EmployeeRow): Employee {
  return {
    id: row.id,
    departementId: row.departement_id,
    matricule: row.matricule,
    nom: row.nom,
    prenom: row.prenom,
    sexe: row.sexe ?? null,
    dateNaissance: row.date_naissance ?? null,
    lieuNaissance: row.lieu_naissance ?? null,
    nationalite: row.nationalite ?? null,
    situationFamiliale: row.situation_familiale ?? null,
    nombreEnfants: row.nombre_enfants ?? null,
    adresse: row.adresse ?? null,
    numeroSecuriteSociale: row.numero_securite_sociale ?? null,
    diplome: row.diplome ?? null,
    specialite: row.specialite ?? null,
    historiquePostes: row.historique_postes ?? null,
    poste: row.poste ?? null,
    categorieProfessionnelle: row.categorie_professionnelle ?? null,
    typeContrat: row.type_contrat ?? null,
    dateRecrutement: row.date_recrutement ?? null,
    email: row.email ?? null,
    telephone: row.telephone ?? null,
    photoUrl: row.photo_url ?? null,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapAdminEmployee(row: AdminEmployeeRow): AdminEmployee {
  return {
    ...mapEmployee(row),
    observations: row.observations,
  }
}

function toInsertPayload(payload: CreateEmployeePayload) {
  const normalizedMatricule = payload.matricule?.trim()

  return {
    departement_id: payload.departementId,
    matricule: normalizedMatricule && normalizedMatricule.length > 0 ? normalizedMatricule : null,
    nom: payload.nom,
    prenom: payload.prenom,
    sexe: payload.sexe ?? null,
    date_naissance: payload.dateNaissance ?? null,
    lieu_naissance: payload.lieuNaissance ?? null,
    nationalite: payload.nationalite ?? null,
    situation_familiale: payload.situationFamiliale ?? null,
    nombre_enfants: payload.nombreEnfants ?? null,
    adresse: payload.adresse ?? null,
    numero_securite_sociale: payload.numeroSecuriteSociale ?? null,
    diplome: payload.diplome ?? null,
    specialite: payload.specialite ?? null,
    historique_postes: payload.historiquePostes ?? null,
    observations: payload.observations ?? null,
    poste: payload.poste ?? null,
    categorie_professionnelle: payload.categorieProfessionnelle ?? null,
    type_contrat: payload.typeContrat ?? null,
    date_recrutement: payload.dateRecrutement ?? null,
    email: payload.email ?? null,
    telephone: payload.telephone ?? null,
    photo_url: payload.photoUrl ?? null,
    is_active: payload.isActive ?? true,
  }
}

function toUpdatePayload(payload: UpdateEmployeePayload) {
  const updatePayload: Record<string, unknown> = {}

  if (payload.departementId !== undefined) {
    updatePayload.departement_id = payload.departementId
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
    updatePayload.sexe = payload.sexe
  }
  if (payload.dateNaissance !== undefined) {
    updatePayload.date_naissance = payload.dateNaissance
  }
  if (payload.lieuNaissance !== undefined) {
    updatePayload.lieu_naissance = payload.lieuNaissance
  }
  if (payload.nationalite !== undefined) {
    updatePayload.nationalite = payload.nationalite
  }
  if (payload.situationFamiliale !== undefined) {
    updatePayload.situation_familiale = payload.situationFamiliale
  }
  if (payload.nombreEnfants !== undefined) {
    updatePayload.nombre_enfants = payload.nombreEnfants
  }
  if (payload.adresse !== undefined) {
    updatePayload.adresse = payload.adresse
  }
  if (payload.numeroSecuriteSociale !== undefined) {
    updatePayload.numero_securite_sociale = payload.numeroSecuriteSociale
  }
  if (payload.diplome !== undefined) {
    updatePayload.diplome = payload.diplome
  }
  if (payload.specialite !== undefined) {
    updatePayload.specialite = payload.specialite
  }
  if (payload.historiquePostes !== undefined) {
    updatePayload.historique_postes = payload.historiquePostes
  }
  if (payload.observations !== undefined) {
    updatePayload.observations = payload.observations
  }
  if (payload.poste !== undefined) {
    updatePayload.poste = payload.poste
  }
  if (payload.categorieProfessionnelle !== undefined) {
    updatePayload.categorie_professionnelle = payload.categorieProfessionnelle
  }
  if (payload.typeContrat !== undefined) {
    updatePayload.type_contrat = payload.typeContrat
  }
  if (payload.dateRecrutement !== undefined) {
    updatePayload.date_recrutement = payload.dateRecrutement
  }
  if (payload.email !== undefined) {
    updatePayload.email = payload.email
  }
  if (payload.telephone !== undefined) {
    updatePayload.telephone = payload.telephone
  }
  if (payload.photoUrl !== undefined) {
    updatePayload.photo_url = payload.photoUrl
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
    query = query.or(`matricule.ilike.${value},nom.ilike.${value},prenom.ilike.${value},email.ilike.${value}`)
  }

  if (params.departementId) {
    query = query.eq('departement_id', params.departementId)
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
    .from('Employe')
    .select(EMPLOYEE_SELF_SELECT)
    .eq('id', id)
    .limit(2)
    .returns<EmployeeRow[]>()

  if (error) {
    throw new Error(error.message)
  }

  const { row, hasMultiple } = normalizeSingleRowResult(data ?? null, 'employeesService.getEmployee')

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
