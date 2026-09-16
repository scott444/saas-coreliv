import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { User } from '@/domain'
import { useServices } from './ServicesProvider'
import { queryKeys } from './queryKeys'

interface AuthContextValue {
  user: User | null
  isLoading: boolean
  login(email: string, password: string): Promise<User>
  register(name: string, email: string, password: string): Promise<User>
  logout(): Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const { auth } = useServices()
  const queryClient = useQueryClient()

  const meQuery = useQuery({
    queryKey: queryKeys.auth.me,
    queryFn: () => auth.getCurrentUser(),
    staleTime: 5 * 60_000,
    retry: false,
  })

  const login = useCallback(
    async (email: string, password: string) => {
      const session = await auth.login(email, password)
      queryClient.setQueryData(queryKeys.auth.me, session.user)
      return session.user
    },
    [auth, queryClient],
  )

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      const session = await auth.register(name, email, password)
      queryClient.setQueryData(queryKeys.auth.me, session.user)
      return session.user
    },
    [auth, queryClient],
  )

  const logout = useCallback(async () => {
    await auth.logout()
    queryClient.setQueryData(queryKeys.auth.me, null)
    queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== 'auth' })
  }, [auth, queryClient])

  const value = useMemo<AuthContextValue>(
    () => ({ user: meQuery.data ?? null, isLoading: meQuery.isPending, login, register, logout }),
    [meQuery.data, meQuery.isPending, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
