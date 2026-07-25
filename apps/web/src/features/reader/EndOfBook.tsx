import { useQuery } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { BookOpen, Check, Library, MessageSquare, Pencil, RotateCcw, Star } from 'lucide-react'
import { Button } from '@/components/Button'
import { BookCover } from '@/components/BookCover'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { formatDuration, pluralize, prefersReducedMotion } from '@/lib/utils'
import type { BookDetail, ReadingStats } from '@/lib/types'

/**
 * Shown when the last page is actually finished. The reader has just spent
 * hours here — saying nothing, and continuing to offer "continue where you left
 * off" at 100%, is the wrong end to a book.
 */
export function EndOfBook({
  book,
  highlights,
  notes,
  onRate,
  onComment,
  onRestart,
  onClose,
  onLibrary,
}: {
  book: BookDetail
  highlights: number
  notes: number
  onRate: () => void
  onComment: () => void
  onRestart: () => void
  onClose: () => void
  onLibrary: () => void
}) {
  const { user } = useAuth()
  const reduced = prefersReducedMotion()

  const stats = useQuery({
    queryKey: ['stats', user?.handle],
    queryFn: () => api.get<ReadingStats>(`/users/${user!.handle}/stats`),
    enabled: Boolean(user),
    staleTime: 60_000,
  })
  const seconds = stats.data?.books.find((entry) => entry.book.id === book.id)?.active_seconds ?? 0

  return (
    <motion.div
      initial={reduced ? { opacity: 1 } : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduced ? 0 : 0.3 }}
      className="absolute inset-0 z-30 grid place-items-center overflow-y-auto bg-ink-bg/96 px-6 py-12 backdrop-blur-sm"
      role="dialog"
      aria-label="You have finished this book"
    >
      <motion.div
        initial={reduced ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduced ? 0 : 0.4, delay: reduced ? 0 : 0.08, ease: [0.22, 0.61, 0.36, 1] }}
        className="w-full max-w-md text-center"
      >
        <div className="mb-7 flex justify-center">
          <div className="relative">
            <BookCover book={book} design={book.front_cover} size="md" interactive={false} />
            <span className="absolute -right-2 -top-2 inline-grid h-8 w-8 place-items-center rounded-full border border-success/50 bg-ink-bg text-success">
              <Check size={16} />
            </span>
          </div>
        </div>

        <p className="label mb-3">The end</p>
        <h2 className="text-balance font-display text-2xl font-semibold leading-tight text-ink-text sm:text-3xl">
          You&rsquo;ve finished {book.title}
        </h2>
        <p className="mt-2 text-sm text-ink-muted">{book.author.display_name}</p>

        <dl className="mx-auto mt-8 grid max-w-sm grid-cols-3 gap-3">
          <Stat icon={<BookOpen size={13} />} label="Time reading" value={seconds ? formatDuration(seconds) : '—'} />
          <Stat icon={<Pencil size={13} />} label="Highlights" value={String(highlights)} tone="amber" />
          <Stat icon={<Pencil size={13} />} label="Notes" value={String(notes)} tone="amber" />
        </dl>

        <div className="mt-9 flex flex-wrap justify-center gap-2.5">
          {book.author.id !== user?.id && (
            <Button variant="primary" icon={<Star size={15} />} onClick={onRate}>
              {book.my_rating ? 'Change your rating' : 'Rate this book'}
            </Button>
          )}
          <Button variant="secondary" icon={<MessageSquare size={15} />} onClick={onComment}>
            Write a comment
          </Button>
          <Button variant="secondary" icon={<RotateCcw size={15} />} onClick={onRestart}>
            Read again
          </Button>
          <Button variant="ghost" icon={<Library size={15} />} onClick={onLibrary}>
            Back to library
          </Button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-7 text-xs text-ink-faint underline-offset-4 transition-colors hover:text-ink-muted hover:underline"
        >
          Stay on the last page
        </button>

        {(highlights > 0 || notes > 0) && (
          <p className="mt-6 text-2xs leading-relaxed text-ink-faint">
            {pluralize(highlights, 'highlight')} and {pluralize(notes, 'note')} are kept — reading
            again does not clear them.
          </p>
        )}
      </motion.div>
    </motion.div>
  )
}

function Stat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: string
  tone?: 'amber'
}) {
  return (
    <div className="rounded-md border border-ink-line px-2 py-2.5">
      <dt className="flex items-center justify-center gap-1 text-2xs text-ink-faint">
        <span className={tone === 'amber' ? 'text-amber' : undefined}>{icon}</span>
        {label}
      </dt>
      <dd className="mt-1 font-display text-base font-semibold tabular-nums text-ink-text">{value}</dd>
    </div>
  )
}
