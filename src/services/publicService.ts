import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/lib/supabaseClient'
import type { PublicProfile } from '@/types/profile'

export async function getPublicProfileByToken(
  token: string,
): Promise<PublicProfile | null> {
  const { data, error } = await supabase.rpc('get_public_profile_by_token', {
    p_token: token,
  })

  if (error) {
    throw new Error(error.message)
  }

  if (!data) {
    return null
  }

  return data as PublicProfile
}

export function usePublicProfileByTokenQuery(token?: string) {
  return useQuery({
    queryKey: ['public-profile', token],
    queryFn: () => getPublicProfileByToken(token as string),
    enabled: Boolean(token),
  })
}

export const publicService = {
  getPublicProfileByToken,
}
