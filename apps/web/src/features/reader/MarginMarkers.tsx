import { useEffect, useState } from 'react'
import { MessageSquare, Pencil, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { HighlightColor } from '@/lib/types'

export type Marker =
  /** A highlight that already carries a private note. */
  | { kind: 'note'; id: string; top: number; color: HighlightColor }
  /** A highlight with no note yet — the invitation to add one. */
  | { kind: 'add-note'; id: string; top: number; color: HighlightColor }
  /** A public, passage-anchored discussion. */
  | { kind: 'discussion'; id: string; top: number; replies: number }

const DOT: Record<HighlightColor, string> = {
  yellow: 'text-[rgb(214_176_74)]',
  green: 'text-[rgb(118_163_106)]',
  blue: 'text-[rgb(98_141_192)]',
  pink: 'text-[rgb(199_118_154)]',
  red: 'text-[rgb(197_96_84)]',
  purple: 'text-[rgb(148_118_196)]',
  black: 'text-[rgb(150_146_140)]',
}

/** Nudge overlapping markers apart so adjacent lines both stay clickable. */
function stack(items: Marker[]): Marker[] {
  const sorted = [...items].sort((a, b) => a.top - b.top)
  let previous = -Infinity
  return sorted.map((marker) => {
    const top = Math.max(marker.top, previous + 28)
    previous = top
    return { ...marker, top }
  })
}

/**
 * Always visible — never hover-only. Hover affordances do not exist on touch,
 * and "there is a note here" is information, not a control.
 *
 * Private markers sit in the left margin and public ones in the right, so the
 * two kinds are told apart by position as well as by colour and icon.
 */
export function MarginMarkers({
  markers,
  activeId,
  onOpen,
}: {
  markers: Marker[]
  activeId: string | null
  onOpen: (marker: Marker) => void
}) {
  const [laid, setLaid] = useState<Marker[]>([])
  useEffect(() => setLaid(stack(markers)), [markers])

  const left = laid.filter((m) => m.kind !== 'discussion')
  const right = laid.filter((m) => m.kind === 'discussion')

  return (
    <>
      {/* private */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-20 hidden w-12 lg:block">
        {left.map((marker) => {
          const noted = marker.kind === 'note'
          return (
            <button
              key={marker.id}
              type="button"
              onClick={() => onOpen(marker)}
              style={{ top: marker.top }}
              aria-label={noted ? 'Open your private note' : 'Add a private note to this highlight'}
              title={noted ? 'Private note · only you' : 'Add a private note · only you'}
              className={cn(
                'pointer-events-auto absolute right-1 inline-grid h-6 w-6 place-items-center rounded-full border transition-colors',
                noted
                  ? cn('border-amber/50 bg-amber/15', 'color' in marker ? DOT[marker.color] : 'text-amber')
                  : 'border-dashed border-ink-line text-ink-faint hover:border-amber/50 hover:text-amber',
                activeId === marker.id && 'ring-2 ring-amber/60',
              )}
            >
              {noted ? <Pencil size={11} /> : <Plus size={11} />}
            </button>
          )
        })}
      </div>

      {/* public */}
      <div className="pointer-events-none absolute inset-y-0 right-0 z-20 hidden w-12 lg:block">
        {right.map((marker) => (
          <button
            key={marker.id}
            type="button"
            onClick={() => onOpen(marker)}
            style={{ top: marker.top }}
            aria-label={`Open the public discussion — ${
              'replies' in marker ? marker.replies + 1 : 1
            } messages`}
            title="Public discussion · everyone can see this"
            className={cn(
              'pointer-events-auto absolute left-1 inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-2xs tabular-nums transition-colors',
              activeId === marker.id
                ? 'border-teal bg-teal/25 text-ink-text'
                : 'border-ink-line bg-ink-raised text-teal-soft hover:border-teal/60',
            )}
          >
            <MessageSquare size={10} />
            {'replies' in marker ? marker.replies + 1 : 1}
          </button>
        ))}
      </div>
    </>
  )
}
