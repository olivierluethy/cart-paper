import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export type Crop = { x: number; y: number; size: number }

/**
 * Circular cropper. Drag to reposition, wheel or slider to zoom, pinch on touch.
 *
 * The transform is kept in display pixels and converted to source pixels only
 * when reporting the crop, so the maths stays legible: at zoom 1 the image's
 * shorter side exactly covers the frame, and the offset is clamped so the frame
 * is never allowed to show empty space.
 */
export function AvatarEditor({
  src,
  frame = 260,
  onChange,
}: {
  src: string
  frame?: number
  onChange: (crop: Crop) => void
}) {
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [loading, setLoading] = useState(true)
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)
  const pinch = useRef<number | null>(null)

  const baseScale = natural ? frame / Math.min(natural.w, natural.h) : 1
  const scale = baseScale * zoom
  const shownW = natural ? natural.w * scale : 0
  const shownH = natural ? natural.h * scale : 0

  const clamp = useCallback(
    (next: { x: number; y: number }) => ({
      x: Math.min(0, Math.max(next.x, frame - shownW)),
      y: Math.min(0, Math.max(next.y, frame - shownH)),
    }),
    [frame, shownW, shownH],
  )

  useEffect(() => {
    setLoading(true)
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => {
      setNatural({ w: image.naturalWidth, h: image.naturalHeight })
      setZoom(1)
      setOffset({ x: 0, y: 0 })
      setLoading(false)
    }
    image.onerror = () => setLoading(false)
    image.src = src
  }, [src])

  // Centre whenever the geometry changes.
  useEffect(() => {
    if (!natural) return
    setOffset(clamp({ x: (frame - shownW) / 2, y: (frame - shownH) / 2 }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [natural, zoom])

  useEffect(() => {
    if (!natural) return
    onChange({
      x: -offset.x / scale,
      y: -offset.y / scale,
      size: frame / scale,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset, zoom, natural])

  return (
    <div className="flex flex-wrap items-start gap-6">
      <div>
        <div
          role="application"
          aria-label="Reposition and zoom your picture"
          style={{ width: frame, height: frame }}
          className="relative overflow-hidden rounded-full border border-ink-line bg-ink-bg touch-none"
          onPointerDown={(event) => {
            ;(event.target as HTMLElement).setPointerCapture?.(event.pointerId)
            drag.current = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y }
          }}
          onPointerMove={(event) => {
            if (!drag.current) return
            setOffset(
              clamp({
                x: drag.current.ox + (event.clientX - drag.current.x),
                y: drag.current.oy + (event.clientY - drag.current.y),
              }),
            )
          }}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
          onWheel={(event) => {
            setZoom((value) => Math.min(4, Math.max(1, value - event.deltaY * 0.0015)))
          }}
          onTouchMove={(event) => {
            if (event.touches.length !== 2) return
            const [a, b] = [event.touches[0]!, event.touches[1]!]
            const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
            if (pinch.current) {
              setZoom((value) => Math.min(4, Math.max(1, value * (distance / pinch.current!))))
            }
            pinch.current = distance
          }}
          onTouchEnd={() => (pinch.current = null)}
        >
          {loading && (
            <div className="absolute inset-0 grid place-items-center text-ink-faint">
              <Loader2 size={18} className="animate-spin" />
            </div>
          )}
          {natural && (
            <img
              src={src}
              alt=""
              draggable={false}
              style={{
                position: 'absolute',
                left: offset.x,
                top: offset.y,
                width: shownW,
                height: shownH,
                maxWidth: 'none',
              }}
              className="select-none"
            />
          )}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-inset ring-white/15"
          />
        </div>

        <label className="mt-4 flex items-center gap-3 text-xs text-ink-muted">
          Zoom
          <input
            type="range"
            min={1}
            max={4}
            step={0.01}
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
            aria-label="Zoom"
            className="flex-1 accent-amber"
          />
        </label>
        <p className="mt-1 text-2xs text-ink-faint">Drag the picture to reposition it.</p>
      </div>

      {/* Live preview at the sizes the avatar is actually used. */}
      <div className="space-y-4">
        <p className="label">Preview</p>
        {[
          { px: 64, label: 'Profile' },
          { px: 32, label: 'Comments' },
          { px: 24, label: 'Header' },
        ].map((preview) => (
          <div key={preview.px} className="flex items-center gap-3">
            <span
              style={{ width: preview.px, height: preview.px }}
              className={cn('relative shrink-0 overflow-hidden rounded-full border border-ink-line bg-ink-bg')}
            >
              {natural && (
                <img
                  src={src}
                  alt=""
                  draggable={false}
                  style={{
                    position: 'absolute',
                    left: (offset.x / frame) * preview.px,
                    top: (offset.y / frame) * preview.px,
                    width: (shownW / frame) * preview.px,
                    height: (shownH / frame) * preview.px,
                    maxWidth: 'none',
                  }}
                />
              )}
            </span>
            <span className="text-2xs text-ink-faint">{preview.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
