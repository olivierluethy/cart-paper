import { useCallback, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { useModal } from '@/lib/modal'
import { LoginModal, RegisterModal } from '@/features/auth/AuthModals'

function AuthFlow({
  reason,
  startAt,
  onDone,
}: {
  reason?: string
  startAt: 'register' | 'login'
  onDone: (signedIn: boolean) => void
}) {
  const [mode, setMode] = useState(startAt)
  const Component = mode === 'register' ? RegisterModal : LoginModal
  return (
    <Component
      reason={reason}
      onDone={onDone}
      onSwitch={() => setMode(mode === 'register' ? 'login' : 'register')}
    />
  )
}

/**
 * Gate an action behind an account without ever leaving the page.
 *
 * Anonymous visitors get the register modal inline; if they sign up (or switch
 * to sign in), the action they originally asked for runs straight away. That
 * resume is the point — nobody should lose the passage they were highlighting.
 */
export function useAuthGate() {
  const { user } = useAuth()
  const { open } = useModal()

  const requireAuth = useCallback(
    async (action: () => void | Promise<void>, reason?: string) => {
      if (user) {
        await action()
        return true
      }
      const signedIn = await open<boolean>(({ close }) => (
        <AuthFlow reason={reason} startAt="register" onDone={close} />
      ))
      if (signedIn) {
        await action()
        return true
      }
      return false
    },
    [user, open],
  )

  const openAuth = useCallback(
    (startAt: 'register' | 'login' = 'register', reason?: string) =>
      open<boolean>(({ close }) => <AuthFlow reason={reason} startAt={startAt} onDone={close} />),
    [open],
  )

  return { requireAuth, openAuth, user }
}
