import { useRef, useState } from 'react'
import { ImagePlus, Loader2 } from 'lucide-react'
import { Modal } from '@/components/Modal'
import { Button } from '@/components/Button'
import { TextArea, Toggle } from '@/components/Field'
import { BookCover, defaultCover } from '@/components/BookCover'
import { useUpdateBook } from '@/lib/books'
import { useImageUpload } from '@/features/editor/useImageUpload'
import { useToast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import type { BookDetail, CoverDesign } from '@/lib/types'

const PRESETS: { value: NonNullable<CoverDesign['preset']>; label: string; hint: string }[] = [
  { value: 'classic', label: 'Classic', hint: 'Centred, with a rule' },
  { value: 'modern', label: 'Modern', hint: 'Large, set low and left' },
  { value: 'plate', label: 'Plate', hint: 'Framed like a bookplate' },
  { value: 'stamp', label: 'Stamp', hint: 'Imprint above, title below' },
]

const PALETTES: [string, string][] = [
  ['#2B2118', '#100C08'],
  ['#1E2A2A', '#0B1211'],
  ['#2A1E24', '#120A0E'],
  ['#242A1E', '#0D1109'],
  ['#1C2130', '#090B12'],
  ['#3A2A16', '#150E06'],
  ['#2E2E2E', '#0E0E0E'],
  ['#D9A05B', '#7A4E17'],
]

type Side = 'front' | 'back'

export function CoverDesigner({ book, onDone }: { book: BookDetail; onDone: () => void }) {
  const update = useUpdateBook(book.id)
  const { upload, uploading } = useImageUpload(book.id)
  const toast = useToast()
  const fileInput = useRef<HTMLInputElement>(null)

  const [side, setSide] = useState<Side>('front')
  const [front, setFront] = useState<CoverDesign>(book.front_cover ?? defaultCover(book.slug))
  const [back, setBack] = useState<CoverDesign>(
    book.back_cover ?? { ...defaultCover(`${book.slug}-back`), text: book.description ?? '' },
  )

  const current = side === 'front' ? front : back
  const setCurrent = (patch: Partial<CoverDesign>) =>
    side === 'front'
      ? setFront((value) => ({ ...value, ...patch }))
      : setBack((value) => ({ ...value, ...patch }))

  const save = async () => {
    try {
      await update.mutateAsync({ front_cover: front, back_cover: back })
      toast.success('Covers saved.')
      onDone()
    } catch {
      toast.error('Could not save the covers.')
    }
  }

  const pickImage = async (file: File) => {
    const asset = await upload(file)
    if (asset) setCurrent({ kind: 'image', image_url: asset.url })
  }

  return (
    <Modal
      title="Cover designer"
      description="Front and back. The preview is the book at reading size."
      onClose={onDone}
      size="xl"
      footer={
        <>
          <Button variant="ghost" onClick={onDone}>
            Cancel
          </Button>
          <Button variant="primary" loading={update.isPending} onClick={save}>
            Save covers
          </Button>
        </>
      }
    >
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        {/* live preview */}
        <div className="flex flex-col items-center justify-center gap-6 rounded-lg border border-ink-line bg-ink-bg/60 p-8">
          <div className="flex items-end gap-6">
            <div className="text-center">
              <BookCover
                book={book}
                design={front}
                size="lg"
                interactive={false}
                className={cn(side === 'front' && 'ring-2 ring-amber/50 ring-offset-4 ring-offset-ink-bg rounded-[4px]')}
              />
              <p className="mt-3 text-2xs uppercase tracking-[0.16em] text-ink-faint">Front</p>
            </div>
            <div className="text-center">
              <BookCover
                book={book}
                design={back}
                side="back"
                size="lg"
                interactive={false}
                className={cn(side === 'back' && 'ring-2 ring-amber/50 ring-offset-4 ring-offset-ink-bg rounded-[4px]')}
              />
              <p className="mt-3 text-2xs uppercase tracking-[0.16em] text-ink-faint">Back</p>
            </div>
          </div>

          <div className="flex gap-1 rounded-md border border-ink-line p-0.5">
            {(['front', 'back'] as Side[]).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setSide(value)}
                className={cn(
                  'rounded px-4 py-1.5 text-xs capitalize transition-colors',
                  side === value ? 'bg-amber/15 text-amber' : 'text-ink-muted hover:text-ink-text',
                )}
              >
                Editing {value}
              </button>
            ))}
          </div>
        </div>

        {/* controls */}
        <div className="space-y-6">
          <section className="space-y-2.5">
            <p className="label">Background</p>
            <div className="flex gap-1 rounded-md border border-ink-line p-0.5">
              {(['gradient', 'color', 'image'] as const).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => setCurrent({ kind })}
                  className={cn(
                    'flex-1 rounded px-2 py-1.5 text-xs capitalize transition-colors',
                    current.kind === kind ? 'bg-amber/15 text-amber' : 'text-ink-muted hover:text-ink-text',
                  )}
                >
                  {kind}
                </button>
              ))}
            </div>

            {current.kind === 'gradient' && (
              <>
                <div className="grid grid-cols-4 gap-2 pt-1">
                  {PALETTES.map(([from, to]) => (
                    <button
                      key={from + to}
                      type="button"
                      aria-label={`Gradient ${from} to ${to}`}
                      onClick={() => setCurrent({ gradient: [from, to] })}
                      style={{ background: `linear-gradient(150deg, ${from}, ${to})` }}
                      className={cn(
                        'h-10 rounded border transition-transform hover:scale-105',
                        current.gradient?.[0] === from ? 'border-amber' : 'border-ink-line',
                      )}
                    />
                  ))}
                </div>
                <label className="flex items-center gap-3 pt-1 text-xs text-ink-muted">
                  Angle
                  <input
                    type="range"
                    min={0}
                    max={360}
                    value={current.angle ?? 150}
                    onChange={(event) => setCurrent({ angle: Number(event.target.value) })}
                    className="flex-1 accent-amber"
                  />
                  <span className="w-9 text-right tabular-nums">{current.angle ?? 150}°</span>
                </label>
              </>
            )}

            {current.kind === 'color' && (
              <div className="flex items-center gap-3 pt-1">
                <input
                  type="color"
                  aria-label="Background colour"
                  value={current.color ?? '#1E1C18'}
                  onChange={(event) => setCurrent({ color: event.target.value })}
                  className="h-10 w-16 cursor-pointer rounded border border-ink-line bg-transparent"
                />
                <span className="font-mono text-xs text-ink-muted">{current.color ?? '#1E1C18'}</span>
              </div>
            )}

            {current.kind === 'image' && (
              <div className="pt-1">
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) void pickImage(file)
                    event.target.value = ''
                  }}
                />
                <Button
                  variant="secondary"
                  block
                  icon={uploading ? <Loader2 size={15} className="animate-spin" /> : <ImagePlus size={15} />}
                  disabled={uploading > 0}
                  onClick={() => fileInput.current?.click()}
                >
                  {current.image_url ? 'Replace image' : 'Upload an image'}
                </Button>
                <p className="mt-2 text-2xs leading-relaxed text-ink-faint">
                  A dark scrim is laid over the image so the title stays readable.
                </p>
              </div>
            )}
          </section>

          <section className="space-y-2.5">
            <p className="label">Typography</p>
            <div className="grid grid-cols-2 gap-2">
              {PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setCurrent({ preset: preset.value })}
                  className={cn(
                    'rounded-md border px-3 py-2 text-left transition-colors',
                    current.preset === preset.value
                      ? 'border-amber/50 bg-amber/[0.08]'
                      : 'border-ink-line hover:border-ink-muted/50',
                  )}
                >
                  <span className="block font-display text-sm text-ink-text">{preset.label}</span>
                  <span className="mt-0.5 block text-2xs leading-snug text-ink-faint">{preset.hint}</span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3 pt-1">
              <input
                type="color"
                aria-label="Text colour"
                value={current.title_color ?? '#EDE7DC'}
                onChange={(event) => setCurrent({ title_color: event.target.value })}
                className="h-9 w-14 cursor-pointer rounded border border-ink-line bg-transparent"
              />
              <span className="text-xs text-ink-muted">Text colour</span>
            </div>
          </section>

          {side === 'front' ? (
            <Toggle
              checked={current.show_author !== false}
              onChange={(value) => setCurrent({ show_author: value })}
              label="Show the author's name"
            />
          ) : (
            <TextArea
              label="Back cover text"
              value={current.text ?? ''}
              onChange={(event) => setCurrent({ text: event.target.value })}
              rows={6}
              placeholder="The blurb a reader gets when they turn the book over."
            />
          )}
        </div>
      </div>
    </Modal>
  )
}
