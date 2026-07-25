import { useState } from 'react'
import { Modal } from '@/components/Modal'
import { Button } from '@/components/Button'
import { Field, TextArea, Toggle } from '@/components/Field'
import { AvatarSection } from '@/features/profile/AvatarSection'
import { ConnectedAccounts } from '@/features/profile/ConnectedAccounts'
import { useAuth, useReadingSettings } from '@/lib/auth'
import { useToast } from '@/lib/toast'
import { cn } from '@/lib/utils'

const TABS = ['Profile', 'Reading'] as const
type Tab = (typeof TABS)[number]

export function SettingsModal({ onDone }: { onDone: () => void }) {
  const { user, updateProfile, updateReadingSettings } = useAuth()
  const settings = useReadingSettings()
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('Profile')
  const [displayName, setDisplayName] = useState(user?.display_name ?? '')
  const [bio, setBio] = useState(user?.bio ?? '')
  const [statsVisible, setStatsVisible] = useState(user?.stats_visible ?? true)
  const [busy, setBusy] = useState(false)

  if (!user) return null

  const saveProfile = async () => {
    setBusy(true)
    try {
      await updateProfile({ display_name: displayName, bio, stats_visible: statsVisible })
      toast.success('Profile updated.')
      onDone()
    } catch {
      toast.error('Could not save your profile.')
    } finally {
      setBusy(false)
    }
  }

  const patchReading = async (patch: Parameters<typeof updateReadingSettings>[0]) => {
    try {
      await updateReadingSettings(patch)
    } catch {
      toast.error('Could not save that reading setting.')
    }
  }

  return (
    <Modal
      title="Settings"
      onClose={onDone}
      size="md"
      footer={
        tab === 'Profile' ? (
          <>
            <Button variant="ghost" onClick={onDone}>
              Cancel
            </Button>
            <Button variant="primary" loading={busy} onClick={saveProfile}>
              Save changes
            </Button>
          </>
        ) : (
          <Button variant="primary" onClick={onDone}>
            Done
          </Button>
        )
      }
    >
      <div className="mb-6 flex gap-1 border-b border-ink-line" role="tablist">
        {TABS.map((name) => (
          <button
            key={name}
            role="tab"
            aria-selected={tab === name}
            onClick={() => setTab(name)}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-sm transition-colors',
              tab === name
                ? 'border-amber text-ink-text'
                : 'border-transparent text-ink-muted hover:text-ink-text',
            )}
          >
            {name}
          </button>
        ))}
      </div>

      {tab === 'Profile' ? (
        <div className="space-y-5">
          <AvatarSection />
          <Field
            label="Display name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={120}
          />
          <TextArea
            label="Bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={2000}
            placeholder="What you read, what you write."
            rows={4}
          />
          <div className="space-y-1.5">
            <p className="label">Handle</p>
            <p className="text-sm text-ink-muted">
              @{user.handle} · <span className="text-ink-faint">{user.email}</span>
            </p>
          </div>
          <Toggle
            checked={statsVisible}
            onChange={setStatsVisible}
            label="Show my reading statistics"
            description="Turn this off and every statistic disappears from your profile — reading time, sessions, pages turned, streaks."
          />
          <ConnectedAccounts />
        </div>
      ) : (
        <div className="space-y-6">
          <Slider
            label="Font size"
            value={settings.font_size}
            min={12}
            max={28}
            step={1}
            suffix="px"
            onChange={(v) => patchReading({ font_size: v })}
          />
          <Slider
            label="Line height"
            value={settings.line_height}
            min={1.2}
            max={2.4}
            step={0.05}
            onChange={(v) => patchReading({ line_height: Number(v.toFixed(2)) })}
          />
          <Slider
            label="Reading width"
            value={settings.width}
            min={24}
            max={54}
            step={1}
            suffix="rem"
            onChange={(v) => patchReading({ width: v })}
          />
          <div className="space-y-2">
            <p className="label">Typeface</p>
            <div className="flex gap-2">
              {(['serif', 'sans'] as const).map((face) => (
                <button
                  key={face}
                  type="button"
                  onClick={() => patchReading({ typeface: face })}
                  data-active={settings.typeface === face}
                  className={cn('chip capitalize', face === 'serif' ? 'font-read' : 'font-ui')}
                >
                  {face === 'serif' ? 'Literata (serif)' : 'IBM Plex (sans)'}
                </button>
              ))}
            </div>
          </div>
          <div
            className="rounded-md border border-ink-line bg-ink-bg/60 p-5"
            style={{
              fontSize: `${settings.font_size}px`,
              lineHeight: settings.line_height,
            }}
          >
            <p className={settings.typeface === 'serif' ? 'font-read' : 'font-ui'}>
              She read the way other people listened for a name in a crowded room — waiting for the
              one line that would turn out to have been written for her.
            </p>
          </div>
        </div>
      )}
    </Modal>
  )
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  suffix?: string
  onChange: (value: number) => void
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="label">{label}</span>
        <span className="text-xs tabular-nums text-ink-muted">
          {value}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-amber"
      />
    </div>
  )
}
