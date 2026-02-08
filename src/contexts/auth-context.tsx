/* eslint-disable react-refresh/only-export-components */
import type { Session, User } from '@supabase/supabase-js'
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

import type { AppRole } from '@/constants/roles'
import type { LoginInput } from '@/schemas/auth/login.schema'
import {
  getSession,
  signInWithPassword,
  signOut as signOutRequest,
  subscribeToAuthChanges,
} from '@/services/auth'
import { resolveRoleByUserId } from '@/services/role.service'
import type { RoleInfo } from '@/types/auth'

interface AuthContextValue {
  session: Session | null
  user: User | null
  role: AppRole | null
  employeId: string | null
  isLoading: boolean
  isAuthenticated: boolean
  signIn: (credentials: LoginInput) => Promise<RoleInfo>
  signOut: () => Promise<void>
  refreshRole: () => Promise<RoleInfo | null>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [role, setRole] = useState<AppRole | null>(null)
  const [employeId, setEmployeId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const applyRole = useCallback((roleInfo: RoleInfo | null) => {
    setRole(roleInfo?.role ?? null)
    setEmployeId(roleInfo?.employeId ?? null)
  }, [])

  const resolveAndCacheRole = useCallback(
    async (userId: string | null) => {
      if (!userId) {
        applyRole(null)
        return null
      }

      const roleInfo = await resolveRoleByUserId(userId)
      applyRole(roleInfo)
      return roleInfo
    },
    [applyRole],
  )

  const refreshRole = useCallback(async () => {
    return resolveAndCacheRole(user?.id ?? null)
  }, [resolveAndCacheRole, user?.id])

  useEffect(() => {
    let mounted = true

    const bootstrap = async () => {
      try {
        const nextSession = await getSession()

        if (!mounted) {
          return
        }

        setSession(nextSession)
        setUser(nextSession?.user ?? null)
        await resolveAndCacheRole(nextSession?.user.id ?? null)
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    void bootstrap()

    const unsubscribe = subscribeToAuthChanges((_event, nextSession) => {
      setSession(nextSession)
      setUser(nextSession?.user ?? null)
      void resolveAndCacheRole(nextSession?.user.id ?? null)
    })

    return () => {
      mounted = false
      unsubscribe()
    }
  }, [resolveAndCacheRole])

  const signIn = useCallback(
    async (credentials: LoginInput) => {
      setIsLoading(true)
      try {
        const nextSession = await signInWithPassword(credentials)
        setSession(nextSession)
        setUser(nextSession?.user ?? null)

        const roleInfo = await resolveAndCacheRole(nextSession?.user.id ?? null)

        if (!roleInfo) {
          throw new Error('No ProfilUtilisateur mapping found for this account.')
        }

        return roleInfo
      } finally {
        setIsLoading(false)
      }
    },
    [resolveAndCacheRole],
  )

  const signOut = useCallback(async () => {
    setIsLoading(true)
    try {
      await signOutRequest()
      setSession(null)
      setUser(null)
      applyRole(null)
    } finally {
      setIsLoading(false)
    }
  }, [applyRole])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      role,
      employeId,
      isLoading,
      isAuthenticated: Boolean(session?.user),
      signIn,
      signOut,
      refreshRole,
    }),
    [
      session,
      user,
      role,
      employeId,
      isLoading,
      signIn,
      signOut,
      refreshRole,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
