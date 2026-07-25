import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { resolveAnchor } from '@/lib/anchor'
import type { AnnotationSpec } from '@/features/reader/extensions/Annotations'
import type { Anchor, Highlight, UUID } from '@/lib/types'

export type DiscussionMarker = {
  id: string
  anchor: Anchor
  page_id: UUID | null
  replies: number
}

type Input = {
  editor: Editor | null
  pageId: UUID | null
  highlights: Highlight[]
  discussions: DiscussionMarker[]
  activeId: string | null
}

export type ResolvedAnnotation = {
  id: string
  from: number
  to: number
  kind: 'highlight' | 'discussion'
}

/**
 * Resolves every annotation for the page currently on screen and paints them as
 * decorations. Anything that no longer resolves is reported as orphaned so the
 * sidebar can keep it visible — an annotation is never silently dropped.
 */
export function useAnnotationLayer({ editor, pageId, highlights, discussions, activeId }: Input) {
  const [orphanIds, setOrphanIds] = useState<Set<string>>(new Set())
  const [resolved, setResolved] = useState<ResolvedAnnotation[]>([])

  const onPage = useMemo(
    () => ({
      highlights: highlights.filter((item) => item.page_id === pageId),
      discussions: discussions.filter((item) => item.page_id === pageId),
    }),
    [highlights, discussions, pageId],
  )

  useEffect(() => {
    if (!editor || editor.isDestroyed) return

    const specs: AnnotationSpec[] = []
    const found: ResolvedAnnotation[] = []
    const orphans = new Set<string>()

    for (const highlight of onPage.highlights) {
      const hit = resolveAnchor(editor, highlight.anchor)
      if (hit.status === 'orphaned') {
        orphans.add(highlight.id)
        continue
      }
      specs.push({
        id: highlight.id,
        from: hit.from,
        to: hit.to,
        kind: 'highlight',
        color: highlight.color,
        active: activeId === highlight.id,
      })
      found.push({ id: highlight.id, from: hit.from, to: hit.to, kind: 'highlight' })
    }

    for (const discussion of onPage.discussions) {
      const hit = resolveAnchor(editor, discussion.anchor)
      if (hit.status === 'orphaned') {
        orphans.add(discussion.id)
        continue
      }
      specs.push({
        id: discussion.id,
        from: hit.from,
        to: hit.to,
        kind: 'discussion',
        active: activeId === discussion.id,
      })
      found.push({ id: discussion.id, from: hit.from, to: hit.to, kind: 'discussion' })
    }

    editor.commands.setAnnotations(specs)
    setResolved(found)
    setOrphanIds(orphans)
  }, [editor, onPage, activeId])

  /** Screen position of a resolved annotation, for margin markers and scrolling. */
  const rectFor = useCallback(
    (id: string): DOMRect | null => {
      if (!editor || editor.isDestroyed) return null
      const item = resolved.find((entry) => entry.id === id)
      if (!item) return null
      try {
        const start = editor.view.coordsAtPos(item.from)
        const end = editor.view.coordsAtPos(item.to)
        return new DOMRect(start.left, start.top, end.right - start.left, end.bottom - start.top)
      } catch {
        return null
      }
    },
    [editor, resolved],
  )

  const scrollTo = useCallback(
    (id: string) => {
      if (!editor || editor.isDestroyed) return false
      const item = resolved.find((entry) => entry.id === id)
      if (!item) return false
      const node = editor.view.dom.querySelector(`[data-annotation-id="${id}"]`)
      node?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return true
    },
    [editor, resolved],
  )

  return { orphanIds, resolved, rectFor, scrollTo }
}
