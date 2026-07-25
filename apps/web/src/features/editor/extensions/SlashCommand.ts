import { Extension, type Editor, type Range } from '@tiptap/core'
import Suggestion from '@tiptap/suggestion'

export type SlashItem = {
  title: string
  hint: string
  icon: string
  keywords: string[]
  run: (editor: Editor, range: Range) => void
}

export type SlashState = {
  items: SlashItem[]
  rect: DOMRect | null
  select: (item: SlashItem) => void
}

/** React owns the popup; the extension only reports state and forwards keys. */
export type SlashController = {
  onOpen: (state: SlashState) => void
  onUpdate: (state: SlashState) => void
  onClose: () => void
  onKeyDown: (event: KeyboardEvent) => boolean
}

const ITEMS: SlashItem[] = [
  {
    title: 'Heading 1',
    hint: 'Part or chapter title',
    icon: 'Heading1',
    keywords: ['h1', 'title', 'chapter'],
    run: (editor, range) => editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run(),
  },
  {
    title: 'Heading 2',
    hint: 'Section',
    icon: 'Heading2',
    keywords: ['h2', 'section'],
    run: (editor, range) => editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run(),
  },
  {
    title: 'Heading 3',
    hint: 'Sub-section',
    icon: 'Heading3',
    keywords: ['h3'],
    run: (editor, range) => editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run(),
  },
  {
    title: 'Heading 4',
    hint: 'Minor heading',
    icon: 'Heading4',
    keywords: ['h4'],
    run: (editor, range) => editor.chain().focus().deleteRange(range).setNode('heading', { level: 4 }).run(),
  },
  {
    title: 'Text',
    hint: 'Plain paragraph',
    icon: 'Pilcrow',
    keywords: ['paragraph', 'body', 'p'],
    run: (editor, range) =>
      editor.chain().focus().deleteRange(range).setParagraph().setBlockStyle(null).run(),
  },
  {
    title: 'Bulleted list',
    hint: 'Unordered items',
    icon: 'List',
    keywords: ['ul', 'bullet', 'unordered'],
    run: (editor, range) => editor.chain().focus().deleteRange(range).toggleBulletList().run(),
  },
  {
    title: 'Numbered list',
    hint: 'Ordered items',
    icon: 'ListOrdered',
    keywords: ['ol', 'ordered', 'number'],
    run: (editor, range) => editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
  },
  {
    title: 'Checklist',
    hint: 'Things to tick off',
    icon: 'ListChecks',
    keywords: ['todo', 'task', 'check'],
    run: (editor, range) => editor.chain().focus().deleteRange(range).toggleTaskList().run(),
  },
  {
    title: 'Quote',
    hint: 'Block quotation',
    icon: 'Quote',
    keywords: ['blockquote', 'cite'],
    run: (editor, range) => editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
  },
  {
    title: 'Callout',
    hint: 'An aside the reader should not skip',
    icon: 'Lightbulb',
    keywords: ['note', 'aside', 'info'],
    run: (editor, range) =>
      editor.chain().focus().deleteRange(range).setParagraph().setBlockStyle('callout').run(),
  },
  {
    title: 'Epigraph',
    hint: 'Centred opening line',
    icon: 'Feather',
    keywords: ['dedication', 'opening'],
    run: (editor, range) =>
      editor.chain().focus().deleteRange(range).setParagraph().setBlockStyle('epigraph').run(),
  },
  {
    title: 'Verse',
    hint: 'Poetry — line breaks kept',
    icon: 'AlignLeft',
    keywords: ['poem', 'poetry', 'lyric'],
    run: (editor, range) =>
      editor.chain().focus().deleteRange(range).setParagraph().setBlockStyle('verse').run(),
  },
  {
    title: 'Code block',
    hint: 'Monospaced block',
    icon: 'Code2',
    keywords: ['pre', 'snippet'],
    run: (editor, range) => editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
  },
  {
    title: 'Divider',
    hint: 'Section break',
    icon: 'Minus',
    keywords: ['hr', 'rule', 'break'],
    run: (editor, range) => editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
  },
]

export function slashItems(query: string): SlashItem[] {
  const q = query.trim().toLowerCase()
  if (!q) return ITEMS
  return ITEMS.filter(
    (item) =>
      item.title.toLowerCase().includes(q) ||
      item.keywords.some((keyword) => keyword.startsWith(q)),
  )
}

export const SlashCommand = Extension.create<{ controller: SlashController | null }>({
  name: 'slashCommand',

  addOptions() {
    return { controller: null }
  },

  addProseMirrorPlugins() {
    const getController = () => this.options.controller

    return [
      Suggestion<SlashItem>({
        editor: this.editor,
        char: '/',
        // Only at the start of an empty-ish block, so "and/or" never opens a menu.
        allow: ({ state, range }) => {
          const before = state.doc.textBetween(Math.max(0, range.from - 1), range.from)
          return before === '' || /\s/.test(before)
        },
        items: ({ query }) => slashItems(query),
        command: ({ editor, range, props }) => props.run(editor, range),
        render: () => ({
          onStart: (props) => {
            getController()?.onOpen({
              items: props.items,
              rect: props.clientRect?.() ?? null,
              select: (item) => props.command(item),
            })
          },
          onUpdate: (props) => {
            getController()?.onUpdate({
              items: props.items,
              rect: props.clientRect?.() ?? null,
              select: (item) => props.command(item),
            })
          },
          onKeyDown: (props) => getController()?.onKeyDown(props.event) ?? false,
          onExit: () => getController()?.onClose(),
        }),
      }),
    ]
  },
})
