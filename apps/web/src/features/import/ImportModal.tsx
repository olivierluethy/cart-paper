import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, FileText, Upload } from 'lucide-react'
import { Modal } from '@/components/Modal'
import { Button } from '@/components/Button'
import { Spinner } from '@/components/States'
import { api, ApiError, mediaUrl } from '@/lib/api'
import { bookKeys } from '@/lib/books'
import { useToast } from '@/lib/toast'
import { cn, pluralize } from '@/lib/utils'
import type { ImportResult } from '@/lib/types'

const ACCEPT = '.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document'

export function ImportModal({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const toast = useToast()
  const qc = useQueryClient()

  const upload = async (file: File) => {
    setError(null)
    setBusy(true)
    try {
      const body = new FormData()
      body.append('file', file)
      const outcome = await api.post<ImportResult>('/imports', body)
      setResult(outcome)
      qc.invalidateQueries({ queryKey: bookKeys.mine() })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'That file could not be imported.')
    } finally {
      setBusy(false)
    }
  }

  const status = result?.document.conversion_status
  const clean = result ? result.report.pages_clean : 0
  const total = result ? result.report.pages_total : 0

  return (
    <Modal
      title="Import a document"
      description="PDF or Word. The original is always kept, and the import lands as a private draft."
      onClose={onDone}
      size="lg"
      footer={
        result ? (
          <>
            <Button variant="ghost" onClick={onDone}>
              Later
            </Button>
            {result.document.conversion_status !== 'converted' && (
              <Button
                variant="secondary"
                onClick={() => {
                  onDone()
                  navigate(result.book ? `/pdf/${result.book.slug}` : '/shelf')
                }}
              >
                Read the original
              </Button>
            )}
            {result.book && (
              <Button
                variant="primary"
                onClick={() => {
                  onDone()
                  navigate(`/write/${result.book!.id}`)
                }}
              >
                Open the draft
              </Button>
            )}
          </>
        ) : (
          <Button variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        )
      }
    >
      {!result ? (
        <>
          <div
            onDragOver={(event) => {
              event.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault()
              setDragging(false)
              const file = event.dataTransfer.files?.[0]
              if (file) void upload(file)
            }}
            className={cn(
              'flex flex-col items-center justify-center rounded-lg border border-dashed px-6 py-14 text-center transition-colors',
              dragging ? 'border-amber bg-amber/[0.06]' : 'border-ink-line',
            )}
          >
            {busy ? (
              <>
                <Spinner className="mb-3" />
                <p className="text-sm text-ink-muted">Converting — this can take a moment for a long file.</p>
              </>
            ) : (
              <>
                <Upload size={22} className="mb-3 text-ink-faint" />
                <p className="text-sm text-ink-text">Drop a PDF or .docx here</p>
                <p className="mt-1 text-xs text-ink-faint">or</p>
                <Button variant="secondary" size="sm" className="mt-3" onClick={() => input.current?.click()}>
                  Choose a file
                </Button>
              </>
            )}
            <input
              ref={input}
              type="file"
              accept={ACCEPT}
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void upload(file)
                event.target.value = ''
              }}
            />
          </div>

          {error && (
            <p className="mt-4 rounded-md border border-danger/40 bg-danger/[0.07] px-4 py-3 text-sm text-danger">
              {error}
            </p>
          )}

          <p className="mt-5 text-xs leading-relaxed text-ink-faint">
            Word files keep headings, emphasis, lists, quotes and images. PDFs are converted
            best-effort — headings are inferred from font size. If the result is not good enough,
            you can read the original file instead, and highlighting, notes and anchored comments
            work there too.
          </p>
        </>
      ) : (
        <div className="space-y-5">
          <div
            className={cn(
              'flex items-start gap-3 rounded-lg border px-4 py-4',
              status === 'converted'
                ? 'border-success/40 bg-success/[0.06]'
                : 'border-amber/40 bg-amber/[0.06]',
            )}
          >
            {status === 'converted' ? (
              <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-success" />
            ) : (
              <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber" />
            )}
            <div>
              <p className="text-sm font-medium text-ink-text">
                {total > 0
                  ? `${clean} of ${pluralize(total, 'page')} converted cleanly`
                  : 'Nothing could be converted'}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                {status === 'converted'
                  ? 'Edit it like any other book. It stays a private draft until you publish it.'
                  : status === 'low_confidence'
                    ? 'The transcription is patchy. You can fix it in the editor, or read the original file — annotations work in both.'
                    : 'The original is kept and can still be read and annotated.'}
              </p>
            </div>
          </div>

          <dl className="grid grid-cols-3 gap-3">
            <Metric label="Pages" value={String(total)} />
            <Metric label="Clean" value={String(clean)} />
            <Metric label="Images" value={String(result.report.images)} />
          </dl>

          {result.report.warnings.length > 0 && (
            <details className="rounded-md border border-ink-line px-4 py-3">
              <summary className="cursor-pointer text-xs text-ink-muted">
                {pluralize(result.report.warnings.length, 'note')} from the converter
              </summary>
              <ul className="mt-2 space-y-1 text-xs text-ink-faint">
                {result.report.warnings.slice(0, 12).map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            </details>
          )}

          <a
            href={mediaUrl(result.document.original_url)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-xs text-ink-muted underline-offset-4 hover:text-amber hover:underline"
          >
            <FileText size={13} />
            {result.document.filename} — the original, kept exactly as uploaded
          </a>
        </div>
      )}
    </Modal>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-ink-line px-3.5 py-2.5">
      <dt className="label">{label}</dt>
      <dd className="mt-1 font-display text-lg font-semibold tabular-nums text-ink-text">{value}</dd>
    </div>
  )
}
