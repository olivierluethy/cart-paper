import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { Menu } from '@/components/Menu'
import { Loading } from '@/components/States'
import { NotificationItem } from '@/features/notifications/NotificationItem'
import {
  useMarkNotificationsRead,
  useNotifications,
  useUnreadCount,
} from '@/features/notifications/useNotifications'
import { cn } from '@/lib/utils'

export function NotificationBell() {
  const unread = useUnreadCount()
  const [open, setOpen] = useState(false)
  const list = useNotifications(open, 12)
  const markRead = useMarkNotificationsRead()

  // Opening the bell is the read receipt — but only after the list is on screen,
  // so the unread markers are still visible when it appears.
  useEffect(() => {
    if (!open || !list.data || unread === 0) return
    const timer = window.setTimeout(() => markRead.mutate(), 1200)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, list.data])

  return (
    <Menu
      label="Notifications"
      className="w-[22rem] max-w-[calc(100vw-2rem)]"
      trigger={({ toggle, open: isOpen, ref }) => (
        <button
          ref={ref as never}
          type="button"
          aria-label={unread > 0 ? `Notifications — ${unread} unread` : 'Notifications'}
          aria-haspopup="menu"
          aria-expanded={isOpen}
          onClick={() => {
            setOpen(!isOpen)
            toggle()
          }}
          className={cn(
            'relative inline-grid h-9 w-9 place-items-center rounded-md text-ink-muted transition-colors hover:bg-ink-line/60 hover:text-ink-text',
            isOpen && 'bg-ink-line/60 text-ink-text',
          )}
        >
          <Bell size={17} />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 inline-grid min-w-[1.05rem] place-items-center rounded-full bg-amber px-1 text-[0.6rem] font-semibold tabular-nums text-[#1A1408]">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </button>
      )}
    >
      {(close) => (
        <div className="max-h-[26rem] overflow-y-auto">
          <div className="flex items-center justify-between border-b border-ink-line px-3.5 py-2.5">
            <span className="label">Notifications</span>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => markRead.mutate()}
                className="text-2xs text-ink-faint underline-offset-2 hover:text-amber hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          {list.isLoading ? (
            <Loading label="Loading…" />
          ) : (list.data ?? []).length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-ink-faint">
              Nothing yet. Replies to your comments and activity on your books land here.
            </p>
          ) : (
            <ul className="divide-y divide-ink-line/70">
              {list.data!.map((item) => (
                <li key={item.id}>
                  <NotificationItem
                    item={item}
                    compact
                    onNavigate={() => {
                      setOpen(false)
                      close()
                    }}
                  />
                </li>
              ))}
            </ul>
          )}

          <Link
            to="/notifications"
            onClick={() => {
              setOpen(false)
              close()
            }}
            className="block border-t border-ink-line px-3.5 py-2.5 text-center text-xs text-ink-muted transition-colors hover:text-amber"
          >
            See everything
          </Link>
        </div>
      )}
    </Menu>
  )
}
