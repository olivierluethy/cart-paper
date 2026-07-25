import { squashText } from '@/lib/anchor'
import type { Anchor } from '@/lib/types'

export type NormRect = [number, number, number, number]

/**
 * PDF anchors carry page-relative rectangles as fractions of the page box, so a
 * highlight survives zooming, a different device, and a re-render at another
 * scale. The quote and its context ride along too, exactly as in the CART
 * reader — the same three-stage story, just against a text layer.
 */
export function pdfAnchorFromSelection(
  pageNumber: number,
  container: HTMLElement,
  pageText: string,
): Anchor | null {
  const selection = window.getSelection()
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null

  const range = selection.getRangeAt(0)
  if (!container.contains(range.commonAncestorContainer)) return null

  const quote = selection.toString()
  if (!squashText(quote)) return null

  const bounds = container.getBoundingClientRect()
  if (bounds.width === 0 || bounds.height === 0) return null

  const rects: NormRect[] = Array.from(range.getClientRects())
    .filter((rect) => rect.width > 0.5 && rect.height > 0.5)
    .map((rect) => [
      (rect.left - bounds.left) / bounds.width,
      (rect.top - bounds.top) / bounds.height,
      rect.width / bounds.width,
      rect.height / bounds.height,
    ])

  if (rects.length === 0) return null

  const flat = squashText(pageText)
  const needle = squashText(quote)
  const at = flat.indexOf(needle)

  return {
    page_id: null,
    from: at >= 0 ? at : null,
    to: at >= 0 ? at + needle.length : null,
    quote,
    prefix: at > 0 ? flat.slice(Math.max(0, at - 40), at) : '',
    suffix: at >= 0 ? flat.slice(at + needle.length, at + needle.length + 40) : '',
    pdf: { page: pageNumber, rects },
  }
}

/** Rectangles to paint for a stored anchor, re-derived from the text if needed. */
export function pdfRectsFor(anchor: Anchor | null | undefined, page: number): NormRect[] {
  if (!anchor?.pdf || anchor.pdf.page !== page) return []
  return (anchor.pdf.rects ?? []) as NormRect[]
}

export function pdfPageOf(anchor: Anchor | null | undefined): number | null {
  return anchor?.pdf?.page ?? null
}
