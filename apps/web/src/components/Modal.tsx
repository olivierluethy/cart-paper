import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { motion } from 'motion/react'
import { cn } from '@/lib/utils'

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'

type Props = {
  title: string
  /** Rendered under the title. Keep it to one line. */
  description?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /** Hide the visible title but keep it for screen readers. */
  hideTitle?: boolean
}

const SIZES = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
}

export function Modal({
  title,
  description,
  onClose,
  children,
  footer,
  size = 'md',
  hideTitle,
}: Props) {
  const panel = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descId = useId()

  // onClose is almost always an inline arrow from the caller, so it changes
  // identity on every render. Keeping it in a ref is what allows the effects
  // below to run once instead of on every keystroke.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  // Mount only. This effect moves focus, and re-running it while the user is
  // typing would yank the caret back to the first field after each character.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    const node = panel.current
    // Focus the first meaningful control, not the close button.
    const focusable = node?.querySelectorAll<HTMLElement>(FOCUSABLE)
    const target = Array.from(focusable ?? []).find((el) => !el.hasAttribute('data-modal-close'))
    ;(target ?? node)?.focus()

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
      previouslyFocused?.focus?.()
    }
  }, [])

  // Escape + focus trap. Reads onClose through the ref, so it never re-binds.
  useEffect(() => {
    const node = panel.current
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab' || !node) return
      const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null,
      )
      if (items.length === 0) return
      const firstItem = items[0]!
      const lastItem = items[items.length - 1]!
      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault()
        lastItem.focus()
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault()
        firstItem.focus()
      }
    }

    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <motion.div
        className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.16 }}
        onClick={onClose}
        aria-hidden
      />
      <motion.div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        initial={{ opacity: 0, y: 12, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.99 }}
        transition={{ duration: 0.22, ease: [0.22, 0.61, 0.36, 1] }}
        className={cn(
          'surface-raised relative m-0 w-full rounded-t-2xl sm:m-4 sm:rounded-xl',
          'max-h-[92dvh] overflow-hidden outline-none',
          SIZES[size],
        )}
      >
        <header className="flex items-start gap-4 border-b border-ink-line px-6 py-5">
          <div className="min-w-0 flex-1">
            <h2
              id={titleId}
              className={cn(
                'font-display text-xl font-semibold text-ink-text',
                hideTitle && 'sr-only',
              )}
            >
              {title}
            </h2>
            {description && (
              <p id={descId} className="mt-1 text-sm text-ink-muted">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            data-modal-close
            onClick={onClose}
            aria-label="Close"
            className="-mr-1.5 -mt-1 rounded-md p-1.5 text-ink-muted transition-colors hover:bg-ink-line/60 hover:text-ink-text"
          >
            <X size={18} />
          </button>
        </header>

        <div className="max-h-[calc(92dvh-9rem)] overflow-y-auto px-6 py-5">{children}</div>

        {footer && (
          <footer className="flex items-center justify-end gap-2 border-t border-ink-line bg-ink-surface/60 px-6 py-4">
            {footer}
          </footer>
        )}
      </motion.div>
    </div>
  )
}
