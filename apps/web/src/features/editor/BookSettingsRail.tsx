import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { Field, TextArea } from '@/components/Field'
import { useUpdateBook } from '@/lib/books'
import { useAutosave } from '@/features/editor/useAutosave'
import { SaveIndicator } from '@/features/editor/SaveIndicator'
import type { BookDetail, PageSummary } from '@/lib/types'

type Props = {
  book: BookDetail
  page: PageSummary | null
  onPageTitle: (title: string) => void
}

export function BookSettingsRail({ book, page, onPageTitle }: Props) {
  const update = useUpdateBook(book.id)
  const [draft, setDraft] = useState({
    title: book.title,
    subtitle: book.subtitle ?? '',
    description: book.description ?? '',
    language: book.language,
  })
  const [tagInput, setTagInput] = useState('')
  const [pageTitle, setPageTitle] = useState(page?.title ?? '')

  useEffect(() => {
    setPageTitle(page?.title ?? '')
  }, [page?.id, page?.title])

  const autosave = useAutosave<Record<string, unknown>>((patch) => update.mutateAsync(patch))

  const set = (field: keyof typeof draft, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }))
    autosave.schedule({ [field]: value || null })
  }

  const addTag = (raw: string) => {
    const tag = raw.trim().toLowerCase()
    if (!tag || book.tags.includes(tag) || book.tags.length >= 8) return
    update.mutate({ tags: [...book.tags, tag] })
    setTagInput('')
  }

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-5">
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="label">Book</span>
          <SaveIndicator state={autosave.state} />
        </div>
        <Field
          label="Title"
          value={draft.title}
          onChange={(e) => set('title', e.target.value)}
          maxLength={240}
        />
        <Field
          label="Subtitle"
          value={draft.subtitle}
          onChange={(e) => set('subtitle', e.target.value)}
          maxLength={240}
          placeholder="Optional"
        />
        <TextArea
          label="Description"
          value={draft.description}
          onChange={(e) => set('description', e.target.value)}
          rows={4}
          placeholder="What a reader sees before they open it."
        />
        <Field
          label="Language"
          value={draft.language}
          onChange={(e) => set('language', e.target.value)}
          maxLength={12}
          hint="Two-letter code, e.g. en, de, fr"
        />
      </section>

      <section className="space-y-2.5">
        <span className="label">Tags</span>
        <div className="flex flex-wrap gap-1.5">
          {book.tags.map((tag) => (
            <span key={tag} className="chip py-0.5 pr-1.5">
              {tag}
              <button
                type="button"
                aria-label={`Remove tag ${tag}`}
                onClick={() => update.mutate({ tags: book.tags.filter((t) => t !== tag) })}
                className="rounded-full p-0.5 transition-colors hover:bg-ink-line hover:text-ink-text"
              >
                <X size={11} />
              </button>
            </span>
          ))}
          {book.tags.length === 0 && <p className="text-xs text-ink-faint">No tags yet.</p>}
        </div>
        {book.tags.length < 8 && (
          <input
            className="field"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ',') {
                event.preventDefault()
                addTag(tagInput)
              }
            }}
            placeholder="Add a tag and press Enter"
            aria-label="Add a tag"
          />
        )}
      </section>

      {page && (
        <section className="space-y-4 border-t border-ink-line pt-6">
          <span className="label">This page</span>
          <Field
            label="Page title"
            value={pageTitle}
            onChange={(e) => {
              setPageTitle(e.target.value)
              onPageTitle(e.target.value)
            }}
            maxLength={240}
            placeholder="Optional — the first heading is used otherwise"
          />
        </section>
      )}
    </div>
  )
}
