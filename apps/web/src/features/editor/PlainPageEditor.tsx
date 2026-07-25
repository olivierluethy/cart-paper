import { useEffect, useRef, useState } from 'react'
import { docToText, textToDoc } from '@/lib/doc'
import type { JSONContent } from '@/lib/types'

/**
 * Plain-paragraph editing surface. Step 5 replaces this with the TipTap
 * editor; keeping it here means page CRUD and autosave are usable — and
 * committed working — before the rich text engine lands.
 */
export function PlainPageEditor({
  doc,
  pageKey,
  onChange,
}: {
  doc: JSONContent
  pageKey: string
  onChange: (doc: JSONContent) => void
}) {
  const [value, setValue] = useState(() => docToText(doc))
  const area = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setValue(docToText(doc))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageKey])

  return (
    <textarea
      ref={area}
      value={value}
      onChange={(event) => {
        setValue(event.target.value)
        onChange(textToDoc(event.target.value))
      }}
      spellCheck
      aria-label="Page text"
      placeholder="Start writing…"
      className="cart-prose min-h-[60vh] w-full resize-none bg-transparent outline-none placeholder:text-ink-faint"
    />
  )
}
