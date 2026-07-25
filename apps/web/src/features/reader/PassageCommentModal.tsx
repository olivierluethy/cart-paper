import { useState } from 'react'
import { MessageSquareQuote } from 'lucide-react'
import { Modal } from '@/components/Modal'
import { Button } from '@/components/Button'
import { useCommentActions } from '@/features/comments/useComments'
import { quoteExcerpt } from '@/lib/anchor'
import { VisibilityBanner } from '@/features/reader/privacy'
import type { Anchor, Comment, UUID } from '@/lib/types'

/**
 * Starting a discussion on a passage. The quote is shown as it will appear to
 * everyone else, because that is what the thread is permanently attached to.
 */
export function PassageCommentModal({
  bookRef,
  invite,
  anchor,
  pageId,
  onDone,
}: {
  bookRef: string
  invite?: string | null
  anchor: Anchor
  pageId: UUID | null
  onDone: (createdId?: string) => void
}) {
  const actions = useCommentActions(bookRef, invite)
  const [body, setBody] = useState('')

  const submit = async () => {
    const created = (await actions.create.mutateAsync({
      body: body.trim(),
      page_id: pageId,
      anchor,
    })) as Comment
    onDone(created?.id)
  }

  return (
    <Modal
      title="Discuss this passage"
      description="Anyone who reads this line will find the thread here."
      onClose={() => onDone()}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={() => onDone()}>
            Cancel
          </Button>
          <Button
            variant="primary"
            icon={<MessageSquareQuote size={15} />}
            loading={actions.create.isPending}
            disabled={!body.trim()}
            onClick={submit}
          >
            Start the discussion
          </Button>
        </>
      }
    >
      <VisibilityBanner visibility="public" className="mb-4" />
      <blockquote className="mb-4 rounded-r-md border-l-2 border-teal/70 bg-ink-bg/60 py-3 pl-4 pr-3 font-read text-sm italic leading-relaxed text-ink-muted">
        {quoteExcerpt(anchor, 320)}
      </blockquote>

      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && body.trim()) {
            event.preventDefault()
            void submit()
          }
        }}
        autoFocus
        rows={5}
        placeholder="What do you make of this line?"
        aria-label="Your comment"
        className="field min-h-[7rem] resize-y leading-relaxed"
      />
      <p className="mt-2 text-2xs text-ink-faint">
        ⌘↵ to post. Anchored comments are public — a private thought belongs in a note instead.
      </p>
    </Modal>
  )
}
