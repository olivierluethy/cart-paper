import { Extension } from '@tiptap/core'

export type BlockStyleName = 'callout' | 'epigraph' | 'verse'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    blockStyle: {
      setBlockStyle: (style: BlockStyleName | null) => ReturnType
      toggleBlockStyle: (style: BlockStyleName) => ReturnType
    }
  }
}

/**
 * Editorial block treatments — a callout, an epigraph, a verse block — carried
 * as an attribute on the paragraph rather than as separate node types. That
 * keeps the document shape flat, which matters because annotation anchors are
 * ProseMirror positions: fewer wrapper nodes means fewer positions shifting
 * when an author restyles a paragraph.
 */
export const BlockStyle = Extension.create({
  name: 'blockStyle',

  addGlobalAttributes() {
    return [
      {
        types: ['paragraph'],
        attributes: {
          blockStyle: {
            default: null,
            parseHTML: (element) => element.getAttribute('data-block'),
            renderHTML: (attributes) =>
              attributes.blockStyle ? { 'data-block': attributes.blockStyle } : {},
          },
        },
      },
    ]
  },

  addCommands() {
    return {
      setBlockStyle:
        (style) =>
        ({ commands }) =>
          commands.updateAttributes('paragraph', { blockStyle: style }),
      toggleBlockStyle:
        (style) =>
        ({ editor, commands }) =>
          commands.updateAttributes('paragraph', {
            blockStyle: editor.isActive('paragraph', { blockStyle: style }) ? null : style,
          }),
    }
  },
})
