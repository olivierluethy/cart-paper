import { useEffect } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { PenLine } from 'lucide-react'
import { Button } from '@/components/Button'
import { EmptyState, Loading } from '@/components/States'
import { useCreateBook, useMyBooks } from '@/lib/books'
import { useAuth } from '@/lib/auth'
import { useAuthGate } from '@/features/auth/useAuthGate'
import { useToast } from '@/lib/toast'

/**
 * `/write` opens the workspace. If there is a draft in progress it goes
 * straight there; a first-time author gets one button instead of an empty
 * three-pane shell.
 */
export function WriteEntryPage() {
  const { user, loading } = useAuth()
  const { openAuth } = useAuthGate()
  const books = useMyBooks()
  const createBook = useCreateBook()
  const navigate = useNavigate()
  const toast = useToast()

  useEffect(() => {
    if (!loading && !user) void openAuth('register', 'Create an account to start writing.')
  }, [loading, user, openAuth])

  if (loading) return <Loading />
  if (!user) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24">
        <EmptyState
          icon={PenLine}
          title="Writing needs an account"
          body="Reading published books does not — but a book of your own has to belong to someone."
          action={<Button variant="primary" onClick={() => openAuth('register')}>Create an account</Button>}
        />
      </div>
    )
  }

  if (books.isLoading) return <Loading label="Finding your drafts…" />

  const drafts = (books.data ?? []).filter((book) => book.status === 'draft')
  if (drafts.length > 0) return <Navigate to={`/write/${drafts[0]!.id}`} replace />

  const start = async () => {
    try {
      const book = await createBook.mutateAsync({ title: 'Untitled' })
      navigate(`/write/${book.id}`)
    } catch {
      toast.error('Could not start a new book.')
    }
  }

  return (
    <div className="mx-auto max-w-lg px-6 py-24">
      <EmptyState
        icon={PenLine}
        title="Start your first book"
        body="A book begins as a private draft with one page. Publish it when you want the world to read it — or invite a few people to preview it first."
        action={
          <Button variant="primary" loading={createBook.isPending} onClick={start}>
            Start writing
          </Button>
        }
      />
    </div>
  )
}
