import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AnimatePresence } from 'motion/react'
import { ChevronLeft, ChevronRight, Lock, MessageSquare, PanelRight, X } from 'lucide-react'
import { GlobalWorkerOptions, getDocument, type PDFDocumentProxy } from 'pdfjs-dist'
import PdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { PdfPageView, type Overlay } from '@/features/import/PdfPageView'
import { SelectionToolbar } from '@/features/reader/SelectionToolbar'
import { NotesPanel } from '@/features/reader/NotesPanel'
import { DiscussionPanel } from '@/features/reader/DiscussionPanel'
import { NoteEditorModal } from '@/features/reader/NoteEditorModal'
import { PassageCommentModal } from '@/features/reader/PassageCommentModal'
import { useHighlightActions, useHighlights, useNotes } from '@/features/reader/useAnnotations'
import { useAllComments } from '@/features/comments/useComments'
import { useAuthGate } from '@/features/auth/useAuthGate'
import { PRIVACY } from '@/features/reader/privacy'
import { IconButton } from '@/components/Button'
import { ErrorState, Loading } from '@/components/States'
import { useBook } from '@/lib/books'
import { useInviteToken } from '@/lib/invite'
import { useModal } from '@/lib/modal'
import { useToast } from '@/lib/toast'
import { mediaUrl } from '@/lib/api'
import { pdfAnchorFromSelection, pdfPageOf, pdfRectsFor } from '@/lib/pdfAnchor'
import { selectionRect } from '@/lib/anchor'
import { cn } from '@/lib/utils'
import type { Anchor, HighlightColor } from '@/lib/types'

GlobalWorkerOptions.workerSrc = PdfWorker

type PanelTab = 'marks' | 'discussion'

/**
 * The fallback reader for imports whose conversion could not be trusted.
 *
 * It is deliberately not a downgrade: the same highlight colours, the same
 * private notes with attachments, and the same passage-anchored discussions
 * work here, against pdf.js' text layer instead of a ProseMirror document.
 */
export function PdfReaderPage() {
  const { slug = '' } = useParams()
  const invite = useInviteToken()
  const { open } = useModal()
  const toast = useToast()
  const { requireAuth } = useAuthGate()

  const book = useBook(slug, invite)
  const highlights = useHighlights(slug, invite)
  const notes = useNotes(slug, invite)
  const comments = useAllComments(slug, invite)
  const highlightActions = useHighlightActions(slug, invite)

  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null)
  const [failed, setFailed] = useState(false)
  const [pageNumber, setPageNumber] = useState(1)
  const [pageText, setPageText] = useState('')
  const [selection, setSelection] = useState<{ rect: DOMRect; anchor: Anchor } | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [tab, setTab] = useState<PanelTab>('marks')

  const host = useRef<HTMLDivElement>(null)
  const pageBox = useRef<HTMLDivElement>(null)

  const originalUrl = book.data?.import_source?.original_url

  useEffect(() => {
    if (!originalUrl) return
    let cancelled = false
    const task = getDocument({ url: mediaUrl(originalUrl)!, withCredentials: true })
    task.promise
      .then((doc) => {
        if (!cancelled) setPdf(doc)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
      void task.destroy()
    }
  }, [originalUrl])

  const threads = comments.data ?? []

  const overlays = useMemo<Overlay[]>(() => {
    const out: Overlay[] = []
    for (const highlight of highlights.data ?? []) {
      const rects = pdfRectsFor(highlight.anchor, pageNumber)
      if (rects.length) out.push({ id: highlight.id, rects, kind: 'highlight', color: highlight.color })
    }
    for (const thread of threads) {
      const rects = pdfRectsFor(thread.root.anchor, pageNumber)
      if (rects.length) out.push({ id: thread.root.id, rects, kind: 'discussion' })
    }
    return out
  }, [highlights.data, threads, pageNumber])

  const readSelection = useCallback(() => {
    const box = pageBox.current
    if (!box) return
    const anchor = pdfAnchorFromSelection(pageNumber, box, pageText)
    const rect = selectionRect()
    setSelection(anchor && rect ? { rect, anchor } : null)
  }, [pageNumber, pageText])

  useEffect(() => {
    const onUp = () => window.setTimeout(readSelection, 0)
    document.addEventListener('mouseup', onUp)
    document.addEventListener('touchend', onUp)
    return () => {
      document.removeEventListener('mouseup', onUp)
      document.removeEventListener('touchend', onUp)
    }
  }, [readSelection])

  const clearSelection = () => {
    window.getSelection()?.removeAllRanges()
    setSelection(null)
  }

  const goTo = (next: number) => {
    if (!pdf) return
    setPageNumber(Math.max(1, Math.min(next, pdf.numPages)))
    setSelection(null)
    host.current?.scrollTo({ top: 0 })
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, [contenteditable="true"]')) return
      if (event.key === 'ArrowRight' || event.key === 'PageDown') goTo(pageNumber + 1)
      if (event.key === 'ArrowLeft' || event.key === 'PageUp') goTo(pageNumber - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageNumber, pdf])

  if (book.isLoading) return <Loading label="Opening the original…" />
  if (book.isError || !book.data) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24">
        <ErrorState title="This book is not available" />
      </div>
    )
  }
  if (!originalUrl) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24">
        <ErrorState
          title="There is no original file for this book"
          body="Only imported books have one. Read the CART pages instead."
        />
      </div>
    )
  }
  if (failed) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24">
        <ErrorState
          title="The original could not be opened"
          body="The file is stored safely — try downloading it directly."
        />
      </div>
    )
  }

  const openHighlight = (color: HighlightColor) =>
    void requireAuth(() => {
      if (!selection) return
      highlightActions.create.mutate({ page_id: null, anchor: selection.anchor, color })
      clearSelection()
    }, 'Create an account to highlight passages.')

  const pageLabel = (anchor?: Anchor | null) => {
    const page = pdfPageOf(anchor)
    return page ? `Page ${page}` : null
  }

  return (
    <div className="paper-grain relative flex h-dvh bg-ink-bg">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 px-3 sm:px-5">
          <Link
            to={`/books/${slug}`}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-ink-muted transition-colors hover:text-ink-text"
          >
            <ChevronLeft size={16} />
            <span className="hidden sm:inline">Back</span>
          </Link>
          <div className="min-w-0 flex-1 text-center">
            <p className="truncate font-display text-sm text-ink-muted">{book.data.title}</p>
            <p className="text-2xs text-ink-faint">reading the original file</p>
          </div>
          <IconButton
            label={panelOpen ? 'Hide the side panel' : 'Show notes and discussions'}
            active={panelOpen}
            onClick={() => setPanelOpen((value) => !value)}
          >
            <PanelRight size={17} />
          </IconButton>
        </header>

        <div ref={host} className="vignette min-h-0 flex-1 overflow-y-auto px-4 py-8">
          <div ref={pageBox} className="relative mx-auto w-fit">
            {pdf ? (
              <PdfPageView
                pdf={pdf}
                pageNumber={pageNumber}
                overlays={overlays}
                activeId={activeId}
                onText={setPageText}
                onOverlayClick={(id) => {
                  setActiveId(id)
                  setTab(threads.some((thread) => thread.root.id === id) ? 'discussion' : 'marks')
                  setPanelOpen(true)
                }}
                containerRef={host}
              />
            ) : (
              <Loading label="Loading the document…" />
            )}
          </div>
        </div>

        <AnimatePresence>
          {selection && (
            <SelectionToolbar
              rect={selection.rect}
              actions={{
                onHighlight: openHighlight,
                onNote: () =>
                  void requireAuth(() => {
                    const anchor = selection.anchor
                    clearSelection()
                    open(({ close }) => (
                      <NoteEditorModal bookRef={slug} invite={invite} anchor={anchor} pageId={null} onDone={close} />
                    ))
                  }, 'Create an account to keep notes.'),
                onComment: () =>
                  void requireAuth(() => {
                    const anchor = selection.anchor
                    clearSelection()
                    setTab('discussion')
                    open(({ close }) => (
                      <PassageCommentModal
                        bookRef={slug}
                        invite={invite}
                        anchor={anchor}
                        pageId={null}
                        onDone={(created) => {
                          close()
                          if (created) {
                            setActiveId(created)
                            setPanelOpen(true)
                          }
                        }}
                      />
                    ))
                  }, 'Create an account to start a discussion.'),
                onCopy: () => {
                  void navigator.clipboard.writeText(selection.anchor.quote).catch(() => undefined)
                  toast.success('Passage copied.')
                  clearSelection()
                },
                onQuote: () => {
                  void navigator.clipboard
                    .writeText(
                      `“${selection.anchor.quote}”\n— ${book.data!.author.display_name}, ${book.data!.title}`,
                    )
                    .catch(() => undefined)
                  toast.success('Quotation copied with its source.')
                  clearSelection()
                },
              }}
            />
          )}
        </AnimatePresence>

        <nav className="flex h-14 shrink-0 items-center justify-between gap-4 border-t border-ink-line/60 px-4">
          <IconButton label="Previous page" onClick={() => goTo(pageNumber - 1)} disabled={pageNumber <= 1}>
            <ChevronLeft size={18} />
          </IconButton>
          <span className="text-xs tabular-nums text-ink-faint">
            Page {pageNumber} of {pdf?.numPages ?? '…'}
          </span>
          <IconButton
            label="Next page"
            onClick={() => goTo(pageNumber + 1)}
            disabled={!pdf || pageNumber >= pdf.numPages}
          >
            <ChevronRight size={18} />
          </IconButton>
        </nav>
      </div>

      <aside
        aria-label="Notes and discussions"
        className={cn(
          'z-40 flex w-[23rem] shrink-0 flex-col border-l border-ink-line bg-ink-surface/70 transition-transform duration-200',
          'fixed inset-y-0 right-0 max-w-[88vw] lg:static lg:max-w-none',
          panelOpen ? 'translate-x-0' : 'translate-x-full lg:hidden',
        )}
      >
        <div className="flex h-14 shrink-0 items-center gap-1 border-b border-ink-line px-2">
          {(['marks', 'discussion'] as PanelTab[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              title={value === 'marks' ? PRIVACY.private.full : PRIVACY.public.full}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs transition-colors',
                tab === value
                  ? value === 'marks'
                    ? 'bg-amber/15 text-amber'
                    : 'bg-teal/20 text-teal-soft'
                  : 'text-ink-muted hover:text-ink-text',
              )}
            >
              {value === 'marks' ? <Lock size={11} /> : <MessageSquare size={11} />}
              {value === 'marks' ? `Private · ${(notes.data ?? []).length}` : `Public · ${threads.length}`}
            </button>
          ))}
          <IconButton label="Close panel" onClick={() => setPanelOpen(false)} className="ml-auto">
            <X size={16} />
          </IconButton>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {tab === 'marks' ? (
            <NotesPanel
              notes={notes.data ?? []}
              highlights={highlights.data ?? []}
              pageIndexOf={() => null}
              pageLabelOf={(anchor) => pageLabel(anchor)}
              orphanIds={new Set()}
              activeId={activeId}
              onOpenNote={(note) =>
                open(({ close }) => (
                  <NoteEditorModal bookRef={slug} invite={invite} note={note} onDone={close} />
                ))
              }
              onGoTo={(_pageId, id) => {
                const anchor =
                  (highlights.data ?? []).find((item) => item.id === id)?.anchor ??
                  (notes.data ?? []).find((item) => item.id === id)?.anchor
                const page = pdfPageOf(anchor)
                if (page) goTo(page)
                setActiveId(id)
              }}
              onNewNoteFor={(highlight) =>
                open(({ close }) => (
                  <NoteEditorModal
                    bookRef={slug}
                    invite={invite}
                    anchor={highlight.anchor}
                    pageId={null}
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
              pageIndexOf={() => null}
              pageLabelOf={(anchor) => pageLabel(anchor)}
              orphanIds={new Set()}
              activeId={activeId}
              onGoTo={(_pageId, id) => {
                const thread = threads.find((item) => item.root.id === id)
                const page = pdfPageOf(thread?.root.anchor)
                if (page) goTo(page)
                setActiveId(id)
              }}
            />
          )}
        </div>
      </aside>

      {panelOpen && (
        <button
          type="button"
          aria-label="Close panel"
          onClick={() => setPanelOpen(false)}
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
        />
      )}
    </div>
  )
}
