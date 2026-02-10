import type { AuthChangeEvent, Session } from '@supabase/supabase-js'

import { supabase } from '@/lib/supabaseClient'
import type { LoginInput } from '@/schemas/auth/login.schema'
import type { ChangePasswordFormValues } from '@/schemas/changePasswordSchema'

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

export async function changePasswordWithReauth(
  payload: Pick<ChangePasswordFormValues, 'currentPassword' | 'newPassword'>,
): Promise<void> {
  const { data: userData, error: userError } = await supabase.auth.getUser()

  if (userError) {
    throw new Error(userError.message)
  }

  const email = userData.user?.email
  if (!email) {
    throw new Error('This account does not have an email address. Contact an administrator.')
  }

  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email,
    password: payload.currentPassword,
  })

  if (reauthError) {
    throw new Error('Current password is incorrect.')
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: payload.newPassword,
  })

  if (updateError) {
    if (updateError.message.toLowerCase().includes('reauthentication')) {
      throw new Error('Please sign in again and retry changing your password.')
    }

    throw new Error(updateError.message)
  }
}

export const authService = {
  signInWithPassword,
  signOut,
  getSession,
  subscribeToAuthChanges,
  changePasswordWithReauth,
}
