import { AlertCircle, Check, Loader2 } from 'lucide-react'
import type { SaveState } from '@/features/editor/useAutosave'
import { cn } from '@/lib/utils'

const COPY: Record<SaveState, { text: string; className: string }> = {
  idle: { text: 'Up to date', className: 'text-ink-faint' },
  dirty: { text: 'Unsaved changes', className: 'text-ink-muted' },
  saving: { text: 'Saving…', className: 'text-ink-muted' },
  saved: { text: 'Saved', className: 'text-success' },
  error: { text: 'Save failed', className: 'text-danger' },
}

export function SaveIndicator({ state, className }: { state: SaveState; className?: string }) {
  const { text, className: tone } = COPY[state]
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn('inline-flex items-center gap-1.5 text-xs', tone, className)}
    >
      {state === 'saving' && <Loader2 size={12} className="animate-spin" />}
      {state === 'saved' && <Check size={12} />}
      {state === 'error' && <AlertCircle size={12} />}
      {state === 'dirty' && <span className="h-1.5 w-1.5 rounded-full bg-amber/70" aria-hidden />}
      {text}
    </span>
  )
}
