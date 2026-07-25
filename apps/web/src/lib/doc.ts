import type { JSONContent } from '@/lib/types'

export const EMPTY_DOC: JSONContent = { type: 'doc', content: [{ type: 'paragraph' }] }

const BLOCK_TYPES = new Set([
  'paragraph',
  'heading',
  'blockquote',
  'codeBlock',
  'listItem',
  'taskItem',
  'horizontalRule',
  'figure',
  'cartImage',
])

/** Plain text of a document, one block per line. Used for previews and excerpts. */
export function docToText(doc: JSONContent | null | undefined): string {
  if (!doc) return ''
  const lines: string[] = []

  const walk = (node: JSONContent, into: string[]) => {
    if (node.type === 'text') {
      into.push(node.text ?? '')
      return
    }
    if (node.type === 'hardBreak') {
      into.push('\n')
      return
    }
    const isBlock = BLOCK_TYPES.has(node.type ?? '')
    const buffer: string[] = isBlock ? [] : into
    for (const child of node.content ?? []) walk(child, buffer)
    if (isBlock) {
      const text = buffer.join('').trim()
      if (text) lines.push(text)
    }
  }

  walk(doc, [])
  return lines.join('\n')
}

export function excerpt(doc: JSONContent | null | undefined, max = 180): string {
  const text = docToText(doc).replace(/\s+/g, ' ').trim()
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text
}

export function isEmptyDoc(doc: JSONContent | null | undefined): boolean {
  return docToText(doc).trim().length === 0
}

/** Rough page count for progress, so a long page does not read as one "unit". */
export function wordCount(doc: JSONContent | null | undefined): number {
  const text = docToText(doc).trim()
  return text ? text.split(/\s+/).length : 0
}

export function textToDoc(text: string): JSONContent {
  const blocks = text.split(/\n/).map<JSONContent>((line) =>
    line.trim()
      ? { type: 'paragraph', content: [{ type: 'text', text: line }] }
      : { type: 'paragraph' },
  )
  return { type: 'doc', content: blocks.length ? blocks : [{ type: 'paragraph' }] }
}

/** First heading in a document — used to label a page when the author has not. */
export function firstHeading(doc: JSONContent | null | undefined): string | null {
  if (!doc?.content) return null
  for (const node of doc.content) {
    if (node.type === 'heading') {
      const text = docToText({ type: 'doc', content: [node] }).trim()
      if (text) return text
    }
  }
  return null
}
