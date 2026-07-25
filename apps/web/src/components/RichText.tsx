import { useEffect } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import { Bold, Italic, Link2, List, Quote } from 'lucide-react'
import { noteExtensions } from '@/features/editor/extensions'
import { promptForLink } from '@/features/editor/linkPrompt'
import { useModal } from '@/lib/modal'
import { cn } from '@/lib/utils'
import type { JSONContent } from '@/lib/types'

/** Compact rich text for notes: bold, italic, links, lists, quotes. No headings. */
export function RichTextEditor({
  value,
  onChange,
  placeholder,
  autoFocus,
  className,
}: {
  value: JSONContent
  onChange: (doc: JSONContent) => void
  placeholder?: string
  autoFocus?: boolean
  className?: string
}) {
  const { open } = useModal()
  const editor = useEditor({
    extensions: noteExtensions(placeholder),
    content: value,
    autofocus: autoFocus ? 'end' : false,
    editorProps: { attributes: { class: 'cart-prose text-[0.95rem] focus:outline-none' } },
    onUpdate: ({ editor: instance }) => onChange(instance.getJSON() as JSONContent),
  })

  if (!editor) return null

  return (
    <div className={cn('rounded-md border border-ink-line bg-ink-bg focus-within:border-amber/50', className)}>
      <div className="flex items-center gap-0.5 border-b border-ink-line px-1.5 py-1">
        <Mini icon={Bold} label="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} />
        <Mini icon={Italic} label="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} />
        <Mini icon={List} label="List" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} />
        <Mini icon={Quote} label="Quote" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()} />
        <Mini icon={Link2} label="Link" active={editor.isActive('link')} onClick={() => void promptForLink(editor, open)} />
      </div>
      <div className="max-h-56 overflow-y-auto px-3.5 py-3">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}

/** Read-only rendering of the same documents. */
export function RichTextView({ value, className }: { value: JSONContent; className?: string }) {
  const editor = useEditor({
    extensions: noteExtensions(),
    content: value,
    editable: false,
    editorProps: { attributes: { class: 'cart-prose text-[0.9rem]' } },
  })

  useEffect(() => {
    editor?.commands.setContent(value, false)
  }, [editor, value])

  if (!editor) return null
  return <EditorContent editor={editor} className={className} />
}

function Mini({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: typeof Bold
  label: string
  active?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(
        'inline-grid h-7 w-7 place-items-center rounded transition-colors',
        active ? 'bg-amber/15 text-amber' : 'text-ink-muted hover:bg-ink-line/60 hover:text-ink-text',
      )}
    >
      <Icon size={13} />
    </button>
  )
}
