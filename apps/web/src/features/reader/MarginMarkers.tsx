import { useEffect, useState } from 'react'
import { MessageSquareQuote } from 'lucide-react'
import { cn } from '@/lib/utils'

export type Marker = { id: string; replies: number; top: number }

/**
 * Reply counts in the margin, aligned with the line they belong to. This is the
 * affordance that tells a reader a sentence has been argued about before they
 * ever select it.
 */
export function MarginMarkers({
  markers,
  activeId,
  onOpen,
}: {
  markers: Marker[]
  activeId: string | null
  onOpen: (id: string) => void
}) {
  // Nudge overlapping markers apart so two discussions on adjacent lines
  // both stay clickable.
  const [laid, setLaid] = useState<Marker[]>([])
  useEffect(() => {
    const sorted = [...markers].sort((a, b) => a.top - b.top)
    let previous = -Infinity
    setLaid(
      sorted.map((marker) => {
        const top = Math.max(marker.top, previous + 30)
        previous = top
        return { ...marker, top }
      }),
    )
  }, [markers])

  if (laid.length === 0) return null

  return (
    <div className="pointer-events-none absolute inset-y-0 right-0 z-20 hidden w-10 lg:block" aria-hidden={false}>
      {laid.map((marker) => (
        <button
          key={marker.id}
          type="button"
          onClick={() => onOpen(marker.id)}
          style={{ top: marker.top }}
          aria-label={`Open discussion — ${marker.replies + 1} messages`}
          className={cn(
            'pointer-events-auto absolute right-0 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-2xs tabular-nums transition-colors',
            activeId === marker.id
              ? 'border-teal bg-teal/25 text-ink-text'
              : 'border-ink-line bg-ink-raised text-ink-muted hover:border-teal/60 hover:text-teal-soft',
          )}
        >
          <MessageSquareQuote size={11} />
          {marker.replies + 1}
        </button>
      ))}
    </div>
  )
}
