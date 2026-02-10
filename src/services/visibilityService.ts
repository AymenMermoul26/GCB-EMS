import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
} from '@tanstack/react-query'

import { supabase } from '@/lib/supabaseClient'
import type {
  EmployeeVisibility,
  UpsertEmployeeVisibilityPayload,
} from '@/types/visibility'

interface EmployeeVisibilityRow {
  id: string
  employe_id: string
  field_key: string
  is_public: boolean
  created_at: string
  updated_at: string
}

function mapVisibility(row: EmployeeVisibilityRow): EmployeeVisibility {
  return {
    id: row.id,
    employeId: row.employe_id,
    fieldKey: row.field_key,
    isPublic: row.is_public,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function getVisibility(employeId: string): Promise<EmployeeVisibility[]> {
  const { data, error } = await supabase
    .from('employee_visibility')
    .select('id, employe_id, field_key, is_public, created_at, updated_at')
    .eq('employe_id', employeId)
    .returns<EmployeeVisibilityRow[]>()

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []).map(mapVisibility)
}

export async function upsertVisibility(
  payload: UpsertEmployeeVisibilityPayload,
): Promise<EmployeeVisibility> {
  const { data, error } = await supabase
    .from('employee_visibility')
    .upsert(
      {
        employe_id: payload.employeId,
        field_key: payload.fieldKey,
        is_public: payload.isPublic,
      },
      { onConflict: 'employe_id,field_key' },
    )
    .select('id, employe_id, field_key, is_public, created_at, updated_at')
    .single<EmployeeVisibilityRow>()

  if (error) {
    throw new Error(error.message)
  }

  return mapVisibility(data)
}

export function useEmployeeVisibilityQuery(employeId?: string | null) {
  return useQuery({
    queryKey: ['employeeVisibility', employeId],
    queryFn: () => getVisibility(employeId as string),
    enabled: Boolean(employeId),
  })
}

export function useUpsertVisibilityMutation(
  options?: UseMutationOptions<EmployeeVisibility, Error, UpsertEmployeeVisibilityPayload>,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: upsertVisibility,
    onSuccess: async (data, variables, onMutateResult, context) => {
      await queryClient.invalidateQueries({
        queryKey: ['employeeVisibility', variables.employeId],
      })
      await options?.onSuccess?.(data, variables, onMutateResult, context)
    },
    ...options,
  })
}

export const visibilityService = {
  getVisibility,
  upsertVisibility,
}
