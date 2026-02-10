import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
} from '@tanstack/react-query'

import { supabase } from '@/lib/supabaseClient'
import type { TokenQR } from '@/types/token'

interface TokenQRRow {
  id: string
  employe_id: string
  token: string
  statut_token: 'ACTIF' | 'REVOQUE'
  expires_at: string | null
  created_at: string
  updated_at: string
}

function mapToken(row: TokenQRRow): TokenQR {
  return {
    id: row.id,
    employeId: row.employe_id,
    token: row.token,
    statutToken: row.statut_token,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function createTokenValue() {
  return crypto.randomUUID().replaceAll('-', '')
}

export async function generateOrRegenerateToken(
  employeId: string,
): Promise<TokenQR> {
  const { error: revokeError } = await supabase
    .from('TokenQR')
    .update({ statut_token: 'REVOQUE' })
    .eq('employe_id', employeId)
    .eq('statut_token', 'ACTIF')

  if (revokeError) {
    throw new Error(revokeError.message)
  }

  const { data, error } = await supabase
    .from('TokenQR')
    .insert({
      employe_id: employeId,
      token: createTokenValue(),
      statut_token: 'ACTIF',
    })
    .select('id, employe_id, token, statut_token, expires_at, created_at, updated_at')
    .single<TokenQRRow>()

  if (error) {
    throw new Error(error.message)
  }

  return mapToken(data)
}

export async function getEmployeeCurrentToken(
  employeId: string,
): Promise<TokenQR | null> {
  const { data: activeTokenRows, error: activeTokenError } = await supabase
    .from('TokenQR')
    .select('id, employe_id, token, statut_token, expires_at, created_at, updated_at')
    .eq('employe_id', employeId)
    .eq('statut_token', 'ACTIF')
    .order('created_at', { ascending: false })
    .limit(1)
    .returns<TokenQRRow[]>()

  if (activeTokenError) {
    throw new Error(activeTokenError.message)
  }

  if (activeTokenRows && activeTokenRows.length > 0) {
    return mapToken(activeTokenRows[0])
  }

  const { data: latestTokenRows, error: latestTokenError } = await supabase
    .from('TokenQR')
    .select('id, employe_id, token, statut_token, expires_at, created_at, updated_at')
    .eq('employe_id', employeId)
    .order('created_at', { ascending: false })
    .limit(1)
    .returns<TokenQRRow[]>()

  if (latestTokenError) {
    throw new Error(latestTokenError.message)
  }

  if (!latestTokenRows || latestTokenRows.length === 0) {
    return null
  }

  return mapToken(latestTokenRows[0])
}

export async function getMyActiveToken(
  employeId: string,
): Promise<TokenQR | null> {
  return getEmployeeCurrentToken(employeId)
}

export async function revokeActiveToken(
  employeId: string,
): Promise<TokenQR | null> {
  const { data, error } = await supabase
    .from('TokenQR')
    .update({ statut_token: 'REVOQUE' })
    .eq('employe_id', employeId)
    .eq('statut_token', 'ACTIF')
    .select('id, employe_id, token, statut_token, expires_at, created_at, updated_at')
    .returns<TokenQRRow[]>()

  if (error) {
    throw new Error(error.message)
  }

  if (!data || data.length === 0) {
    return null
  }

  return mapToken(data[0])
}

export function useEmployeeCurrentTokenQuery(employeId?: string | null) {
  return useQuery({
    queryKey: ['employeeToken', employeId],
    queryFn: () => getEmployeeCurrentToken(employeId as string),
    enabled: Boolean(employeId),
  })
}

export function useMyActiveTokenQuery(employeId?: string | null) {
  return useQuery({
    queryKey: ['myActiveToken', employeId],
    queryFn: () => getMyActiveToken(employeId as string),
    enabled: Boolean(employeId),
    refetchInterval: 30000,
  })
}

export function useGenerateOrRegenerateTokenMutation(
  options?: UseMutationOptions<TokenQR, Error, string>,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: generateOrRegenerateToken,
    onSuccess: async (data, variables, onMutateResult, context) => {
      await queryClient.invalidateQueries({ queryKey: ['employee', variables] })
      await queryClient.invalidateQueries({ queryKey: ['employees'] })
      await queryClient.invalidateQueries({ queryKey: ['employeeToken', variables] })
      await options?.onSuccess?.(data, variables, onMutateResult, context)
    },
    ...options,
  })
}

export function useRevokeActiveTokenMutation(
  options?: UseMutationOptions<TokenQR | null, Error, string>,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: revokeActiveToken,
    onSuccess: async (data, variables, onMutateResult, context) => {
      await queryClient.invalidateQueries({ queryKey: ['employee', variables] })
      await queryClient.invalidateQueries({ queryKey: ['employees'] })
      await queryClient.invalidateQueries({ queryKey: ['employeeToken', variables] })
      await options?.onSuccess?.(data, variables, onMutateResult, context)
    },
    ...options,
  })
}

export const qrService = {
  getMyActiveToken,
  getEmployeeCurrentToken,
  generateOrRegenerateToken,
  revokeActiveToken,
}
