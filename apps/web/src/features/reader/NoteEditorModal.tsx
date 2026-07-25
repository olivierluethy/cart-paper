import { useRef, useState } from 'react'
import { FileText, ImagePlus, Link2, Paperclip, TextQuote, Trash2, X } from 'lucide-react'
import { Modal } from '@/components/Modal'
import { Button } from '@/components/Button'
import { Field } from '@/components/Field'
import { RichTextEditor } from '@/components/RichText'
import { useNoteActions } from '@/features/reader/useAnnotations'
import { mediaUrl } from '@/lib/api'
import { EMPTY_DOC, isEmptyDoc } from '@/lib/doc'
import { quoteExcerpt } from '@/lib/anchor'
import { cn } from '@/lib/utils'
import type { Anchor, HighlightColor, JSONContent, Note, NoteAttachment, UUID } from '@/lib/types'

type DraftAttachment = {
  kind: 'link' | 'quote' | 'image'
  url?: string
  title?: string
  preview?: string
}

type Props = {
  bookRef: string
  invite?: string | null
  /** Existing note being edited, or the anchor a new note hangs from. */
  note?: Note | null
  anchor?: Anchor | null
  pageId?: UUID | null
  highlightId?: UUID | null
  highlightColor?: HighlightColor | null
  onDone: () => void
}

export function NoteEditorModal({
  bookRef,
  invite,
  note,
  anchor,
  pageId,
  highlightId,
  highlightColor,
  onDone,
}: Props) {
  const actions = useNoteActions(bookRef, invite)
  const [body, setBody] = useState<JSONContent>(note?.body ?? EMPTY_DOC)
  const [drafts, setDrafts] = useState<DraftAttachment[]>([])
  const [adding, setAdding] = useState<'link' | 'quote' | null>(null)
  const [linkUrl, setLinkUrl] = useState('')
  const [linkTitle, setLinkTitle] = useState('')
  const [quoteText, setQuoteText] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  const passage = quoteExcerpt(note?.anchor ?? anchor, 220)
  const saved = note?.attachments ?? []

  const save = async () => {
    if (note) {
      await actions.update.mutateAsync({ id: note.id, body })
      for (const draft of drafts) {
        await actions.addAttachment.mutateAsync({ noteId: note.id, ...draft })
      }
    } else {
      const created = await actions.create.mutateAsync({
        highlight_id: highlightId ?? null,
        page_id: pageId ?? null,
        anchor: anchor ?? null,
        body,
        attachments: drafts,
      })
      // Files need the note to exist first; nothing is queued here for a new note.
      void created
    }
    onDone()
  }

  const attachFile = async (file: File) => {
    if (!note) return
    await actions.uploadAttachment.mutateAsync({ noteId: note.id, file })
  }

  return (
    <Modal
      title={note ? 'Edit note' : 'Add a note'}
      description={passage ? undefined : 'A private note, kept beside the passage it belongs to.'}
      onClose={onDone}
      size="lg"
      footer={
        <>
          {note && (
            <Button
              variant="ghost"
              className="mr-auto text-danger hover:bg-danger/10"
              icon={<Trash2 size={14} />}
              onClick={async () => {
                await actions.remove.mutateAsync(note.id)
                onDone()
              }}
            >
              Delete note
            </Button>
          )}
          <Button variant="ghost" onClick={onDone}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={actions.create.isPending || actions.update.isPending}
            disabled={isEmptyDoc(body) && drafts.length === 0}
            onClick={save}
          >
            {note ? 'Save note' : 'Add note'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {passage && (
          <blockquote
            className={cn(
              'rounded-r-md border-l-2 bg-ink-bg/60 py-2.5 pl-4 pr-3 font-read text-sm italic leading-relaxed text-ink-muted',
              highlightColor ? 'border-amber/60' : 'border-ink-line',
            )}
          >
            {passage}
          </blockquote>
        )}

        <RichTextEditor
          value={body}
          onChange={setBody}
          placeholder="What this passage made you think…"
          autoFocus
        />

        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="label mr-1">Attach</span>
            <Button size="sm" variant="secondary" icon={<Link2 size={13} />} onClick={() => setAdding(adding === 'link' ? null : 'link')}>
              Link
            </Button>
            <Button size="sm" variant="secondary" icon={<TextQuote size={13} />} onClick={() => setAdding(adding === 'quote' ? null : 'quote')}>
              Quote
            </Button>
            <Button
              size="sm"
              variant="secondary"
              icon={<ImagePlus size={13} />}
              disabled={!note}
              title={note ? undefined : 'Save the note first, then attach files to it'}
              onClick={() => fileInput.current?.click()}
            >
              Image or file
            </Button>
            <input
              ref={fileInput}
              type="file"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void attachFile(file)
                event.target.value = ''
              }}
            />
          </div>

          {adding === 'link' && (
            <div className="space-y-2 rounded-md border border-ink-line p-3">
              <Field label="URL" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://…" autoFocus />
              <Field label="Title" value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)} placeholder="What is behind the link" />
              <Button
                size="sm"
                variant="primary"
                disabled={!linkUrl.trim()}
                onClick={() => {
                  setDrafts((current) => [
                    ...current,
                    { kind: 'link', url: linkUrl.trim(), title: linkTitle.trim() || linkUrl.trim() },
                  ])
                  setLinkUrl('')
                  setLinkTitle('')
                  setAdding(null)
                }}
              >
                Attach link
              </Button>
            </div>
          )}

          {adding === 'quote' && (
            <div className="space-y-2 rounded-md border border-ink-line p-3">
              <Field
                label="Quotation"
                value={quoteText}
                onChange={(e) => setQuoteText(e.target.value)}
                placeholder="Something worth keeping next to this passage"
                autoFocus
              />
              <Button
                size="sm"
                variant="primary"
                disabled={!quoteText.trim()}
                onClick={() => {
                  setDrafts((current) => [...current, { kind: 'quote', preview: quoteText.trim() }])
                  setQuoteText('')
                  setAdding(null)
                }}
              >
                Attach quote
              </Button>
            </div>
          )}

          {(saved.length > 0 || drafts.length > 0) && (
            <ul className="space-y-1.5">
              {saved.map((item) => (
                <AttachmentRow
                  key={item.id}
                  attachment={item}
                  onRemove={() => actions.removeAttachment.mutate(item.id)}
                />
              ))}
              {drafts.map((item, index) => (
                <AttachmentRow
                  key={`draft-${index}`}
                  attachment={{
                    id: `draft-${index}`,
                    kind: item.kind,
                    url: item.url ?? null,
                    title: item.title ?? null,
                    preview: item.preview ?? null,
                    storage_key: null,
                  }}
                  pending
                  onRemove={() => setDrafts((current) => current.filter((_, i) => i !== index))}
                />
              ))}
            </ul>
          )}
        </section>
      </div>
    </Modal>
  )
}

const ICONS = { link: Link2, image: ImagePlus, quote: TextQuote, file: FileText }

export function AttachmentRow({
  attachment,
  pending,
  onRemove,
}: {
  attachment: NoteAttachment
  pending?: boolean
  onRemove?: () => void
}) {
  const Icon = ICONS[attachment.kind as keyof typeof ICONS] ?? Paperclip
  const href = attachment.url ? mediaUrl(attachment.url) : undefined

  return (
    <li className="flex items-center gap-2.5 rounded-md border border-ink-line bg-ink-bg/40 px-3 py-2">
      <Icon size={14} className="shrink-0 text-ink-faint" />
      <div className="min-w-0 flex-1">
        {attachment.kind === 'quote' ? (
          <p className="truncate font-read text-sm italic text-ink-muted">“{attachment.preview}”</p>
        ) : href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="block truncate text-sm text-amber underline-offset-2 hover:underline"
          >
            {attachment.title || href}
          </a>
        ) : (
          <p className="truncate text-sm text-ink-muted">{attachment.title}</p>
        )}
      </div>
      {pending && <span className="shrink-0 text-2xs uppercase tracking-wide text-ink-faint">new</span>}
      {onRemove && (
        <button
          type="button"
          aria-label="Remove attachment"
          onClick={onRemove}
          className="shrink-0 rounded p-1 text-ink-faint transition-colors hover:bg-danger/10 hover:text-danger"
        >
          <X size={13} />
        </button>
      )}
    </li>
  )
}
