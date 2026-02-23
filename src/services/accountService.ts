import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
} from '@tanstack/react-query'

import { env } from '@/config/env'
import { supabase } from '@/lib/supabaseClient'

interface EmployeeProfileRow {
  id: string
  employe_id: string
  user_id: string | null
  role: 'ADMIN_RH' | 'EMPLOYE'
  created_at: string
  updated_at: string
}

interface FunctionErrorBody {
  error?: string
  message?: string
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
  must_change_password?: boolean
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

async function getFreshAccessTokenOrThrow(): Promise<string> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()

  if (sessionError) {
    throw new Error(sessionError.message)
  }

  if (!sessionData.session?.access_token) {
    throw new Error('Session expired. Please sign out and sign in again.')
  }

  const { data: refreshedData, error: refreshError } = await supabase.auth.refreshSession()

  if (!refreshError && refreshedData.session?.access_token) {
    return refreshedData.session.access_token
  }

  return sessionData.session.access_token
}

function mapInviteErrorMessage(status: number, body: FunctionErrorBody | null): string {
  const rawMessage = (body?.error ?? body?.message ?? '').trim()
  const normalized = rawMessage.toLowerCase()

  if (normalized.includes('invalid jwt')) {
    return 'Session token is invalid. Please sign out and sign in again.'
  }

  if (status === 401) {
    return 'Unauthorized. Please sign out and sign in again.'
  }

  if (status === 404) {
    return 'Invite service is unreachable. Ensure edge function "invite-employee" is deployed.'
  }

  if (rawMessage.length > 0) {
    return rawMessage
  }

  return `Invite service failed with status ${status}.`
}

async function callInviteEmployeeFunction(
  payload: InviteEmployeeAccountPayload,
  accessToken: string,
): Promise<{ ok: true; data: InviteEmployeeAccountResponse } | { ok: false; error: Error }> {
  try {
    const response = await fetch(`${env.VITE_SUPABASE_URL}/functions/v1/invite-employee`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: env.VITE_SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        employe_id: payload.employeId,
        email: payload.email.trim().toLowerCase(),
      }),
    })

    let parsedBody: unknown = null
    try {
      parsedBody = await response.json()
    } catch {
      parsedBody = null
    }

    if (!response.ok) {
      return {
        ok: false,
        error: new Error(mapInviteErrorMessage(response.status, parsedBody as FunctionErrorBody | null)),
      }
    }

    const data = parsedBody as InviteEmployeeAccountResponse | null
    if (!data?.user_id) {
      return { ok: false, error: new Error('Invite function returned an invalid response.') }
    }

    return { ok: true, data }
  } catch {
    return {
      ok: false,
      error: new Error(
        'Invite service is unreachable. Ensure edge function "invite-employee" is deployed.',
      ),
    }
  }
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
  const accessToken = await getFreshAccessTokenOrThrow()
  const firstAttempt = await callInviteEmployeeFunction(payload, accessToken)

  if (firstAttempt.ok) {
    return firstAttempt.data
  }

  const normalized = firstAttempt.error.message.toLowerCase()
  const shouldRetryAfterRefresh =
    normalized.includes('invalid jwt') ||
    normalized.includes('session token is invalid') ||
    normalized.includes('session expired')

  if (!shouldRetryAfterRefresh) {
    throw firstAttempt.error
  }

  const { data: refreshedSessionData, error: refreshError } = await supabase.auth.refreshSession()
  if (refreshError || !refreshedSessionData.session?.access_token) {
    throw new Error('Session token is invalid. Please sign out and sign in again.')
  }

  const secondAttempt = await callInviteEmployeeFunction(
    payload,
    refreshedSessionData.session.access_token,
  )

  if (secondAttempt.ok) {
    return secondAttempt.data
  }

  throw secondAttempt.error
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
