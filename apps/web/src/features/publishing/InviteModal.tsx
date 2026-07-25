import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Copy, Link2, Mail, Trash2 } from 'lucide-react'
import { Modal } from '@/components/Modal'
import { Button } from '@/components/Button'
import { Field } from '@/components/Field'
import { EmptyState, Loading } from '@/components/States'
import { api } from '@/lib/api'
import { useToast } from '@/lib/toast'
import { formatDate, timeAgo } from '@/lib/utils'
import type { BookDetail, BookInvite } from '@/lib/types'

export function InviteModal({ book, onDone }: { book: BookDetail; onDone: () => void }) {
  const qc = useQueryClient()
  const toast = useToast()
  const [label, setLabel] = useState('')
  const [email, setEmail] = useState('')
  const [expiry, setExpiry] = useState('')
  const [copied, setCopied] = useState<string | null>(null)

  const invites = useQuery({
    queryKey: ['invites', book.id],
    queryFn: () => api.get<BookInvite[]>(`/books/${book.id}/invites`),
  })

  const create = useMutation({
    mutationFn: () =>
      api.post<BookInvite>(`/books/${book.id}/invites`, {
        label: label || null,
        invited_email: email || null,
        expires_in_days: expiry ? Number(expiry) : null,
      }),
    onSuccess: (invite) => {
      qc.invalidateQueries({ queryKey: ['invites', book.id] })
      setLabel('')
      setEmail('')
      void copy(invite.url)
      toast.success('Preview link created and copied.')
    },
    onError: () => toast.error('Could not create that preview link.'),
  })

  const revoke = useMutation({
    mutationFn: (id: string) => api.del(`/invites/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invites', book.id] }),
    onError: () => toast.error('Could not revoke that link.'),
  })

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(url)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      toast.error('Your browser blocked the clipboard — copy the link manually.')
    }
  }

  const active = (invites.data ?? []).filter((invite) => !invite.revoked_at)

  return (
    <Modal
      title="Invite to preview"
      description="A private link into this draft. Invited readers can read and comment — nobody else can see it."
      onClose={onDone}
      size="lg"
      footer={
        <Button variant="ghost" onClick={onDone}>
          Done
        </Button>
      }
    >
      <div className="space-y-7">
        <section className="grid gap-3 rounded-lg border border-ink-line bg-ink-bg/50 p-4 sm:grid-cols-[1fr_1fr_7rem]">
          <Field
            label="Who is it for"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="My editor"
            maxLength={120}
          />
          <Field
            label="Email (optional)"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="they@example.com"
            hint="Logged to stdout in v1"
          />
          <div className="space-y-1.5">
            <label className="label block" htmlFor="invite-expiry">
              Expires
            </label>
            <select
              id="invite-expiry"
              value={expiry}
              onChange={(event) => setExpiry(event.target.value)}
              className="field"
            >
              <option value="">Never</option>
              <option value="7">7 days</option>
              <option value="30">30 days</option>
              <option value="90">90 days</option>
            </select>
          </div>
          <div className="sm:col-span-3">
            <Button
              variant="primary"
              icon={<Link2 size={15} />}
              loading={create.isPending}
              onClick={() => create.mutate()}
            >
              Create preview link
            </Button>
          </div>
        </section>

        <section>
          <h3 className="label mb-3">Active links</h3>
          {invites.isLoading ? (
            <Loading label="Loading links…" />
          ) : active.length === 0 ? (
            <EmptyState
              icon={Link2}
              title="No preview links yet"
              body="Create one above and send it to whoever should read the draft before the world does."
              className="py-10"
            />
          ) : (
            <ul className="divide-y divide-ink-line/70 rounded-lg border border-ink-line">
              {active.map((invite) => (
                <li key={invite.id} className="flex items-center gap-3 p-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-ink-text">
                      {invite.label ?? 'Preview link'}
                      {invite.invited_email && (
                        <span className="ml-2 inline-flex items-center gap-1 text-xs text-ink-faint">
                          <Mail size={11} />
                          {invite.invited_email}
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-ink-faint">
                      created {timeAgo(invite.created_at)}
                      {invite.expires_at && ` · expires ${formatDate(invite.expires_at)}`}
                      {' · '}
                      opened {invite.accepted_count}×
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={copied === invite.url ? <Check size={13} /> : <Copy size={13} />}
                    onClick={() => copy(invite.url)}
                  >
                    {copied === invite.url ? 'Copied' : 'Copy'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="Revoke link"
                    icon={<Trash2 size={13} />}
                    onClick={() => revoke.mutate(invite.id)}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Modal>
  )
}
