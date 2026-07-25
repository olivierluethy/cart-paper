import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronLeft, ChevronRight, Lock, MessageSquare, PanelRight, Pencil, Settings2, X } from 'lucide-react'
import type { Editor } from '@tiptap/react'
import { PageView } from '@/features/reader/PageView'
import { SelectionToolbar } from '@/features/reader/SelectionToolbar'
import { NotesPanel } from '@/features/reader/NotesPanel'
import { DiscussionPanel } from '@/features/reader/DiscussionPanel'
import { MarginMarkers, type Marker } from '@/features/reader/MarginMarkers'
import { NoteEditorModal } from '@/features/reader/NoteEditorModal'
import { PassageCommentModal } from '@/features/reader/PassageCommentModal'
import { useAnnotationLayer, type DiscussionMarker } from '@/features/reader/useAnnotationLayer'
import { useHighlightActions, useHighlights, useNoteActions, useNotes } from '@/features/reader/useAnnotations'
import { NoteComposerPopover, type ComposerTarget } from '@/features/reader/NoteComposerPopover'
import { EndOfBook } from '@/features/reader/EndOfBook'
import { PRIVACY } from '@/features/reader/privacy'
import {
  useHeartbeat,
  useProgress,
  useReaderTypography,
  useRestartBook,
  useSaveProgress,
} from '@/features/reader/useReading'
import { useAllComments } from '@/features/comments/useComments'
import { SettingsModal } from '@/features/profile/SettingsModal'
import { useAuthGate } from '@/features/auth/useAuthGate'
import { IconButton } from '@/components/Button'
import { ErrorState, Loading } from '@/components/States'
import { useBook, usePagesFull } from '@/lib/books'
import { useInviteToken } from '@/lib/invite'
import { usePageMeta } from '@/lib/page-meta'
import { useModal } from '@/lib/modal'
import { useToast } from '@/lib/toast'
import { anchorFrom, selectionRange, selectionRect } from '@/lib/anchor'
import { cn, prefersReducedMotion } from '@/lib/utils'
import type { Highlight, HighlightColor, UUID } from '@/lib/types'

const SWIPE_THRESHOLD = 56
type PanelTab = 'marks' | 'discussion'

export function ReaderPage() {
  const { slug = '' } = useParams()
  const invite = useInviteToken()
  const navigate = useNavigate()
  const { open } = useModal()
  const toast = useToast()
  const { user, requireAuth } = useAuthGate()
  const [params] = useSearchParams()

  const book = useBook(slug, invite)
  const pages = usePagesFull(slug, invite)
  const progress = useProgress(slug, invite)
  const saveProgress = useSaveProgress(slug, invite)
  const highlights = useHighlights(slug, invite)
  const notes = useNotes(slug, invite)
  const comments = useAllComments(slug, invite)
  const highlightActions = useHighlightActions(slug, invite)
  const noteActions = useNoteActions(slug, invite)
  const restart = useRestartBook(slug)

  const list = useMemo(() => pages.data ?? [], [pages.data])
  const [index, setIndex] = useState(0)
  const [direction, setDirection] = useState(1)
  const [resumeOffer, setResumeOffer] = useState<number | null>(null)
  const [editor, setEditor] = useState<Editor | null>(null)
  const [selection, setSelection] = useState<{ rect: DOMRect; from: number; to: number } | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [tab, setTab] = useState<PanelTab>('marks')
  const [pendingScroll, setPendingScroll] = useState<string | null>(null)
  const [markers, setMarkers] = useState<Marker[]>([])
  const [composer, setComposer] = useState<ComposerTarget | null>(null)
  const [savingNote, setSavingNote] = useState(false)
  const [showEnd, setShowEnd] = useState(false)

  const resumeChecked = useRef(false)
  const deepLinkDone = useRef(false)
  const surface = useRef<HTMLDivElement>(null)
  const touchStart = useRef<{ x: number; y: number } | null>(null)

  const page = list[index]
  const countPageTurn = useHeartbeat(slug, list.length > 0, invite)
  usePageMeta(book.data?.title)

  const threads = comments.data ?? []
  const discussions = useMemo<DiscussionMarker[]>(
    () =>
      threads
        .filter((thread) => thread.root.anchor?.quote && thread.root.page_id)
        .map((thread) => ({
          id: thread.root.id,
          anchor: thread.root.anchor!,
          page_id: thread.root.page_id,
          replies: thread.replies.length,
        })),
    [threads],
  )

  const layer = useAnnotationLayer({
    editor,
    pageId: page?.id ?? null,
    highlights: highlights.data ?? [],
    discussions,
    activeId,
  })

  const pageIndexOf = useCallback(
    (pageId: UUID | null) => {
      if (!pageId) return null
      const at = list.findIndex((item) => item.id === pageId)
      return at === -1 ? null : at
    },
    [list],
  )

  // ---------------------------------------------------------------- navigation
  useEffect(() => {
    if (deepLinkDone.current || !list.length) return
    const wanted = Number(params.get('p'))
    const thread = params.get('c')
    if (Number.isFinite(wanted) && wanted > 0) {
      setIndex(Math.min(wanted - 1, list.length - 1))
      resumeChecked.current = true
      deepLinkDone.current = true
    }
    if (thread) {
      setActiveId(thread)
      setTab('discussion')
      setPendingScroll(thread)
      resumeChecked.current = true
      deepLinkDone.current = true
    }
  }, [params, list.length])

  useEffect(() => {
    if (resumeChecked.current || !list.length || progress.isLoading) return
    resumeChecked.current = true
    const saved = progress.data
    if (!saved?.page_id) return
    // A finished book resumes silently at page one rather than nagging.
    if (saved.completed_at && saved.percent >= 0.999) return
    const at = list.findIndex((item) => item.id === saved.page_id)
    if (at > 0) setResumeOffer(at)
  }, [progress.data, progress.isLoading, list])

  const goTo = useCallback(
    (next: number, dir: number) => {
      if (!list.length) return
      // Paging past the last page is how a reader says "I am done".
      if (next > list.length - 1) {
        setShowEnd(true)
        return
      }
      const bounded = Math.max(0, Math.min(next, list.length - 1))
      setDirection(dir)
      setIndex((current) => {
        if (current !== bounded) countPageTurn()
        return bounded
      })
      setResumeOffer(null)
      setSelection(null)
      surface.current?.scrollTo({ top: 0, behavior: 'auto' })
    },
    [list.length, countPageTurn],
  )

  const goToAnnotation = useCallback(
    (pageId: UUID | null, id: string) => {
      const at = pageIndexOf(pageId)
      setActiveId(id)
      if (at !== null && at !== index) {
        goTo(at, at > index ? 1 : -1)
        setPendingScroll(id)
      } else {
        layer.scrollTo(id)
      }
      if (window.innerWidth < 1024) setPanelOpen(false)
    },
    [pageIndexOf, index, goTo, layer],
  )

  useEffect(() => {
    if (!pendingScroll || !editor) return
    const timer = window.setTimeout(() => {
      if (layer.scrollTo(pendingScroll)) setPendingScroll(null)
    }, 80)
    return () => window.clearTimeout(timer)
  }, [pendingScroll, editor, layer])

  useEffect(() => {
    if (!page || !user) return
    const bounded = Math.max(0, Math.min(index, Math.max(list.length - 1, 0)))
    saveProgress({
      page_id: page.id,
      anchor: null,
      percent: list.length > 1 ? bounded / (list.length - 1) : 1,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, page?.id, user])

  // Confirm completion once the end screen is actually reached.
  useEffect(() => {
    if (!showEnd || !user || !page) return
    saveProgress({ page_id: page.id, anchor: null, percent: 1, completed: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showEnd, user])

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
        if (selection) setSelection(null)
        else navigate(`/books/${slug}`)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, goTo, list.length, navigate, slug, selection])

  // ------------------------------------------------------------ margin markers
  useEffect(() => {
    const container = surface.current
    if (!container) return
    const replyCounts = new Map(discussions.map((item) => [item.id, item.replies]))
    const byId = new Map((highlights.data ?? []).map((item) => [item.id, item]))

    const measure = () => {
      const bounds = container.getBoundingClientRect()
      const next: Marker[] = []
      for (const item of layer.resolved) {
        const rect = layer.rectFor(item.id)
        if (!rect) continue
        const top = rect.top - bounds.top + container.scrollTop

        if (item.kind === 'discussion') {
          next.push({ kind: 'discussion', id: item.id, replies: replyCounts.get(item.id) ?? 0, top })
          continue
        }
        // A highlight either carries a note, or advertises that it could.
        const highlight = byId.get(item.id)
        if (!highlight) continue
        next.push({
          kind: highlight.note_id ? 'note' : 'add-note',
          id: item.id,
          color: highlight.color,
          top,
        })
      }
      setMarkers(next)
    }

    const frame = requestAnimationFrame(measure)
    window.addEventListener('resize', measure)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', measure)
    }
  }, [layer.resolved, layer.rectFor, discussions, highlights.data, index])

  // ----------------------------------------------------------------- selection
  const readSelection = useCallback(() => {
    if (!editor || editor.isDestroyed) return
    const range = selectionRange(editor)
    const rect = selectionRect()
    if (!range || !rect) {
      setSelection(null)
      return
    }
    setSelection({ rect, from: range.from, to: range.to })
  }, [editor])

  useEffect(() => {
    const onUp = () => window.setTimeout(readSelection, 0)
    document.addEventListener('mouseup', onUp)
    document.addEventListener('touchend', onUp)
    return () => {
      document.removeEventListener('mouseup', onUp)
      document.removeEventListener('touchend', onUp)
    }
  }, [readSelection])

  const currentAnchor = useMemo(() => {
    if (!editor || !selection || !page) return null
    return anchorFrom(editor, page.id, { from: selection.from, to: selection.to })
  }, [editor, selection, page])

  const highlightUnderSelection = useMemo((): Highlight | null => {
    if (!selection) return null
    const hit = layer.resolved.find(
      (item) => item.kind === 'highlight' && item.from <= selection.from && item.to >= selection.to,
    )
    if (!hit) return null
    return (highlights.data ?? []).find((item) => item.id === hit.id) ?? null
  }, [selection, layer.resolved, highlights.data])

  const clearSelection = () => {
    window.getSelection()?.removeAllRanges()
    setSelection(null)
  }

  const applyHighlight = (color: HighlightColor) =>
    void requireAuth(async () => {
      if (!currentAnchor || !page) return
      const anchor = currentAnchor
      const pageId = page.id
      const rect = selection?.rect ?? null

      if (highlightUnderSelection) {
        // Re-clicking the active colour removes it; any other colour recolours.
        if (highlightUnderSelection.color === color) {
          highlightActions.remove.mutate(highlightUnderSelection.id)
          clearSelection()
        } else {
          highlightActions.recolor.mutate({ id: highlightUnderSelection.id, color })
          clearSelection()
        }
        return
      }

      clearSelection()
      const created = await highlightActions.create
        .mutateAsync({ page_id: pageId, anchor, color })
        .catch(() => null)
      // Attaching a private note is offered the moment the highlight exists,
      // rather than left to be discovered by hovering the margin.
      if (created && rect) {
        setComposer({ highlightId: created.id, anchor, pageId, color, rect })
      }
    }, 'Create an account to highlight passages.')

  const saveComposerNote = async (text: string) => {
    if (!composer) return
    setSavingNote(true)
    try {
      await noteActions.create.mutateAsync({
        highlight_id: composer.highlightId,
        page_id: composer.pageId,
        anchor: composer.anchor,
        body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] },
      })
      setComposer(null)
      toast.success('Private note saved — only you can see it.')
    } finally {
      setSavingNote(false)
    }
  }

  const openNoteForSelection = () =>
    void requireAuth(() => {
      if (!currentAnchor || !page) return
      const anchor = currentAnchor
      const pageId = page.id
      clearSelection()
      open(({ close }) => (
        <NoteEditorModal bookRef={slug} invite={invite} anchor={anchor} pageId={pageId} onDone={close} />
      ))
    }, 'Create an account to keep notes.')

  const openCommentForSelection = () =>
    void requireAuth(() => {
      if (!currentAnchor || !page) return
      const anchor = currentAnchor
      const pageId = page.id
      clearSelection()
      setTab('discussion')
      open(({ close }) => (
        <PassageCommentModal
          bookRef={slug}
          invite={invite}
          anchor={anchor}
          pageId={pageId}
          onDone={(created) => {
            close()
            if (created) {
              setActiveId(created)
              setPanelOpen(true)
            }
          }}
        />
      ))
    }, 'Create an account to start a discussion on this passage.')

  const copySelection = async () => {
    if (!currentAnchor) return
    await navigator.clipboard.writeText(currentAnchor.quote).catch(() => undefined)
    toast.success('Passage copied.')
    clearSelection()
  }

  const quoteSelection = async () => {
    if (!currentAnchor || !book.data) return
    const text = `“${currentAnchor.quote}”\n— ${book.data.author.display_name}, ${book.data.title}`
    await navigator.clipboard.writeText(text).catch(() => undefined)
    toast.success('Quotation copied with its source.')
    clearSelection()
  }

  useEffect(() => {
    const node = editor?.view.dom
    if (!node) return
    const onClick = (event: MouseEvent) => {
      const target = (event.target as HTMLElement).closest('[data-annotation-id]')
      const id = target?.getAttribute('data-annotation-id')
      if (!id) return
      setActiveId(id)
      setTab(target?.getAttribute('data-annotation-kind') === 'discussion' ? 'discussion' : 'marks')
      setPanelOpen(true)
    }
    node.addEventListener('click', onClick)
    return () => node.removeEventListener('click', onClick)
  }, [editor])

  // ------------------------------------------------------------------- render
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

  const percent = list.length > 1 ? (index / (list.length - 1)) * 100 : 100
  const reduced = prefersReducedMotion()
  const noteList = notes.data ?? []
  const highlightList = highlights.data ?? []

  return (
    <ReaderShell
      title={book.data.title}
      slug={slug}
      index={index}
      total={list.length}
      percent={percent}
      noteCount={noteList.length}
      discussionCount={threads.length}
      panelOpen={panelOpen}
      tab={tab}
      onTab={setTab}
      onTogglePanel={() => setPanelOpen((value) => !value)}
      onOpenPanel={() => setPanelOpen(true)}
      onSettings={() => open(({ close }) => <SettingsModal onDone={close} />)}
      panel={
        tab === 'marks' ? (
          <NotesPanel
            notes={noteList}
            highlights={highlightList}
            pageIndexOf={pageIndexOf}
            orphanIds={layer.orphanIds}
            activeId={activeId}
            onOpenNote={(note) =>
              open(({ close }) => (
                <NoteEditorModal bookRef={slug} invite={invite} note={note} onDone={close} />
              ))
            }
            onGoTo={goToAnnotation}
            onNewNoteFor={(highlight) =>
              open(({ close }) => (
                <NoteEditorModal
                  bookRef={slug}
                  invite={invite}
                  anchor={highlight.anchor}
                  pageId={highlight.page_id}
                  highlightId={highlight.id}
                  highlightColor={highlight.color}
                  onDone={close}
                />
              ))
            }
          />
        ) : (
          <DiscussionPanel
            bookRef={slug}
            invite={invite}
            threads={threads}
            pageIndexOf={pageIndexOf}
            orphanIds={layer.orphanIds}
            activeId={activeId}
            onGoTo={goToAnnotation}
          />
        )
      }
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
          touchStart.current = null
          if (!start || !touch || selection) return
          const dx = touch.clientX - start.x
          const dy = touch.clientY - start.y
          if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy) * 1.5) {
            goTo(index + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1)
          }
        }}
      >
        <button
          type="button"
          aria-label="Previous page"
          onClick={() => goTo(index - 1, -1)}
          disabled={index === 0}
          className="absolute inset-y-0 left-0 z-10 hidden w-[max(3rem,calc((100%-var(--reader-width))/2-3.5rem))] cursor-w-resize disabled:cursor-default lg:block"
        />
        <button
          type="button"
          aria-label="Next page"
          onClick={() => goTo(index + 1, 1)}
          className="absolute inset-y-0 right-0 z-10 hidden w-[max(3rem,calc((100%-var(--reader-width))/2-3.5rem))] cursor-e-resize lg:block"
        />

        <MarginMarkers
          markers={markers}
          activeId={activeId}
          onOpen={(marker) => {
            setActiveId(marker.id)
            if (marker.kind === 'discussion') {
              setTab('discussion')
              setPanelOpen(true)
              return
            }
            if (marker.kind === 'note') {
              const note = noteList.find((item) => item.highlight_id === marker.id)
              if (note) {
                open(({ close }) => (
                  <NoteEditorModal bookRef={slug} invite={invite} note={note} onDone={close} />
                ))
                return
              }
            }
            // "+ note" on a highlight that has none yet.
            const highlight = (highlights.data ?? []).find((item) => item.id === marker.id)
            const rect = layer.rectFor(marker.id)
            if (highlight && rect) {
              setComposer({
                highlightId: highlight.id,
                anchor: highlight.anchor,
                pageId: highlight.page_id,
                color: highlight.color,
                rect,
              })
            }
          }}
        />

        <AnimatePresence>
          {showEnd && book.data && (
            <EndOfBook
              book={book.data}
              highlights={highlightList.length}
              notes={noteList.length}
              onRate={() => navigate(`/books/${slug}#rating`)}
              onComment={() => navigate(`/books/${slug}#comments`)}
              onRestart={async () => {
                await restart.mutateAsync().catch(() => undefined)
                setShowEnd(false)
                goTo(0, -1)
              }}
              onClose={() => setShowEnd(false)}
              onLibrary={() => navigate('/')}
            />
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait" initial={false}>
          <motion.article
            key={page?.id ?? index}
            initial={reduced ? { opacity: 0 } : { opacity: 0, x: direction * 18 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, x: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, x: direction * -14 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="relative z-20 mx-auto w-[min(var(--reader-width),100%-2.5rem)] py-12 sm:py-16"
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
        {selection && currentAnchor && (
          <SelectionToolbar
            rect={selection.rect}
            activeColor={highlightUnderSelection?.color ?? null}
            actions={{
              onHighlight: applyHighlight,
              onNote: openNoteForSelection,
              onComment: openCommentForSelection,
              onCopy: () => void copySelection(),
              onQuote: () => void quoteSelection(),
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {composer && (
          <NoteComposerPopover
            target={composer}
            saving={savingNote}
            onSave={(text) => void saveComposerNote(text)}
            onDismiss={() => setComposer(null)}
            onExpand={(text) => {
              const target = composer
              setComposer(null)
              open(({ close }) => (
                <NoteEditorModal
                  bookRef={slug}
                  invite={invite}
                  anchor={target.anchor}
                  pageId={target.pageId}
                  highlightId={target.highlightId}
                  highlightColor={target.color}
                  initialText={text}
                  onDone={close}
                />
              ))
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {resumeOffer !== null && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.24, ease: 'easeOut' }}
            className="fixed bottom-20 left-1/2 z-30 -translate-x-1/2"
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
          label={index >= list.length - 1 ? 'Finish the book' : 'Next page'}
          onClick={() => goTo(index + 1, 1)}
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
  noteCount,
  discussionCount,
  panelOpen,
  tab,
  onTab,
  onTogglePanel,
  onOpenPanel,
  onSettings,
  panel,
  children,
}: {
  title: string
  slug: string
  index: number
  total: number
  percent: number
  noteCount: number
  discussionCount: number
  panelOpen: boolean
  tab: PanelTab
  onTab: (tab: PanelTab) => void
  onTogglePanel: () => void
  onOpenPanel: () => void
  onSettings: () => void
  panel: React.ReactNode
  children: React.ReactNode
}) {
  const { style, className } = useReaderTypography()

  return (
    <div style={style} className={cn('paper-grain relative flex h-dvh bg-ink-bg', className)}>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 px-3 sm:px-5">
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
          {/* Two separate counts, so private and public never read as one pile. */}
          <button
            type="button"
            onClick={() => {
              onTab('marks')
              onOpenPanel()
            }}
            aria-label={`Your private notes — ${noteCount}`}
            title={PRIVACY.private.full}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-amber transition-colors hover:bg-amber/10"
          >
            <Pencil size={14} />
            <span className="tabular-nums">{noteCount}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onTab('discussion')
              onOpenPanel()
            }}
            aria-label={`Public discussions — ${discussionCount}`}
            title={PRIVACY.public.full}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-teal-soft transition-colors hover:bg-teal/10"
          >
            <MessageSquare size={14} />
            <span className="tabular-nums">{discussionCount}</span>
          </button>
          <IconButton
            label={panelOpen ? 'Hide the side panel' : 'Show notes and discussions'}
            active={panelOpen}
            onClick={onTogglePanel}
          >
            <PanelRight size={17} />
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

      <aside
        aria-label="Notes and discussions"
        className={cn(
          'z-40 flex w-[23rem] shrink-0 flex-col border-l border-ink-line bg-ink-surface/70 transition-transform duration-200 ease-paper',
          'fixed inset-y-0 right-0 max-w-[88vw] lg:static lg:max-w-none',
          panelOpen ? 'translate-x-0' : 'translate-x-full lg:hidden',
        )}
      >
        <div className="flex h-14 shrink-0 items-center gap-1 border-b border-ink-line px-2">
          <button
            type="button"
            onClick={() => onTab('marks')}
            aria-current={tab === 'marks'}
            title={PRIVACY.private.full}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs transition-colors',
              tab === 'marks' ? 'bg-amber/15 text-amber' : 'text-ink-muted hover:text-ink-text',
            )}
          >
            <Lock size={11} />
            Private · {noteCount}
          </button>
          <button
            type="button"
            onClick={() => onTab('discussion')}
            aria-current={tab === 'discussion'}
            title={PRIVACY.public.full}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs transition-colors',
              tab === 'discussion' ? 'bg-teal/20 text-teal-soft' : 'text-ink-muted hover:text-ink-text',
            )}
          >
            <MessageSquare size={11} />
            Public · {discussionCount}
          </button>
          <IconButton label="Close panel" onClick={onTogglePanel} className="ml-auto">
            <X size={16} />
          </IconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{panel}</div>
      </aside>

      {panelOpen && (
        <button
          type="button"
          aria-label="Close panel"
          onClick={onTogglePanel}
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
        />
      )}
    </div>
  )
}
