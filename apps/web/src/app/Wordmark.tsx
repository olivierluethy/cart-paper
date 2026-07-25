import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

/** C·A·R·T set as a bookplate: serif capitals, an amber rule, a quiet subtitle. */
export function Wordmark({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <Link
      to="/"
      className={cn('group inline-flex items-center gap-2.5 outline-none', className)}
      aria-label="CART Paper — home"
    >
      <span className="relative inline-grid h-8 w-7 place-items-center overflow-hidden rounded-[3px] border border-ink-line bg-ink-raised">
        <span className="absolute left-0 top-0 h-full w-1 bg-amber/85" aria-hidden />
        <span className="ml-1 font-display text-[0.7rem] font-semibold leading-none text-ink-text" aria-hidden>
          C
        </span>
      </span>
      <span className="flex flex-col leading-none">
        <span className="font-display text-[1.05rem] font-semibold tracking-[0.02em] text-ink-text">
          CART <span className="text-amber">Paper</span>
        </span>
        {!compact && (
          <span className="mt-1 hidden text-2xs uppercase tracking-[0.18em] text-ink-faint sm:block">
            read · annotate · discuss
          </span>
        )}
      </span>
    </Link>
  )
}
