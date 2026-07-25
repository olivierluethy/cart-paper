import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type Common = {
  label?: string
  hint?: ReactNode
  error?: string | null
}

type InputProps = Common & InputHTMLAttributes<HTMLInputElement>

export const Field = forwardRef<HTMLInputElement, InputProps>(function Field(
  { label, hint, error, className, id, ...rest },
  ref,
) {
  const auto = useId()
  const fieldId = id ?? auto
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={fieldId} className="label block">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${fieldId}-help` : undefined}
        className={cn('field', error && 'border-danger/60 focus:border-danger', className)}
        {...rest}
      />
      {(error || hint) && (
        <p id={`${fieldId}-help`} className={cn('text-xs', error ? 'text-danger' : 'text-ink-faint')}>
          {error ?? hint}
        </p>
      )}
    </div>
  )
})

type AreaProps = Common & TextareaHTMLAttributes<HTMLTextAreaElement>

export const TextArea = forwardRef<HTMLTextAreaElement, AreaProps>(function TextArea(
  { label, hint, error, className, id, ...rest },
  ref,
) {
  const auto = useId()
  const fieldId = id ?? auto
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={fieldId} className="label block">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={fieldId}
        aria-invalid={error ? true : undefined}
        className={cn('field min-h-[5rem] resize-y leading-relaxed', error && 'border-danger/60', className)}
        {...rest}
      />
      {(error || hint) && (
        <p className={cn('text-xs', error ? 'text-danger' : 'text-ink-faint')}>{error ?? hint}</p>
      )}
    </div>
  )
})

export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
  description?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-start gap-3 rounded-md p-1 text-left transition-colors hover:bg-ink-line/30"
    >
      <span
        className={cn(
          'mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors',
          checked ? 'border-amber/60 bg-amber/30' : 'border-ink-line bg-ink-bg',
        )}
      >
        <span
          className={cn(
            'ml-0.5 h-3.5 w-3.5 rounded-full transition-transform duration-200',
            checked ? 'translate-x-4 bg-amber' : 'translate-x-0 bg-ink-muted',
          )}
        />
      </span>
      <span className="min-w-0">
        <span className="block text-sm text-ink-text">{label}</span>
        {description && <span className="mt-0.5 block text-xs leading-relaxed text-ink-faint">{description}</span>}
      </span>
    </button>
  )
}
