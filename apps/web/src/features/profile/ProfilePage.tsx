import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { BookOpen, Check, Heart, RotateCcw, Settings, Star } from 'lucide-react'
import { Avatar } from '@/components/Avatar'
import { Button } from '@/components/Button'
import { BookGrid } from '@/components/BookTile'
import { EmptyState, ErrorState, Loading } from '@/components/States'
import { TrailView } from '@/features/profile/TrailView'
import { StatsPanel } from '@/features/profile/StatsPanel'
import { SettingsModal } from '@/features/profile/SettingsModal'
import { useFavorites } from '@/features/library/useFavorite'
import { useContinueReading } from '@/features/reader/useReading'
import { useAuth } from '@/lib/auth'
import { useAuthGate } from '@/features/auth/useAuthGate'
import { useMyBooks } from '@/lib/books'
import { useModal } from '@/lib/modal'
import { api } from '@/lib/api'
import { usePageMeta } from '@/lib/page-meta'
import { cn, formatDate, pluralize } from '@/lib/utils'
import type { Profile } from '@/lib/types'

const PUBLIC_TABS = ['Books', 'Statistics'] as const
const OWN_TABS = ['Books', 'Trail', 'Reading', 'Favourites', 'Drafts', 'Statistics'] as const
type Tab = (typeof OWN_TABS)[number]

export function ProfilePage({ me }: { me?: boolean }) {
  const params = useParams()
  const { user, loading } = useAuth()
  const { openAuth } = useAuthGate()
  const { open } = useModal()
  const handle = me ? user?.handle : params.handle
  const [tab, setTab] = useState<Tab>('Books')

  const profile = useQuery({
    queryKey: ['profile', handle],
    queryFn: () => api.get<Profile>(`/users/${handle}`),
    enabled: Boolean(handle),
  })

  usePageMeta(profile.data?.user.display_name, profile.data?.user.bio ?? undefined)

  if (loading) return <Loading />
  if (me && !user) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24">
        <EmptyState
          icon={BookOpen}
          title="Your profile lives behind an account"
          body="Sign in to see your trail, your drafts and everything you have marked."
          action={<Button variant="primary" onClick={() => openAuth('login')}>Sign in</Button>}
        />
      </div>
    )
  }
  if (profile.isLoading) return <Loading />
  if (profile.isError || !profile.data) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24">
        <ErrorState title="No such reader" body="That handle does not belong to anyone here." />
      </div>
    )
  }

  const data = profile.data
  const tabs = data.is_me ? OWN_TABS : PUBLIC_TABS

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-14">
      <header className="mb-10 flex flex-wrap items-start gap-6">
        <Avatar user={data.user} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-3xl font-semibold text-ink-text">
            {data.user.display_name}
          </h1>
          <p className="mt-0.5 text-sm text-ink-faint">@{data.user.handle}</p>
          {data.user.bio && (
            <p className="mt-3 max-w-prose whitespace-pre-line text-sm leading-relaxed text-ink-muted">
              {data.user.bio}
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-ink-faint">
            <span>{pluralize(data.book_count, 'published book')}</span>
            {data.average_rating > 0 && (
              <span className="inline-flex items-center gap-1">
                <Star size={11} className="fill-amber/80 text-amber/80" />
                {data.average_rating.toFixed(1)} average
              </span>
            )}
            <span>{pluralize(data.comment_count, 'comment')}</span>
            <span>joined {formatDate(data.user.created_at)}</span>
          </div>
        </div>
        {data.is_me && (
          <Button
            variant="secondary"
            icon={<Settings size={15} />}
            onClick={() => open(({ close }) => <SettingsModal onDone={close} />)}
          >
            Settings
          </Button>
        )}
      </header>

      <div className="mb-8 flex gap-1 overflow-x-auto border-b border-ink-line no-scrollbar" role="tablist">
        {tabs.map((name) => (
          <button
            key={name}
            role="tab"
            aria-selected={tab === name}
            onClick={() => setTab(name)}
            className={cn(
              '-mb-px shrink-0 border-b-2 px-3.5 py-2.5 text-sm transition-colors',
              tab === name
                ? 'border-amber text-ink-text'
                : 'border-transparent text-ink-muted hover:text-ink-text',
            )}
          >
            {name}
          </button>
        ))}
      </div>

      {tab === 'Books' && (
        data.published_books.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="Nothing published yet"
            body={data.is_me ? 'Your drafts stay private until you publish them.' : 'This reader has not published a book.'}
          />
        ) : (
          <BookGrid books={data.published_books} />
        )
      )}

      {tab === 'Trail' && <TrailView />}
      {tab === 'Reading' && <ContinueReadingTab />}
      {tab === 'Favourites' && <FavouritesTab />}
      {tab === 'Drafts' && <DraftsTab />}
      {tab === 'Statistics' && (
        <StatsPanel handle={data.user.handle} hidden={!data.is_me && !data.stats_visible} />
      )}
    </div>
  )
}

function ContinueReadingTab() {
  const reading = useContinueReading(true)
  if (reading.isLoading) return <Loading />
  const all = reading.data ?? []
  const items = all.filter((entry) => !entry.completed_at)
  const finished = all.filter((entry) => entry.completed_at)
  if (all.length === 0) {
    return (
      <EmptyState
        icon={BookOpen}
        title="Nothing part-read"
        body="Open a book and it appears here with exactly how far you got."
      />
    )
  }
  return (
    <div className="space-y-10">
      {items.length > 0 && (
        <section>
          <h3 className="label mb-3">In progress · {items.length}</h3>
          <ul className="space-y-2.5">
            {items.map((entry) => (
              <li key={entry.book_id}>
                <Link
                  to={`/read/${entry.book.slug}`}
                  className="flex items-center gap-4 rounded-lg border border-ink-line px-4 py-3.5 transition-colors hover:border-amber/40"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-display text-sm text-ink-text">
                      {entry.book.title}
                    </span>
                    <span className="mt-0.5 block text-xs text-ink-faint">
                      {entry.book.author.display_name} · page {entry.page_index + 1}
                    </span>
                  </span>
                  <span className="h-1.5 w-28 overflow-hidden rounded-full bg-ink-line">
                    <span
                      className="block h-full rounded-full bg-amber"
                      style={{ width: `${Math.round(entry.percent * 100)}%` }}
                    />
                  </span>
                  <span className="w-10 shrink-0 text-right text-xs tabular-nums text-ink-muted">
                    {Math.round(entry.percent * 100)}%
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {finished.length > 0 && (
        <section>
          <h3 className="label mb-3">Finished · {finished.length}</h3>
          <ul className="space-y-2.5">
            {finished.map((entry) => (
              <li key={entry.book_id}>
                <div className="flex items-center gap-4 rounded-lg border border-success/30 bg-success/[0.04] px-4 py-3.5">
                  <Check size={15} className="shrink-0 text-success" />
                  <span className="min-w-0 flex-1">
                    <Link
                      to={`/books/${entry.book.slug}`}
                      className="block truncate font-display text-sm text-ink-text hover:text-amber"
                    >
                      {entry.book.title}
                    </Link>
                    <span className="mt-0.5 block text-xs text-ink-faint">
                      finished {formatDate(entry.completed_at!)}
                      {entry.restarted_count > 0 && ` · read ${entry.restarted_count + 1}×`}
                    </span>
                  </span>
                  <Link
                    to={`/read/${entry.book.slug}`}
                    className="inline-flex shrink-0 items-center gap-1.5 text-xs text-amber underline-offset-4 hover:underline"
                  >
                    <RotateCcw size={12} />
                    Read again
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function FavouritesTab() {
  const favorites = useFavorites(true)
  if (favorites.isLoading) return <Loading />
  const items = favorites.data ?? []
  if (items.length === 0) {
    return (
      <EmptyState
        icon={Heart}
        title="No favourites yet"
        body="Favourite a book and it stays here, one click from the library."
      />
    )
  }
  return <BookGrid books={items} />
}

function DraftsTab() {
  const books = useMyBooks()
  if (books.isLoading) return <Loading />
  const drafts = (books.data ?? []).filter((book) => book.status === 'draft')
  if (drafts.length === 0) {
    return (
      <EmptyState
        icon={BookOpen}
        title="No drafts"
        body="Start a book and it lives here, private, until you publish it."
        action={
          <Link to="/write">
            <Button variant="primary">Start writing</Button>
          </Link>
        }
      />
    )
  }
  return (
    <ul className="divide-y divide-ink-line/70 border-y border-ink-line/70">
      {drafts.map((book) => (
        <li key={book.id}>
          <Link
            to={`/write/${book.id}`}
            className="flex items-baseline gap-4 py-4 transition-colors hover:bg-ink-line/20"
          >
            <span className="min-w-0 flex-1 truncate font-display text-base text-ink-text">
              {book.title}
            </span>
            <span className="shrink-0 text-xs text-ink-faint">{pluralize(book.page_count, 'page')}</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
