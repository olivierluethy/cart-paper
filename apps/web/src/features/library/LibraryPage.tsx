import { Library } from 'lucide-react'
import { EmptyState } from '@/components/States'
import { Button } from '@/components/Button'
import { useAuthGate } from '@/features/auth/useAuthGate'

export function LibraryPage() {
  const { user, openAuth } = useAuthGate()

  return (
    <div className="mx-auto max-w-[110rem] px-4 py-10 sm:px-6 lg:py-14">
      <section className="mb-12 max-w-2xl">
        <p className="label mb-4">The library</p>
        <h1 className="text-balance font-display text-4xl font-semibold leading-[1.1] text-ink-text sm:text-5xl">
          Everyone reviews the book.
          <br />
          <span className="text-amber">Here you can argue with the line.</span>
        </h1>
        <p className="mt-5 max-w-prose text-[0.95rem] leading-relaxed text-ink-muted">
          Read what other people have written, highlight what stays with you, keep private notes
          beside the passage they belong to — and start a discussion anchored to the exact sentence
          that started it.
        </p>
      </section>

      <EmptyState
        icon={Library}
        title="No books have been published yet"
        body="Once someone publishes, their covers appear here. In the meantime, the first shelf is yours to fill."
        action={
          user ? undefined : (
            <Button variant="primary" onClick={() => openAuth('register')}>
              Create an account
            </Button>
          )
        }
      />
    </div>
  )
}
