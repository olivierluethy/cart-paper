import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import type { AppNotification } from '@/lib/types'

const POLL_MS = 60_000

/**
 * Database-backed and delivered by polling: every 60s, plus once whenever the
 * window regains focus. No WebSockets in v1 — the unread count is one indexed
 * COUNT, which is cheap enough to ask for on that cadence.
 */
export function useUnreadCount() {
  const { user } = useAuth()
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: () => api.get<{ unread: number }>('/notifications/unread-count'),
    enabled: Boolean(user),
    refetchInterval: POLL_MS,
    staleTime: POLL_MS / 2,
  })

  useEffect(() => {
    if (!user) return
    const onFocus = () => {
      if (document.visibilityState === 'visible') {
        qc.invalidateQueries({ queryKey: ['notifications', 'unread'] })
      }
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [user, qc])

  return query.data?.unread ?? 0
}

export function useNotifications(enabled: boolean, limit = 30) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['notifications', 'list', limit],
    queryFn: () => api.get<AppNotification[]>(`/notifications?limit=${limit}`),
    enabled: enabled && Boolean(user),
  })
}

export function useMarkNotificationsRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.post('/notifications/read'),
    onSuccess: () => {
      qc.setQueryData(['notifications', 'unread'], { unread: 0 })
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}
