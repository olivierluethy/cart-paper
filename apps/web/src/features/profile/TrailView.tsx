import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { CornerDownRight, MessageSquareQuote, Route, StickyNote } from 'lucide-react'
import { RichTextView } from '@/components/RichText'
import { AttachmentRow } from '@/features/reader/NoteEditorModal'
import { NoteEditorModal } from '@/features/reader/NoteEditorModal'
import { CommentComposer } from '@/features/comments/CommentThreadView'
import { useCommentActions } from '@/features/comments/useComments'
import { EmptyState, Loading } from '@/components/States'
import { Button } from '@/components/Button'
import { api } from '@/lib/api'
import { useModal } from '@/lib/modal'
import { cn, formatDate, timeAgo } from '@/lib/utils'
import type { TrailEntry, TrailPage } from '@/lib/types'

type Filter = 'all' | 'comment' | 'note'

/**
 * The trail: every comment and note in the order it was written, each still
 * carrying the passage it was attached to and a link back to that exact line.
 * This is the "follow my whole thought process" view.
 */
export function TrailView() {
  const [filter, setFilter] = useState<Filter>('all')
  const [anchoredOnly, setAnchoredOnly] = useState(false)
  const [bookId, setBookId] = useState<string>('')

  const trail = useQuery({
    queryKey: ['trail', filter, anchoredOnly, bookId],
    queryFn: () => {
      const params = new URLSearchParams({ kind: filter, limit: '80' })
      if (anchoredOnly) params.set('anchored_only', 'true')
      if (bookId) params.set('book_id', bookId)
      return api.get<TrailPage>(`/users/me/trail?${params}`)
    },
  })

  const items = trail.data?.items ?? []
  const books = Array.from(
    new Map(items.map((entry) => [entry.book.id, entry.book])).values(),
  )

  return (
    <div>
      <div className="mb-7 flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-md border border-ink-line p-0.5">
          {(['all', 'comment', 'note'] as Filter[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={cn(
                'rounded px-3 py-1.5 text-xs capitalize transition-colors',
                filter === value ? 'bg-amber/15 text-amber' : 'text-ink-muted hover:text-ink-text',
              )}
            >
              {value === 'all' ? 'Everything' : value === 'comment' ? 'Comments' : 'Notes'}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setAnchoredOnly((value) => !value)}
          data-active={anchoredOnly}
          className="chip"
        >
          <MessageSquareQuote size={12} />
          Anchored to a passage
        </button>

        {books.length > 1 && (
          <select
            value={bookId}
            onChange={(event) => setBookId(event.target.value)}
            aria-label="Filter by book"
            className="h-8 rounded-md border border-ink-line bg-ink-raised px-2 text-xs text-ink-text outline-none focus:border-amber/60"
          >
            <option value="">Every book</option>
            {books.map((book) => (
              <option key={book.id} value={book.id}>
                {book.title}
              </option>
            ))}
          </select>
        )}

        <span className="ml-auto text-xs text-ink-faint">
          {trail.data ? `${trail.data.total} entries` : ''}
        </span>
      </div>

      {trail.isLoading ? (
        <Loading />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Route}
          title="Your trail is empty"
          body="Comment on a passage or keep a note while you read, and every step shows up here in order — with the line that prompted it."
        />
      ) : (
        <ol className="relative space-y-0 border-l border-ink-line pl-6">
          {items.map((entry, index) => (
            <TrailRow
              key={`${entry.kind}-${entry.comment?.id ?? entry.note?.id ?? index}`}
              entry={entry}
              showDate={
                index === 0 ||
                new Date(entry.at).toDateString() !== new Date(items[index - 1]!.at).toDateString()
              }
              onChanged={() => trail.refetch()}
            />
          ))}
        </ol>
      )}
    </div>
  )
}

function TrailRow({
  entry,
  showDate,
  onChanged,
}: {
  entry: TrailEntry
  showDate: boolean
  onChanged: () => void
}) {
  const { open, confirm } = useModal()
  const actions = useCommentActions(entry.book.slug)
  const [editing, setEditing] = useState(false)
  const [replying, setReplying] = useState(false)

  const jump =
    entry.page_index !== null
      ? `/read/${entry.book.slug}?p=${entry.page_index + 1}${
          entry.kind === 'comment' && entry.comment ? `&c=${entry.comment.thread_id ?? entry.comment.id}` : ''
        }`
      : `/books/${entry.book.slug}`

  return (
    <li className="relative pb-8">
      {showDate && (
        <p className="mb-3 -ml-6 pl-6 text-2xs uppercase tracking-[0.14em] text-ink-faint">
          {formatDate(entry.at)}
        </p>
      )}

      <span
        aria-hidden
        className={cn(
          'absolute -left-[1.6rem] top-1 grid h-5 w-5 place-items-center rounded-full border bg-ink-bg',
          entry.kind === 'comment' ? 'border-teal/60 text-teal-soft' : 'border-amber/50 text-amber',
        )}
      >
        {entry.kind === 'comment' ? <MessageSquareQuote size={10} /> : <StickyNote size={10} />}
      </span>

      <div className="rounded-lg border border-ink-line p-4">
        <header className="mb-2.5 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs">
          <Link to={`/books/${entry.book.slug}`} className="font-display text-sm text-ink-text hover:text-amber">
            {entry.book.title}
          </Link>
          {entry.page_index !== null && <span className="text-ink-faint">page {entry.page_index + 1}</span>}
          <span className="text-ink-faint">· {timeAgo(entry.at)}</span>
          <Link
            to={jump}
            className="ml-auto text-2xs uppercase tracking-wide text-amber underline-offset-4 hover:underline"
          >
            Open at this passage
          </Link>
        </header>

        {entry.quote && (
          <blockquote
            className={cn(
              'mb-3 border-l-2 pl-3 font-read text-sm italic leading-relaxed text-ink-muted',
              entry.kind === 'comment' ? 'border-teal/60' : 'border-amber/50',
            )}
          >
            {entry.quote}
          </blockquote>
        )}

        {entry.reply_to && (
          <p className="mb-2 flex items-start gap-1.5 text-xs text-ink-faint">
            <CornerDownRight size={12} className="mt-0.5 shrink-0" />
            <span className="line-clamp-1">
              replying to {entry.reply_to.author ?? 'a deleted comment'} — “{entry.reply_to.excerpt}”
            </span>
          </p>
        )}

        {entry.kind === 'comment' && entry.comment && (
          <>
            {editing ? (
              <CommentComposer
                initial={entry.comment.body}
                submitLabel="Save"
                busy={actions.edit.isPending}
                onCancel={() => setEditing(false)}
                onSubmit={async (body) => {
                  await actions.edit.mutateAsync({ id: entry.comment!.id, body })
                  setEditing(false)
                  onChanged()
                }}
              />
            ) : (
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-text/90">
                {entry.comment.body}
              </p>
            )}

            {!editing && (
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                <button type="button" onClick={() => setReplying((v) => !v)} className="text-ink-faint hover:text-amber">
                  Reply
                </button>
                <button type="button" onClick={() => setEditing(true)} className="text-ink-faint hover:text-amber">
                  Edit
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await confirm({
                      title: 'Delete this comment?',
                      body: 'If it has replies it stays as a [deleted] marker so the thread still reads.',
                      confirmLabel: 'Delete',
                      destructive: true,
                    })
                    if (ok) {
                      await actions.remove.mutateAsync(entry.comment!.id)
                      onChanged()
                    }
                  }}
                  className="text-ink-faint hover:text-danger"
                >
                  Delete
                </button>
              </div>
            )}

            {replying && (
              <div className="mt-3">
                <CommentComposer
                  mention={entry.comment.author?.display_name ?? null}
                  placeholder="Reply…"
                  busy={actions.create.isPending}
                  onCancel={() => setReplying(false)}
                  onSubmit={async (body) => {
                    await actions.create.mutateAsync({ body, parent_id: entry.comment!.id })
                    setReplying(false)
                    onChanged()
                  }}
                />
              </div>
            )}
          </>
        )}

        {entry.kind === 'note' && entry.note && (
          <>
            <RichTextView value={entry.note.body} />
            {entry.note.attachments.length > 0 && (
              <ul className="mt-2.5 space-y-1.5">
                {entry.note.attachments.map((attachment) => (
                  <AttachmentRow key={attachment.id} attachment={attachment} />
                ))}
              </ul>
            )}
            <div className="mt-3">
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  open(({ close }) => (
                    <NoteEditorModal
                      bookRef={entry.book.slug}
                      note={entry.note}
                      onDone={() => {
                        close()
                        onChanged()
                      }}
                    />
                  ))
                }
              >
                Edit note
              </Button>
            </div>
          </>
        )}
      </div>
    </li>
  )
}
