import { useQuery } from '@tanstack/react-query'
import { api, API_URL } from '@/lib/api'
import { cn } from '@/lib/utils'

export type Provider = { provider: 'google' | 'facebook'; configured: boolean; label: string }

export function useProviders() {
  return useQuery({
    queryKey: ['auth', 'providers'],
    queryFn: () => api.get<Provider[]>('/auth/providers'),
    staleTime: 5 * 60_000,
  })
}

const MARKS: Record<string, React.ReactNode> = {
  google: (
    <svg viewBox="0 0 18 18" width="16" height="16" aria-hidden>
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z" />
    </svg>
  ),
  facebook: (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
      <path
        fill="#1877F2"
        d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.96h-1.51c-1.49 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07Z"
      />
    </svg>
  ),
}

/**
 * Never render a button that looks live but does nothing. A provider without
 * credentials is visibly disabled and says so, and there is no code path that
 * fakes a successful social login.
 */
export function SocialButtons({ action }: { action: 'Sign in' | 'Sign up' }) {
  const providers = useProviders()
  const list = providers.data ?? []
  if (providers.isLoading || list.length === 0) return null

  return (
    <div className="space-y-2.5">
      {list.map((provider) => (
        <button
          key={provider.provider}
          type="button"
          disabled={!provider.configured}
          title={
            provider.configured
              ? `${action} with ${provider.label}`
              : 'Not configured yet — coming soon.'
          }
          onClick={() => {
            if (!provider.configured) return
            window.location.href = `${API_URL}/auth/oauth/${provider.provider}/start`
          }}
          className={cn(
            'flex w-full items-center justify-center gap-2.5 rounded-md border px-4 py-2.5 text-sm transition-colors',
            provider.configured
              ? 'border-ink-line bg-ink-raised text-ink-text hover:border-ink-muted/50 hover:bg-ink-line/50'
              : 'cursor-not-allowed border-ink-line/60 bg-ink-surface/40 text-ink-faint',
          )}
        >
          <span className={cn(!provider.configured && 'opacity-40')}>{MARKS[provider.provider]}</span>
          Continue with {provider.label}
          {!provider.configured && (
            <span className="ml-1 rounded-full border border-ink-line px-1.5 py-0.5 text-[0.6rem] uppercase tracking-wide">
              soon
            </span>
          )}
        </button>
      ))}

      <div className="flex items-center gap-3 pt-1" aria-hidden>
        <span className="h-px flex-1 bg-ink-line" />
        <span className="text-2xs uppercase tracking-[0.14em] text-ink-faint">or</span>
        <span className="h-px flex-1 bg-ink-line" />
      </div>
    </div>
  )
}
