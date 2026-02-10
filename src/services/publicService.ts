import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/lib/supabaseClient'
import type { PublicProfile, PublicProfileResult } from '@/types/profile'

export async function getPublicProfileByToken(
  token: string,
): Promise<PublicProfileResult> {
  const { data, error } = await supabase.rpc('get_public_profile_by_token', {
    p_token: token,
  })

  if (error) {
    throw new Error(error.message)
  }

  if (!data) {
    return {
      status: 'invalid_or_revoked',
      profile: null,
    }
  }

  if (typeof data === 'object' && data !== null && '__status' in data) {
    const status = (data as { __status?: unknown }).__status
    if (status === 'EXPIRED') {
      return {
        status: 'expired',
        profile: null,
      }
    }
  }

  return {
    status: 'valid',
    profile: data as PublicProfile,
  }
}

export function usePublicProfileByTokenQuery(token?: string) {
  return useQuery({
    queryKey: ['publicProfile', token],
    queryFn: () => getPublicProfileByToken(token as string),
    enabled: Boolean(token),
  })
}

export const publicService = {
  getPublicProfileByToken,
}
