import { useMemo, useRef, useState } from 'react'
import {
  AlignLeft,
  Code2,
  Feather,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Lightbulb,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Pilcrow,
  Quote,
  type LucideIcon,
} from 'lucide-react'
import type { SlashController, SlashItem, SlashState } from '@/features/editor/extensions/SlashCommand'
import { cn } from '@/lib/utils'

const ICONS: Record<string, LucideIcon> = {
  AlignLeft,
  Code2,
  Feather,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Lightbulb,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Pilcrow,
  Quote,
}

export function useSlashMenu() {
  const [state, setState] = useState<SlashState | null>(null)
  const [index, setIndex] = useState(0)
  const stateRef = useRef<SlashState | null>(null)
  const indexRef = useRef(0)

  const controller = useMemo<SlashController>(() => {
    const apply = (next: SlashState, resetIndex: boolean) => {
      stateRef.current = next
      const bounded = resetIndex ? 0 : Math.min(indexRef.current, Math.max(0, next.items.length - 1))
      indexRef.current = bounded
      setState(next)
      setIndex(bounded)
    }
    const close = () => {
      stateRef.current = null
      setState(null)
    }

    return {
      onOpen: (next) => apply(next, true),
      onUpdate: (next) => apply(next, false),
      onClose: close,
      onKeyDown: (event) => {
        const current = stateRef.current
        if (!current || current.items.length === 0) return false
        const count = current.items.length
        if (event.key === 'ArrowDown') {
          indexRef.current = (indexRef.current + 1) % count
          setIndex(indexRef.current)
          return true
        }
        if (event.key === 'ArrowUp') {
          indexRef.current = (indexRef.current - 1 + count) % count
          setIndex(indexRef.current)
          return true
        }
        if (event.key === 'Enter' || event.key === 'Tab') {
          const item = current.items[indexRef.current]
          if (item) {
            current.select(item)
            return true
          }
        }
        if (event.key === 'Escape') {
          close()
          return true
        }
        return false
      },
    }
  }, [])

  const menu =
    state && state.items.length > 0 && state.rect ? (
      <SlashMenu state={state} activeIndex={index} onHover={setIndex} />
    ) : null

  return { controller, menu }
}

function SlashMenu({
  state,
  activeIndex,
  onHover,
}: {
  state: SlashState
  activeIndex: number
  onHover: (index: number) => void
}) {
  const rect = state.rect!
  // Flip above the caret when there is no room below.
  const below = window.innerHeight - rect.bottom > 300
  const style = below
    ? { left: rect.left, top: rect.bottom + 8 }
    : { left: rect.left, bottom: window.innerHeight - rect.top + 8 }

  return (
    <div
      role="listbox"
      aria-label="Insert block"
      style={{ position: 'fixed', ...style }}
      className="surface-raised z-50 max-h-[19rem] w-72 overflow-y-auto rounded-lg py-1.5"
    >
      {state.items.map((item: SlashItem, i) => {
        const Icon = ICONS[item.icon] ?? Pilcrow
        const active = i === activeIndex
        return (
          <button
            key={item.title}
            type="button"
            role="option"
            aria-selected={active}
            onMouseEnter={() => onHover(i)}
            onMouseDown={(event) => {
              event.preventDefault()
              state.select(item)
            }}
            className={cn(
              'flex w-full items-center gap-3 px-3 py-2 text-left transition-colors',
              active ? 'bg-amber/10' : 'hover:bg-ink-line/40',
            )}
          >
            <span
              className={cn(
                'inline-grid h-7 w-7 shrink-0 place-items-center rounded border',
                active ? 'border-amber/40 text-amber' : 'border-ink-line text-ink-muted',
              )}
            >
              <Icon size={14} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm text-ink-text">{item.title}</span>
              <span className="block truncate text-xs text-ink-faint">{item.hint}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
