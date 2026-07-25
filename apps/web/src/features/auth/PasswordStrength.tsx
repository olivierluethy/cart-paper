import { useEffect, useState } from 'react'
import type { ZxcvbnResult } from '@zxcvbn-ts/core'
import { adviceFor, crackTime, scorePassword, VERDICTS } from '@/features/auth/passwords'
import { cn } from '@/lib/utils'

const TONE = [
  'bg-danger',
  'bg-danger/70',
  'bg-amber/70',
  'bg-amber',
  'bg-success',
]

const TEXT = ['text-danger', 'text-danger', 'text-amber', 'text-amber', 'text-success']

/**
 * Advisory only. The server enforces the hard minimum; a low score here warns
 * but never blocks — a genuinely random passphrase can score oddly, and telling
 * someone their good password is unacceptable is worse than letting it through.
 */
export function PasswordStrength({
  password,
  /** Known entropy for a value we generated ourselves. */
  generatedBits,
}: {
  password: string
  generatedBits?: number | null
}) {
  const [result, setResult] = useState<ZxcvbnResult | null>(null)

  useEffect(() => {
    if (!password) {
      setResult(null)
      return
    }
    let cancelled = false
    const timer = window.setTimeout(async () => {
      const scored = await scorePassword(password).catch(() => null)
      if (!cancelled) setResult(scored)
    }, 150)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [password])

  if (!password) return null

  const score = result?.score ?? 0
  const verdict = VERDICTS[score]

  return (
    <div className="space-y-1.5 pt-0.5">
      <div className="flex gap-1" role="img" aria-label={`Password strength: ${verdict}`}>
        {[0, 1, 2, 3, 4].map((segment) => (
          <span
            key={segment}
            className={cn(
              'h-1 flex-1 rounded-full transition-colors',
              segment <= score && result ? TONE[score] : 'bg-ink-line',
            )}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-baseline gap-x-2 text-2xs">
        <span className={cn('font-medium', result ? TEXT[score] : 'text-ink-faint')}>
          {result ? verdict : 'Checking…'}
        </span>
        {result && (
          <span className="text-ink-faint">
            · cracks in {crackTime(result)}
            {generatedBits ? ` · ${generatedBits} bits` : ''}
          </span>
        )}
      </div>

      {result && <p className="text-2xs leading-relaxed text-ink-faint">{adviceFor(result)}</p>}
    </div>
  )
}
