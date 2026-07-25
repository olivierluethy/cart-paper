import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CornerDownRight, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { Avatar } from '@/components/Avatar'
import { Button } from '@/components/Button'
import { Menu, MenuItem } from '@/components/Menu'
import { useAuth } from '@/lib/auth'
import { useAuthGate } from '@/features/auth/useAuthGate'
import { useModal } from '@/lib/modal'
import { useCommentActions } from '@/features/comments/useComments'
import { quoteExcerpt } from '@/lib/anchor'
import { cn, timeAgo } from '@/lib/utils'
import type { Comment, CommentThread } from '@/lib/types'

type Props = {
  bookRef: string
  invite?: string | null
  thread: CommentThread
  /** Rendered above the thread when the discussion belongs to a passage. */
  showQuote?: boolean
  jumpTo?: string
  compact?: boolean
}

export function CommentThreadView({ bookRef, invite, thread, showQuote, jumpTo, compact }: Props) {
  const [replying, setReplying] = useState(false)
  const actions = useCommentActions(bookRef, invite)
  const { requireAuth } = useAuthGate()

  return (
    <article
      className={cn(
        'rounded-lg border border-ink-line',
        compact ? 'p-3' : 'p-4 sm:p-5',
      )}
    >
      {showQuote && thread.root.anchor?.quote && (
        <div className="mb-3.5 border-l-2 border-teal/70 pl-3">
          <p className="font-read text-sm italic leading-relaxed text-ink-muted">
            {quoteExcerpt(thread.root.anchor, 220)}
          </p>
          {jumpTo && (
            <Link
              to={jumpTo}
              className="mt-1.5 inline-block text-2xs uppercase tracking-wide text-teal-soft underline-offset-4 hover:underline"
            >
              Read it in place
            </Link>
          )}
        </div>
      )}

      <CommentRow bookRef={bookRef} invite={invite} comment={thread.root} compact={compact} />

      {thread.replies.length > 0 && (
        <ul className="mt-4 space-y-4 border-l border-ink-line pl-4">
          {thread.replies.map((reply) => (
            <li key={reply.id}>
              <CommentRow bookRef={bookRef} invite={invite} comment={reply} compact={compact} />
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3.5">
        {replying ? (
          <CommentComposer
            placeholder="Reply to this thread…"
            busy={actions.create.isPending}
            onCancel={() => setReplying(false)}
            onSubmit={async (body) => {
              await actions.create.mutateAsync({ body, parent_id: thread.root.id })
              setReplying(false)
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => void requireAuth(() => setReplying(true), 'Create an account to join the discussion.')}
            className="inline-flex items-center gap-1.5 text-xs text-ink-faint transition-colors hover:text-amber"
          >
            <CornerDownRight size={12} />
            Reply
            {thread.root.reply_count > 0 && (
              <span className="text-ink-faint">· {thread.root.reply_count}</span>
            )}
          </button>
        )}
      </div>
    </article>
  )
}

function CommentRow({
  bookRef,
  invite,
  comment,
  compact,
}: {
  bookRef: string
  invite?: string | null
  comment: Comment
  compact?: boolean
}) {
  const { user } = useAuth()
  const { confirm } = useModal()
  const actions = useCommentActions(bookRef, invite)
  const [editing, setEditing] = useState(false)
  const mine = user && comment.author && user.id === comment.author.id

  if (comment.is_deleted) {
    return (
      <p className="text-sm italic text-ink-faint">
        [deleted] — the replies below were kept.
      </p>
    )
  }

  return (
    <div className="flex gap-3">
      <Avatar user={comment.author} size={compact ? 'xs' : 'sm'} />
      <div className="min-w-0 flex-1">
        <header className="flex items-center gap-2 text-xs">
          {comment.author ? (
            <Link
              to={`/u/${comment.author.handle}`}
              className="font-medium text-ink-text hover:text-amber"
            >
              {comment.author.display_name}
            </Link>
          ) : (
            <span className="text-ink-faint">someone</span>
          )}
          <span className="text-ink-faint">{timeAgo(comment.created_at)}</span>
          {comment.edited_at && <span className="text-ink-faint">· edited</span>}

          {mine && (
            <Menu
              label="Comment actions"
              trigger={({ toggle, ref }) => (
                <button
                  ref={ref as never}
                  type="button"
                  onClick={toggle}
                  aria-label="Comment actions"
                  className="ml-auto rounded p-1 text-ink-faint transition-colors hover:bg-ink-line/60 hover:text-ink-text"
                >
                  <MoreHorizontal size={14} />
                </button>
              )}
            >
              {(close) => (
                <>
                  <MenuItem
                    icon={<Pencil size={14} />}
                    onClick={() => {
                      close()
                      setEditing(true)
                    }}
                  >
                    Edit
                  </MenuItem>
                  <MenuItem
                    icon={<Trash2 size={14} />}
                    danger
                    onClick={async () => {
                      close()
                      const ok = await confirm({
                        title: 'Delete this comment?',
                        body: 'If it has replies it stays as a [deleted] marker so the thread still reads.',
                        confirmLabel: 'Delete',
                        destructive: true,
                      })
                      if (ok) actions.remove.mutate(comment.id)
                    }}
                  >
                    Delete
                  </MenuItem>
                </>
              )}
            </Menu>
          )}
        </header>

        {editing ? (
          <div className="mt-2">
            <CommentComposer
              initial={comment.body}
              submitLabel="Save"
              busy={actions.edit.isPending}
              onCancel={() => setEditing(false)}
              onSubmit={async (body) => {
                await actions.edit.mutateAsync({ id: comment.id, body })
                setEditing(false)
              }}
            />
          </div>
        ) : (
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink-text/90">
            {comment.body}
          </p>
        )}
      </div>
    </div>
  )
}

export function CommentComposer({
  initial = '',
  placeholder = 'Say something about this book…',
  submitLabel = 'Post',
  busy,
  autoFocus = true,
  onSubmit,
  onCancel,
}: {
  initial?: string
  placeholder?: string
  submitLabel?: string
  busy?: boolean
  autoFocus?: boolean
  onSubmit: (body: string) => void | Promise<void>
  onCancel?: () => void
}) {
  const [value, setValue] = useState(initial)

  return (
    <div className="space-y-2">
      <textarea
        value={value}
        autoFocus={autoFocus}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && value.trim()) {
            event.preventDefault()
            void onSubmit(value.trim())
            setValue('')
          }
          if (event.key === 'Escape' && onCancel) onCancel()
        }}
        placeholder={placeholder}
        rows={3}
        className="field min-h-[4.5rem] resize-y leading-relaxed"
      />
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="primary"
          loading={busy}
          disabled={!value.trim()}
          onClick={async () => {
            await onSubmit(value.trim())
            setValue('')
          }}
        >
          {submitLabel}
        </Button>
        {onCancel && (
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <span className="ml-auto text-2xs text-ink-faint">⌘↵ to post</span>
      </div>
    </div>
  )
}
