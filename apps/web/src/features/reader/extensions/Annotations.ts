import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Node as PMNode } from '@tiptap/pm/model'

export type AnnotationSpec = {
  id: string
  from: number
  to: number
  kind: 'highlight' | 'discussion'
  color?: string
  active?: boolean
}

export const annotationsKey = new PluginKey<AnnotationState>('cartAnnotations')

type AnnotationState = { specs: AnnotationSpec[]; decorations: DecorationSet }

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    cartAnnotations: {
      setAnnotations: (specs: AnnotationSpec[]) => ReturnType
    }
  }
}

function build(specs: AnnotationSpec[], doc: PMNode): DecorationSet {
  const size = doc.content.size
  const decorations = specs
    .filter((spec) => spec.from >= 0 && spec.to > spec.from && spec.to <= size)
    // Longest first, so a short highlight nested inside a long one still paints.
    .sort((a, b) => b.to - b.from - (a.to - a.from))
    .map((spec) =>
      Decoration.inline(
        spec.from,
        spec.to,
        {
          class: spec.kind === 'highlight' ? 'cart-highlight' : 'cart-anchor',
          ...(spec.color ? { 'data-color': spec.color } : {}),
          'data-annotation-id': spec.id,
          'data-annotation-kind': spec.kind,
          ...(spec.active ? { 'data-active': 'true' } : {}),
        },
        { inclusiveStart: false, inclusiveEnd: false },
      ),
    )
  return DecorationSet.create(doc, decorations)
}

/**
 * Highlights and discussion markers are decorations, not marks: they belong to
 * the reader, not to the book. The document is never touched, so two people
 * reading the same page see their own annotations over identical text.
 */
export const Annotations = Extension.create({
  name: 'cartAnnotations',

  addProseMirrorPlugins() {
    return [
      new Plugin<AnnotationState>({
        key: annotationsKey,
        state: {
          init: () => ({ specs: [], decorations: DecorationSet.empty }),
          apply(tr, value, _oldState, newState) {
            const incoming = tr.getMeta(annotationsKey) as AnnotationSpec[] | undefined
            if (incoming) return { specs: incoming, decorations: build(incoming, newState.doc) }
            if (tr.docChanged) {
              return { specs: value.specs, decorations: value.decorations.map(tr.mapping, tr.doc) }
            }
            return value
          },
        },
        props: {
          decorations: (state) => annotationsKey.getState(state)?.decorations,
        },
      }),
    ]
  },

  addCommands() {
    return {
      setAnnotations:
        (specs) =>
        ({ tr, dispatch }) => {
          if (dispatch) dispatch(tr.setMeta(annotationsKey, specs))
          return true
        },
    }
  },
})
