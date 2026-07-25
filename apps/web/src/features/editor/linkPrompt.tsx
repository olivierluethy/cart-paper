import { useState } from 'react'
import type { Editor } from '@tiptap/react'
import { Modal } from '@/components/Modal'
import { Button } from '@/components/Button'
import { Field } from '@/components/Field'
import type { useModal } from '@/lib/modal'

type OpenFn = ReturnType<typeof useModal>['open']

function normalize(raw: string): string | null {
  const value = raw.trim()
  if (!value) return null
  if (/^(https?:|mailto:)/i.test(value)) return value
  if (/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(value)) return `mailto:${value}`
  return `https://${value}`
}

function LinkModal({
  initial,
  onDone,
}: {
  initial: string
  onDone: (result: { href: string | null } | undefined) => void
}) {
  const [href, setHref] = useState(initial)

  return (
    <Modal
      title={initial ? 'Edit link' : 'Add a link'}
      onClose={() => onDone(undefined)}
      size="sm"
      footer={
        <div className="flex w-full items-center justify-between">
          {initial ? (
            <Button variant="quiet" onClick={() => onDone({ href: null })}>
              Remove link
            </Button>
          ) : (
            <span />
          )}
          <Button
            variant="primary"
            onClick={() => onDone({ href: normalize(href) })}
            disabled={!href.trim()}
          >
            {initial ? 'Update' : 'Add link'}
          </Button>
        </div>
      }
    >
      <Field
        label="Destination"
        value={href}
        onChange={(event) => setHref(event.target.value)}
        placeholder="example.com or you@example.com"
        autoFocus
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            onDone({ href: normalize(href) })
          }
        }}
      />
      <p className="mt-3 text-xs text-ink-faint">
        Links open in a new tab. A bare domain becomes https, an address becomes mailto.
      </p>
    </Modal>
  )
}

/** Modal instead of window.prompt — the whole product avoids browser dialogs. */
export async function promptForLink(editor: Editor, open: OpenFn) {
  const existing = (editor.getAttributes('link').href as string | undefined) ?? ''
  const result = await open<{ href: string | null }>(({ close }) => (
    <LinkModal initial={existing} onDone={close} />
  ))
  if (!result) return
  if (result.href === null) {
    editor.chain().focus().extendMarkRange('link').unsetLink().run()
    return
  }
  editor.chain().focus().extendMarkRange('link').setLink({ href: result.href }).run()
}
