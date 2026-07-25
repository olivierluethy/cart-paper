import { useState } from 'react'
import { Check, Share2 } from 'lucide-react'
import { Button } from '@/components/Button'
import { useToast } from '@/lib/toast'

/** Native share sheet where the browser has one, clipboard everywhere else. */
export function ShareButton({
  title,
  text,
  url,
  variant = 'secondary',
}: {
  title: string
  text?: string
  url?: string
  variant?: 'secondary' | 'ghost'
}) {
  const toast = useToast()
  const [done, setDone] = useState(false)
  const target = url ?? (typeof window !== 'undefined' ? window.location.href : '')

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url: target })
        return
      } catch (error) {
        // A cancelled share sheet is not a failure; fall through to copying.
        if ((error as Error)?.name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(target)
      setDone(true)
      setTimeout(() => setDone(false), 2000)
      toast.success('Link copied.')
    } catch {
      toast.error('Your browser blocked the clipboard — copy the address bar instead.')
    }
  }

  return (
    <Button variant={variant} icon={done ? <Check size={15} /> : <Share2 size={15} />} onClick={share}>
      {done ? 'Copied' : 'Share'}
    </Button>
  )
}
