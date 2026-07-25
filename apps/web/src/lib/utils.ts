import clsx, { type ClassValue } from 'clsx'

export const cn = (...parts: ClassValue[]) => clsx(parts)

/** Debounce that keeps the latest arguments and exposes a flush/cancel pair. */
export function debounce<A extends unknown[]>(fn: (...args: A) => void, wait: number) {
  let timer: ReturnType<typeof setTimeout> | undefined
  let pending: A | undefined

  const run = () => {
    timer = undefined
    if (pending) {
      const args = pending
      pending = undefined
      fn(...args)
    }
  }

  const debounced = (...args: A) => {
    pending = args
    if (timer) clearTimeout(timer)
    timer = setTimeout(run, wait)
  }

  debounced.flush = () => {
    if (timer) clearTimeout(timer)
    run()
  }
  debounced.cancel = () => {
    if (timer) clearTimeout(timer)
    timer = undefined
    pending = undefined
  }
  debounced.pending = () => pending !== undefined

  return debounced
}

const RELATIVE = [
  { limit: 60, unit: 'second' as const, ms: 1000 },
  { limit: 3600, unit: 'minute' as const, ms: 60_000 },
  { limit: 86_400, unit: 'hour' as const, ms: 3_600_000 },
  { limit: 604_800, unit: 'day' as const, ms: 86_400_000 },
  { limit: 2_629_800, unit: 'week' as const, ms: 604_800_000 },
  { limit: 31_557_600, unit: 'month' as const, ms: 2_629_800_000 },
]

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

export function timeAgo(iso: string | Date): string {
  const then = typeof iso === 'string' ? new Date(iso) : iso
  const diff = (then.getTime() - Date.now()) / 1000
  const abs = Math.abs(diff)
  if (abs < 45) return 'just now'
  for (const { limit, unit, ms } of RELATIVE) {
    if (abs < limit) return rtf.format(Math.round((then.getTime() - Date.now()) / ms), unit)
  }
  return rtf.format(Math.round((then.getTime() - Date.now()) / 31_557_600_000), 'year')
}

export function formatDate(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
}

/** "2h 14m" — reading time is read at a glance, never as raw seconds. */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`
  const mins = Math.round(seconds / 60)
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  const rest = mins % 60
  return rest ? `${hours}h ${rest}m` : `${hours}h`
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('')
}

export function pluralize(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`
}

/** Deterministic hue from a string — used for author chips and cover fallbacks. */
export function hueFrom(seed: string): number {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0
  return Math.abs(hash) % 360
}

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
