import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronLeft, ChevronRight, Settings2, X } from 'lucide-react'
import type { Editor } from '@tiptap/react'
import { PageView } from '@/features/reader/PageView'
import {
  useHeartbeat,
  useProgress,
  useReaderTypography,
  useSaveProgress,
} from '@/features/reader/useReading'
import { SettingsModal } from '@/features/profile/SettingsModal'
import { IconButton } from '@/components/Button'
import { ErrorState, Loading } from '@/components/States'
import { useBook, usePagesFull } from '@/lib/books'
import { useInviteToken } from '@/lib/invite'
import { useModal } from '@/lib/modal'
import { useAuth } from '@/lib/auth'
import { cn, prefersReducedMotion } from '@/lib/utils'

const SWIPE_THRESHOLD = 56

export function ReaderPage() {
  const { slug = '' } = useParams()
  const invite = useInviteToken()
  const navigate = useNavigate()
  const { open } = useModal()
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()

  const book = useBook(slug, invite)
  const pages = usePagesFull(slug, invite)
  const progress = useProgress(slug, invite)
  const saveProgress = useSaveProgress(slug, invite)

  const list = useMemo(() => pages.data ?? [], [pages.data])
  const [index, setIndex] = useState(0)
  const [direction, setDirection] = useState(1)
  const [resumeOffer, setResumeOffer] = useState<number | null>(null)
  const [, setEditor] = useState<Editor | null>(null)
  const resumeChecked = useRef(false)
  const surface = useRef<HTMLDivElement>(null)
  const touchStart = useRef<{ x: number; y: number } | null>(null)

  const countPageTurn = useHeartbeat(slug, list.length > 0, invite)

  // Deep links (`?p=3`) win over saved progress; that is how a jump-to-passage
  // link from the comment trail lands on the right page.
  useEffect(() => {
    const wanted = Number(params.get('p'))
    if (Number.isFinite(wanted) && wanted > 0 && list.length) {
      setIndex(Math.min(wanted - 1, list.length - 1))
      resumeChecked.current = true
    }
  }, [params, list.length])

  useEffect(() => {
    if (resumeChecked.current || !list.length || progress.isLoading) return
    resumeChecked.current = true
    const saved = progress.data
    if (!saved?.page_id) return
    const at = list.findIndex((page) => page.id === saved.page_id)
    if (at > 0) setResumeOffer(at)
  }, [progress.data, progress.isLoading, list])

  const goTo = useCallback(
    (next: number, dir: number) => {
      if (!list.length) return
      const bounded = Math.max(0, Math.min(next, list.length - 1))
      setDirection(dir)
      setIndex((current) => {
        if (current !== bounded) countPageTurn()
        return bounded
      })
      setResumeOffer(null)
      surface.current?.scrollTo({ top: 0, behavior: 'auto' })
    },
    [list.length, countPageTurn],
  )

  // Persist where the reader is, coalesced.
  useEffect(() => {
    const page = list[index]
    if (!page || !user) return
    saveProgress({
      page_id: page.id,
      anchor: null,
      percent: list.length > 1 ? index / (list.length - 1) : 1,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, list, user])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, [contenteditable="true"]')) return
      if (event.key === 'ArrowRight' || event.key === 'PageDown' || event.key === ' ') {
        event.preventDefault()
        goTo(index + 1, 1)
      } else if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
        event.preventDefault()
        goTo(index - 1, -1)
      } else if (event.key === 'Home') {
        goTo(0, -1)
      } else if (event.key === 'End') {
        goTo(list.length - 1, 1)
      } else if (event.key === 'Escape') {
        navigate(`/books/${slug}`)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, goTo, list.length, navigate, slug])

  if (book.isLoading || pages.isLoading) return <Loading label="Opening the book…" />
  if (book.isError || !book.data) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24">
        <ErrorState
          title="This book is not available"
          body="It may have been unpublished, or it is a draft you were not invited to."
        />
      </div>
    )
  }

  const page = list[index]
  const percent = list.length > 1 ? (index / (list.length - 1)) * 100 : 100
  const reduced = prefersReducedMotion()

  return (
    <ReaderShell
      title={book.data.title}
      slug={slug}
      index={index}
      total={list.length}
      percent={percent}
      onSettings={() => open(({ close }) => <SettingsModal onDone={close} />)}
    >
      <div
        ref={surface}
        className="vignette relative min-h-0 flex-1 overflow-y-auto"
        onTouchStart={(event) => {
          const touch = event.touches[0]!
          touchStart.current = { x: touch.clientX, y: touch.clientY }
        }}
        onTouchEnd={(event) => {
          const start = touchStart.current
          const touch = event.changedTouches[0]
          if (!start || !touch) return
          const dx = touch.clientX - start.x
          const dy = touch.clientY - start.y
          if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy) * 1.5) {
            goTo(index + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1)
          }
          touchStart.current = null
        }}
      >
        {/* Click zones — generous on desktop, out of the way of the text column. */}
        <button
          type="button"
          aria-label="Previous page"
          onClick={() => goTo(index - 1, -1)}
          disabled={index === 0}
          className="absolute inset-y-0 left-0 z-10 hidden w-[max(4rem,calc((100%-var(--reader-width))/2-2rem))] cursor-w-resize disabled:cursor-default lg:block"
        />
        <button
          type="button"
          aria-label="Next page"
          onClick={() => goTo(index + 1, 1)}
          disabled={index >= list.length - 1}
          className="absolute inset-y-0 right-0 z-10 hidden w-[max(4rem,calc((100%-var(--reader-width))/2-2rem))] cursor-e-resize disabled:cursor-default lg:block"
        />

        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.article
            key={page?.id ?? index}
            custom={direction}
            initial={reduced ? { opacity: 0 } : { opacity: 0, x: direction * 18 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, x: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, x: direction * -14 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="mx-auto w-[min(var(--reader-width),100%-2.5rem)] py-12 sm:py-16"
          >
            {page ? (
              <PageView doc={page.content} pageKey={page.id} onEditor={setEditor} />
            ) : (
              <p className="text-center text-sm text-ink-faint">This book has no pages yet.</p>
            )}
          </motion.article>
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {resumeOffer !== null && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.24, ease: 'easeOut' }}
            className="pointer-events-auto fixed bottom-20 left-1/2 z-30 -translate-x-1/2"
          >
            <div className="surface-raised flex items-center gap-3 rounded-full py-2 pl-5 pr-2 text-sm">
              <span className="text-ink-muted">
                Continue where you left off —{' '}
                <span className="text-ink-text">page {resumeOffer + 1}</span>
              </span>
              <button
                type="button"
                onClick={() => goTo(resumeOffer, 1)}
                className="rounded-full bg-amber px-3.5 py-1.5 text-xs font-medium text-[#1A1408] transition-colors hover:bg-amber-soft"
              >
                Go there
              </button>
              <IconButton label="Stay on this page" onClick={() => setResumeOffer(null)} className="h-7 w-7">
                <X size={14} />
              </IconButton>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <nav className="flex h-14 shrink-0 items-center justify-between gap-4 border-t border-ink-line/60 px-4">
        <IconButton label="Previous page" onClick={() => goTo(index - 1, -1)} disabled={index === 0}>
          <ChevronLeft size={18} />
        </IconButton>
        <span className="text-xs tabular-nums text-ink-faint">
          Page {index + 1} of {list.length}
        </span>
        <IconButton
          label="Next page"
          onClick={() => goTo(index + 1, 1)}
          disabled={index >= list.length - 1}
        >
          <ChevronRight size={18} />
        </IconButton>
      </nav>
    </ReaderShell>
  )
}

function ReaderShell({
  title,
  slug,
  index,
  total,
  percent,
  onSettings,
  children,
}: {
  title: string
  slug: string
  index: number
  total: number
  percent: number
  onSettings: () => void
  children: React.ReactNode
}) {
  const { style, className } = useReaderTypography()

  return (
    <div
      style={style}
      className={cn('paper-grain relative flex h-dvh flex-col bg-ink-bg', className)}
    >
      <header className="flex h-14 shrink-0 items-center gap-3 px-3 sm:px-5">
        <Link
          to={`/books/${slug}`}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-ink-muted transition-colors hover:text-ink-text"
        >
          <ChevronLeft size={16} />
          <span className="hidden sm:inline">Back</span>
        </Link>
        <p className="min-w-0 flex-1 truncate text-center font-display text-sm text-ink-muted">
          {title}
        </p>
        <span className="hidden text-xs tabular-nums text-ink-faint sm:inline">
          {index + 1} / {total}
        </span>
        <IconButton label="Reading settings" onClick={onSettings}>
          <Settings2 size={17} />
        </IconButton>
      </header>

      <div className="h-px w-full shrink-0 bg-ink-line/70" aria-hidden>
        <div
          className="h-full bg-amber/70 transition-[width] duration-300 ease-paper"
          style={{ width: `${percent}%` }}
        />
      </div>

      {children}
    </div>
  )
}
