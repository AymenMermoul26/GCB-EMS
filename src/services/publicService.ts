import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/lib/supabaseClient'
import type {
  PublicProfile,
  PublicProfileResult,
  PublicProfileRpcResult,
} from '@/types/profile'

function isPublicProfile(value: unknown): value is PublicProfile {
  return typeof value === 'object' && value !== null
}

function mapStatus(status: PublicProfileRpcResult['status']): PublicProfileResult['status'] {
  if (status === 'VALID') {
    return 'valid'
  }

  if (status === 'EXPIRED') {
    return 'expired'
  }

  return 'invalid_or_revoked'
}

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

  if (
    typeof data === 'object' &&
    data !== null &&
    'status' in data &&
    typeof (data as { status?: unknown }).status === 'string'
  ) {
    const payload = data as PublicProfileRpcResult

    return {
      status: mapStatus(payload.status),
      profile: isPublicProfile(payload.profile) ? payload.profile : null,
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
    profile: isPublicProfile(data) ? (data as PublicProfile) : null,
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
