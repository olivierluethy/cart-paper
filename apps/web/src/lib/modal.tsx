import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { AnimatePresence } from 'motion/react'
import { Modal } from '@/components/Modal'
import { Button } from '@/components/Button'

/**
 * Imperative modal stack. The product prefers modals over redirects for auth,
 * invites, settings, note editing and confirmations, so opening one has to be
 * as cheap as calling a function — and it has to be awaitable, because most of
 * those flows continue once the user is done.
 */

export type ModalControls<T> = { close: (value?: T) => void }
type Renderer<T> = (controls: ModalControls<T>) => ReactNode

type Entry = {
  id: number
  render: Renderer<unknown>
  resolve: (value: unknown) => void
}

type ModalApi = {
  open: <T = void>(render: Renderer<T>) => Promise<T | undefined>
  confirm: (options: ConfirmOptions) => Promise<boolean>
  closeAll: () => void
}

export type ConfirmOptions = {
  title: string
  body?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
}

const ModalContext = createContext<ModalApi | null>(null)

export function ModalProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<Entry[]>([])
  const nextId = useRef(1)

  const open = useCallback(<T,>(render: Renderer<T>) => {
    return new Promise<T | undefined>((resolve) => {
      const id = nextId.current++
      setStack((current) => [
        ...current,
        { id, render: render as Renderer<unknown>, resolve: resolve as (v: unknown) => void },
      ])
    })
  }, [])

  const dismiss = useCallback((id: number, value: unknown) => {
    setStack((current) => {
      const entry = current.find((item) => item.id === id)
      entry?.resolve(value)
      return current.filter((item) => item.id !== id)
    })
  }, [])

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      open<boolean>(({ close }) => (
        <Modal
          title={options.title}
          onClose={() => close(false)}
          size="sm"
          footer={
            <>
              <Button variant="ghost" onClick={() => close(false)}>
                {options.cancelLabel ?? 'Cancel'}
              </Button>
              <Button
                variant={options.destructive ? 'danger' : 'primary'}
                onClick={() => close(true)}
              >
                {options.confirmLabel ?? 'Confirm'}
              </Button>
            </>
          }
        >
          <div className="text-sm leading-relaxed text-ink-muted">{options.body}</div>
        </Modal>
      )).then((value) => value === true),
    [open],
  )

  const closeAll = useCallback(() => {
    setStack((current) => {
      current.forEach((entry) => entry.resolve(undefined))
      return []
    })
  }, [])

  const api = useMemo<ModalApi>(() => ({ open, confirm, closeAll }), [open, confirm, closeAll])

  return (
    <ModalContext.Provider value={api}>
      {children}
      <AnimatePresence>
        {stack.map((entry) => (
          <div key={entry.id}>
            {entry.render({ close: (value?: unknown) => dismiss(entry.id, value) })}
          </div>
        ))}
      </AnimatePresence>
    </ModalContext.Provider>
  )
}

export function useModal(): ModalApi {
  const ctx = useContext(ModalContext)
  if (!ctx) throw new Error('useModal must be used inside <ModalProvider>')
  return ctx
}
