import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type Tone = 'success' | 'error' | 'info'

type Toast = {
  id: number
  tone: Tone
  message: string
  action?: { label: string; onClick: () => void }
}

type ToastApi = {
  show: (message: string, tone?: Tone, action?: Toast['action']) => void
  success: (message: string, action?: Toast['action']) => void
  error: (message: string, action?: Toast['action']) => void
  info: (message: string, action?: Toast['action']) => void
}

const ToastContext = createContext<ToastApi | null>(null)

const ICONS: Record<Tone, typeof Info> = {
  success: CheckCircle2,
  error: AlertTriangle,
  info: Info,
}

const TONES: Record<Tone, string> = {
  success: 'border-success/40 text-success',
  error: 'border-danger/45 text-danger',
  info: 'border-ink-line text-amber',
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id))
  }, [])

  const show = useCallback(
    (message: string, tone: Tone = 'info', action?: Toast['action']) => {
      const id = nextId.current++
      setToasts((current) => [...current.slice(-3), { id, tone, message, action }])
      setTimeout(() => dismiss(id), tone === 'error' ? 7000 : 4200)
    },
    [dismiss],
  )

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (m, a) => show(m, 'success', a),
      error: (m, a) => show(m, 'error', a),
      info: (m, a) => show(m, 'info', a),
    }),
    [show],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
        role="status"
        aria-live="polite"
      >
        <AnimatePresence initial={false}>
          {toasts.map((toast) => {
            const Icon = ICONS[toast.tone]
            return (
              <motion.div
                key={toast.id}
                layout
                initial={{ opacity: 0, y: 10, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 16, transition: { duration: 0.14 } }}
                transition={{ duration: 0.2, ease: [0.22, 0.61, 0.36, 1] }}
                className={cn(
                  'surface-raised pointer-events-auto flex items-start gap-3 rounded-lg border px-4 py-3',
                  TONES[toast.tone],
                )}
              >
                <Icon size={16} className="mt-0.5 shrink-0" />
                <p className="flex-1 text-sm leading-snug text-ink-text">{toast.message}</p>
                {toast.action && (
                  <button
                    type="button"
                    onClick={() => {
                      toast.action!.onClick()
                      dismiss(toast.id)
                    }}
                    className="shrink-0 text-xs font-medium text-amber underline-offset-4 hover:underline"
                  >
                    {toast.action.label}
                  </button>
                )}
                <button
                  type="button"
                  aria-label="Dismiss"
                  onClick={() => dismiss(toast.id)}
                  className="-mr-1 shrink-0 text-ink-faint transition-colors hover:text-ink-text"
                >
                  <X size={14} />
                </button>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
