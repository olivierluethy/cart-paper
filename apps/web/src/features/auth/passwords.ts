import { ZxcvbnFactory, type ZxcvbnResult } from '@zxcvbn-ts/core'
import { BITS_PER_WORD, WORDLIST } from '@/features/auth/wordlist'

let factory: ZxcvbnFactory | null = null

/** Loaded lazily: the language packs are large and only the auth screens need them. */
async function getFactory(): Promise<ZxcvbnFactory> {
  if (!factory) {
    const [common, english] = await Promise.all([
      import('@zxcvbn-ts/language-common'),
      import('@zxcvbn-ts/language-en'),
    ])
    factory = new ZxcvbnFactory({
      dictionary: { ...common.dictionary, ...english.dictionary },
      graphs: common.adjacencyGraphs,
      translations: english.translations,
    })
  }
  return factory
}

export async function scorePassword(password: string): Promise<ZxcvbnResult | null> {
  if (!password) return null
  const zxcvbn = await getFactory()
  return zxcvbn.checkAsync(password)
}

export const VERDICTS = ['Very weak', 'Weak', 'Fair', 'Strong', 'Excellent'] as const

/** The single most useful thing to say next, rather than a wall of advice. */
export function adviceFor(result: ZxcvbnResult | null): string {
  if (!result) return ''
  const { warning, suggestions } = result.feedback
  if (warning) return warning
  if (suggestions.length > 0) return suggestions[0]!
  return result.score >= 4 ? 'Nothing to improve — save it somewhere safe.' : 'Add another word.'
}

/** Offline slow hashing is the realistic attacker for a stolen argon2 database. */
export function crackTime(result: ZxcvbnResult | null): string {
  if (!result) return ''
  return String(result.crackTimes.offlineSlowHashingXPerSecond)
}

// --------------------------------------------------------------------- generation
/** Uniform in [0, max) from the CSPRNG. Rejection sampling, never modulo bias. */
function randomBelow(max: number): number {
  const limit = Math.floor(0xffffffff / max) * max
  const buffer = new Uint32Array(1)
  let value: number
  do {
    crypto.getRandomValues(buffer)
    value = buffer[0]!
  } while (value >= limit)
  return value % max
}

function pick<T>(items: readonly T[]): T {
  return items[randomBelow(items.length)]!
}

export type RandomOptions = {
  length: number
  uppercase: boolean
  digits: boolean
  symbols: boolean
  avoidAmbiguous: boolean
}

const LOWER = 'abcdefghijkmnopqrstuvwxyz'
const LOWER_ALL = 'abcdefghijklmnopqrstuvwxyz'
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const UPPER_ALL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const DIGITS = '23456789'
const DIGITS_ALL = '0123456789'
const SYMBOLS = '!@#$%^&*()-_=+[]{};:,.?/'

export function generateRandom(options: RandomOptions): string {
  const sets: string[] = [options.avoidAmbiguous ? LOWER : LOWER_ALL]
  if (options.uppercase) sets.push(options.avoidAmbiguous ? UPPER : UPPER_ALL)
  if (options.digits) sets.push(options.avoidAmbiguous ? DIGITS : DIGITS_ALL)
  if (options.symbols) sets.push(SYMBOLS)

  // One character from each chosen set first, so every toggle is honoured…
  const chars = sets.map((set) => pick(set.split('')))
  const pool = sets.join('').split('')
  while (chars.length < options.length) chars.push(pick(pool))

  // …then shuffled, so the guaranteed characters are not always at the front.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomBelow(i + 1)
    ;[chars[i], chars[j]] = [chars[j]!, chars[i]!]
  }
  return chars.join('')
}

export type MemorableOptions = {
  words: number
  separator: string
  capitalise: boolean
  number: boolean
}

export function generateMemorable(options: MemorableOptions): string {
  const words = Array.from({ length: options.words }, () => {
    const word = pick(WORDLIST)
    return options.capitalise ? word[0]!.toUpperCase() + word.slice(1) : word
  })
  const phrase = words.join(options.separator)
  return options.number ? `${phrase}${options.separator}${randomBelow(90) + 10}` : phrase
}

/** Honest entropy for a generated value — not zxcvbn's guess at a human one. */
export function generatedBits(mode: 'random' | 'memorable', options: RandomOptions | MemorableOptions): number {
  if (mode === 'memorable') {
    const memorable = options as MemorableOptions
    return Math.round(memorable.words * BITS_PER_WORD + (memorable.number ? 6.5 : 0))
  }
  const random = options as RandomOptions
  let pool = 25
  if (random.uppercase) pool += 24
  if (random.digits) pool += 8
  if (random.symbols) pool += SYMBOLS.length
  return Math.round(random.length * Math.log2(pool))
}

// --------------------------------------------------------------------- clipboard
const CLIPBOARD_TTL_MS = 90_000

/**
 * Copy, then clear after 90 seconds — but only if the clipboard still holds our
 * value, so we never wipe something the user copied afterwards.
 */
export async function copyPasswordToClipboard(password: string): Promise<'copied' | 'unavailable'> {
  if (!navigator.clipboard?.writeText || !window.isSecureContext) return 'unavailable'
  try {
    await navigator.clipboard.writeText(password)
  } catch {
    return 'unavailable'
  }
  window.setTimeout(() => void clearClipboardIfOurs(password), CLIPBOARD_TTL_MS)
  return 'copied'
}

export async function clearClipboardIfOurs(password: string): Promise<void> {
  try {
    if (navigator.clipboard?.readText) {
      const current = await navigator.clipboard.readText()
      if (current !== password) return
    }
    await navigator.clipboard?.writeText('')
  } catch {
    // Reading the clipboard can be denied; not being able to tidy up is fine.
  }
}
