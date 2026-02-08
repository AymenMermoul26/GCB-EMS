import { useMutation, useQueryClient, type UseMutationOptions } from '@tanstack/react-query'

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

export function useGenerateOrRegenerateTokenMutation(
  options?: UseMutationOptions<TokenQR, Error, string>,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: generateOrRegenerateToken,
    onSuccess: async (data, variables, onMutateResult, context) => {
      await queryClient.invalidateQueries({ queryKey: ['employee', variables] })
      await queryClient.invalidateQueries({ queryKey: ['employees'] })
      await options?.onSuccess?.(data, variables, onMutateResult, context)
    },
    ...options,
  })
}

export const qrService = {
  generateOrRegenerateToken,
}
