import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { Dices, KeyRound, RefreshCw } from 'lucide-react'
import {
  generateMemorable,
  generateRandom,
  generatedBits,
  type MemorableOptions,
  type RandomOptions,
} from '@/features/auth/passwords'
import { cn } from '@/lib/utils'

type Mode = 'random' | 'memorable'

export function GeneratePasswordButton({
  onAccept,
}: {
  onAccept: (password: string, bits: number) => void
}) {
  const [open, setOpen] = useState(false)
  const wrapper = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [open])

  return (
    <div ref={wrapper} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-2xs text-ink-muted transition-colors hover:bg-ink-line/60 hover:text-amber"
      >
        <KeyRound size={11} />
        Generate password
      </button>

      {open && (
        <Popover
          onAccept={(password, bits) => {
            onAccept(password, bits)
            setOpen(false)
          }}
        />
      )}
    </div>
  )
}

function Popover({ onAccept }: { onAccept: (password: string, bits: number) => void }) {
  const [mode, setMode] = useState<Mode>('memorable')
  const [random, setRandom] = useState<RandomOptions>({
    length: 20,
    uppercase: true,
    digits: true,
    symbols: true,
    avoidAmbiguous: true,
  })
  const [memorable, setMemorable] = useState<MemorableOptions>({
    words: 5,
    separator: '-',
    capitalise: true,
    number: false,
  })
  const [value, setValue] = useState('')

  // Re-roll whenever the shape changes, so the preview always matches the knobs.
  useEffect(() => {
    setValue(mode === 'random' ? generateRandom(random) : generateMemorable(memorable))
  }, [mode, random, memorable])

  const bits = generatedBits(mode, mode === 'random' ? random : memorable)
  const reroll = () => setValue(mode === 'random' ? generateRandom(random) : generateMemorable(memorable))

  return (
    <motion.div
      initial={{ opacity: 0, y: -4, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.14, ease: 'easeOut' }}
      role="dialog"
      aria-label="Generate a password"
      className="surface-raised absolute right-0 z-50 mt-2 w-[min(21rem,calc(100vw-3rem))] rounded-lg p-3"
    >
      <div className="mb-3 flex gap-1 rounded-md border border-ink-line p-0.5">
        {(['memorable', 'random'] as Mode[]).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setMode(value)}
            className={cn(
              'flex-1 rounded px-2 py-1 text-xs capitalize transition-colors',
              mode === value ? 'bg-amber/15 text-amber' : 'text-ink-muted hover:text-ink-text',
            )}
          >
            {value}
          </button>
        ))}
      </div>

      <div className="mb-3 flex items-start gap-2 rounded-md border border-ink-line bg-ink-bg px-3 py-2.5">
        <code className="min-w-0 flex-1 break-all font-mono text-xs leading-relaxed text-ink-text">
          {value}
        </code>
        <button
          type="button"
          onClick={reroll}
          aria-label="Generate another"
          title="Generate another"
          className="shrink-0 rounded p-1 text-ink-faint transition-colors hover:bg-ink-line/60 hover:text-amber"
        >
          <RefreshCw size={13} />
        </button>
      </div>

      {mode === 'random' ? (
        <div className="space-y-2.5">
          <label className="flex items-center gap-3 text-2xs text-ink-muted">
            Length
            <input
              type="range"
              min={12}
              max={48}
              value={random.length}
              onChange={(event) => setRandom({ ...random, length: Number(event.target.value) })}
              className="flex-1 accent-amber"
              aria-label="Length"
            />
            <span className="w-5 text-right tabular-nums">{random.length}</span>
          </label>
          <div className="grid grid-cols-2 gap-x-3">
            <MiniToggle label="A–Z" checked={random.uppercase} onChange={(v) => setRandom({ ...random, uppercase: v })} />
            <MiniToggle label="0–9" checked={random.digits} onChange={(v) => setRandom({ ...random, digits: v })} />
            <MiniToggle label="Symbols" checked={random.symbols} onChange={(v) => setRandom({ ...random, symbols: v })} />
            <MiniToggle
              label="No Il1O0"
              checked={random.avoidAmbiguous}
              onChange={(v) => setRandom({ ...random, avoidAmbiguous: v })}
            />
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          <label className="flex items-center gap-3 text-2xs text-ink-muted">
            Words
            <input
              type="range"
              min={4}
              max={6}
              value={memorable.words}
              onChange={(event) => setMemorable({ ...memorable, words: Number(event.target.value) })}
              className="flex-1 accent-amber"
              aria-label="Words"
            />
            <span className="w-5 text-right tabular-nums">{memorable.words}</span>
          </label>
          <div className="flex items-center gap-2 text-2xs text-ink-muted">
            Separator
            {['-', '.', '_', ' '].map((sep) => (
              <button
                key={sep}
                type="button"
                onClick={() => setMemorable({ ...memorable, separator: sep })}
                className={cn(
                  'h-6 w-6 rounded border font-mono transition-colors',
                  memorable.separator === sep
                    ? 'border-amber/60 bg-amber/15 text-amber'
                    : 'border-ink-line text-ink-muted hover:text-ink-text',
                )}
              >
                {sep === ' ' ? '␣' : sep}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-x-3">
            <MiniToggle label="Capitals" checked={memorable.capitalise} onChange={(v) => setMemorable({ ...memorable, capitalise: v })} />
            <MiniToggle label="End number" checked={memorable.number} onChange={(v) => setMemorable({ ...memorable, number: v })} />
          </div>
        </div>
      )}

      <div className="mt-3 flex items-center gap-2 border-t border-ink-line pt-3">
        <button
          type="button"
          onClick={() => onAccept(value, bits)}
          className="inline-flex items-center gap-1.5 rounded-md bg-amber px-3 py-1.5 text-xs font-medium text-[#1A1408] transition-colors hover:bg-amber-soft"
        >
          <Dices size={12} />
          Use this password
        </button>
        <span className="ml-auto text-2xs tabular-nums text-ink-faint">{bits} bits of entropy</span>
      </div>
    </motion.div>
  )
}

function MiniToggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 py-0.5 text-2xs text-ink-muted">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-3.5 w-3.5 accent-amber"
      />
      {label}
    </label>
  )
}

