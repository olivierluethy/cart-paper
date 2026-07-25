import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Star } from 'lucide-react'
import { api, ApiError } from '@/lib/api'
import { bookKeys } from '@/lib/books'
import { useAuthGate } from '@/features/auth/useAuthGate'
import { useToast } from '@/lib/toast'
import { cn, pluralize } from '@/lib/utils'
import type { BookDetail } from '@/lib/types'

const LABELS = ['', 'Not for me', 'It was fine', 'Good', 'Very good', 'One I will reread']

export function RatingWidget({ book }: { book: BookDetail }) {
  const qc = useQueryClient()
  const toast = useToast()
  const { user, requireAuth } = useAuthGate()
  const [hover, setHover] = useState<number | null>(null)
  const own = user?.id === book.author.id

  const rate = useMutation({
    mutationFn: (value: number | null) =>
      value === null
        ? api.del(`/books/${book.slug}/rating`)
        : api.put(`/books/${book.slug}/rating`, { value }),
    onMutate: async (value) => {
      const keys = [bookKeys.detail(book.id), bookKeys.detail(book.slug)]
      await Promise.all(keys.map((key) => qc.cancelQueries({ queryKey: key })))
      const snapshots = keys.map((key) => [key, qc.getQueryData(key)] as const)
      for (const key of keys) {
        qc.setQueryData<BookDetail | undefined>(key, (current) => {
          if (!current) return current
          const had = current.my_rating
          const count = current.rating_count + (value === null ? (had ? -1 : 0) : had ? 0 : 1)
          const sum =
            current.rating_average * current.rating_count - (had ?? 0) + (value ?? 0)
          return {
            ...current,
            my_rating: value,
            rating_count: Math.max(0, count),
            rating_average: count > 0 ? Number((sum / count).toFixed(2)) : 0,
          }
        })
      }
      return { snapshots }
    },
    onError: (error, _value, context) => {
      context?.snapshots.forEach(([key, value]) => qc.setQueryData(key, value))
      toast.error(error instanceof ApiError ? error.message : 'Could not save your rating.')
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: bookKeys.detail(book.id) })
      qc.invalidateQueries({ queryKey: bookKeys.detail(book.slug) })
      qc.invalidateQueries({ queryKey: ['library'] })
    },
  })

  const shown = hover ?? book.my_rating ?? 0
  const max = Math.max(1, ...Object.values(book.rating_distribution ?? {}))

  return (
    <section className="rounded-lg border border-ink-line p-5">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <p className="label mb-2">Rating</p>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-3xl font-semibold tabular-nums text-ink-text">
              {book.rating_count > 0 ? book.rating_average.toFixed(1) : '—'}
            </span>
            <span className="text-xs text-ink-faint">
              {book.rating_count > 0 ? pluralize(book.rating_count, 'rating') : 'not rated yet'}
            </span>
          </div>

          {!own && (
            <div className="mt-4">
              <div
                className="flex items-center gap-1"
                onMouseLeave={() => setHover(null)}
                role="radiogroup"
                aria-label="Your rating"
              >
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={book.my_rating === value}
                    aria-label={`${value} of 5 — ${LABELS[value]}`}
                    onMouseEnter={() => setHover(value)}
                    onFocus={() => setHover(value)}
                    onBlur={() => setHover(null)}
                    onClick={() =>
                      void requireAuth(
                        () => rate.mutate(book.my_rating === value ? null : value),
                        'Create an account to rate books.',
                      )
                    }
                    className="rounded p-0.5 transition-transform hover:scale-110"
                  >
                    <Star
                      size={22}
                      className={cn(
                        'transition-colors',
                        value <= shown ? 'fill-amber text-amber' : 'text-ink-line',
                      )}
                    />
                  </button>
                ))}
              </div>
              <p className="mt-1.5 h-4 text-xs text-ink-faint">
                {shown > 0 ? LABELS[shown] : book.my_rating ? '' : 'Tap a star'}
                {book.my_rating && hover === null && ' · click again to remove'}
              </p>
            </div>
          )}
          {own && <p className="mt-4 text-xs text-ink-faint">You cannot rate your own book.</p>}
        </div>

        {book.rating_count > 0 && (
          <div className="min-w-[10rem] flex-1 space-y-1">
            {[5, 4, 3, 2, 1].map((value) => {
              const count = book.rating_distribution?.[String(value)] ?? 0
              return (
                <div key={value} className="flex items-center gap-2 text-2xs text-ink-faint">
                  <span className="w-3 tabular-nums">{value}</span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-line/70">
                    <span
                      className="block h-full rounded-full bg-amber/70"
                      style={{ width: `${(count / max) * 100}%` }}
                    />
                  </span>
                  <span className="w-5 text-right tabular-nums">{count}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
