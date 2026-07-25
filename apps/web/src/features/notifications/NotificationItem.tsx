import { Link } from 'react-router-dom'
import { MessageSquare, MessageSquareQuote, Star, UserCheck } from 'lucide-react'
import { Avatar } from '@/components/Avatar'
import { cn, timeAgo } from '@/lib/utils'
import type { AppNotification, NotificationType } from '@/lib/types'

const ICONS: Record<NotificationType, typeof MessageSquare> = {
  comment_reply: MessageSquareQuote,
  book_comment: MessageSquare,
  book_rating: Star,
  invite_accepted: UserCheck,
}

function sentence(item: AppNotification): string {
  const who = item.actor?.display_name ?? 'Someone'
  const title = item.book?.title ?? 'your book'
  switch (item.type) {
    case 'comment_reply':
      return `${who} replied to your comment`
    case 'book_comment':
      return item.quote ? `${who} commented on a passage in “${title}”` : `${who} commented on “${title}”`
    case 'book_rating':
      return `${who} rated “${title}”`
    case 'invite_accepted':
      return `${who} opened your draft of “${title}”`
  }
}

/** Where a notification takes you — the exact line where possible. */
export function targetOf(item: AppNotification): string {
  if (!item.book) return '/notifications'
  if (item.comment_id && item.page_index !== null && item.page_index !== undefined) {
    return `/read/${item.book.slug}?p=${item.page_index + 1}&c=${item.comment_id}`
  }
  return `/books/${item.book.slug}`
}

export function NotificationItem({
  item,
  onNavigate,
  compact,
}: {
  item: AppNotification
  onNavigate?: () => void
  compact?: boolean
}) {
  const Icon = ICONS[item.type] ?? MessageSquare

  return (
    <Link
      to={targetOf(item)}
      onClick={onNavigate}
      className={cn(
        'flex gap-3 transition-colors hover:bg-ink-line/30',
        compact ? 'px-3.5 py-3' : 'rounded-lg border border-ink-line p-4',
        !item.read_at && (compact ? 'bg-amber/[0.05]' : 'border-amber/30 bg-amber/[0.04]'),
      )}
    >
      <span className="relative shrink-0">
        <Avatar user={item.actor} size={compact ? 'xs' : 'sm'} />
        <span className="absolute -bottom-1 -right-1 inline-grid h-4 w-4 place-items-center rounded-full border border-ink-line bg-ink-raised text-ink-muted">
          <Icon size={9} />
        </span>
      </span>

      <div className="min-w-0 flex-1">
        <p className={cn('text-ink-text', compact ? 'text-xs leading-snug' : 'text-sm')}>
          {sentence(item)}
        </p>
        {item.quote && (
          <p className="mt-1 truncate border-l-2 border-teal/60 pl-2 font-read text-xs italic text-ink-muted">
            {item.quote}
          </p>
        )}
        {item.excerpt && (
          <p className={cn('mt-1 text-ink-muted', compact ? 'line-clamp-2 text-2xs' : 'text-xs')}>
            {item.excerpt}
          </p>
        )}
        <p className="mt-1 text-2xs text-ink-faint">{timeAgo(item.created_at)}</p>
      </div>

      {!item.read_at && (
        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber" aria-label="Unread" />
      )}
    </Link>
  )
}
