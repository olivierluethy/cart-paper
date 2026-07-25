import { Link, useNavigate, useParams } from 'react-router-dom'
import { BookOpen, FileText, Heart, PenLine, Star, Users } from 'lucide-react'
import { motion } from 'motion/react'
import { BookCover } from '@/components/BookCover'
import { Button } from '@/components/Button'
import { Avatar } from '@/components/Avatar'
import { ErrorState, Loading } from '@/components/States'
import { ShareButton } from '@/features/library/ShareButton'
import { useToggleFavorite } from '@/features/library/useFavorite'
import { useAuthGate } from '@/features/auth/useAuthGate'
import { BookComments } from '@/features/comments/BookComments'
import { RatingWidget } from '@/features/library/RatingWidget'
import { useBook, usePages } from '@/lib/books'
import { useInviteToken } from '@/lib/invite'
import { cn, formatDate, pluralize } from '@/lib/utils'

export function BookDetailPage() {
  const { slug = '' } = useParams()
  const invite = useInviteToken()
  const navigate = useNavigate()
  const { requireAuth } = useAuthGate()
  const book = useBook(slug, invite)
  const pages = usePages(slug, invite)
  const favorite = useToggleFavorite({
    id: book.data?.id ?? '',
    slug: book.data?.slug ?? '',
    is_favorite: book.data?.is_favorite ?? false,
  })

  if (book.isLoading) return <Loading label="Fetching the book…" />
  if (book.isError || !book.data) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24">
        <ErrorState
          title="This book is not available"
          body="It may have been unpublished, deleted, or it is a draft you were not invited to."
        />
      </div>
    )
  }

  const item = book.data
  const readTo = `/read/${item.slug}${invite ? `?invite=${invite}` : ''}`

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:py-16">
      {item.status === 'draft' && (
        <div className="mb-8 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-amber/30 bg-amber/[0.07] px-4 py-3 text-sm text-amber-soft">
          <Users size={15} />
          <span className="font-medium">You are previewing a private draft.</span>
          <span className="text-ink-muted">
            {item.can_edit
              ? 'Only you and anyone holding a preview link can see it.'
              : 'Your comments go straight to the author.'}
          </span>
        </div>
      )}

      <div className="grid gap-10 md:grid-cols-[16rem_minmax(0,1fr)] lg:gap-14">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 0.61, 0.36, 1] }}
          className="mx-auto w-full max-w-[16rem] md:mx-0"
        >
          <BookCover book={item} design={item.front_cover} size="xl" className="w-full" />
        </motion.div>

        <div className="min-w-0">
          <h1 className="text-balance font-display text-3xl font-semibold leading-tight text-ink-text sm:text-4xl">
            {item.title}
          </h1>
          {item.subtitle && (
            <p className="mt-2 font-read text-lg italic leading-snug text-ink-muted">{item.subtitle}</p>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <span className="inline-flex items-center gap-2 text-ink-muted">
              <Avatar user={item.author} size="xs" />
              {item.author.display_name}
            </span>
            {item.rating_count > 0 && (
              <span className="inline-flex items-center gap-1.5 text-ink-muted">
                <Star size={14} className="fill-amber/80 text-amber/80" />
                <span className="tabular-nums text-ink-text">{item.rating_average.toFixed(1)}</span>
                <span className="text-ink-faint">({pluralize(item.rating_count, 'rating')})</span>
              </span>
            )}
            <span className="text-ink-faint">{pluralize(item.page_count, 'page')}</span>
            {item.published_at && (
              <span className="text-ink-faint">{formatDate(item.published_at)}</span>
            )}
          </div>

          {item.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {item.tags.map((tag) => (
                <span key={tag} className="chip">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {item.description && (
            <p className="mt-7 max-w-prose whitespace-pre-line font-read leading-relaxed text-ink-text/90">
              {item.description}
            </p>
          )}

          <div className="mt-9 flex flex-wrap items-center gap-2.5">
            <Button
              variant="primary"
              size="lg"
              icon={<BookOpen size={16} />}
              onClick={() => navigate(readTo)}
            >
              {item.progress && item.progress.percent > 0.01 ? 'Continue reading' : 'Read'}
            </Button>

            <Button
              variant="secondary"
              icon={
                <Heart
                  size={15}
                  className={cn(item.is_favorite && 'fill-danger text-danger')}
                />
              }
              onClick={() =>
                void requireAuth(
                  () => favorite.mutate(!item.is_favorite),
                  'Create an account to keep favourites.',
                )
              }
            >
              {item.is_favorite ? 'Favourited' : 'Favourite'}
              {item.favorite_count > 0 && (
                <span className="ml-1 text-xs tabular-nums text-ink-faint">
                  {item.favorite_count}
                </span>
              )}
            </Button>

            <ShareButton
              title={item.title}
              text={item.description ?? undefined}
              url={`${window.location.origin}/books/${item.slug}`}
            />

            {item.import_source && (
              <Button
                variant="ghost"
                icon={<FileText size={15} />}
                onClick={() => navigate(`/pdf/${item.slug}`)}
              >
                Read the original
              </Button>
            )}

            {item.can_edit && (
              <Button variant="ghost" icon={<PenLine size={15} />} onClick={() => navigate(`/write/${item.id}`)}>
                Edit
              </Button>
            )}
          </div>

          {item.import_source && item.import_source.conversion_status !== 'converted' && (
            <p className="mt-5 flex max-w-prose items-start gap-2.5 rounded-md border border-amber/30 bg-amber/[0.06] px-4 py-3 text-xs leading-relaxed text-ink-muted">
              <FileText size={14} className="mt-0.5 shrink-0 text-amber" />
              <span>
                This book was imported from <strong className="text-ink-text">{item.import_source.filename}</strong> and
                the conversion was only partly successful. Reading the original file gives you the
                same highlights, notes and passage-anchored discussions.
              </span>
            </p>
          )}

          {item.progress && item.progress.percent > 0.01 && (
            <Link
              to={readTo}
              className="mt-6 flex max-w-sm items-center gap-3 rounded-md border border-ink-line px-4 py-3 text-sm transition-colors hover:border-amber/40"
            >
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-line">
                <span
                  className="block h-full rounded-full bg-amber"
                  style={{ width: `${Math.round(item.progress.percent * 100)}%` }}
                />
              </span>
              <span className="shrink-0 text-xs tabular-nums text-ink-muted">
                {Math.round(item.progress.percent * 100)}% · page {item.progress.page_index + 1}
              </span>
            </Link>
          )}
        </div>
      </div>

      <div className="mt-12 max-w-2xl">
        <RatingWidget book={item} />
      </div>

      <BookComments
        book={item}
        invite={invite}
        pageIndexOf={(pageId) => {
          if (!pageId) return null
          const at = (pages.data ?? []).findIndex((page) => page.id === pageId)
          return at === -1 ? null : at
        }}
      />
    </div>
  )
}
