import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
} from '@tanstack/react-query'
import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from '@supabase/supabase-js'

import { supabase } from '@/lib/supabaseClient'

interface EmployeeProfileRow {
  id: string
  employe_id: string
  user_id: string | null
  role: 'ADMIN_RH' | 'EMPLOYE'
  created_at: string
  updated_at: string
}

interface InviteEmployeeAccountBody {
  employe_id: string
  email: string
}

export interface EmployeeProfileLink {
  id: string
  employeId: string
  userId: string | null
  role: 'ADMIN_RH' | 'EMPLOYE'
  createdAt: string
  updatedAt: string
}

export interface InviteEmployeeAccountPayload {
  employeId: string
  email: string
}

export interface InviteEmployeeAccountResponse {
  employe_id: string
  user_id: string
  email: string
  status: 'INVITED'
}

function mapEmployeeProfileLink(row: EmployeeProfileRow): EmployeeProfileLink {
  return {
    id: row.id,
    employeId: row.employe_id,
    userId: row.user_id,
    role: row.role,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function normalizeSingleRowResult<T>(rows: T[] | null, context: string): T | null {
  if (!rows || rows.length === 0) {
    return null
  }

  if (rows.length > 1) {
    console.error(`[${context}] expected a single row, got`, rows.length)
    throw new Error('Data integrity issue: multiple profile mappings found for this employee.')
  }

  return rows[0]
}

async function mapFunctionInvokeError(error: unknown): Promise<Error> {
  if (error instanceof FunctionsFetchError) {
    return new Error(
      'Invite service is unreachable. Ensure edge function "invite-employee" is deployed.',
    )
  }

  if (error instanceof FunctionsRelayError) {
    return new Error(`Invite service relay error: ${error.message}`)
  }

  if (error instanceof FunctionsHttpError) {
    try {
      const body = (await error.context.json()) as { error?: string; message?: string }
      if (body.error) {
        return new Error(body.error)
      }
      if (body.message) {
        return new Error(body.message)
      }
    } catch {
      return new Error(error.message)
    }
  }

  if (error instanceof Error) {
    return error
  }

  return new Error('Unexpected error while invoking invite-employee function.')
}

export async function getEmployeeProfileLink(
  employeId: string,
): Promise<EmployeeProfileLink | null> {
  const { data, error } = await supabase
    .from('ProfilUtilisateur')
    .select('id, employe_id, user_id, role, created_at, updated_at')
    .eq('employe_id', employeId)
    .limit(2)
    .returns<EmployeeProfileRow[]>()

  if (error) {
    throw new Error(error.message)
  }

  const row = normalizeSingleRowResult(data ?? null, 'accountService.getEmployeeProfileLink')
  return row ? mapEmployeeProfileLink(row) : null
}

export async function inviteEmployeeAccount(
  payload: InviteEmployeeAccountPayload,
): Promise<InviteEmployeeAccountResponse> {
  const body: InviteEmployeeAccountBody = {
    employe_id: payload.employeId,
    email: payload.email.trim().toLowerCase(),
  }

  const { data, error } = await supabase.functions.invoke<InviteEmployeeAccountResponse>(
    'invite-employee',
    { body },
  )

  if (error) {
    throw await mapFunctionInvokeError(error)
  }

  if (!data?.user_id) {
    throw new Error('Invite function returned an invalid response.')
  }

  return data
}

export async function resendInvite(
  payload: InviteEmployeeAccountPayload,
): Promise<InviteEmployeeAccountResponse> {
  return inviteEmployeeAccount(payload)
}

export function useEmployeeProfileQuery(employeId?: string | null) {
  return useQuery({
    queryKey: ['employeeProfile', employeId ?? null],
    queryFn: () => getEmployeeProfileLink(employeId as string),
    enabled: Boolean(employeId),
  })
}

export function useInviteEmployeeAccountMutation(
  options?: UseMutationOptions<InviteEmployeeAccountResponse, Error, InviteEmployeeAccountPayload>,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: inviteEmployeeAccount,
    onSuccess: async (data, variables, onMutateResult, context) => {
      await queryClient.invalidateQueries({ queryKey: ['employee', variables.employeId] })
      await queryClient.invalidateQueries({ queryKey: ['employeeProfile', variables.employeId] })
      await queryClient.invalidateQueries({ queryKey: ['employees'] })
      await options?.onSuccess?.(data, variables, onMutateResult, context)
    },
    ...options,
  })
}

export function useResendInviteMutation(
  options?: UseMutationOptions<InviteEmployeeAccountResponse, Error, InviteEmployeeAccountPayload>,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: resendInvite,
    onSuccess: async (data, variables, onMutateResult, context) => {
      await queryClient.invalidateQueries({ queryKey: ['employee', variables.employeId] })
      await queryClient.invalidateQueries({ queryKey: ['employeeProfile', variables.employeId] })
      await queryClient.invalidateQueries({ queryKey: ['employees'] })
      await options?.onSuccess?.(data, variables, onMutateResult, context)
    },
    ...options,
  })
}

export const accountService = {
  getEmployeeProfileLink,
  inviteEmployeeAccount,
  resendInvite,
}
