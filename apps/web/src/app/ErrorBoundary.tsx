import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Wordmark } from '@/app/Wordmark'

type State = { error: Error | null }

/**
 * A render error should cost the reader their page, not the whole session — and
 * it should never leave a blank screen with no way back.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('CART Paper crashed while rendering', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="paper-grain relative grid min-h-dvh place-items-center px-6">
        <div className="max-w-md text-center">
          <div className="mb-8 flex justify-center">
            <Wordmark compact />
          </div>
          <h1 className="font-display text-2xl font-semibold text-ink-text">
            Something went wrong on this page.
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-muted">
            Nothing you wrote has been lost — drafts, notes and comments are saved as you go.
          </p>
          <div className="mt-7 flex justify-center gap-2.5">
            <button
              type="button"
              onClick={() => this.setState({ error: null })}
              className="rounded-md border border-ink-line bg-ink-raised px-4 py-2 text-sm text-ink-text transition-colors hover:border-ink-muted/50"
            >
              Try again
            </button>
            <a
              href="/"
              className="rounded-md bg-amber px-4 py-2 text-sm font-medium text-[#1A1408] transition-colors hover:bg-amber-soft"
            >
              Back to the library
            </a>
          </div>
          <details className="mt-8 text-left">
            <summary className="cursor-pointer text-xs text-ink-faint">Technical detail</summary>
            <pre className="mt-2 max-h-40 overflow-auto rounded-md border border-ink-line bg-ink-bg p-3 text-2xs text-ink-faint">
              {this.state.error.message}
            </pre>
          </details>
        </div>
      </div>
    )
  }
}
