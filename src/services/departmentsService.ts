import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
} from '@tanstack/react-query'

import { supabase } from '@/lib/supabaseClient'
import type {
  Department,
  ListDepartmentsParams,
  UpsertDepartmentPayload,
} from '@/types/department'

interface DepartmentRow {
  id: string
  nom: string
  code: string | null
  description: string | null
  created_at: string
  updated_at: string
}

function mapDepartment(row: DepartmentRow): Department {
  return {
    id: row.id,
    nom: row.nom,
    code: row.code,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toUpsertPayload(payload: UpsertDepartmentPayload) {
  return {
    nom: payload.nom,
    code: payload.code ?? null,
    description: payload.description ?? null,
  }
}

export async function listDepartments(params: ListDepartmentsParams = {}): Promise<Department[]> {
  const normalizedSearch = params.search?.trim()

  let query = supabase
    .from('Departement')
    .select('id, nom, code, description, created_at, updated_at')
    .order('nom', { ascending: true })

  if (normalizedSearch) {
    const value = `%${normalizedSearch}%`
    query = query.or(`nom.ilike.${value},code.ilike.${value}`)
  }

  const { data, error } = await query.returns<DepartmentRow[]>()

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []).map(mapDepartment)
}

export async function createDepartment(payload: UpsertDepartmentPayload): Promise<Department> {
  const { data, error } = await supabase
    .from('Departement')
    .insert(toUpsertPayload(payload))
    .select('id, nom, code, description, created_at, updated_at')
    .single<DepartmentRow>()

  if (error) {
    throw new Error(error.message)
  }

  return mapDepartment(data)
}

export async function updateDepartment(
  id: string,
  payload: UpsertDepartmentPayload,
): Promise<Department> {
  const { data, error } = await supabase
    .from('Departement')
    .update(toUpsertPayload(payload))
    .eq('id', id)
    .select('id, nom, code, description, created_at, updated_at')
    .single<DepartmentRow>()

  if (error) {
    throw new Error(error.message)
  }

  return mapDepartment(data)
}

export async function deleteDepartment(id: string): Promise<void> {
  const { error } = await supabase.from('Departement').delete().eq('id', id)

  if (error) {
    throw new Error(error.message)
  }
}

export function useDepartmentsQuery(search?: string) {
  const normalizedSearch = search?.trim() ?? ''

  return useQuery({
    queryKey: ['departments', normalizedSearch],
    queryFn: () =>
      listDepartments({
        search: normalizedSearch || undefined,
      }),
    placeholderData: keepPreviousData,
  })
}

export function useCreateDepartmentMutation(
  options?: UseMutationOptions<Department, Error, UpsertDepartmentPayload>,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createDepartment,
    onSuccess: async (data, variables, onMutateResult, context) => {
      await queryClient.invalidateQueries({ queryKey: ['departments'] })
      await queryClient.invalidateQueries({ queryKey: ['employees'] })
      await options?.onSuccess?.(data, variables, onMutateResult, context)
    },
    ...options,
  })
}

export function useUpdateDepartmentMutation(
  options?: UseMutationOptions<
    Department,
    Error,
    { id: string; payload: UpsertDepartmentPayload }
  >,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, payload }) => updateDepartment(id, payload),
    onSuccess: async (data, variables, onMutateResult, context) => {
      await queryClient.invalidateQueries({ queryKey: ['departments'] })
      await queryClient.invalidateQueries({ queryKey: ['employees'] })
      await options?.onSuccess?.(data, variables, onMutateResult, context)
    },
    ...options,
  })
}

export function useDeleteDepartmentMutation(
  options?: UseMutationOptions<void, Error, string>,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteDepartment,
    onSuccess: async (data, variables, onMutateResult, context) => {
      await queryClient.invalidateQueries({ queryKey: ['departments'] })
      await queryClient.invalidateQueries({ queryKey: ['employees'] })
      await options?.onSuccess?.(data, variables, onMutateResult, context)
    },
    ...options,
  })
}

export const departmentsService = {
  listDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
}
