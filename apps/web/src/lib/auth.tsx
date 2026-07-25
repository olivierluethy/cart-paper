import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '@/lib/api'
import type { ReadingSettings, UserMe } from '@/lib/types'

type AuthContextValue = {
  user: UserMe | null
  loading: boolean
  register: (input: { email: string; password: string; display_name: string }) => Promise<UserMe>
  login: (input: { email: string; password: string }) => Promise<UserMe>
  logout: () => Promise<void>
  updateProfile: (patch: Partial<Pick<UserMe, 'display_name' | 'bio' | 'avatar_url' | 'stats_visible'>>) => Promise<UserMe>
  updateReadingSettings: (patch: Partial<ReadingSettings>) => Promise<UserMe>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      try {
        return await api.get<UserMe>('/auth/me')
      } catch (error) {
        // Not signed in is a normal state here, not a failure to report.
        if (error instanceof ApiError && error.status === 401) return null
        throw error
      }
    },
    staleTime: 60_000,
    retry: false,
  })

  const setUser = useCallback(
    (user: UserMe | null) => {
      qc.setQueryData(['me'], user)
    },
    [qc],
  )

  const registerMutation = useMutation({
    mutationFn: (input: { email: string; password: string; display_name: string }) =>
      api.post<UserMe>('/auth/register', input),
    onSuccess: (user) => {
      setUser(user)
      qc.invalidateQueries({ queryKey: ['library'] })
    },
  })

  const loginMutation = useMutation({
    mutationFn: (input: { email: string; password: string }) => api.post<UserMe>('/auth/login', input),
    onSuccess: (user) => {
      setUser(user)
      qc.invalidateQueries()
    },
  })

  const value = useMemo<AuthContextValue>(
    () => ({
      user: data ?? null,
      loading: isLoading,
      register: registerMutation.mutateAsync,
      login: loginMutation.mutateAsync,
      logout: async () => {
        await api.post('/auth/logout')
        setUser(null)
        qc.clear()
      },
      updateProfile: async (patch) => {
        const user = await api.patch<UserMe>('/auth/me', patch)
        setUser(user)
        return user
      },
      updateReadingSettings: async (patch) => {
        const user = await api.patch<UserMe>('/auth/me/reading-settings', patch)
        setUser(user)
        return user
      },
    }),
    [data, isLoading, registerMutation.mutateAsync, loginMutation.mutateAsync, qc, setUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

/** Reading settings with sane fallbacks for signed-out visitors. */
export const DEFAULT_READING_SETTINGS: ReadingSettings = {
  font_size: 18,
  line_height: 1.75,
  width: 34,
  typeface: 'serif',
  hide_statistics: false,
}

export function useReadingSettings(): ReadingSettings {
  const { user } = useAuth()
  return { ...DEFAULT_READING_SETTINGS, ...(user?.reading_settings ?? {}) }
}
