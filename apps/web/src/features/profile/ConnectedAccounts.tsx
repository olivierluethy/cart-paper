import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link2Off, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/Button'
import { useProviders } from '@/features/auth/SocialButtons'
import { api, API_URL, ApiError } from '@/lib/api'
import { useToast } from '@/lib/toast'
import { formatDate } from '@/lib/utils'

type Linked = { id: string; provider: string; email: string | null; created_at: string }

export function ConnectedAccounts() {
  const qc = useQueryClient()
  const toast = useToast()
  const providers = useProviders()

  const linked = useQuery({
    queryKey: ['auth', 'linked'],
    queryFn: () => api.get<Linked[]>('/auth/linked'),
  })

  const unlink = useMutation({
    mutationFn: (id: string) => api.del(`/auth/linked/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auth', 'linked'] })
      toast.success('Account disconnected.')
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : 'Could not disconnect that account.'),
  })

  const available = (providers.data ?? []).filter((provider) => provider.configured)
  const rows = linked.data ?? []

  return (
    <section className="space-y-3 border-t border-ink-line pt-5">
      <div>
        <p className="label">Connected accounts</p>
        <p className="mt-1 text-xs leading-relaxed text-ink-faint">
          Sign in with a provider instead of a password. Linking one never changes your books,
          notes or discussions.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-ink-faint">Nothing connected.</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-ink-line px-3.5 py-2.5"
            >
              <ShieldCheck size={14} className="shrink-0 text-success" />
              <span className="text-sm capitalize text-ink-text">{row.provider}</span>
              {row.email && <span className="text-xs text-ink-faint">{row.email}</span>}
              <span className="text-2xs text-ink-faint">linked {formatDate(row.created_at)}</span>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto"
                icon={<Link2Off size={13} />}
                loading={unlink.isPending}
                onClick={() => unlink.mutate(row.id)}
              >
                Disconnect
              </Button>
            </li>
          ))}
        </ul>
      )}

      {available.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {available
            .filter((provider) => !rows.some((row) => row.provider === provider.provider))
            .map((provider) => (
              <Button
                key={provider.provider}
                variant="secondary"
                size="sm"
                onClick={() => {
                  window.location.href = `${API_URL}/auth/oauth/${provider.provider}/start`
                }}
              >
                Connect {provider.label}
              </Button>
            ))}
        </div>
      )}

      {available.length === 0 && (
        <p className="text-2xs text-ink-faint">
          No provider is configured on this server yet — see docs/ARCHITECTURE.md to switch one on.
        </p>
      )}
    </section>
  )
}
