import type { Extensions } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import CharacterCount from '@tiptap/extension-character-count'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import TaskItem from '@tiptap/extension-task-item'
import TaskList from '@tiptap/extension-task-list'
import TextAlign from '@tiptap/extension-text-align'
import TextStyle from '@tiptap/extension-text-style'
import Underline from '@tiptap/extension-underline'
import { BlockStyle } from '@/features/editor/extensions/BlockStyle'
import { FontScale } from '@/features/editor/extensions/FontScale'
import { SlashCommand, type SlashController } from '@/features/editor/extensions/SlashCommand'

export function bookExtensions(options: {
  placeholder?: string
  slash?: SlashController | null
}): Extensions {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4] },
      codeBlock: { HTMLAttributes: { spellcheck: 'false' } },
      // Anchors are ProseMirror positions; a shorter undo depth is not worth
      // the risk of an author losing a paragraph.
      history: { depth: 200 },
    }),
    Underline,
    Superscript,
    Subscript,
    TextStyle,
    FontScale,
    BlockStyle,
    TaskList,
    TaskItem.configure({ nested: true }),
    TextAlign.configure({ types: ['heading', 'paragraph'], alignments: ['left', 'center', 'right'] }),
    Link.configure({
      openOnClick: false,
      autolink: true,
      protocols: ['http', 'https', 'mailto'],
      HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' },
    }),
    Placeholder.configure({
      placeholder: options.placeholder ?? 'Write, or press / for blocks…',
    }),
    CharacterCount,
    SlashCommand.configure({ controller: options.slash ?? null }),
  ]
}

/** Notes are rich too, but deliberately smaller: no headings, no slash menu. */
export function noteExtensions(placeholder = 'Your note…'): Extensions {
  return [
    StarterKit.configure({
      heading: false,
      codeBlock: false,
      horizontalRule: false,
      history: { depth: 80 },
    }),
    Underline,
    TextStyle,
    Link.configure({
      openOnClick: false,
      autolink: true,
      HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' },
    }),
    Placeholder.configure({ placeholder }),
  ]
}
