import { useEffect } from 'react'
import { Bell } from 'lucide-react'
import { EmptyState, Loading } from '@/components/States'
import { Button } from '@/components/Button'
import { NotificationItem } from '@/features/notifications/NotificationItem'
import {
  useMarkNotificationsRead,
  useNotifications,
} from '@/features/notifications/useNotifications'
import { useAuth } from '@/lib/auth'
import { useAuthGate } from '@/features/auth/useAuthGate'

export function NotificationsPage() {
  const { user, loading } = useAuth()
  const { openAuth } = useAuthGate()
  const list = useNotifications(true, 100)
  const markRead = useMarkNotificationsRead()

  useEffect(() => {
    if (list.data?.some((item) => !item.read_at)) markRead.mutate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.data])

  if (loading) return <Loading />
  if (!user) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24">
        <EmptyState
          icon={Bell}
          title="Notifications need an account"
          body="Replies to your comments and activity on your books arrive here."
          action={<Button variant="primary" onClick={() => openAuth('login')}>Sign in</Button>}
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 lg:py-14">
      <header className="mb-8">
        <p className="label mb-3">Activity</p>
        <h1 className="font-display text-3xl font-semibold text-ink-text">Notifications</h1>
      </header>

      {list.isLoading ? (
        <Loading />
      ) : (list.data ?? []).length === 0 ? (
        <EmptyState
          icon={Bell}
          title="Nothing yet"
          body="You will hear when somebody replies to one of your comments, comments on a book of yours, rates it, or opens a draft you shared."
        />
      ) : (
        <ul className="space-y-2.5">
          {list.data!.map((item) => (
            <li key={item.id}>
              <NotificationItem item={item} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
