import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { Loader2, Lock, X } from 'lucide-react'
import { PRIVACY } from '@/features/reader/privacy'
import { quoteExcerpt } from '@/lib/anchor'
import { cn } from '@/lib/utils'
import type { Anchor, HighlightColor } from '@/lib/types'

export type ComposerTarget = {
  highlightId: string
  anchor: Anchor
  pageId: string | null
  color: HighlightColor
  rect: DOMRect
}

/**
 * Opens by itself the moment a highlight is made, so "you can attach a private
 * note to this" is discovered by doing rather than by hovering.
 *
 * Dismissing it never removes the highlight — the highlight is already saved;
 * this only decides whether a note joins it.
 */
export function NoteComposerPopover({
  target,
  saving,
  onSave,
  onDismiss,
  onExpand,
}: {
  target: ComposerTarget
  saving: boolean
  onSave: (text: string) => void
  onDismiss: () => void
  onExpand: (text: string) => void
}) {
  const [text, setText] = useState('')
  const area = useRef<HTMLTextAreaElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const textRef = useRef('')
  textRef.current = text

  useEffect(() => {
    area.current?.focus()
  }, [])

  useEffect(() => {
    const onDown = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) onDismiss()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onDismiss()
      }
    }
    // Defer so the click that created the highlight does not close this at once.
    const timer = window.setTimeout(() => document.addEventListener('mousedown', onDown), 0)
    document.addEventListener('keydown', onKey, true)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [onDismiss])

  const below = target.rect.top < 260
  const style: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(Math.max(target.rect.left + target.rect.width / 2, 190), window.innerWidth - 190),
    top: below ? target.rect.bottom + 10 : target.rect.top - 10,
    transform: `translate(-50%, ${below ? '0' : '-100%'})`,
  }

  return (
    <motion.div
      ref={box}
      initial={{ opacity: 0, y: below ? -4 : 4, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      style={style}
      role="dialog"
      aria-label="Add a private note"
      className="surface-raised z-50 w-[min(22rem,calc(100vw-2rem))] rounded-xl border-amber/30 p-3"
    >
      <header className="mb-2 flex items-center gap-1.5">
        <Lock size={11} className="text-amber" />
        <span className="text-2xs font-medium text-amber">{PRIVACY.private.full}</span>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss without adding a note"
          className="ml-auto rounded p-0.5 text-ink-faint transition-colors hover:bg-ink-line/60 hover:text-ink-text"
        >
          <X size={13} />
        </button>
      </header>

      <p
        className={cn(
          'mb-2 line-clamp-2 border-l-2 pl-2 font-read text-2xs italic leading-relaxed text-ink-muted',
          'border-amber/50',
        )}
      >
        {quoteExcerpt(target.anchor, 110)}
      </p>

      <textarea
        ref={area}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
            event.preventDefault()
            if (textRef.current.trim()) onSave(textRef.current.trim())
          }
        }}
        rows={3}
        placeholder={PRIVACY.private.placeholder}
        className="field min-h-[4rem] resize-y text-sm leading-relaxed"
      />

      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          disabled={!text.trim() || saving}
          onClick={() => onSave(text.trim())}
          className="inline-flex items-center gap-1.5 rounded-md bg-amber px-3 py-1.5 text-xs font-medium text-[#1A1408] transition-colors hover:bg-amber-soft disabled:cursor-not-allowed disabled:opacity-45"
        >
          {saving && <Loader2 size={12} className="animate-spin" />}
          Save note
        </button>
        <button
          type="button"
          onClick={() => onExpand(text)}
          className="text-2xs text-ink-faint underline-offset-2 transition-colors hover:text-amber hover:underline"
        >
          More options…
        </button>
        <span className="ml-auto text-[0.6rem] text-ink-faint">⌘↵ save · Esc close</span>
      </div>
    </motion.div>
  )
}
