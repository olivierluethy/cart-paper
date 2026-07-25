import { mediaUrl } from '@/lib/api'
import { cn, hueFrom } from '@/lib/utils'
import type { CoverDesign } from '@/lib/types'

export type CoverBook = {
  title: string
  subtitle?: string | null
  slug?: string
  author?: { display_name: string } | null
}

const SIZES = {
  xs: 'w-16',
  sm: 'w-28',
  md: 'w-40',
  lg: 'w-56',
  xl: 'w-72',
}

/** A deterministic warm gradient, so an undesigned book still looks bound. */
export function defaultCover(seed: string): CoverDesign {
  const hue = hueFrom(seed)
  return {
    kind: 'gradient',
    gradient: [`hsl(${hue} 22% 22%)`, `hsl(${(hue + 34) % 360} 26% 11%)`],
    angle: 155,
    preset: 'classic',
    show_author: true,
  }
}

function background(design: CoverDesign): React.CSSProperties {
  if (design.kind === 'image' && design.image_url) {
    return {
      backgroundImage: `linear-gradient(180deg, rgb(0 0 0 / 0.15), rgb(0 0 0 / 0.65)), url(${mediaUrl(design.image_url)})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    }
  }
  if (design.kind === 'color' && design.color) {
    return { background: design.color }
  }
  const [from, to] = design.gradient ?? ['#2A2723', '#14120F']
  return { background: `linear-gradient(${design.angle ?? 150}deg, ${from}, ${to})` }
}

type Props = {
  book: CoverBook
  design?: CoverDesign | null
  side?: 'front' | 'back'
  size?: keyof typeof SIZES
  /** 3D tilt + lift on hover. Off inside the designer preview. */
  interactive?: boolean
  className?: string
}

export function BookCover({
  book,
  design,
  side = 'front',
  size = 'md',
  interactive = true,
  className,
}: Props) {
  const cover = design ?? defaultCover(book.slug ?? book.title)
  const preset = cover.preset ?? 'classic'
  const titleColor = cover.title_color ?? '#EDE7DC'

  return (
    <div className={cn('group/cover [perspective:1200px]', SIZES[size], className)}>
      <div
        className={cn(
          'relative aspect-[2/3] w-full rounded-[3px] shadow-cover transition-transform duration-300 ease-paper [transform-style:preserve-3d]',
          interactive && 'group-hover/cover:-translate-y-1 group-hover/cover:[transform:rotateY(-9deg)]',
        )}
        style={background(cover)}
      >
        {/* spine */}
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 w-[7%] rounded-l-[3px]"
          style={{
            background:
              side === 'front'
                ? 'linear-gradient(90deg, rgb(0 0 0 / 0.55), rgb(0 0 0 / 0.12) 60%, rgb(255 255 255 / 0.06))'
                : 'linear-gradient(270deg, rgb(0 0 0 / 0.55), rgb(0 0 0 / 0.12) 60%, rgb(255 255 255 / 0.06))',
            left: side === 'front' ? 0 : undefined,
            right: side === 'back' ? 0 : undefined,
          }}
        />
        {/* page edge */}
        <span
          aria-hidden
          className="absolute inset-y-1 right-[-3px] w-[3px] rounded-r-[2px] bg-[linear-gradient(90deg,#3a352e,#1b1916)]"
        />
        {/* paper sheen */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[3px] bg-[linear-gradient(115deg,rgb(255_255_255/0.09),transparent_38%)]"
        />

        <div
          className={cn(
            'absolute inset-0 flex flex-col pl-[9%] pr-[7%]',
            preset === 'classic' && 'items-center justify-center gap-2 text-center',
            preset === 'modern' && 'items-start justify-end gap-1.5 pb-[10%] text-left',
            preset === 'plate' && 'items-center justify-center gap-2 py-[10%] text-center',
            preset === 'stamp' && 'items-start justify-between py-[10%] text-left',
          )}
          style={{ color: titleColor }}
        >
          {preset === 'plate' && (
            <span
              aria-hidden
              className="absolute inset-[8%] left-[12%] rounded-[2px] border"
              style={{ borderColor: `${titleColor}44` }}
            />
          )}

          {side === 'back' ? (
            <BackFace text={cover.text} book={book} size={size} titleColor={titleColor} />
          ) : (
            <>
              {preset === 'stamp' && (
                <span className="relative text-[0.4em] uppercase tracking-[0.3em] opacity-70">
                  CART Paper
                </span>
              )}
              <div className={cn('relative', preset === 'stamp' && 'mt-auto')}>
                <h3
                  className={cn(
                    'font-display font-semibold leading-[1.08]',
                    preset === 'modern' ? 'text-[1.15em]' : 'text-[1em]',
                    size === 'xs' && 'text-[0.5rem]',
                    size === 'sm' && 'text-[0.8rem]',
                    size === 'md' && 'text-[1rem]',
                    size === 'lg' && 'text-[1.3rem]',
                    size === 'xl' && 'text-[1.65rem]',
                  )}
                  style={{ textWrap: 'balance' }}
                >
                  {book.title}
                </h3>
                {book.subtitle && size !== 'xs' && size !== 'sm' && (
                  <p className="mt-1.5 text-[0.55em] italic leading-snug opacity-75">{book.subtitle}</p>
                )}
              </div>

              {preset === 'classic' && (
                <span
                  aria-hidden
                  className="relative h-px w-8 opacity-50"
                  style={{ background: titleColor }}
                />
              )}

              {cover.show_author !== false && book.author && size !== 'xs' && (
                <p
                  className={cn(
                    'relative text-[0.5em] uppercase tracking-[0.16em] opacity-80',
                    preset === 'stamp' && 'mt-2',
                  )}
                >
                  {book.author.display_name}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function BackFace({
  text,
  book,
  size,
  titleColor,
}: {
  text?: string | null
  book: CoverBook
  size: keyof typeof SIZES
  titleColor: string
}) {
  return (
    <div className="relative flex h-full w-full flex-col justify-center gap-3 py-[12%]">
      <p
        className={cn(
          'font-read leading-relaxed opacity-85',
          size === 'xs' || size === 'sm' ? 'line-clamp-4 text-[0.42em]' : 'line-clamp-[10] text-[0.5em]',
        )}
      >
        {text || 'The back of the book is still blank.'}
      </p>
      <span aria-hidden className="h-px w-10 opacity-40" style={{ background: titleColor }} />
      <p className="text-[0.42em] uppercase tracking-[0.18em] opacity-65">
        {book.author?.display_name ?? 'CART Paper'}
      </p>
    </div>
  )
}
