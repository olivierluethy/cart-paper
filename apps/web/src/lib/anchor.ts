import type { Editor } from '@tiptap/react'
import type { Node as PMNode } from '@tiptap/pm/model'
import type { Anchor, UUID } from '@/lib/types'

export const CONTEXT_CHARS = 40

/**
 * Anchors carry both a precise locator (ProseMirror positions) and a resilient
 * one (the quote plus its surrounding context). Resolution walks three stages
 * and never throws — a stale anchor becomes "orphaned", never an exception and
 * never a lost note.
 */
export type Resolved =
  | { status: 'exact' | 'relocated'; from: number; to: number }
  | { status: 'orphaned' }

type Flat = { text: string; map: number[] }

/** Flatten a document to plain text alongside a char-index → doc-position map. */
function flatten(doc: PMNode): Flat {
  let text = ''
  const map: number[] = []

  doc.descendants((node, pos) => {
    if (node.isText) {
      const value = node.text ?? ''
      for (let i = 0; i < value.length; i++) map.push(pos + i)
      text += value
      return false
    }
    // A block boundary reads as whitespace, matching textBetween's separator.
    if (node.isBlock && text.length > 0 && !text.endsWith('\n')) {
      text += '\n'
      map.push(pos)
    }
    return true
  })

  return { text, map }
}

/** Collapse whitespace so re-indenting or re-wrapping a paragraph cannot orphan a note. */
function squash(flat: Flat): Flat {
  let text = ''
  const map: number[] = []
  let previousWasSpace = false

  for (let i = 0; i < flat.text.length; i++) {
    const char = flat.text[i]!
    if (/\s/.test(char)) {
      if (previousWasSpace) continue
      text += ' '
      map.push(flat.map[i]!)
      previousWasSpace = true
    } else {
      text += char
      map.push(flat.map[i]!)
      previousWasSpace = false
    }
  }
  return { text, map }
}

export function squashText(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

export type Range = { from: number; to: number }

/**
 * The reader's document is not editable, so ProseMirror's own selection never
 * moves — the browser owns it. Map the DOM selection back to positions, and
 * fall back to the editor's selection when the document *is* editable.
 */
export function selectionRange(editor: Editor): Range | null {
  const dom = typeof window !== 'undefined' ? window.getSelection() : null
  if (dom && !dom.isCollapsed && dom.rangeCount > 0) {
    const { anchorNode, anchorOffset, focusNode, focusOffset } = dom
    const root = editor.view.dom
    if (anchorNode && focusNode && root.contains(anchorNode) && root.contains(focusNode)) {
      try {
        const a = editor.view.posAtDOM(anchorNode, anchorOffset)
        const b = editor.view.posAtDOM(focusNode, focusOffset)
        const from = Math.min(a, b)
        const to = Math.max(a, b)
        if (to > from) return { from, to }
      } catch {
        // posAtDOM throws for nodes outside the document — fall through.
      }
    }
  }
  const { from, to } = editor.state.selection
  return to > from ? { from, to } : null
}

export function selectionRect(): DOMRect | null {
  const dom = typeof window !== 'undefined' ? window.getSelection() : null
  if (!dom || dom.isCollapsed || dom.rangeCount === 0) return null
  const rect = dom.getRangeAt(0).getBoundingClientRect()
  return rect.width === 0 && rect.height === 0 ? null : rect
}

/** Build an anchor from a resolved range in the given editor. */
export function anchorFrom(editor: Editor, pageId: UUID | null, range: Range): Anchor | null {
  const { from, to } = range
  if (to <= from) return null

  const doc = editor.state.doc
  const quote = doc.textBetween(from, to, '\n', ' ')
  if (!squashText(quote)) return null

  return {
    page_id: pageId,
    from,
    to,
    quote,
    prefix: doc.textBetween(Math.max(0, from - CONTEXT_CHARS), from, ' ', ' '),
    suffix: doc.textBetween(to, Math.min(doc.content.size, to + CONTEXT_CHARS), ' ', ' '),
  }
}

function occurrences(haystack: string, needle: string): number[] {
  if (!needle) return []
  const found: number[] = []
  let at = haystack.indexOf(needle)
  while (at !== -1 && found.length < 200) {
    found.push(at)
    at = haystack.indexOf(needle, at + 1)
  }
  return found
}

export function resolveAnchor(editor: Editor, anchor: Anchor | null | undefined): Resolved {
  if (!anchor) return { status: 'orphaned' }
  const doc = editor.state.doc
  const size = doc.content.size
  const quote = squashText(anchor.quote ?? '')
  if (!quote) return { status: 'orphaned' }

  // 1. Positions — cheap, exact, correct while the page is unchanged.
  const from = anchor.from ?? -1
  const to = anchor.to ?? -1
  if (from >= 0 && to > from && to <= size) {
    try {
      if (squashText(doc.textBetween(from, to, '\n', ' ')) === quote) {
        return { status: 'exact', from, to }
      }
    } catch {
      // A position past a shrunken document just falls through to stage 2.
    }
  }

  // 2. Re-locate by context. Longest match first, then closest to where it was.
  const flat = squash(flatten(doc))
  const prefix = squashText(anchor.prefix ?? '')
  const suffix = squashText(anchor.suffix ?? '')

  const candidates: { index: number; offset: number }[] = []
  const push = (needle: string, offsetInNeedle: number) => {
    if (candidates.length) return
    for (const at of occurrences(flat.text, needle)) {
      candidates.push({ index: at + offsetInNeedle, offset: at })
    }
  }

  if (prefix && suffix) push(`${prefix} ${quote} ${suffix}`, prefix.length + 1)
  if (prefix && suffix) push(prefix + quote + suffix, prefix.length)
  if (prefix) push(prefix + quote, prefix.length)
  if (suffix) push(quote + suffix, 0)
  push(quote, 0)

  if (candidates.length === 0) return { status: 'orphaned' }

  const wanted = from >= 0 ? from : 0
  const best = candidates.reduce((a, b) =>
    Math.abs((flat.map[a.index] ?? 0) - wanted) <= Math.abs((flat.map[b.index] ?? 0) - wanted) ? a : b,
  )

  const start = flat.map[best.index]
  const endChar = flat.map[best.index + quote.length - 1]
  if (start === undefined || endChar === undefined) return { status: 'orphaned' }

  const resolvedTo = Math.min(endChar + 1, size)
  if (resolvedTo <= start) return { status: 'orphaned' }
  return { status: 'relocated', from: start, to: resolvedTo }
}

/** Short, readable form of an anchor's quote, for sidebars and trails. */
export function quoteExcerpt(anchor: Anchor | null | undefined, max = 140): string {
  const quote = squashText(anchor?.quote ?? '')
  if (!quote) return ''
  return quote.length > max ? `${quote.slice(0, max - 1).trimEnd()}…` : quote
}
