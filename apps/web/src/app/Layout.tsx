import { Outlet } from 'react-router-dom'
import { TopBar } from '@/app/TopBar'

export function Layout() {
  return (
    <div className="paper-grain relative flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-ink-raised focus:px-4 focus:py-2 focus:text-sm"
      >
        Skip to content
      </a>
      <TopBar />
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-ink-line/70 px-6 py-8">
        <div className="mx-auto flex max-w-[110rem] flex-wrap items-center gap-x-6 gap-y-2 text-xs text-ink-faint">
          <span className="font-display text-sm text-ink-muted">CART Paper</span>
          <span>Down to the line, not just the book.</span>
          <span className="flex-1" />
          <span>Dark by design.</span>
        </div>
      </footer>
    </div>
  )
}
