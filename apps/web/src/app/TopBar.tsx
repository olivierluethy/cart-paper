import { NavLink, useNavigate } from 'react-router-dom'
import { BookMarked, LogOut, PenLine, Settings, User as UserIcon } from 'lucide-react'
import { Wordmark } from '@/app/Wordmark'
import { Avatar } from '@/components/Avatar'
import { Button } from '@/components/Button'
import { Menu, MenuDivider, MenuItem } from '@/components/Menu'
import { NotificationBell } from '@/features/notifications/NotificationBell'
import { useAuth } from '@/lib/auth'
import { useAuthGate } from '@/features/auth/useAuthGate'
import { useModal } from '@/lib/modal'
import { SettingsModal } from '@/features/profile/SettingsModal'
import { cn } from '@/lib/utils'

const NAV = [
  { to: '/', label: 'Library', end: true },
  { to: '/shelf', label: 'My shelf' },
]

export function TopBar() {
  const { user, logout } = useAuth()
  const { openAuth } = useAuthGate()
  const { open } = useModal()
  const navigate = useNavigate()

  return (
    <header className="sticky top-0 z-30 border-b border-ink-line/80 bg-ink-bg/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[110rem] items-center gap-3 px-4 sm:gap-6 sm:px-6">
        <Wordmark />

        <nav className="ml-2 hidden items-center gap-1 md:flex" aria-label="Main">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'rounded-md px-3 py-1.5 text-sm transition-colors',
                  isActive ? 'bg-ink-line/50 text-ink-text' : 'text-ink-muted hover:text-ink-text',
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex-1" />

        {user ? (
          <>
            <Button
              variant="primary"
              size="sm"
              icon={<PenLine size={15} />}
              onClick={() => navigate('/write')}
            >
              Write
            </Button>
            <NotificationBell />
            <Menu
              label="Account"
              trigger={({ toggle, open: isOpen, ref }) => (
                <button
                  ref={ref as never}
                  type="button"
                  onClick={toggle}
                  aria-haspopup="menu"
                  aria-expanded={isOpen}
                  aria-label="Account menu"
                  className="rounded-full outline-none ring-offset-2 ring-offset-ink-bg focus-visible:ring-2 focus-visible:ring-amber/70"
                >
                  <Avatar user={user} size="sm" />
                </button>
              )}
            >
              {(close) => (
                <>
                  <div className="px-3.5 pb-2 pt-1">
                    <p className="truncate text-sm text-ink-text">{user.display_name}</p>
                    <p className="truncate text-xs text-ink-faint">@{user.handle}</p>
                  </div>
                  <MenuDivider />
                  <MenuItem
                    icon={<UserIcon size={15} />}
                    onClick={() => {
                      close()
                      navigate('/me')
                    }}
                  >
                    My profile
                  </MenuItem>
                  <MenuItem
                    icon={<BookMarked size={15} />}
                    onClick={() => {
                      close()
                      navigate('/shelf')
                    }}
                  >
                    My shelf
                  </MenuItem>
                  <MenuItem
                    icon={<Settings size={15} />}
                    onClick={() => {
                      close()
                      open(({ close: done }) => <SettingsModal onDone={done} />)
                    }}
                  >
                    Settings
                  </MenuItem>
                  <MenuDivider />
                  <MenuItem
                    icon={<LogOut size={15} />}
                    onClick={async () => {
                      close()
                      await logout()
                      navigate('/')
                    }}
                  >
                    Sign out
                  </MenuItem>
                </>
              )}
            </Menu>
          </>
        ) : (
          <>
            <Button variant="ghost" size="sm" onClick={() => openAuth('login')}>
              Sign in
            </Button>
            <Button variant="primary" size="sm" onClick={() => openAuth('register')}>
              Join
            </Button>
          </>
        )}
      </div>

      <nav
        className="flex items-center gap-1 border-t border-ink-line/60 px-4 pb-2 pt-1.5 md:hidden"
        aria-label="Main"
      >
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                'rounded-md px-3 py-1 text-xs transition-colors',
                isActive ? 'bg-ink-line/50 text-ink-text' : 'text-ink-muted',
              )
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </header>
  )
}
