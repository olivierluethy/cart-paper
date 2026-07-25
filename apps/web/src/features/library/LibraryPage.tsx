import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Library, Search, X } from 'lucide-react'
import { motion } from 'motion/react'
import { BookGrid } from '@/components/BookTile'
import { BookCover } from '@/components/BookCover'
import { EmptyState, ErrorState, Skeleton } from '@/components/States'
import { Button } from '@/components/Button'
import { useLibrary, useTags, type LibraryQuery } from '@/lib/books'
import { useFavorites } from '@/features/library/useFavorite'
import { useContinueReading } from '@/features/reader/useReading'
import { useAuthGate } from '@/features/auth/useAuthGate'
import { cn, pluralize } from '@/lib/utils'

const SORTS: { value: NonNullable<LibraryQuery['sort']>; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'top_rated', label: 'Top rated' },
  { value: 'most_discussed', label: 'Most discussed' },
  { value: 'title', label: 'A–Z' },
]

export function LibraryPage() {
  const { user, openAuth } = useAuthGate()
  const [term, setTerm] = useState('')
  const [debounced, setDebounced] = useState('')
  const [sort, setSort] = useState<NonNullable<LibraryQuery['sort']>>('newest')
  const [tag, setTag] = useState<string | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(term.trim()), 260)
    return () => window.clearTimeout(timer)
  }, [term])

  const query = useMemo<LibraryQuery>(
    () => ({ q: debounced || undefined, tag: tag ?? undefined, sort, limit: 48 }),
    [debounced, tag, sort],
  )

  const library = useLibrary(query)
  const tags = useTags()
  const favorites = useFavorites(Boolean(user))
  const reading = useContinueReading(Boolean(user))

  const books = library.data?.items ?? []
  const filtering = Boolean(debounced || tag || sort !== 'newest')
  const continueReading = (reading.data ?? []).filter((entry) => entry.percent > 0.01)

  return (
    <div className="mx-auto max-w-[110rem] px-4 py-10 sm:px-6 lg:py-14">
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 0.61, 0.36, 1] }}
        className="mb-12 max-w-2xl"
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

      {!filtering && continueReading.length > 0 && (
        <section className="mb-14">
          <SectionHeading title="Continue reading" count={continueReading.length} />
          <ul className="flex gap-5 overflow-x-auto pb-2 no-scrollbar">
            {continueReading.map((entry) => (
              <li key={entry.book_id} className="w-36 shrink-0">
                <Link to={`/read/${entry.book.slug}`} className="group/tile block">
                  <div className="group/cover">
                    <BookCover book={entry.book} design={entry.book.front_cover} size="sm" className="w-full" />
                  </div>
                  <p className="mt-3 line-clamp-2 font-display text-sm leading-snug text-ink-text transition-colors group-hover/tile:text-amber">
                    {entry.book.title}
                  </p>
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-ink-line">
                    <div
                      className="h-full rounded-full bg-amber"
                      style={{ width: `${Math.round(entry.percent * 100)}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-2xs text-ink-faint">
                    page {entry.page_index + 1} · {Math.round(entry.percent * 100)}%
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!filtering && (favorites.data ?? []).length > 0 && (
        <section className="mb-14">
          <SectionHeading title="Your favourites" count={favorites.data!.length} />
          <BookGrid books={favorites.data!.slice(0, 12)} size="sm" />
        </section>
      )}

      <section>
        <div className="mb-6 flex flex-wrap items-center gap-3 border-b border-ink-line/70 pb-4">
          <h2 className="font-display text-lg font-semibold text-ink-text">
            {debounced ? 'Search results' : tag ? `Tagged “${tag}”` : 'Recently published'}
          </h2>
          {library.data && (
            <span className="text-xs tabular-nums text-ink-faint">
              {pluralize(library.data.total, 'book')}
            </span>
          )}

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <label className="relative">
              <span className="sr-only">Search books</span>
              <Search
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
              />
              <input
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                placeholder="Title, author, description…"
                className="field h-9 w-56 pl-9 pr-8"
              />
              {term && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-ink-faint hover:text-ink-text"
                >
                  <X size={13} />
                </button>
              )}
            </label>

            <div className="flex gap-1 rounded-md border border-ink-line p-0.5">
              {SORTS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSort(option.value)}
                  className={cn(
                    'rounded px-2.5 py-1.5 text-xs transition-colors',
                    sort === option.value ? 'bg-amber/15 text-amber' : 'text-ink-muted hover:text-ink-text',
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {(tags.data ?? []).length > 0 && (
          <div className="mb-7 flex flex-wrap gap-1.5">
            <button type="button" onClick={() => setTag(null)} data-active={tag === null} className="chip">
              All
            </button>
            {tags.data!.map((entry) => (
              <button
                key={entry.tag}
                type="button"
                onClick={() => setTag(tag === entry.tag ? null : entry.tag)}
                data-active={tag === entry.tag}
                className="chip"
              >
                {entry.tag}
                <span className="text-ink-faint">{entry.count}</span>
              </button>
            ))}
          </div>
        )}

        {library.isLoading ? (
          <SkeletonGrid />
        ) : library.isError ? (
          <ErrorState
            title="The library did not load"
            body="The API may still be starting up."
            onRetry={() => library.refetch()}
          />
        ) : books.length === 0 ? (
          <EmptyState
            icon={Library}
            title={filtering ? 'Nothing matches that' : 'No books have been published yet'}
            body={
              filtering
                ? 'Try a different word, or clear the filters.'
                : 'Once someone publishes, their covers appear here. In the meantime, the first shelf is yours to fill.'
            }
            action={
              filtering ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setTerm('')
                    setTag(null)
                    setSort('newest')
                  }}
                >
                  Clear filters
                </Button>
              ) : user ? undefined : (
                <Button variant="primary" onClick={() => openAuth('register')}>
                  Create an account
                </Button>
              )
            }
          />
        ) : (
          <div className={cn(library.isFetching && 'opacity-60 transition-opacity')}>
            <BookGrid books={books} />
          </div>
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

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-9 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
      {Array.from({ length: 12 }).map((_, index) => (
        <div key={index}>
          <Skeleton className="aspect-[2/3] w-full rounded-[3px]" />
          <Skeleton className="mt-3.5 h-3.5 w-4/5" />
          <Skeleton className="mt-2 h-3 w-1/2" />
        </div>
      ))}
    </div>
  )
}

