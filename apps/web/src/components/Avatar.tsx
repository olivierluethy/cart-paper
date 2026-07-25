import { cn, hueFrom, initials } from '@/lib/utils'
import { mediaUrl } from '@/lib/api'
import type { UserPublic } from '@/lib/types'

const SIZES = { xs: 'h-6 w-6 text-[0.6rem]', sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-16 w-16 text-lg' }

export function Avatar({
  user,
  size = 'sm',
  className,
}: {
  user: Pick<UserPublic, 'display_name' | 'avatar_url' | 'handle'> | null
  size?: keyof typeof SIZES
  className?: string
}) {
  if (!user) {
    return (
      <span
        aria-hidden
        className={cn(
          'inline-grid shrink-0 place-items-center rounded-full border border-ink-line bg-ink-raised text-ink-faint',
          SIZES[size],
          className,
        )}
      >
        ?
      </span>
    )
  }

  const url = mediaUrl(user.avatar_url)
  if (url) {
    return (
      <img
        src={url}
        alt=""
        className={cn('shrink-0 rounded-full border border-ink-line object-cover', SIZES[size], className)}
      />
    )
  }

  const hue = hueFrom(user.handle || user.display_name)
  return (
    <span
      aria-hidden
      title={user.display_name}
      style={{
        background: `linear-gradient(150deg, hsl(${hue} 30% 26%), hsl(${(hue + 40) % 360} 26% 16%))`,
      }}
      className={cn(
        'inline-grid shrink-0 place-items-center rounded-full border border-ink-line font-ui font-medium text-ink-text/90',
        SIZES[size],
        className,
      )}
    >
      {initials(user.display_name)}
    </span>
  )
}
