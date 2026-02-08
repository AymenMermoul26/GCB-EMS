import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
} from '@tanstack/react-query'

import { supabase } from '@/lib/supabaseClient'
import type {
  CreateEmployeePayload,
  Employee,
  EmployeesListParams,
  EmployeesListResponse,
  UpdateEmployeePayload,
} from '@/types/employee'

const EMPLOYEE_SELECT =
  'id, departement_id, matricule, nom, prenom, poste, email, telephone, is_active, created_at, updated_at'

interface EmployeeRow {
  id: string
  departement_id: string
  matricule: string
  nom: string
  prenom: string
  poste: string | null
  email: string | null
  telephone: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

function mapEmployee(row: EmployeeRow): Employee {
  return {
    id: row.id,
    departementId: row.departement_id,
    matricule: row.matricule,
    nom: row.nom,
    prenom: row.prenom,
    poste: row.poste,
    email: row.email,
    telephone: row.telephone,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toInsertPayload(payload: CreateEmployeePayload) {
  return {
    departement_id: payload.departementId,
    matricule: payload.matricule,
    nom: payload.nom,
    prenom: payload.prenom,
    poste: payload.poste ?? null,
    email: payload.email ?? null,
    telephone: payload.telephone ?? null,
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
  if (payload.poste !== undefined) {
    updatePayload.poste = payload.poste
  }
  if (payload.email !== undefined) {
    updatePayload.email = payload.email
  }
  if (payload.telephone !== undefined) {
    updatePayload.telephone = payload.telephone
  }
  if (payload.isActive !== undefined) {
    updatePayload.is_active = payload.isActive
  }

  return updatePayload
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

  let query = supabase
    .from('Employe')
    .select(EMPLOYEE_SELECT, { count: 'exact' })
    .order(sortField, { ascending })

  if (params.search) {
    const value = `%${params.search.trim()}%`
    query = query.or(`matricule.ilike.${value},nom.ilike.${value},prenom.ilike.${value}`)
  }

  if (params.departementId) {
    query = query.eq('departement_id', params.departementId)
  }

  if (params.isActive !== undefined) {
    query = query.eq('is_active', params.isActive)
  }

  const { data, count, error } = await query.range(from, to).returns<EmployeeRow[]>()

  if (error) {
    throw new Error(error.message)
  }

  return {
    items: (data ?? []).map(mapEmployee),
    total: count ?? 0,
    page,
    pageSize,
  }
}

export async function getEmployee(id: string): Promise<Employee | null> {
  const { data, error } = await supabase
    .from('Employe')
    .select(EMPLOYEE_SELECT)
    .eq('id', id)
    .maybeSingle<EmployeeRow>()

  if (error) {
    throw new Error(error.message)
  }

  if (!data) {
    return null
  }

  return mapEmployee(data)
}

export async function createEmployee(
  payload: CreateEmployeePayload,
): Promise<Employee> {
  const { data, error } = await supabase
    .from('Employe')
    .insert(toInsertPayload(payload))
    .select(EMPLOYEE_SELECT)
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
    .select(EMPLOYEE_SELECT)
    .single<EmployeeRow>()

  if (error) {
    throw new Error(error.message)
  }

  return mapEmployee(data)
}

export async function deactivateEmployee(id: string): Promise<Employee> {
  const employee = await updateEmployee(id, { isActive: false })

  const { error } = await supabase
    .from('TokenQR')
    .update({ statut_token: 'REVOQUE' })
    .eq('employe_id', id)
    .eq('statut_token', 'ACTIF')

  if (error) {
    throw new Error(error.message)
  }

  return employee
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

export function useDeactivateEmployeeMutation(
  options?: UseMutationOptions<Employee, Error, string>,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deactivateEmployee,
    onSuccess: async (data, variables, onMutateResult, context) => {
      await queryClient.invalidateQueries({ queryKey: ['employees'] })
      await queryClient.invalidateQueries({ queryKey: ['employee', data.id] })
      await options?.onSuccess?.(data, variables, onMutateResult, context)
    },
    ...options,
  })
}

export const employeesService = {
  listEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  deactivateEmployee,
}
