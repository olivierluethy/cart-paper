import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-6 py-32 text-center">
      <p className="label mb-4">404</p>
      <h1 className="font-display text-3xl font-semibold text-ink-text">
        That page is not on any shelf here.
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-muted">
        The link may be broken, or the book behind it may still be a private draft.
      </p>
      <Link
        to="/"
        className="mt-7 text-sm text-amber underline-offset-4 transition-colors hover:underline"
      >
        Back to the library
      </Link>
    </div>
  )
}
