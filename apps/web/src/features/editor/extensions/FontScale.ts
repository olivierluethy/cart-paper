import { Extension } from '@tiptap/core'

export type ScaleName = 's' | 'l'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontScale: {
      setFontScale: (scale: ScaleName | null) => ReturnType
    }
  }
}

/**
 * A three-step size scale (S / M / L) rather than arbitrary point sizes.
 * Reading size is the reader's decision — the author only gets relative
 * emphasis, expressed as `em`, so it composes with the reader's font size.
 */
export const FontScale = Extension.create({
  name: 'fontScale',

  addGlobalAttributes() {
    return [
      {
        types: ['textStyle'],
        attributes: {
          scale: {
            default: null,
            parseHTML: (element) => element.getAttribute('data-scale'),
            renderHTML: (attributes) => (attributes.scale ? { 'data-scale': attributes.scale } : {}),
          },
        },
      },
    ]
  },

  addCommands() {
    return {
      setFontScale:
        (scale) =>
        ({ chain }) =>
          scale
            ? chain().setMark('textStyle', { scale }).run()
            : chain().setMark('textStyle', { scale: null }).removeEmptyTextStyle().run(),
    }
  },
})
