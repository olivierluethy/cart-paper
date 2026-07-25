import { Highlighter, StickyNote, Unlink } from 'lucide-react'
import { RichTextView } from '@/components/RichText'
import { EmptyState } from '@/components/States'
import { AttachmentRow } from '@/features/reader/NoteEditorModal'
import { quoteExcerpt } from '@/lib/anchor'
import { cn, timeAgo } from '@/lib/utils'
import type { Anchor, Highlight, HighlightColor, Note, UUID } from '@/lib/types'

const DOT: Record<HighlightColor, string> = {
  yellow: 'bg-[rgb(214_176_74/0.8)]',
  green: 'bg-[rgb(118_163_106/0.8)]',
  blue: 'bg-[rgb(98_141_192/0.85)]',
  pink: 'bg-[rgb(199_118_154/0.8)]',
  red: 'bg-[rgb(197_96_84/0.8)]',
  purple: 'bg-[rgb(148_118_196/0.85)]',
  black: 'bg-[rgb(120_115_108/0.9)]',
}

type Props = {
  notes: Note[]
  highlights: Highlight[]
  pageIndexOf: (pageId: UUID | null) => number | null
  /** Overrides the page label — the PDF reader numbers by document page. */
  pageLabelOf?: (anchor: Anchor | null | undefined) => string | null
  /** Ids whose passage no longer exists on its page — shown here, never inline. */
  orphanIds: Set<string>
  activeId: string | null
  onOpenNote: (note: Note) => void
  onGoTo: (pageId: UUID | null, id: string) => void
  onNewNoteFor: (highlight: Highlight) => void
}

export function NotesPanel({
  notes,
  highlights,
  pageIndexOf,
  pageLabelOf,
  orphanIds,
  activeId,
  onOpenNote,
  onGoTo,
  onNewNoteFor,
}: Props) {
  const label = (pageId: UUID | null, anchor: Anchor | null | undefined) => {
    if (pageLabelOf) return pageLabelOf(anchor)
    const index = pageIndexOf(pageId)
    return index === null ? null : `Page ${index + 1}`
  }
  const noteHighlightIds = new Set(notes.map((note) => note.highlight_id).filter(Boolean))
  const bare = highlights.filter((highlight) => !noteHighlightIds.has(highlight.id))

  if (notes.length === 0 && highlights.length === 0) {
    return (
      <EmptyState
        icon={StickyNote}
        title="Nothing marked yet"
        body="Select any passage while you read to highlight it, keep a private note beside it, or open a discussion on that exact line."
        className="m-4 border-none py-10"
      />
    )
  }

  return (
    <div className="space-y-6 p-4">
      {notes.length > 0 && (
        <section>
          <h3 className="label mb-3">Notes · {notes.length}</h3>
          <ul className="space-y-2.5">
            {notes.map((note) => {
              const orphaned = orphanIds.has(note.id)
              const page = label(note.page_id, note.anchor)
              return (
                <li key={note.id}>
                  <article
                    className={cn(
                      'rounded-md border p-3 transition-colors',
                      activeId === note.id
                        ? 'border-amber/50 bg-amber/[0.06]'
                        : 'border-ink-line hover:border-ink-muted/40',
                    )}
                  >
                    <header className="mb-2 flex items-center gap-2 text-2xs text-ink-faint">
                      {note.highlight_color && (
                        <span className={cn('h-2 w-2 rounded-full', DOT[note.highlight_color])} aria-hidden />
                      )}
                      {page && <span>{page}</span>}
                      <span>·</span>
                      <span>{timeAgo(note.updated_at)}</span>
                      {orphaned && (
                        <span
                          className="ml-auto inline-flex items-center gap-1 text-amber/80"
                          title="The passage this note was attached to has changed. The note is kept here."
                        >
                          <Unlink size={11} />
                          orphaned
                        </span>
                      )}
                    </header>

                    {note.anchor?.quote && (
                      <button
                        type="button"
                        onClick={() => onGoTo(note.page_id, note.id)}
                        disabled={orphaned}
                        className="mb-2 block w-full border-l-2 border-ink-line pl-2.5 text-left font-read text-xs italic leading-relaxed text-ink-muted transition-colors enabled:hover:border-amber/60 enabled:hover:text-ink-text disabled:cursor-default"
                      >
                        {quoteExcerpt(note.anchor, 120)}
                      </button>
                    )}

                    <RichTextView value={note.body} />

                    <button
                      type="button"
                      onClick={() => onOpenNote(note)}
                      className="mt-2 text-2xs text-ink-faint underline-offset-2 transition-colors hover:text-amber hover:underline"
                    >
                      Edit this note
                    </button>

                    {note.attachments.length > 0 && (
                      <ul className="mt-2.5 space-y-1.5">
                        {note.attachments.map((attachment) => (
                          <AttachmentRow key={attachment.id} attachment={attachment} />
                        ))}
                      </ul>
                    )}
                  </article>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {bare.length > 0 && (
        <section>
          <h3 className="label mb-3">Highlights · {bare.length}</h3>
          <ul className="space-y-1.5">
            {bare.map((highlight) => {
              const orphaned = orphanIds.has(highlight.id)
              const page = label(highlight.page_id, highlight.anchor)
              return (
                <li key={highlight.id} className="group/hl rounded-md border border-ink-line p-2.5">
                  <div className="mb-1.5 flex items-center gap-2 text-2xs text-ink-faint">
                    <span className={cn('h-2 w-2 rounded-full', DOT[highlight.color])} aria-hidden />
                    {page && <span>{page}</span>}
                    {orphaned && (
                      <span className="ml-auto inline-flex items-center gap-1 text-amber/80">
                        <Unlink size={11} />
                        orphaned
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => onGoTo(highlight.page_id, highlight.id)}
                    disabled={orphaned}
                    className="block w-full text-left font-read text-sm italic leading-relaxed text-ink-text/85 transition-colors enabled:hover:text-amber disabled:cursor-default"
                  >
                    {quoteExcerpt(highlight.anchor, 160)}
                  </button>
                  <button
                    type="button"
                    onClick={() => onNewNoteFor(highlight)}
                    className="mt-2 inline-flex items-center gap-1.5 text-2xs text-ink-faint opacity-0 transition-opacity hover:text-amber focus:opacity-100 group-hover/hl:opacity-100"
                  >
                    <Highlighter size={11} />
                    Add a note to this
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}
