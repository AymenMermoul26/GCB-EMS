import type { AuthChangeEvent, Session } from '@supabase/supabase-js'

import { supabase } from '@/lib/supabaseClient'
import type { LoginInput } from '@/schemas/auth/login.schema'

export async function signInWithPassword(
  credentials: LoginInput,
): Promise<Session | null> {
  const { data, error } = await supabase.auth.signInWithPassword(credentials)

  if (error) {
    throw new Error(error.message)
  }

  return data.session
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut()

  if (error) {
    throw new Error(error.message)
  }
}

export async function getSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession()

  if (error) {
    throw new Error(error.message)
  }

  return data.session
}

export function subscribeToAuthChanges(
  callback: (event: AuthChangeEvent, session: Session | null) => void,
) {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange(callback)

  return () => {
    subscription.unsubscribe()
  }
}

export const authService = {
  signInWithPassword,
  signOut,
  getSession,
  subscribeToAuthChanges,
}
