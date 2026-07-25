import { MessageSquareQuote, Unlink } from 'lucide-react'
import { CommentThreadView } from '@/features/comments/CommentThreadView'
import { EmptyState } from '@/components/States'
import { cn } from '@/lib/utils'
import type { CommentThread, UUID } from '@/lib/types'

export function DiscussionPanel({
  bookRef,
  invite,
  threads,
  pageIndexOf,
  orphanIds,
  activeId,
  onGoTo,
}: {
  bookRef: string
  invite?: string | null
  threads: CommentThread[]
  pageIndexOf: (pageId: UUID | null) => number | null
  orphanIds: Set<string>
  activeId: string | null
  onGoTo: (pageId: UUID | null, id: string) => void
}) {
  if (threads.length === 0) {
    return (
      <EmptyState
        icon={MessageSquareQuote}
        title="No passage has been discussed yet"
        body="Select any sentence and choose “Comment on this passage”. The thread stays attached to that line for every reader who finds it."
        className="m-4 border-none py-10"
      />
    )
  }

  return (
    <ul className="space-y-3 p-4">
      {threads.map((thread) => {
        const anchored = Boolean(thread.root.anchor?.quote)
        const orphaned = orphanIds.has(thread.root.id)
        const page = pageIndexOf(thread.root.page_id)
        return (
          <li key={thread.root.id}>
            <div
              className={cn(
                'rounded-lg border transition-colors',
                activeId === thread.root.id ? 'border-teal/60 bg-teal/[0.06]' : 'border-transparent',
              )}
            >
              <div className="flex items-center gap-2 px-1 pb-1.5 pt-1 text-2xs text-ink-faint">
                {anchored ? (
                  <>
                    <MessageSquareQuote size={11} />
                    {page !== null && <span>Page {page + 1}</span>}
                    {!orphaned && (
                      <button
                        type="button"
                        onClick={() => onGoTo(thread.root.page_id, thread.root.id)}
                        className="text-teal-soft underline-offset-2 hover:underline"
                      >
                        jump to the line
                      </button>
                    )}
                    {orphaned && (
                      <span className="inline-flex items-center gap-1 text-amber/80">
                        <Unlink size={11} />
                        the passage has changed
                      </span>
                    )}
                  </>
                ) : (
                  <span>About the book</span>
                )}
              </div>
              <CommentThreadView
                bookRef={bookRef}
                invite={invite}
                thread={thread}
                showQuote={anchored}
                compact
              />
            </div>
          </li>
        )
      })}
    </ul>
  )
}
