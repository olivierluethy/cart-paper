import { useCallback, useEffect, useRef, type ReactNode } from 'react'
import { BubbleMenu, EditorContent, useEditor, type Editor } from '@tiptap/react'
import {
  Bold,
  Code,
  ImagePlus,
  Italic,
  Link2,
  Strikethrough,
  Underline as UnderlineIcon,
} from 'lucide-react'
import { bookExtensions } from '@/features/editor/extensions'
import { EditorToolbar, ToolButton } from '@/features/editor/EditorToolbar'
import { useSlashMenu } from '@/features/editor/SlashMenu'
import { useImageUpload } from '@/features/editor/useImageUpload'
import { promptForLink } from '@/features/editor/linkPrompt'
import { useModal } from '@/lib/modal'
import type { JSONContent } from '@/lib/types'

type Props = {
  bookId: string
  /** Changing this remounts the document — one key per page. */
  pageKey: string
  doc: JSONContent
  onChange: (doc: JSONContent) => void
  onEditorReady?: (editor: Editor | null) => void
  toolbarExtra?: ReactNode
}

export function PageEditor({ bookId, pageKey, doc, onChange, onEditorReady, toolbarExtra }: Props) {
  const { controller, menu } = useSlashMenu()
  const { open } = useModal()
  const { insertFiles, uploading } = useImageUpload(bookId)
  const editorRef = useRef<Editor | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      const editor = editorRef.current
      if (!editor) return
      void insertFiles(editor, files)
    },
    [insertFiles],
  )

  const editor = useEditor(
    {
      extensions: bookExtensions({ slash: controller }),
      content: doc,
      autofocus: false,
      editorProps: {
        attributes: { class: 'cart-prose focus:outline-none', spellcheck: 'true' },
        handleDrop: (view, event) => {
          const files = (event as DragEvent).dataTransfer?.files
          if (!files?.length) return false
          event.preventDefault()
          const at = view.posAtCoords({
            left: (event as DragEvent).clientX,
            top: (event as DragEvent).clientY,
          })
          if (at) editorRef.current?.commands.setTextSelection(at.pos)
          handleFiles(files)
          return true
        },
        handlePaste: (_view, event) => {
          const files = Array.from(event.clipboardData?.files ?? [])
          if (!files.length) return false
          event.preventDefault()
          handleFiles(files)
          return true
        },
      },
      onUpdate: ({ editor: instance }) => onChange(instance.getJSON() as JSONContent),
    },
    [pageKey],
  )

  editorRef.current = editor

  useEffect(() => {
    onEditorReady?.(editor)
    return () => onEditorReady?.(null)
  }, [editor, onEditorReady])

  if (!editor) return null

  return (
    <div className="relative">
      <EditorToolbar
        editor={editor}
        extra={
          <>
            <ToolButton
              icon={ImagePlus}
              label={uploading > 0 ? 'Uploading…' : 'Insert image'}
              disabled={uploading > 0}
              onClick={() => fileInput.current?.click()}
            />
            {toolbarExtra}
          </>
        }
      />
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(event) => {
          if (event.target.files?.length) handleFiles(event.target.files)
          event.target.value = ''
        }}
      />

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
