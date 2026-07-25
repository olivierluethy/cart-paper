import { MessageSquare, MessageSquareQuote } from 'lucide-react'
import { CommentComposer, CommentThreadView } from '@/features/comments/CommentThreadView'
import { useAllComments, useBookComments, useCommentActions } from '@/features/comments/useComments'
import { useAuthGate } from '@/features/auth/useAuthGate'
import { EmptyState, Loading } from '@/components/States'
import { pluralize } from '@/lib/utils'
import type { BookDetail, CommentThread } from '@/lib/types'

export function BookComments({
  book,
  invite,
  pageIndexOf,
}: {
  book: BookDetail
  invite?: string | null
  pageIndexOf: (pageId: string | null) => number | null
}) {
  const bookThreads = useBookComments(book.slug, invite)
  const allThreads = useAllComments(book.slug, invite)
  const actions = useCommentActions(book.slug, invite)
  const { user, requireAuth } = useAuthGate()

  const anchored = (allThreads.data ?? []).filter((thread) => thread.root.anchor?.quote)

  return (
    <div className="mt-16 border-t border-ink-line pt-12">
      <div className="grid gap-12 lg:grid-cols-2">
        <section>
          <h2 className="mb-1 font-display text-xl font-semibold text-ink-text">
            About the book
          </h2>
          <p className="mb-6 text-sm text-ink-faint">
            The whole-book conversation. For a single line, open the reader and select it.
          </p>

          {user ? (
            <div className="mb-7">
              <CommentComposer
                autoFocus={false}
                busy={actions.create.isPending}
                onSubmit={async (body) => {
                  await actions.create.mutateAsync({ body })
                }}
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => void requireAuth(() => undefined, 'Create an account to comment.')}
              className="mb-7 w-full rounded-md border border-dashed border-ink-line px-4 py-4 text-left text-sm text-ink-muted transition-colors hover:border-amber/40 hover:text-ink-text"
            >
              Sign in to leave a comment — it takes one step.
            </button>
          )}

          {bookThreads.isLoading ? (
            <Loading />
          ) : (bookThreads.data ?? []).length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title="No comments yet"
              body="Be the first to say something about this book as a whole."
              className="py-10"
            />
          ) : (
            <ul className="space-y-4">
              {bookThreads.data!.map((thread) => (
                <li key={thread.root.id}>
                  <CommentThreadView bookRef={book.slug} invite={invite} thread={thread} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-1 font-display text-xl font-semibold text-ink-text">
            Anchored to a passage
          </h2>
          <p className="mb-6 text-sm text-ink-faint">
            {anchored.length > 0
              ? `${pluralize(anchored.length, 'discussion')} attached to an exact line.`
              : 'Nothing yet — select a passage while reading to start one.'}
          </p>

          {allThreads.isLoading ? (
            <Loading />
          ) : anchored.length === 0 ? (
            <EmptyState
              icon={MessageSquareQuote}
              title="No line has been argued with yet"
              body="Open the book, select any sentence, and the discussion you start there will be waiting for the next reader."
              className="py-10"
            />
          ) : (
            <ul className="space-y-4">
              {anchored.map((thread: CommentThread) => {
                const page = pageIndexOf(thread.root.page_id)
                return (
                  <li key={thread.root.id}>
                    <CommentThreadView
                      bookRef={book.slug}
                      invite={invite}
                      thread={thread}
                      showQuote
                      compact
                      jumpTo={`/read/${book.slug}?p=${(page ?? 0) + 1}&c=${thread.root.id}${
                        invite ? `&invite=${invite}` : ''
                      }`}
                    />
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
