import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const SUFFIX = 'CART Paper'

/**
 * Published books live on public, shareable routes, so each one should present
 * itself properly when the link is pasted somewhere. No SSR in v1 — this is the
 * client-side half of that (see docs/ARCHITECTURE.md → Deferred).
 */
export function usePageMeta(title?: string | null, description?: string | null) {
  useEffect(() => {
    document.title = title ? `${title} — ${SUFFIX}` : `${SUFFIX} — a private library at night`

    if (description === undefined) return
    let tag = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    if (!tag) {
      tag = document.createElement('meta')
      tag.name = 'description'
      document.head.appendChild(tag)
    }
    tag.content = description ?? ''
  }, [title, description])
}

/** A new route should start at the top — except inside the reader, which manages its own. */
export function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    if (pathname.startsWith('/read/') || pathname.startsWith('/pdf/')) return
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [pathname])
  return null
}
