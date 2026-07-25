import { useState, type FormEvent } from 'react'
import { BookOpen } from 'lucide-react'
import { Modal } from '@/components/Modal'
import { Button } from '@/components/Button'
import { Field } from '@/components/Field'
import { PasswordField } from '@/components/PasswordField'
import { PasswordStrength } from '@/features/auth/PasswordStrength'
import { GeneratePasswordButton } from '@/features/auth/GeneratePassword'
import { copyPasswordToClipboard, clearClipboardIfOurs } from '@/features/auth/passwords'
import { useAuth } from '@/lib/auth'
import { useToast } from '@/lib/toast'
import { ApiError, api } from '@/lib/api'

type Props = {
  /** Explains why the modal appeared — e.g. "Sign up to highlight this passage." */
  reason?: string
  onDone: (signedIn: boolean) => void
  onSwitch: () => void
}

export function RegisterModal({ reason, onDone, onSwitch }: Props) {
  const { register } = useAuth()
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [bits, setBits] = useState<number | null>(null)
  const [revealGenerated, setRevealGenerated] = useState(false)

  const acceptGenerated = async (value: string, entropy: number) => {
    setPassword(value)
    setBits(entropy)
    setRevealGenerated(true)
    const outcome = await copyPasswordToClipboard(value)
    if (outcome === 'copied') {
      toast.success('Password copied — save it in your password manager now.', {
        label: 'Clear clipboard',
        onClick: () => void clearClipboardIfOurs(value),
      })
    } else {
      toast.info('Copy it from the field — the clipboard is unavailable here.')
    }
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    if (password.length < 10) {
      setError('Passwords need at least 10 characters.')
      return
    }
    setBusy(true)
    try {
      const user = await register({ email, password, display_name: displayName })
      toast.success(`Welcome to CART Paper, ${user.display_name}.`)
      onDone(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create your account.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title="Start reading and writing"
      description={reason ?? 'One step. You are signed in the moment you submit.'}
      onClose={() => onDone(false)}
      size="sm"
      footer={
        <div className="flex w-full items-center justify-between">
          <button
            type="button"
            onClick={onSwitch}
            className="text-xs text-ink-muted underline-offset-4 hover:text-amber hover:underline"
          >
            I already have an account
          </button>
          <Button type="submit" form="register-form" variant="primary" loading={busy}>
            Create account
          </Button>
        </div>
      }
    >
      <form id="register-form" onSubmit={submit} className="space-y-4">
        <Field
          label="Display name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Mira Halloway"
          autoComplete="name"
          required
          maxLength={120}
        />
        <Field
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          required
        />
        <PasswordField
          key={revealGenerated ? 'revealed' : 'hidden'}
          value={password}
          onChange={(e) => {
            setPassword(e.target.value)
            setBits(null)
          }}
          placeholder="At least 10 characters"
          autoComplete="new-password"
          required
          error={error}
          revealed={revealGenerated}
          action={<GeneratePasswordButton onAccept={acceptGenerated} />}
          below={<PasswordStrength password={password} generatedBits={bits} />}
        />
        <p className="flex items-start gap-2 rounded-md border border-ink-line bg-ink-bg/60 px-3 py-2.5 text-xs leading-relaxed text-ink-faint">
          <BookOpen size={14} className="mt-0.5 shrink-0 text-amber/70" />
          No confirmation email, no second form. Published books stay readable without an account —
          you only need one to write, highlight and join a discussion.
        </p>
      </form>
    </Modal>
  )
}

export function LoginModal({ reason, onDone, onSwitch }: Props) {
  const { login } = useAuth()
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const user = await login({ email, password })
      toast.success(`Welcome back, ${user.display_name}.`)
      onDone(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not sign you in.')
    } finally {
      setBusy(false)
    }
  }

  const forgot = async () => {
    if (!email) {
      setError('Enter your email first, then ask for a reset.')
      return
    }
    await api.post('/auth/forgot-password', { email }).catch(() => undefined)
    toast.info('If that account exists, a reset token has been issued.')
  }

  return (
    <Modal
      title="Welcome back"
      description={reason ?? 'Pick up where you stopped.'}
      onClose={() => onDone(false)}
      size="sm"
      footer={
        <div className="flex w-full items-center justify-between">
          <button
            type="button"
            onClick={onSwitch}
            className="text-xs text-ink-muted underline-offset-4 hover:text-amber hover:underline"
          >
            Create an account instead
          </button>
          <Button type="submit" form="login-form" variant="primary" loading={busy}>
            Sign in
          </Button>
        </div>
      }
    >
      <form id="login-form" onSubmit={submit} className="space-y-4">
        <Field
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
        <PasswordField
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
          error={error}
        />
        <button
          type="button"
          onClick={forgot}
          className="text-xs text-ink-faint underline-offset-4 hover:text-ink-muted hover:underline"
        >
          Forgot your password?
        </button>
      </form>
    </Modal>
  )
}
