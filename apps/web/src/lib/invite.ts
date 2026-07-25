import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '@/lib/api'

const SEEN = new Set<string>()

/**
 * A preview link is `?invite=<token>`. The token is passed on every request for
 * that draft, and the "someone opened your draft" notification fires once per
 * token per session rather than on every render.
 */
export function useInviteToken(): string | null {
  const [params] = useSearchParams()
  const token = params.get('invite')
  const accepted = useRef(false)

  useEffect(() => {
    if (!token || accepted.current || SEEN.has(token)) return
    accepted.current = true
    SEEN.add(token)
    void api.post(`/invites/${token}/accept`).catch(() => {
      // A revoked or expired link still renders the 404 the API sends for the
      // draft itself — no need to shout about the accept call.
    })
  }, [token])

  return token
}
