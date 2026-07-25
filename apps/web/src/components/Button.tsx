import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'quiet'
type Size = 'sm' | 'md' | 'lg'

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-amber text-[#1A1408] hover:bg-amber-soft active:bg-amber font-medium shadow-[0_1px_0_rgb(255_255_255/0.15)_inset]',
  secondary: 'border border-ink-line bg-ink-raised text-ink-text hover:border-ink-muted/50 hover:bg-ink-line/50',
  ghost: 'text-ink-muted hover:bg-ink-line/50 hover:text-ink-text',
  quiet: 'text-ink-muted hover:text-amber underline-offset-4 hover:underline',
  danger: 'border border-danger/40 bg-danger/10 text-danger hover:bg-danger/20',
}

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-md',
  md: 'h-10 px-4 text-sm gap-2 rounded-md',
  lg: 'h-12 px-6 text-[0.95rem] gap-2 rounded-lg',
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
  loading?: boolean
  icon?: ReactNode
  block?: boolean
}

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'secondary', size = 'md', loading, icon, block, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex select-none items-center justify-center whitespace-nowrap transition-colors duration-150',
        'disabled:cursor-not-allowed disabled:opacity-45',
        VARIANTS[variant],
        SIZES[size],
        block && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 size={15} className="animate-spin" /> : icon}
      {children}
    </button>
  )
})

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string
  active?: boolean
  size?: number
  children: ReactNode
}

export function IconButton({ label, active, className, children, ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={cn(
        'inline-grid h-9 w-9 place-items-center rounded-md text-ink-muted transition-colors',
        'hover:bg-ink-line/60 hover:text-ink-text',
        active && 'bg-amber/15 text-amber',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}
