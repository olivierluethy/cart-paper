import { useCallback, useEffect, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuth, useReadingSettings } from '@/lib/auth'
import { debounce } from '@/lib/utils'
import type { Anchor, ContinueReading, ReadingProgress, UUID } from '@/lib/types'

export function useProgress(ref: string | undefined, invite?: string | null) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['progress', ref],
    queryFn: () => api.get<ReadingProgress | null>(`/books/${ref}/progress`, invite ? { invite } : undefined),
    enabled: Boolean(ref && user),
    staleTime: Infinity,
  })
}

export function useContinueReading(enabled: boolean) {
  return useQuery({
    queryKey: ['reading', 'continue'],
    queryFn: () => api.get<ContinueReading[]>('/reading/continue'),
    enabled,
  })
}

/**
 * Progress is written continuously but coalesced: a reader flipping through ten
 * pages should cost one request, not ten.
 */
export function useSaveProgress(ref: string, invite?: string | null) {
  const { user } = useAuth()
  const qc = useQueryClient()

  const save = useMutation({
    mutationFn: (input: { page_id: UUID | null; anchor: Anchor | null; percent: number }) =>
      api.put<ReadingProgress>(`/books/${ref}/progress`, input, invite ? { invite } : undefined),
    onSuccess: (progress) => {
      qc.setQueryData(['progress', ref], progress)
      qc.invalidateQueries({ queryKey: ['reading', 'continue'] })
    },
  })

  const saveRef = useRef(save)
  saveRef.current = save

  const push = useRef(
    debounce((input: { page_id: UUID | null; anchor: Anchor | null; percent: number }) => {
      saveRef.current.mutate(input)
    }, 1200),
  ).current

  useEffect(() => () => push.flush(), [push])

  return (input: { page_id: UUID | null; anchor: Anchor | null; percent: number }) => {
    if (!user) return
    push(input)
  }
}

/**
 * Passive time tracking: a 15s tick that only runs while the tab is focused and
 * the reader is actually on screen. Nothing about it is ever shown mid-read.
 */
export function useHeartbeat(ref: string, active: boolean, invite?: string | null) {
  const { user } = useAuth()
  const pagesTurned = useRef(0)

  // Stable across renders: the reader's navigation callbacks depend on this,
  // and an unstable identity would re-register the key handlers every keystroke.
  const countPageTurn = useCallback(() => {
    pagesTurned.current += 1
  }, [])

  useEffect(() => {
    if (!user || !active) return
    let stopped = false

    const beat = () => {
      if (stopped) return
      if (document.visibilityState !== 'visible' || !document.hasFocus()) return
      const turned = pagesTurned.current
      pagesTurned.current = 0
      void api
        .post(`/books/${ref}/heartbeat`, { seconds: 15, pages_turned: turned }, invite ? { invite } : undefined)
        .catch(() => undefined)
    }

    const timer = window.setInterval(beat, 15_000)
    return () => {
      stopped = true
      window.clearInterval(timer)
    }
  }, [ref, active, user, invite])

  return countPageTurn
}

/** Reader typography as CSS variables, so the prose stylesheet stays declarative. */
export function useReaderTypography() {
  const settings = useReadingSettings()
  return {
    style: {
      ['--reader-size' as string]: `${settings.font_size}px`,
      ['--reader-leading' as string]: String(settings.line_height),
      ['--reader-width' as string]: `${settings.width}rem`,
    } as React.CSSProperties,
    className: settings.typeface === 'sans' ? 'font-ui' : 'font-read',
    settings,
  }
}
