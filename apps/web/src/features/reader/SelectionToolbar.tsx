import { motion } from 'motion/react'
import { Copy, MessageSquare, Pencil, TextQuote } from 'lucide-react'
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
  const above = rect.top > 150
  const style: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(Math.max(rect.left + rect.width / 2, 230), window.innerWidth - 230),
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
      className="surface-raised z-40 flex flex-col gap-1.5 rounded-xl px-2 py-2"
    >
      <div className="flex items-center gap-1.5 px-0.5">
        <span className="mr-0.5 text-2xs uppercase tracking-[0.12em] text-ink-faint">Highlight</span>
        {HIGHLIGHT_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={`Highlight ${color}`}
            title={`Highlight ${color}`}
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

      <div className="h-px bg-ink-line" aria-hidden />

      {/* Text labels, not icon-only: nothing here should need a hover to explain it. */}
      <div className="flex items-center gap-0.5">
        <Action
          icon={Pencil}
          label="Note"
          hint="Private · only you"
          tone="private"
          onClick={actions.onNote}
        />
        <Action
          icon={MessageSquare}
          label="Discuss"
          hint="Public · everyone"
          tone="public"
          onClick={actions.onComment}
        />
        <span className="mx-0.5 h-6 w-px bg-ink-line" aria-hidden />
        <Action icon={Copy} label="Copy" onClick={actions.onCopy} />
        <Action icon={TextQuote} label="Quote" onClick={actions.onQuote} />
      </div>
    </motion.div>
  )
}

function Action({
  icon: Icon,
  label,
  hint,
  tone,
  onClick,
}: {
  icon: typeof Copy
  label: string
  hint?: string
  tone?: 'private' | 'public'
  onClick: () => void
}) {
  return (
    <button
      type="button"
      title={hint ? `${label} — ${hint}` : label}
      onClick={onClick}
      className={cn(
        'flex flex-col items-start gap-0.5 rounded-lg px-2.5 py-1.5 text-left transition-colors',
        'hover:bg-ink-line/60',
        tone === 'private' && 'text-amber hover:bg-amber/10',
        tone === 'public' && 'text-teal-soft hover:bg-teal/10',
        !tone && 'text-ink-muted hover:text-ink-text',
      )}
    >
      <span className="flex items-center gap-1.5 text-xs font-medium">
        <Icon size={13} />
        {label}
      </span>
      {hint && <span className="text-[0.6rem] leading-none text-ink-faint">{hint}</span>}
    </button>
  )
}
