import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { debounce } from '@/lib/utils'

export type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'

/**
 * Debounced autosave with a visible state, plus a manual flush for Cmd/Ctrl+S.
 * The editor must never lose a keystroke to a navigation, so the pending value
 * is flushed on unmount and on `beforeunload` too.
 */
export function useAutosave<T>(save: (value: T) => Promise<unknown>, wait = 800) {
  const [state, setState] = useState<SaveState>('idle')
  const latest = useRef<T | null>(null)
  const saveRef = useRef(save)
  saveRef.current = save

  const run = useCallback(async (value: T) => {
    setState('saving')
    try {
      await saveRef.current(value)
      latest.current = null
      setState('saved')
    } catch {
      setState('error')
    }
  }, [])

  const debounced = useMemo(() => debounce((value: T) => void run(value), wait), [run, wait])

  const schedule = useCallback(
    (value: T) => {
      latest.current = value
      setState('dirty')
      debounced(value)
    },
    [debounced],
  )

  const flush = useCallback(() => {
    if (latest.current !== null) debounced.flush()
  }, [debounced])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        flush()
      }
    }
    const onLeave = (event: BeforeUnloadEvent) => {
      if (latest.current !== null) {
        debounced.flush()
        event.preventDefault()
      }
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('beforeunload', onLeave)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('beforeunload', onLeave)
      debounced.flush()
    }
  }, [flush, debounced])

  return { state, schedule, flush, setState }
}
