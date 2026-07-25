import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { ImageNodeView } from '@/features/editor/ImageNodeView'

export type ImageAlign = 'left' | 'center' | 'right' | 'full'
export type ImageWidth = 25 | 50 | 75 | 100

export type CartImageAttrs = {
  src: string
  alt: string | null
  caption: string | null
  align: ImageAlign
  width: ImageWidth
  wrap: boolean
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    cartImage: {
      insertCartImage: (attrs: Partial<CartImageAttrs> & { src: string }) => ReturnType
      updateCartImage: (attrs: Partial<CartImageAttrs>) => ReturnType
    }
  }
}

/**
 * Images carry their placement with them — alignment, width, text wrap, caption
 * and alt text are node attributes, so the reader, the print stylesheet and the
 * server-side PDF all lay an image out the same way without extra plumbing.
 */
export const CartImage = Node.create({
  name: 'cartImage',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      src: { default: '' },
      alt: { default: null },
      caption: { default: null },
      align: { default: 'center' },
      width: { default: 100 },
      wrap: { default: false },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'figure[data-cart-image]',
        getAttrs: (element) => {
          const node = element as HTMLElement
          const img = node.querySelector('img')
          return {
            src: img?.getAttribute('src') ?? '',
            alt: img?.getAttribute('alt') ?? null,
            caption: node.querySelector('figcaption')?.textContent ?? null,
            align: node.getAttribute('data-align') ?? 'center',
            width: Number(node.getAttribute('data-width') ?? 100),
            wrap: node.getAttribute('data-wrap') === 'true',
          }
        },
      },
      // A bare <img> (e.g. from a DOCX import) becomes a centred full-width figure.
      {
        tag: 'img[src]',
        getAttrs: (element) => ({
          src: (element as HTMLElement).getAttribute('src') ?? '',
          alt: (element as HTMLElement).getAttribute('alt') ?? null,
        }),
      },
    ]
  },

  renderHTML({ HTMLAttributes, node }) {
    const attrs = node.attrs as CartImageAttrs
    return [
      'figure',
      mergeAttributes(
        {
          'data-cart-image': '',
          'data-align': attrs.align,
          'data-width': String(attrs.width),
          'data-wrap': String(attrs.wrap),
          class: 'cart-figure',
        },
        HTMLAttributes,
      ),
      ['img', { src: attrs.src, alt: attrs.alt ?? '' }],
      ...(attrs.caption ? [['figcaption', {}, attrs.caption] as const] : []),
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView)
  },

  addCommands() {
    return {
      insertCartImage:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
      updateCartImage:
        (attrs) =>
        ({ commands }) =>
          commands.updateAttributes(this.name, attrs),
    }
  },
})
