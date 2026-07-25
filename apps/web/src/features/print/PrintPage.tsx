import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ChevronLeft, Download, Printer } from 'lucide-react'
import { PageView } from '@/features/reader/PageView'
import { RichTextView } from '@/components/RichText'
import { Button } from '@/components/Button'
import { Toggle } from '@/components/Field'
import { ErrorState, Loading } from '@/components/States'
import { useHighlights, useNotes } from '@/features/reader/useAnnotations'
import { useAuth } from '@/lib/auth'
import { useBook, usePagesFull } from '@/lib/books'
import { useInviteToken } from '@/lib/invite'
import { api } from '@/lib/api'
import { quoteExcerpt } from '@/lib/anchor'
import { cn } from '@/lib/utils'
import type { CoverDesign } from '@/lib/types'

function coverStyle(design: CoverDesign | null): React.CSSProperties {
  if (design?.kind === 'color' && design.color) return { background: design.color }
  if (design?.kind === 'image' && design.image_url) {
    return {
      backgroundImage: `linear-gradient(rgba(0,0,0,.25), rgba(0,0,0,.6)), url(${design.image_url})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    }
  }
  const [from, to] = design?.gradient ?? ['#2b2118', '#100c08']
  return { background: `linear-gradient(${design?.angle ?? 150}deg, ${from}, ${to})` }
}

export function PrintPage() {
  const { slug = '' } = useParams()
  const invite = useInviteToken()
  const { user } = useAuth()
  const book = useBook(slug, invite)
  const pages = usePagesFull(slug, invite)
  const highlights = useHighlights(slug, invite)
  const notes = useNotes(slug, invite)
  const [withMarks, setWithMarks] = useState(false)

  useEffect(() => {
    document.title = book.data ? `${book.data.title} — print` : 'CART Paper — print'
  }, [book.data])

  if (book.isLoading || pages.isLoading) return <Loading label="Setting the type…" />
  if (book.isError || !book.data) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24">
        <ErrorState title="This book is not available" />
      </div>
    )
  }

  const item = book.data
  const list = pages.data ?? []
  const indexOf = (pageId: string | null) => {
    const at = list.findIndex((page) => page.id === pageId)
    return at === -1 ? null : at
  }
  const myHighlights = highlights.data ?? []
  const myNotes = notes.data ?? []
  const hasMarks = myHighlights.length + myNotes.length > 0

  const exportUrl = api.url(`/books/${item.slug}/export.pdf${withMarks ? '?marks=true' : ''}`)

  return (
    <div className="min-h-dvh bg-ink-bg">
      <header className="no-print sticky top-0 z-20 border-b border-ink-line bg-ink-bg/90 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3">
          <Link
            to={`/books/${item.slug}`}
            className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink-text"
          >
            <ChevronLeft size={16} />
            Back
          </Link>
          <p className="min-w-0 flex-1 truncate font-display text-sm text-ink-muted">{item.title}</p>

          {user && hasMarks && (
            <div className="w-full sm:w-auto">
              <Toggle
                checked={withMarks}
                onChange={setWithMarks}
                label="Include my highlights and notes"
              />
            </div>
          )}

          <Button variant="secondary" icon={<Printer size={15} />} onClick={() => window.print()}>
            Print
          </Button>
          <a href={exportUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="primary" icon={<Download size={15} />}>
              PDF
            </Button>
          </a>
        </div>
      </header>

      <div
        className={cn('print-book mx-auto max-w-3xl px-6 py-10', withMarks && 'with-marks')}
        style={{ ['--reader-width' as string]: '100%' }}
      >
        <section
          className="print-cover mb-12 flex flex-col items-center justify-center rounded-sm px-10 py-24 text-center"
          style={coverStyle(item.front_cover)}
        >
          <h1 className="font-display text-3xl font-semibold text-white">{item.title}</h1>
          {item.subtitle && <p className="mt-2 italic text-white/85">{item.subtitle}</p>}
          <p className="mt-10 text-xs uppercase tracking-[0.18em] text-white/85">
            {item.author.display_name}
          </p>
        </section>

        {list.map((page) => (
          <section key={page.id} className="print-page mb-12">
            <PageView doc={page.content} pageKey={`print-${page.id}`} />
          </section>
        ))}

        {withMarks && hasMarks && (
          <section className="print-appendix mt-12 border-t border-ink-line pt-10">
            <h2 className="mb-6 font-display text-xl font-semibold text-ink-text">Your marks</h2>

            {myHighlights.map((highlight) => {
              const page = indexOf(highlight.page_id)
              return (
                <div key={highlight.id} className="mark mb-5 border-l-[3px] border-amber/70 pl-4">
                  <p className="text-2xs text-ink-faint">
                    {page !== null ? `Page ${page + 1}` : 'This book'}
                  </p>
                  <p className="mt-1 font-read text-sm italic text-ink-text/90">
                    {quoteExcerpt(highlight.anchor, 400)}
                  </p>
                </div>
              )
            })}

            {myNotes.map((note) => {
              const page = indexOf(note.page_id)
              return (
                <div key={note.id} className="mark mb-5 border-l-[3px] border-amber/70 pl-4">
                  <p className="text-2xs text-ink-faint">
                    {page !== null ? `Page ${page + 1}` : 'This book'}
                  </p>
                  {note.anchor?.quote && (
                    <p className="mt-1 font-read text-sm italic text-ink-muted">
                      {quoteExcerpt(note.anchor, 400)}
                    </p>
                  )}
                  <div className="mt-1.5">
                    <RichTextView value={note.body} />
                  </div>
                </div>
              )
            })}
          </section>
        )}

        {item.back_cover && (
          <section
            className="print-cover mt-12 flex flex-col items-center justify-center rounded-sm px-10 py-24 text-center"
            style={coverStyle(item.back_cover)}
          >
            <p className="max-w-prose font-read italic leading-relaxed text-white/90">
              {item.back_cover.text || item.description}
            </p>
            <p className="mt-8 text-xs uppercase tracking-[0.18em] text-white/85">
              {item.author.display_name}
            </p>
          </section>
        )}
      </div>
    </div>
  )
}
