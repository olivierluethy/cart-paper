import { Link } from 'react-router-dom'
import { MessageSquareQuote, Star } from 'lucide-react'
import { motion } from 'motion/react'
import { BookCover } from '@/components/BookCover'
import { cn, prefersReducedMotion } from '@/lib/utils'
import type { BookSummary } from '@/lib/types'

export function BookTile({
  book,
  index = 0,
  size = 'md',
}: {
  book: BookSummary
  index?: number
  size?: 'sm' | 'md' | 'lg'
}) {
  const reduced = prefersReducedMotion()
  return (
    <motion.li
      initial={reduced ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.34,
        // One orchestrated reveal on load, capped so a big shelf never crawls.
        delay: reduced ? 0 : Math.min(index * 0.035, 0.5),
        ease: [0.22, 0.61, 0.36, 1],
      }}
      className="group/tile"
    >
      <Link to={`/books/${book.slug}`} className="block outline-none">
        <div className="group/cover">
          <BookCover book={book} design={book.front_cover} size={size} className="w-full" />
        </div>
        <div className="mt-3.5 space-y-1">
          <h3
            className={cn(
              'line-clamp-2 font-display font-semibold leading-snug text-ink-text transition-colors group-hover/tile:text-amber',
              size === 'sm' ? 'text-sm' : 'text-[0.95rem]',
            )}
          >
            {book.title}
          </h3>
          <p className="truncate text-xs text-ink-muted">{book.author.display_name}</p>
          <div className="flex items-center gap-3 pt-0.5 text-2xs text-ink-faint">
            {book.rating_count > 0 && (
              <span className="inline-flex items-center gap-1">
                <Star size={11} className="fill-amber/80 text-amber/80" />
                <span className="tabular-nums">{book.rating_average.toFixed(1)}</span>
                <span>({book.rating_count})</span>
              </span>
            )}
            {book.comment_count > 0 && (
              <span className="inline-flex items-center gap-1">
                <MessageSquareQuote size={11} />
                <span className="tabular-nums">{book.comment_count}</span>
              </span>
            )}
          </div>
        </div>
      </Link>
    </motion.li>
  )
}

export function BookGrid({ books, size = 'md' }: { books: BookSummary[]; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <ul
      className={cn(
        'grid gap-x-6 gap-y-9',
        size === 'sm'
          ? 'grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8'
          : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6',
      )}
    >
      {books.map((book, index) => (
        <BookTile key={book.id} book={book} index={index} size={size} />
      ))}
    </ul>
  )
}
