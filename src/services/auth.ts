import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js'

import { supabase } from '@/lib/supabaseClient'
import type { LoginInput } from '@/schemas/auth/login.schema'
import type {
  ChangePasswordFormValues,
  FirstLoginSetPasswordFormValues,
} from '@/schemas/changePasswordSchema'

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

export async function refreshSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.refreshSession()

  if (error) {
    throw new Error(error.message)
  }

  return data.session
}

export async function getCurrentUser(): Promise<User | null> {
  const { data, error } = await supabase.auth.getUser()

  if (error) {
    throw new Error(error.message)
  }

  return data.user ?? null
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

async function clearMustChangePasswordFlag(): Promise<void> {
  const { data, error } = await supabase.functions.invoke<{
    ok: boolean
    must_change_password: boolean
  }>('complete-password-change', {
    method: 'POST',
  })

  if (error) {
    throw new Error(error.message)
  }

  if (!data?.ok) {
    throw new Error('Unable to finalize password change.')
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

  await clearMustChangePasswordFlag()

  const { error: refreshError } = await supabase.auth.refreshSession()

  if (refreshError) {
    throw new Error('Password updated, but session refresh failed. Please sign in again.')
  }
}

export async function setPasswordOnFirstLogin(
  payload: Pick<FirstLoginSetPasswordFormValues, 'newPassword'>,
): Promise<void> {
  const { error: updateError } = await supabase.auth.updateUser({
    password: payload.newPassword,
  })

  if (updateError) {
    const normalizedMessage = updateError.message.toLowerCase()

    if (normalizedMessage.includes('reauthentication')) {
      throw new Error('Session expired. Please sign in again from your invite link.')
    }

    throw new Error(updateError.message)
  }

  await clearMustChangePasswordFlag()

  const { error: refreshError } = await supabase.auth.refreshSession()

  if (refreshError) {
    throw new Error('Password updated, but session refresh failed. Please sign in again.')
  }
}

export const authService = {
  signInWithPassword,
  signOut,
  getSession,
  refreshSession,
  getCurrentUser,
  subscribeToAuthChanges,
  changePasswordWithReauth,
  setPasswordOnFirstLogin,
}
