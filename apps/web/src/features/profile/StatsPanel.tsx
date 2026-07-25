import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { BarChart3, EyeOff, Flame } from 'lucide-react'
import { EmptyState, Loading } from '@/components/States'
import { api, ApiError } from '@/lib/api'
import { formatDuration, pluralize, timeAgo } from '@/lib/utils'
import type { ReadingStats } from '@/lib/types'

export function StatsPanel({ handle, hidden }: { handle: string; hidden: boolean }) {
  const stats = useQuery({
    queryKey: ['stats', handle],
    queryFn: () => api.get<ReadingStats>(`/users/${handle}/stats`),
    enabled: !hidden,
    retry: false,
  })

  if (hidden) {
    return (
      <EmptyState
        icon={EyeOff}
        title="Statistics are hidden"
        body="This reader keeps their reading time to themselves."
      />
    )
  }

  if (stats.isLoading) return <Loading />
  if (stats.isError) {
    const forbidden = stats.error instanceof ApiError && stats.error.status === 403
    return (
      <EmptyState
        icon={EyeOff}
        title={forbidden ? 'Statistics are hidden' : 'Statistics did not load'}
        body={
          forbidden
            ? 'This reader keeps their reading time to themselves.'
            : 'Try again in a moment.'
        }
      />
    )
  }

  const data = stats.data!
  if (data.sessions === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title="No reading time recorded yet"
        body="Time is counted quietly in the background while a book is open — never with a timer on screen."
      />
    )
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Total read" value={formatDuration(data.total_seconds)} />
        <Stat label="Sessions" value={String(data.sessions)} />
        <Stat label="Average session" value={formatDuration(data.average_session_seconds)} />
        <Stat label="Pages turned" value={String(data.pages_turned)} />
        <Stat label="Longest streak" value={`${data.longest_streak_days}d`} icon={<Flame size={12} />} />
        <Stat label="Current streak" value={`${data.current_streak_days}d`} />
      </div>

      <section>
        <h3 className="label mb-3">Time per book</h3>
        <ul className="space-y-2">
          {data.books.map((entry) => {
            const share = data.total_seconds ? entry.active_seconds / data.total_seconds : 0
            return (
              <li key={entry.book.id} className="rounded-md border border-ink-line px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <Link
                    to={`/books/${entry.book.slug}`}
                    className="font-display text-sm text-ink-text hover:text-amber"
                  >
                    {entry.book.title}
                  </Link>
                  <span className="text-xs tabular-nums text-ink-muted">
                    {formatDuration(entry.active_seconds)}
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-line/70">
                  <div
                    className="h-full rounded-full bg-amber/70"
                    style={{ width: `${Math.max(share * 100, 2)}%` }}
                  />
                </div>
                <p className="mt-1.5 text-2xs text-ink-faint">
                  {pluralize(entry.sessions, 'session')} · {pluralize(entry.pages_turned, 'page')} turned
                  {entry.last_read_at && ` · last read ${timeAgo(entry.last_read_at)}`}
                </p>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-md border border-ink-line px-3.5 py-3">
      <p className="label flex items-center gap-1">
        {icon}
        {label}
      </p>
      <p className="mt-1.5 font-display text-xl font-semibold tabular-nums text-ink-text">{value}</p>
    </div>
  )
}
