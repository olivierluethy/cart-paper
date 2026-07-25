import { Link, useNavigate } from 'react-router-dom'
import { BookMarked, Plus } from 'lucide-react'
import { Button } from '@/components/Button'
import { EmptyState, Loading } from '@/components/States'
import { useCreateBook, useMyBooks } from '@/lib/books'
import { useAuth } from '@/lib/auth'
import { useAuthGate } from '@/features/auth/useAuthGate'
import { useToast } from '@/lib/toast'
import { formatDate, pluralize, timeAgo } from '@/lib/utils'
import type { BookSummary } from '@/lib/types'

export function ShelfPage() {
  const { user, loading } = useAuth()
  const { openAuth } = useAuthGate()
  const books = useMyBooks()
  const createBook = useCreateBook()
  const navigate = useNavigate()
  const toast = useToast()

  if (loading) return <Loading />
  if (!user) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24">
        <EmptyState
          icon={BookMarked}
          title="Your shelf lives behind an account"
          body="Sign in to see your drafts, the books you are part way through, and everything you have published."
          action={<Button variant="primary" onClick={() => openAuth('login')}>Sign in</Button>}
        />
      </div>
    )
  }

  const all = books.data ?? []
  const drafts = all.filter((book) => book.status === 'draft')
  const published = all.filter((book) => book.status === 'published')

  const start = async () => {
    try {
      const book = await createBook.mutateAsync({ title: 'Untitled' })
      navigate(`/write/${book.id}`)
    } catch {
      toast.error('Could not start a new book.')
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:py-14">
      <header className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label mb-3">My shelf</p>
          <h1 className="font-display text-3xl font-semibold text-ink-text">
            {user.display_name}
          </h1>
        </div>
        <Button variant="primary" icon={<Plus size={15} />} loading={createBook.isPending} onClick={start}>
          New book
        </Button>
      </header>

      {books.isLoading ? (
        <Loading />
      ) : all.length === 0 ? (
        <EmptyState
          icon={BookMarked}
          title="Nothing on the shelf yet"
          body="Start a book and it appears here as a private draft until you publish it."
          action={<Button variant="primary" onClick={start}>Start writing</Button>}
        />
      ) : (
        <div className="space-y-12">
          <Section title="Drafts" count={drafts.length} books={drafts} />
          <Section title="Published" count={published.length} books={published} />
        </div>
      )}
    </div>
  )
}

function Section({ title, count, books }: { title: string; count: number; books: BookSummary[] }) {
  if (count === 0) return null
  return (
    <section>
      <h2 className="mb-4 font-display text-lg font-semibold text-ink-text">
        {title} <span className="ml-1 text-sm font-normal text-ink-faint">{count}</span>
      </h2>
      <ul className="divide-y divide-ink-line/70 border-y border-ink-line/70">
        {books.map((book) => (
          <li key={book.id}>
            <Link
              to={book.status === 'draft' ? `/write/${book.id}` : `/books/${book.slug}`}
              className="group flex items-baseline gap-4 py-4 transition-colors hover:bg-ink-line/20"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display text-base text-ink-text group-hover:text-amber">
                  {book.title}
                </span>
                {book.subtitle && (
                  <span className="mt-0.5 block truncate text-sm text-ink-muted">{book.subtitle}</span>
                )}
              </span>
              <span className="hidden shrink-0 text-xs text-ink-faint sm:block">
                {pluralize(book.page_count, 'page')}
              </span>
              <span className="shrink-0 text-xs text-ink-faint">
                {book.status === 'published' && book.published_at
                  ? formatDate(book.published_at)
                  : `edited ${timeAgo(book.updated_at)}`}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
