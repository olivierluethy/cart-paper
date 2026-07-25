import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Eye, PanelLeft, PanelRight, Send, Users } from 'lucide-react'
import { Button, IconButton } from '@/components/Button'
import { Loading, ErrorState } from '@/components/States'
import { PageRail } from '@/features/editor/PageRail'
import { BookSettingsRail } from '@/features/editor/BookSettingsRail'
import { SaveIndicator } from '@/features/editor/SaveIndicator'
import { PageEditor } from '@/features/editor/PageEditor'
import { useAutosave } from '@/features/editor/useAutosave'
import {
  useBook,
  useCreatePage,
  useDeletePage,
  useDuplicatePage,
  usePage,
  usePages,
  useReorderPages,
  useSavePage,
} from '@/lib/books'
import { InviteModal } from '@/features/publishing/InviteModal'
import { usePublishing } from '@/features/publishing/usePublishing'
import { firstHeading } from '@/lib/doc'
import { useModal } from '@/lib/modal'
import { useToast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import type { JSONContent, PageSummary, UUID } from '@/lib/types'

export function WorkspacePage() {
  const { bookId = '' } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { confirm, open } = useModal()
  const publishing = usePublishing(bookId)

  const book = useBook(bookId)
  const pages = usePages(bookId)
  const [activeId, setActiveId] = useState<UUID | null>(null)
  const [leftOpen, setLeftOpen] = useState(false)
  const [rightOpen, setRightOpen] = useState(false)

  const createPage = useCreatePage(bookId)
  const duplicatePage = useDuplicatePage(bookId)
  const deletePage = useDeletePage(bookId)
  const reorderPages = useReorderPages(bookId)
  const savePage = useSavePage(bookId)

  const list = useMemo(() => pages.data ?? [], [pages.data])
  useEffect(() => {
    if (!activeId && list.length) setActiveId(list[0]!.id)
    if (activeId && list.length && !list.some((page) => page.id === activeId)) {
      setActiveId(list[0]!.id)
    }
  }, [list, activeId])

  const active = usePage(bookId, activeId ?? undefined)

  const autosave = useAutosave<{ content?: JSONContent; title?: string | null }>(async (patch) => {
    if (!activeId) return
    await savePage.mutateAsync({ pageId: activeId, ...patch })
  })

  if (book.isLoading || pages.isLoading) return <Loading label="Opening the workspace…" />
  if (book.isError || !book.data) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24">
        <ErrorState
          title="That draft is not available"
          body="It may have been deleted, or it belongs to someone else."
          onRetry={() => book.refetch()}
        />
      </div>
    )
  }
  if (!book.data.can_edit) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24">
        <ErrorState title="You cannot edit this book" body="Only its author can open the workspace." />
      </div>
    )
  }

  const titleFor = (page: PageSummary) => {
    if (page.title) return page.title
    if (page.id === activeId && active.data) {
      const heading = firstHeading(active.data.content)
      if (heading) return heading
    }
    return `Page ${page.index + 1}`
  }

  const removePage = async (id: UUID) => {
    const ok = await confirm({
      title: 'Delete this page?',
      body: 'The text on it, and any highlights or discussions anchored to it, go with it.',
      confirmLabel: 'Delete page',
      destructive: true,
    })
    if (!ok) return
    try {
      await deletePage.mutateAsync(id)
      toast.success('Page deleted.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not delete that page.')
    }
  }

  return (
    <div className="flex h-[calc(100dvh-4rem)] flex-col">
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-ink-line px-3 sm:px-4">
        <IconButton label="Back to my shelf" onClick={() => navigate('/shelf')}>
          <ArrowLeft size={17} />
        </IconButton>
        <IconButton
          label="Toggle page list"
          className="lg:hidden"
          onClick={() => setLeftOpen((v) => !v)}
        >
          <PanelLeft size={17} />
        </IconButton>

        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-sm font-semibold text-ink-text">
            {book.data.title}
          </p>
          <p className="truncate text-2xs text-ink-faint">
            {book.data.status === 'draft' ? 'Draft — private to you' : 'Published'} ·{' '}
            {list.length} {list.length === 1 ? 'page' : 'pages'}
          </p>
        </div>

        <SaveIndicator state={autosave.state} className="mr-1 hidden sm:inline-flex" />

        <IconButton
          label="Preview as a reader"
          onClick={() => {
            autosave.flush()
            navigate(`/books/${book.data!.slug}`)
          }}
        >
          <Eye size={16} />
        </IconButton>
        <Button
          variant="ghost"
          size="sm"
          icon={<Users size={14} />}
          className="hidden sm:inline-flex"
          onClick={() => open(({ close }) => <InviteModal book={book.data!} onDone={close} />)}
        >
          Invite
        </Button>
        {book.data.status === 'draft' ? (
          <Button
            variant="primary"
            size="sm"
            icon={<Send size={14} />}
            loading={publishing.publish.isPending}
            onClick={() => {
              autosave.flush()
              publishing.publish.mutate()
            }}
          >
            Publish
          </Button>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            loading={publishing.unpublish.isPending}
            onClick={async () => {
              const ok = await confirm({
                title: 'Unpublish this book?',
                body: 'It leaves the public library and becomes a private draft again. Comments, highlights and ratings are kept.',
                confirmLabel: 'Unpublish',
              })
              if (ok) publishing.unpublish.mutate()
            }}
          >
            Unpublish
          </Button>
        )}

        <IconButton
          label="Toggle settings"
          className="xl:hidden"
          onClick={() => setRightOpen((v) => !v)}
        >
          <PanelRight size={17} />
        </IconButton>
      </div>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[16rem_minmax(0,1fr)] xl:grid-cols-[16rem_minmax(0,1fr)_21rem]">
        {/* left rail */}
        <aside
          className={cn(
            'min-h-0 border-r border-ink-line bg-ink-surface/40',
            'fixed inset-y-0 left-0 z-40 w-72 transform bg-ink-bg transition-transform duration-200 lg:static lg:z-auto lg:w-auto lg:translate-x-0 lg:bg-transparent',
            leftOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <PageRail
            pages={list}
            activeId={activeId}
            titleFor={titleFor}
            onSelect={(id) => {
              autosave.flush()
              setActiveId(id)
              setLeftOpen(false)
            }}
            onAdd={async (index) => {
              const page = await createPage.mutateAsync({ index })
              setActiveId(page.id)
            }}
            onDuplicate={async (id) => {
              const page = await duplicatePage.mutateAsync(id)
              setActiveId(page.id)
            }}
            onDelete={removePage}
            onReorder={(ids) => reorderPages.mutate(ids)}
          />
        </aside>

        {/* editor */}
        <section className="min-h-0 overflow-y-auto">
          <div className="mx-auto max-w-prose px-5 pb-24 sm:px-8">
            {active.isLoading || !active.data ? (
              <Loading label="Loading page…" />
            ) : (
              <PageEditor
                bookId={book.data.id}
                pageKey={active.data.id}
                doc={active.data.content}
                onChange={(doc) => autosave.schedule({ content: doc })}
              />
            )}
          </div>
        </section>

        {/* right rail */}
        <aside
          className={cn(
            'min-h-0 border-l border-ink-line bg-ink-surface/40',
            'fixed inset-y-0 right-0 z-40 w-80 transform bg-ink-bg transition-transform duration-200 xl:static xl:z-auto xl:w-auto xl:translate-x-0 xl:bg-transparent',
            rightOpen ? 'translate-x-0' : 'translate-x-full',
          )}
        >
          <BookSettingsRail
            book={book.data}
            page={list.find((page) => page.id === activeId) ?? null}
            onPageTitle={(title) => autosave.schedule({ title: title || null })}
          />
        </aside>
      </div>

      {(leftOpen || rightOpen) && (
        <button
          type="button"
          aria-label="Close panel"
          onClick={() => {
            setLeftOpen(false)
            setRightOpen(false)
          }}
          className="fixed inset-0 z-30 bg-black/50 xl:hidden"
        />
      )}

      <Link to={`/books/${book.data.slug}`} className="sr-only">
        Preview this book
      </Link>
    </div>
  )
}
