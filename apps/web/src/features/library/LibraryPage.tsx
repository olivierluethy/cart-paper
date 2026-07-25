import { Library } from 'lucide-react'
import { motion } from 'motion/react'
import { BookGrid } from '@/components/BookTile'
import { EmptyState, Loading, ErrorState } from '@/components/States'
import { Button } from '@/components/Button'
import { useLibrary } from '@/lib/books'
import { useFavorites } from '@/features/library/useFavorite'
import { useAuthGate } from '@/features/auth/useAuthGate'

export function LibraryPage() {
  const { user, openAuth } = useAuthGate()
  const library = useLibrary({ limit: 48 })
  const favorites = useFavorites(Boolean(user))

  const books = library.data?.items ?? []
  const favorited = favorites.data ?? []

  return (
    <div className="mx-auto max-w-[110rem] px-4 py-10 sm:px-6 lg:py-14">
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 0.61, 0.36, 1] }}
        className="mb-14 max-w-2xl"
      >
        <p className="label mb-4">The library</p>
        <h1 className="text-balance font-display text-4xl font-semibold leading-[1.08] text-ink-text sm:text-5xl">
          Everyone reviews the book.
          <br />
          <span className="text-amber">Here you can argue with the line.</span>
        </h1>
        <p className="mt-5 max-w-prose text-[0.95rem] leading-relaxed text-ink-muted">
          Read what other people have written, highlight what stays with you, keep private notes
          beside the passage they belong to — and start a discussion anchored to the exact sentence
          that started it.
        </p>
      </motion.section>

      {favorited.length > 0 && (
        <section className="mb-14">
          <SectionHeading title="Your favourites" count={favorited.length} />
          <BookGrid books={favorited.slice(0, 12)} size="sm" />
        </section>
      )}

      <section>
        <SectionHeading title="Recently published" count={library.data?.total ?? 0} />
        {library.isLoading ? (
          <Loading label="Opening the library…" />
        ) : library.isError ? (
          <ErrorState
            title="The library did not load"
            body="The API may still be starting up."
            onRetry={() => library.refetch()}
          />
        ) : books.length === 0 ? (
          <EmptyState
            icon={Library}
            title="No books have been published yet"
            body="Once someone publishes, their covers appear here. In the meantime, the first shelf is yours to fill."
            action={
              user ? undefined : (
                <Button variant="primary" onClick={() => openAuth('register')}>
                  Create an account
                </Button>
              )
            }
          />
        ) : (
          <BookGrid books={books} />
        )}
      </section>
    </div>
  )
}

function SectionHeading({ title, count }: { title: string; count: number }) {
  return (
    <div className="mb-6 flex items-baseline gap-3 border-b border-ink-line/70 pb-3">
      <h2 className="font-display text-lg font-semibold text-ink-text">{title}</h2>
      {count > 0 && <span className="text-xs tabular-nums text-ink-faint">{count}</span>}
    </div>
  )
}
