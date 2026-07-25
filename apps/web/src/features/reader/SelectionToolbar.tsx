import { motion } from 'motion/react'
import { Copy, MessageSquareQuote, StickyNote, TextQuote } from 'lucide-react'
import { HIGHLIGHT_COLORS, type HighlightColor } from '@/lib/types'
import { cn } from '@/lib/utils'

const SWATCH: Record<HighlightColor, string> = {
  yellow: 'bg-[rgb(214_176_74/0.55)]',
  green: 'bg-[rgb(118_163_106/0.55)]',
  blue: 'bg-[rgb(98_141_192/0.6)]',
  pink: 'bg-[rgb(199_118_154/0.55)]',
  red: 'bg-[rgb(197_96_84/0.55)]',
  purple: 'bg-[rgb(148_118_196/0.6)]',
  black: 'bg-[rgb(120_115_108/0.7)]',
}

export type SelectionActions = {
  onHighlight: (color: HighlightColor) => void
  onNote: () => void
  onComment: () => void
  onCopy: () => void
  onQuote: () => void
}

export function SelectionToolbar({
  rect,
  actions,
  activeColor,
}: {
  rect: DOMRect
  actions: SelectionActions
  activeColor?: HighlightColor | null
}) {
  // Sit above the selection unless it is near the top of the viewport.
  const above = rect.top > 120
  const style: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(Math.max(rect.left + rect.width / 2, 180), window.innerWidth - 180),
    top: above ? rect.top - 12 : rect.bottom + 12,
    transform: `translate(-50%, ${above ? '-100%' : '0'})`,
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: above ? 4 : -4, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.13, ease: 'easeOut' }}
      style={style}
      role="toolbar"
      aria-label="Selected passage"
      // The toolbar must not steal the selection it is acting on.
      onMouseDown={(event) => event.preventDefault()}
      className="surface-raised z-40 flex items-center gap-1 rounded-full px-2 py-1.5"
    >
      <div className="flex items-center gap-1 pr-1">
        {HIGHLIGHT_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={`Highlight ${color}`}
            title={color}
            aria-pressed={activeColor === color}
            onClick={() => actions.onHighlight(color)}
            className={cn(
              'h-5 w-5 rounded-full border transition-transform hover:scale-110',
              SWATCH[color],
              activeColor === color ? 'border-amber' : 'border-white/15',
            )}
          />
        ))}
      </div>

      <span className="h-5 w-px bg-ink-line" aria-hidden />

      <Action icon={StickyNote} label="Add note" onClick={actions.onNote} />
      <Action icon={MessageSquareQuote} label="Comment on this passage" onClick={actions.onComment} />
      <Action icon={Copy} label="Copy" onClick={actions.onCopy} />
      <Action icon={TextQuote} label="Quote" onClick={actions.onQuote} />
    </motion.div>
  )
}

function Action({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Copy
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="inline-grid h-8 w-8 place-items-center rounded-full text-ink-muted transition-colors hover:bg-ink-line/60 hover:text-ink-text"
    >
      <Icon size={15} />
    </button>
  )
}
