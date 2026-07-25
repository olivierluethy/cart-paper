import { Lock, MessageSquare, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * One vocabulary for "private note" vs "public discussion", used by the
 * selection toolbar, the margin markers, the side-panel tabs, the composers and
 * the profile views. Icon + accent colour + label always travel together — a
 * reader should never have to work out who can see something.
 *
 * Private is amber and lives in the left margin; public is teal and lives in
 * the right. The spatial split reinforces the colour one.
 */
export const PRIVACY = {
  private: {
    label: 'Private note',
    full: 'Private note · only you',
    hint: 'Only you can see this.',
    placeholder: 'Private note — only you can see this.',
    Icon: Pencil,
    LockIcon: Lock,
    accent: 'text-amber',
    border: 'border-amber/50',
    bg: 'bg-amber/10',
    dot: 'bg-amber',
  },
  public: {
    label: 'Public discussion',
    full: 'Public discussion · everyone can see this',
    hint: 'Everyone reading this passage can see it.',
    placeholder: 'What do you make of this line? Everyone can see this.',
    Icon: MessageSquare,
    LockIcon: MessageSquare,
    accent: 'text-teal-soft',
    border: 'border-teal/60',
    bg: 'bg-teal/10',
    dot: 'bg-teal',
  },
} as const

export type Visibility = keyof typeof PRIVACY

/** The full "who can see this" line. Used above every composer. */
export function VisibilityBanner({
  visibility,
  className,
}: {
  visibility: Visibility
  className?: string
}) {
  const v = PRIVACY[visibility]
  return (
    <p
      className={cn(
        'flex items-center gap-2 rounded-md border px-3 py-2 text-xs',
        v.border,
        v.bg,
        v.accent,
        className,
      )}
    >
      <v.LockIcon size={13} className="shrink-0" />
      <span className="font-medium">{v.full}</span>
    </p>
  )
}

/** Compact inline marker: icon + label, for panel headers and list rows. */
export function VisibilityTag({
  visibility,
  short,
  className,
}: {
  visibility: Visibility
  short?: boolean
  className?: string
}) {
  const v = PRIVACY[visibility]
  return (
    <span className={cn('inline-flex items-center gap-1 text-2xs', v.accent, className)}>
      <v.Icon size={10} />
      {short ? v.label : v.full}
    </span>
  )
}
