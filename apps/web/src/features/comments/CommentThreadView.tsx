import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, CornerDownRight, Pencil, Reply, Trash2, X } from 'lucide-react'
import { Avatar } from '@/components/Avatar'
import { Button } from '@/components/Button'
import { useAuth } from '@/lib/auth'
import { useAuthGate } from '@/features/auth/useAuthGate'
import { useModal } from '@/lib/modal'
import { useCommentActions } from '@/features/comments/useComments'
import { quoteExcerpt } from '@/lib/anchor'
import { cn, timeAgo } from '@/lib/utils'
import type { Comment, CommentThread } from '@/lib/types'

/** Indentation stops at this depth; deeper replies render flat with a back-reference. */
const MAX_NESTING = 3

type TreeNode = { comment: Comment; children: TreeNode[] }

function buildTree(thread: CommentThread): TreeNode {
  const byParent = new Map<string, Comment[]>()
  for (const reply of thread.replies) {
    const key = reply.parent_id ?? thread.root.id
    byParent.set(key, [...(byParent.get(key) ?? []), reply])
  }
  const attach = (comment: Comment): TreeNode => ({
    comment,
    children: (byParent.get(comment.id) ?? [])
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map(attach),
  })
  return attach(thread.root)
}

function countDescendants(node: TreeNode): number {
  return node.children.reduce((total, child) => total + 1 + countDescendants(child), 0)
}

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
  const tree = useMemo(() => buildTree(thread), [thread])

  return (
    <article className={cn('rounded-lg border border-ink-line', compact ? 'p-3' : 'p-4 sm:p-5')}>
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

      <CommentNode node={tree} depth={0} bookRef={bookRef} invite={invite} compact={compact} />
    </article>
  )
}

function CommentNode({
  node,
  depth,
  bookRef,
  invite,
  compact,
  parentAuthor,
}: {
  node: TreeNode
  depth: number
  bookRef: string
  invite?: string | null
  compact?: boolean
  parentAuthor?: string | null
}) {
  const { comment, children } = node
  const { user } = useAuth()
  const { requireAuth } = useAuthGate()
  const { confirm } = useModal()
  const actions = useCommentActions(bookRef, invite)

  const [replying, setReplying] = useState(false)
  const [editing, setEditing] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const row = useRef<HTMLDivElement>(null)

  const mine = Boolean(user && comment.author && user.id === comment.author.id)
  const descendants = countDescendants(node)
  const nested = depth < MAX_NESTING

  return (
    <div
      ref={row}
      id={`comment-${comment.id}`}
      tabIndex={0}
      onKeyDown={(event) => {
        // `r` replies to whichever comment has focus.
        if (event.key === 'r' && !replying && !editing && event.target === row.current) {
          event.preventDefault()
          void requireAuth(() => setReplying(true), 'Create an account to join the discussion.')
        }
      }}
      className="scroll-mt-24 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-amber/50"
    >
      {comment.is_deleted ? (
        <p className="text-sm italic text-ink-faint">[deleted] — the replies below were kept.</p>
      ) : (
        <div className="flex gap-3">
          <Avatar user={comment.author} size={compact ? 'xs' : 'sm'} />
          <div className="min-w-0 flex-1">
            <header className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
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
            </header>

            {/* Past the nesting limit the thread flattens, so each reply says
                what it is answering and links back to it. */}
            {!nested && parentAuthor && (
              <a
                href={`#comment-${comment.parent_id}`}
                className="mt-1 inline-flex items-center gap-1 text-2xs text-ink-faint underline-offset-2 hover:text-amber hover:underline"
              >
                <CornerDownRight size={10} />
                replying to @{parentAuthor}
              </a>
            )}

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
      )}

      {/* Always visible — hover-only actions do not exist on touch. */}
      {!editing && (
        <div className={cn('mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs', !comment.is_deleted && 'pl-[calc(theme(spacing.3)+2rem)]', compact && !comment.is_deleted && 'pl-[calc(theme(spacing.3)+1.5rem)]')}>
          {!comment.is_deleted && (
            <button
              type="button"
              onClick={() =>
                void requireAuth(
                  () => setReplying((value) => !value),
                  'Create an account to join the discussion.',
                )
              }
              className="inline-flex items-center gap-1 text-ink-faint transition-colors hover:text-amber"
            >
              <Reply size={11} />
              Reply
            </button>
          )}
          {mine && (
            <>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="inline-flex items-center gap-1 text-ink-faint transition-colors hover:text-amber"
              >
                <Pencil size={11} />
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
                  if (ok) actions.remove.mutate(comment.id)
                }}
                className="inline-flex items-center gap-1 text-ink-faint transition-colors hover:text-danger"
              >
                <Trash2 size={11} />
                Delete
              </button>
            </>
          )}

          {/* Separate from Reply: this only expands or collapses the subtree. */}
          {descendants > 0 && (
            <button
              type="button"
              onClick={() => setCollapsed((value) => !value)}
              aria-expanded={!collapsed}
              className="inline-flex items-center gap-1 text-ink-faint transition-colors hover:text-ink-text"
            >
              <ChevronDown size={11} className={cn('transition-transform', collapsed && '-rotate-90')} />
              {descendants} {descendants === 1 ? 'reply' : 'replies'}
            </button>
          )}
        </div>
      )}

      {replying && (
        <div className={cn('mt-3', nested && 'ml-11')}>
          <CommentComposer
            mention={comment.author?.display_name ?? null}
            placeholder="Reply…"
            busy={actions.create.isPending}
            onCancel={() => setReplying(false)}
            onSubmit={async (body) => {
              await actions.create.mutateAsync({ body, parent_id: comment.id })
              setReplying(false)
            }}
          />
        </div>
      )}

      {children.length > 0 && !collapsed && (
        <ul className={cn('mt-4 space-y-4', nested ? 'border-l border-ink-line pl-4' : 'pl-0')}>
          {children.map((child) => (
            <li key={child.comment.id}>
              <CommentNode
                node={child}
                depth={depth + 1}
                bookRef={bookRef}
                invite={invite}
                compact={compact}
                parentAuthor={comment.author?.display_name ?? null}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function CommentComposer({
  initial = '',
  mention,
  placeholder = 'Say something about this book…',
  submitLabel = 'Post',
  busy,
  autoFocus = true,
  onSubmit,
  onCancel,
}: {
  initial?: string
  /** Shown as a removable chip; prefixes the posted body with @Name. */
  mention?: string | null
  placeholder?: string
  submitLabel?: string
  busy?: boolean
  autoFocus?: boolean
  onSubmit: (body: string) => void | Promise<void>
  onCancel?: () => void
}) {
  const [value, setValue] = useState(initial)
  const [chip, setChip] = useState<string | null>(mention ?? null)

  const send = async () => {
    const body = `${chip ? `@${chip} ` : ''}${value.trim()}`.trim()
    if (!body) return
    await onSubmit(body)
    setValue('')
  }

  return (
    <div className="space-y-2">
      {chip && (
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full border border-teal/50 bg-teal/10 px-2 py-0.5 text-2xs text-teal-soft">
            @{chip}
            <button
              type="button"
              onClick={() => setChip(null)}
              aria-label={`Do not mention ${chip}`}
              className="rounded-full transition-colors hover:text-ink-text"
            >
              <X size={10} />
            </button>
          </span>
        </div>
      )}
      <textarea
        value={value}
        autoFocus={autoFocus}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
            event.preventDefault()
            void send()
          }
          if (event.key === 'Escape' && onCancel) {
            event.stopPropagation()
            onCancel()
          }
        }}
        placeholder={placeholder}
        rows={3}
        className="field min-h-[4.5rem] resize-y leading-relaxed"
      />
      <div className="flex items-center gap-2">
        <Button size="sm" variant="primary" loading={busy} disabled={!value.trim()} onClick={send}>
          {submitLabel}
        </Button>
        {onCancel && (
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <span className="ml-auto text-2xs text-ink-faint">⌘↵ post · Esc cancel</span>
      </div>
    </div>
  )
}
