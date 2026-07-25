import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label?: string
  hint?: ReactNode
  error?: string | null
  /** Rendered between the input and the hint — the strength meter goes here. */
  below?: ReactNode
  /** Rendered to the right of the label — the generator button goes here. */
  action?: ReactNode
  /** Start revealed, so a freshly generated password can be read once. */
  revealed?: boolean
}

/**
 * Declared at module scope on purpose. A form field defined inside another
 * component's render body is a new component type on every render, which makes
 * React unmount and remount the input — and typing into an input that remounts
 * loses both the caret and the focus.
 */
export const PasswordField = forwardRef<HTMLInputElement, Props>(function PasswordField(
  { label = 'Password', hint, error, below, action, revealed = false, className, id, ...rest },
  ref,
) {
  const auto = useId()
  const fieldId = id ?? auto
  const [shown, setShown] = useState(revealed)

  return (
    <div className="space-y-1.5">
      {(label || action) && (
        <div className="flex items-center justify-between gap-2">
          <label htmlFor={fieldId} className="label block">
            {label}
          </label>
          {action}
        </div>
      )}

      <div className="relative">
        <input
          ref={ref}
          id={fieldId}
          type={shown ? 'text' : 'password'}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? `${fieldId}-help` : undefined}
          className={cn('field pr-11', error && 'border-danger/60 focus:border-danger', className)}
          {...rest}
        />
        <button
          type="button"
          onClick={() => setShown((value) => !value)}
          aria-label={shown ? 'Hide password' : 'Show password'}
          aria-pressed={shown}
          title={shown ? 'Hide password' : 'Show password'}
          className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded text-ink-faint transition-colors hover:bg-ink-line/60 hover:text-ink-text"
        >
          {shown ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>

      {below}

      {(error || hint) && (
        <p id={`${fieldId}-help`} className={cn('text-xs', error ? 'text-danger' : 'text-ink-faint')}>
          {error ?? hint}
        </p>
      )}
    </div>
  )
})
