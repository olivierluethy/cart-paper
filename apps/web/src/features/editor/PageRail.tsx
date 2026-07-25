import { useState } from 'react'
import { Copy, GripVertical, Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { IconButton } from '@/components/Button'
import type { PageSummary, UUID } from '@/lib/types'

type Props = {
  pages: PageSummary[]
  activeId: UUID | null
  onSelect: (id: UUID) => void
  onAdd: (afterIndex?: number) => void
  onDuplicate: (id: UUID) => void
  onDelete: (id: UUID) => void
  onReorder: (ids: UUID[]) => void
  titleFor: (page: PageSummary) => string
}

export function PageRail({
  pages,
  activeId,
  onSelect,
  onAdd,
  onDuplicate,
  onDelete,
  onReorder,
  titleFor,
}: Props) {
  const [dragId, setDragId] = useState<UUID | null>(null)
  const [overId, setOverId] = useState<UUID | null>(null)

  const drop = (targetId: UUID) => {
    if (!dragId || dragId === targetId) return
    const ids = pages.map((page) => page.id)
    const from = ids.indexOf(dragId)
    const to = ids.indexOf(targetId)
    ids.splice(to, 0, ids.splice(from, 1)[0]!)
    onReorder(ids)
  }

  /** Keyboard reorder — drag and drop cannot be the only way to move a page. */
  const move = (id: UUID, delta: number) => {
    const ids = pages.map((page) => page.id)
    const from = ids.indexOf(id)
    const to = from + delta
    if (to < 0 || to >= ids.length) return
    ids.splice(to, 0, ids.splice(from, 1)[0]!)
    onReorder(ids)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 py-3">
        <span className="label">Pages · {pages.length}</span>
        <IconButton label="Add page" onClick={() => onAdd()}>
          <Plus size={16} />
        </IconButton>
      </div>

      <ol className="flex-1 space-y-1 overflow-y-auto px-2 pb-4">
        {pages.map((page, index) => {
          const active = page.id === activeId
          return (
            <li
              key={page.id}
              draggable
              onDragStart={() => setDragId(page.id)}
              onDragEnd={() => {
                setDragId(null)
                setOverId(null)
              }}
              onDragOver={(event) => {
                event.preventDefault()
                setOverId(page.id)
              }}
              onDrop={(event) => {
                event.preventDefault()
                drop(page.id)
                setDragId(null)
                setOverId(null)
              }}
              className={cn(
                'group relative rounded-md border transition-colors',
                active
                  ? 'border-amber/45 bg-amber/[0.08]'
                  : 'border-transparent hover:border-ink-line hover:bg-ink-line/30',
                overId === page.id && dragId !== page.id && 'border-amber/60',
                dragId === page.id && 'opacity-40',
              )}
            >
              <button
                type="button"
                onClick={() => onSelect(page.id)}
                onKeyDown={(event) => {
                  if (!event.altKey) return
                  if (event.key === 'ArrowUp') {
                    event.preventDefault()
                    move(page.id, -1)
                  }
                  if (event.key === 'ArrowDown') {
                    event.preventDefault()
                    move(page.id, 1)
                  }
                }}
                aria-current={active ? 'true' : undefined}
                className="flex w-full items-start gap-2.5 px-2.5 py-2.5 text-left"
              >
                <GripVertical
                  size={14}
                  className="mt-0.5 shrink-0 cursor-grab text-ink-faint opacity-0 transition-opacity group-hover:opacity-100"
                  aria-hidden
                />
                <span className="w-5 shrink-0 pt-px text-right font-mono text-2xs text-ink-faint">
                  {index + 1}
                </span>
                <span
                  className={cn(
                    'line-clamp-2 flex-1 text-sm leading-snug',
                    active ? 'text-ink-text' : 'text-ink-muted',
                  )}
                >
                  {titleFor(page)}
                </span>
              </button>

              <div className="absolute right-1.5 top-1.5 flex gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                <IconButton
                  label={`Duplicate page ${index + 1}`}
                  className="h-7 w-7"
                  onClick={() => onDuplicate(page.id)}
                >
                  <Copy size={13} />
                </IconButton>
                <IconButton
                  label={`Delete page ${index + 1}`}
                  className="h-7 w-7 hover:text-danger"
                  onClick={() => onDelete(page.id)}
                >
                  <Trash2 size={13} />
                </IconButton>
              </div>
            </li>
          )
        })}
      </ol>

      <div className="border-t border-ink-line p-2">
        <button
          type="button"
          onClick={() => onAdd(pages.length)}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-ink-line py-2.5 text-xs text-ink-muted transition-colors hover:border-amber/40 hover:text-amber"
        >
          <Plus size={14} />
          New page
        </button>
        <p className="mt-2 px-1 text-2xs leading-relaxed text-ink-faint">
          Drag to reorder, or focus a page and use Alt + ↑ / ↓.
        </p>
      </div>
    </div>
  )
}
