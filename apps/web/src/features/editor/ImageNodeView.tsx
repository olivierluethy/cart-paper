import { useState } from 'react'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Maximize,
  TextQuote,
  Trash2,
  Type,
  WrapText,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { mediaUrl } from '@/lib/api'
import type { ImageAlign, ImageWidth } from '@/features/editor/extensions/CartImage'

const ALIGNS: { value: ImageAlign; label: string; icon: typeof AlignLeft }[] = [
  { value: 'left', label: 'Align left', icon: AlignLeft },
  { value: 'center', label: 'Align centre', icon: AlignCenter },
  { value: 'right', label: 'Align right', icon: AlignRight },
  { value: 'full', label: 'Full bleed', icon: Maximize },
]

const WIDTHS: ImageWidth[] = [25, 50, 75, 100]

/** Shared by the editor and the read-only reader; controls only appear when editable. */
export function ImageNodeView({ node, updateAttributes, deleteNode, selected, editor }: NodeViewProps) {
  const attrs = node.attrs as {
    src: string
    alt: string | null
    caption: string | null
    align: ImageAlign
    width: ImageWidth
    wrap: boolean
  }
  const [editing, setEditing] = useState<'caption' | 'alt' | null>(null)
  const editable = editor.isEditable

  const figureStyle =
    attrs.align === 'full'
      ? { width: '100%' }
      : {
          width: `${attrs.width}%`,
          marginLeft: attrs.align === 'right' ? 'auto' : attrs.align === 'center' ? 'auto' : undefined,
          marginRight: attrs.align === 'left' ? 'auto' : attrs.align === 'center' ? 'auto' : undefined,
          float: attrs.wrap && attrs.align !== 'center' ? (attrs.align as 'left' | 'right') : undefined,
        }

  return (
    <NodeViewWrapper
      as="figure"
      data-cart-image=""
      data-align={attrs.align}
      data-width={attrs.width}
      data-wrap={String(attrs.wrap)}
      className={cn(
        'cart-figure relative',
        attrs.align === 'full' && '-mx-4 sm:-mx-10',
        attrs.wrap && attrs.align === 'left' && 'mr-6',
        attrs.wrap && attrs.align === 'right' && 'ml-6',
      )}
      style={figureStyle}
    >
      <img
        src={mediaUrl(attrs.src) ?? attrs.src}
        alt={attrs.alt ?? ''}
        draggable={false}
        className={cn(
          'block w-full rounded-sm border border-ink-line/60',
          selected && editable && 'outline outline-2 outline-offset-2 outline-amber/70',
        )}
      />

      {(attrs.caption || editing === 'caption') && (
        <figcaption className="mt-2 text-center font-ui text-xs leading-relaxed text-ink-faint">
          {editable && editing === 'caption' ? (
            <input
              autoFocus
              value={attrs.caption ?? ''}
              onChange={(event) => updateAttributes({ caption: event.target.value })}
              onBlur={() => setEditing(null)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === 'Escape') setEditing(null)
              }}
              placeholder="Caption"
              aria-label="Image caption"
              className="w-full bg-transparent text-center outline-none placeholder:text-ink-faint/60"
            />
          ) : (
            attrs.caption
          )}
        </figcaption>
      )}

      {editable && selected && (
        <div
          contentEditable={false}
          className="surface-raised absolute -top-11 left-1/2 z-20 flex -translate-x-1/2 items-center gap-0.5 rounded-lg px-1 py-1"
        >
          {ALIGNS.map(({ value, label, icon: Icon }) => (
            <Control
              key={value}
              label={label}
              active={attrs.align === value}
              onClick={() => updateAttributes({ align: value, wrap: value === 'center' ? false : attrs.wrap })}
            >
              <Icon size={14} />
            </Control>
          ))}

          <span className="mx-0.5 h-5 w-px bg-ink-line" aria-hidden />

          {WIDTHS.map((width) => (
            <button
              key={width}
              type="button"
              title={`${width}% width`}
              aria-label={`${width} percent width`}
              aria-pressed={attrs.width === width && attrs.align !== 'full'}
              onClick={() => updateAttributes({ width })}
              disabled={attrs.align === 'full'}
              className={cn(
                'h-7 rounded px-1.5 text-2xs tabular-nums transition-colors disabled:opacity-30',
                attrs.width === width && attrs.align !== 'full'
                  ? 'bg-amber/15 text-amber'
                  : 'text-ink-muted hover:bg-ink-line/60 hover:text-ink-text',
              )}
            >
              {width}
            </button>
          ))}

          <span className="mx-0.5 h-5 w-px bg-ink-line" aria-hidden />

          <Control
            label="Wrap text around"
            active={attrs.wrap}
            disabled={attrs.align === 'center' || attrs.align === 'full'}
            onClick={() => updateAttributes({ wrap: !attrs.wrap })}
          >
            <WrapText size={14} />
          </Control>
          <Control
            label="Caption"
            active={editing === 'caption' || Boolean(attrs.caption)}
            onClick={() => setEditing(editing === 'caption' ? null : 'caption')}
          >
            <TextQuote size={14} />
          </Control>
          <Control
            label="Alt text"
            active={editing === 'alt' || Boolean(attrs.alt)}
            onClick={() => setEditing(editing === 'alt' ? null : 'alt')}
          >
            <Type size={14} />
          </Control>
          <Control label="Remove image" onClick={deleteNode} danger>
            <Trash2 size={14} />
          </Control>
        </div>
      )}

      {editable && selected && editing === 'alt' && (
        <div contentEditable={false} className="surface-raised absolute left-1/2 top-full z-20 mt-2 w-72 -translate-x-1/2 rounded-lg p-3">
          <label className="label mb-1.5 block" htmlFor="cart-alt">
            Alt text
          </label>
          <input
            id="cart-alt"
            autoFocus
            value={attrs.alt ?? ''}
            onChange={(event) => updateAttributes({ alt: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === 'Escape') setEditing(null)
            }}
            placeholder="What the image shows"
            className="field"
          />
          <p className="mt-2 text-2xs leading-relaxed text-ink-faint">
            Read aloud in place of the image. Leave it empty only if the image is decorative.
          </p>
        </div>
      )}
    </NodeViewWrapper>
  )
}

function Control({
  label,
  active,
  danger,
  disabled,
  onClick,
  children,
}: {
  label: string
  active?: boolean
  danger?: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-grid h-7 w-7 place-items-center rounded transition-colors disabled:cursor-not-allowed disabled:opacity-30',
        danger
          ? 'text-ink-muted hover:bg-danger/15 hover:text-danger'
          : active
            ? 'bg-amber/15 text-amber'
            : 'text-ink-muted hover:bg-ink-line/60 hover:text-ink-text',
      )}
    >
      {children}
    </button>
  )
}
