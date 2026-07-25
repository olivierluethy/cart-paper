import { Loader2, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Spinner({ className, label = 'Loading' }: { className?: string; label?: string }) {
  return (
    <span role="status" aria-label={label} className={cn('inline-flex text-ink-faint', className)}>
      <Loader2 size={16} className="animate-spin" />
    </span>
  )
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2.5 py-16 text-sm text-ink-faint">
      <Spinner />
      {label}
    </div>
  )
}

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  className,
}: {
  icon?: LucideIcon
  title: string
  body?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border border-dashed border-ink-line/80 px-6 py-14 text-center',
        className,
      )}
    >
      {Icon && (
        <span className="mb-4 inline-grid h-11 w-11 place-items-center rounded-full border border-ink-line bg-ink-raised text-ink-faint">
          <Icon size={18} />
        </span>
      )}
      <h3 className="font-display text-lg font-semibold text-ink-text">{title}</h3>
      {body && <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-muted">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function ErrorState({
  title = 'That did not load',
  body,
  onRetry,
}: {
  title?: string
  body?: ReactNode
  onRetry?: () => void
}) {
  return (
    <div className="rounded-lg border border-danger/30 bg-danger/[0.06] px-5 py-6 text-center">
      <h3 className="font-display text-base font-semibold text-ink-text">{title}</h3>
      {body && <p className="mt-1.5 text-sm text-ink-muted">{body}</p>}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 text-sm text-amber underline-offset-4 hover:underline"
        >
          Try again
        </button>
      )}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('block animate-pulse rounded-md bg-ink-line/50', className)}
    />
  )
}
