import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Link2, Trash2, Upload } from 'lucide-react'
import { Avatar } from '@/components/Avatar'
import { Button } from '@/components/Button'
import { Field } from '@/components/Field'
import { AvatarEditor, type Crop } from '@/features/profile/AvatarEditor'
import { api, ApiError, mediaUrl } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useToast } from '@/lib/toast'
import type { UserMe } from '@/lib/types'

type Source =
  | { kind: 'file'; file: File; preview: string }
  | { kind: 'url'; url: string; preview: string }

/**
 * Setting a picture is optional — the initials fallback is a real avatar, not a
 * placeholder to be nagged about. Both routes in are equally prominent.
 */
export function AvatarSection() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const toast = useToast()
  const fileInput = useRef<HTMLInputElement>(null)

  const [source, setSource] = useState<Source | null>(null)
  const [crop, setCrop] = useState<Crop>({ x: 0, y: 0, size: 0 })
  const [url, setUrl] = useState('')
  const [checking, setChecking] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!user) return null

  const settle = (updated: UserMe) => {
    // Propagate everywhere the avatar is shown, without a reload.
    qc.setQueryData(['me'], updated)
    qc.invalidateQueries({ queryKey: ['profile'] })
    qc.invalidateQueries({ queryKey: ['comments'] })
    qc.invalidateQueries({ queryKey: ['book'] })
    qc.invalidateQueries({ queryKey: ['library'] })
  }

  const checkUrl = async (value: string) => {
    setError(null)
    if (!value.trim()) return
    setChecking(true)
    try {
      // Validated on the server: CORS, mixed content and hotlink blocking can
      // never make a good link look broken here.
      const meta = await api.post<{ url: string; width: number; height: number }>(
        '/me/avatar/preview',
        { url: value.trim() },
      )
      setSource({ kind: 'url', url: meta.url, preview: meta.url })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'That link could not be used.')
      setSource(null)
    } finally {
      setChecking(false)
    }
  }

  const save = async () => {
    if (!source) return
    setSaving(true)
    setError(null)
    try {
      let updated: UserMe
      if (source.kind === 'file') {
        const body = new FormData()
        body.append('file', source.file)
        body.append('x', String(Math.round(crop.x)))
        body.append('y', String(Math.round(crop.y)))
        body.append('size', String(Math.round(crop.size)))
        updated = await api.post<UserMe>('/me/avatar', body)
      } else {
        updated = await api.post<UserMe>('/me/avatar/url', {
          url: source.url,
          x: Math.round(crop.x),
          y: Math.round(crop.y),
          size: Math.round(crop.size),
        })
      }
      settle(updated)
      setSource(null)
      setUrl('')
      toast.success('Profile picture updated.')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save that picture.')
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    const updated = await api.del<UserMe>('/me/avatar').catch(() => null)
    if (updated) {
      settle(updated)
      toast.info('Back to your initials.')
    }
  }

  return (
    <section className="space-y-4 rounded-lg border border-ink-line p-4">
      <div className="flex flex-wrap items-center gap-4">
        <Avatar user={user} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-ink-text">Profile picture</p>
          <p className="mt-0.5 text-xs leading-relaxed text-ink-faint">
            Optional — your initials work perfectly well. Anything you set is re-hosted here, so it
            cannot break later.
          </p>
        </div>
        {user.avatar_url && (
          <Button variant="ghost" size="sm" icon={<Trash2 size={13} />} onClick={remove}>
            Remove picture
          </Button>
        )}
      </div>

      {!source && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Button
            variant="secondary"
            icon={<Upload size={15} />}
            onClick={() => fileInput.current?.click()}
          >
            Upload image
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (!file) return
              if (file.size > 8 * 1024 * 1024) {
                setError('That image is larger than 8 MB.')
                return
              }
              setError(null)
              setSource({ kind: 'file', file, preview: URL.createObjectURL(file) })
            }}
          />

          <div className="flex gap-2">
            <Field
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              onBlur={() => void checkUrl(url)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void checkUrl(url)
                }
              }}
              placeholder="Paste image URL"
              aria-label="Image URL"
              className="flex-1"
            />
            <Button
              variant="secondary"
              icon={<Link2 size={15} />}
              loading={checking}
              onClick={() => void checkUrl(url)}
            >
              Use
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p className="rounded-md border border-danger/40 bg-danger/[0.07] px-3 py-2 text-xs text-danger">
          {error}
        </p>
      )}

      {source && (
        <div className="space-y-4 border-t border-ink-line pt-4">
          <AvatarEditor
            src={source.kind === 'file' ? source.preview : mediaUrl(source.preview)!}
            onChange={setCrop}
          />
          <div className="flex items-center gap-2">
            <Button variant="primary" loading={saving} onClick={save}>
              Save picture
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                if (source.kind === 'file') URL.revokeObjectURL(source.preview)
                setSource(null)
              }}
            >
              Cancel
            </Button>
            <span className="ml-auto text-2xs text-ink-faint">Stored as 512×512 WebP</span>
          </div>
        </div>
      )}
    </section>
  )
}
