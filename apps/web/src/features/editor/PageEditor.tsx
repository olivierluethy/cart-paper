import { useEffect, type ReactNode } from 'react'
import { BubbleMenu, EditorContent, useEditor, type Editor } from '@tiptap/react'
import { Bold, Code, Italic, Link2, Strikethrough, Underline as UnderlineIcon } from 'lucide-react'
import { bookExtensions } from '@/features/editor/extensions'
import { EditorToolbar, ToolButton } from '@/features/editor/EditorToolbar'
import { useSlashMenu } from '@/features/editor/SlashMenu'
import { promptForLink } from '@/features/editor/linkPrompt'
import { useModal } from '@/lib/modal'
import type { JSONContent } from '@/lib/types'

type Props = {
  /** Changing this remounts the document — one key per page. */
  pageKey: string
  doc: JSONContent
  onChange: (doc: JSONContent) => void
  onEditorReady?: (editor: Editor | null) => void
  toolbarExtra?: ReactNode
}

export function PageEditor({ pageKey, doc, onChange, onEditorReady, toolbarExtra }: Props) {
  const { controller, menu } = useSlashMenu()
  const { open } = useModal()

  const editor = useEditor(
    {
      extensions: bookExtensions({ slash: controller }),
      content: doc,
      autofocus: false,
      editorProps: {
        attributes: {
          class: 'cart-prose focus:outline-none',
          spellcheck: 'true',
        },
      },
      onUpdate: ({ editor: instance }) => onChange(instance.getJSON() as JSONContent),
    },
    // Rebuild on page change so undo history never spans two pages.
    [pageKey],
  )

  useEffect(() => {
    onEditorReady?.(editor)
    return () => onEditorReady?.(null)
  }, [editor, onEditorReady])

  if (!editor) return null

  return (
    <div className="relative">
      <EditorToolbar editor={editor} extra={toolbarExtra} />

      <BubbleMenu
        editor={editor}
        tippyOptions={{ duration: 120, maxWidth: 'none' }}
        shouldShow={({ editor: instance, from, to }) =>
          from !== to && !instance.isActive('codeBlock') && !instance.isActive('cartImage')
        }
        className="surface-raised flex items-center gap-0.5 rounded-lg px-1 py-1"
      >
        <ToolButton icon={Bold} label="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} />
        <ToolButton icon={Italic} label="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} />
        <ToolButton icon={UnderlineIcon} label="Underline" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} />
        <ToolButton icon={Strikethrough} label="Strikethrough" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} />
        <ToolButton icon={Code} label="Inline code" active={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()} />
        <span className="mx-0.5 h-5 w-px bg-ink-line" aria-hidden />
        <ToolButton icon={Link2} label="Link" active={editor.isActive('link')} onClick={() => void promptForLink(editor, open)} />
      </BubbleMenu>

      <div className="py-8">
        <EditorContent editor={editor} />
      </div>

      {menu}
    </div>
  )
}
