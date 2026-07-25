import { useEffect } from 'react'
import { EditorContent, useEditor, type Editor } from '@tiptap/react'
import { bookExtensions } from '@/features/editor/extensions'
import type { JSONContent } from '@/lib/types'

/**
 * The reader renders each page through a read-only ProseMirror document rather
 * than dumping HTML. Two reasons, both load-bearing:
 *
 *   1. What a reader sees is byte-for-byte what the author saw in the editor.
 *   2. Annotations are ProseMirror positions. Keeping a live document means a
 *      selection maps straight to `from`/`to`, and stored anchors map back.
 */
export function PageView({
  doc,
  pageKey,
  onEditor,
  className,
}: {
  doc: JSONContent
  pageKey: string
  onEditor?: (editor: Editor | null) => void
  className?: string
}) {
  const editor = useEditor(
    {
      extensions: bookExtensions({ slash: null }),
      content: doc,
      editable: false,
      editorProps: {
        attributes: { class: 'cart-prose focus:outline-none', role: 'document' },
      },
    },
    [pageKey],
  )

  useEffect(() => {
    onEditor?.(editor)
    return () => onEditor?.(null)
  }, [editor, onEditor])

  if (!editor) return null
  return <EditorContent editor={editor} className={className} />
}
