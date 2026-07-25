import { useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { TextLayer } from 'pdfjs-dist'
import { Spinner } from '@/components/States'
import type { NormRect } from '@/lib/pdfAnchor'
import type { HighlightColor } from '@/lib/types'
import { cn } from '@/lib/utils'

export type Overlay = {
  id: string
  rects: NormRect[]
  kind: 'highlight' | 'discussion'
  color?: HighlightColor
}

/**
 * A PDF page rendered to canvas with pdf.js' selectable text layer on top.
 * The text layer is what makes the fallback a real reader: selection, quotes,
 * highlights and anchored discussion all depend on it.
 */
export function PdfPageView({
  pdf,
  pageNumber,
  overlays,
  activeId,
  onText,
  onOverlayClick,
  containerRef,
}: {
  pdf: PDFDocumentProxy
  pageNumber: number
  overlays: Overlay[]
  activeId: string | null
  onText: (text: string) => void
  onOverlayClick: (id: string) => void
  containerRef: React.RefObject<HTMLDivElement>
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const textLayer = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    let task: { cancel: () => void } | null = null

    const render = async () => {
      setLoading(true)
      const page = await pdf.getPage(pageNumber)
      if (cancelled) return

      const host = containerRef.current
      const available = Math.min(host?.clientWidth ?? 800, 900)
      const base = page.getViewport({ scale: 1 })
      const scale = available / base.width
      const viewport = page.getViewport({ scale })
      const dpr = Math.min(window.devicePixelRatio || 1, 2)

      const element = canvas.current
      if (!element) return
      element.width = Math.floor(viewport.width * dpr)
      element.height = Math.floor(viewport.height * dpr)
      element.style.width = `${Math.floor(viewport.width)}px`
      element.style.height = `${Math.floor(viewport.height)}px`
      setSize({ width: Math.floor(viewport.width), height: Math.floor(viewport.height) })

      const context = element.getContext('2d')
      if (!context) return
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      const renderTask = page.render({ canvasContext: context, viewport })
      task = renderTask
      await renderTask.promise.catch(() => undefined)
      if (cancelled) return

      const layer = textLayer.current
      if (layer) {
        layer.replaceChildren()
        // pdf.js positions spans from this variable.
        layer.style.setProperty('--scale-factor', String(scale))
        layer.style.setProperty('--total-scale-factor', String(scale))
        layer.style.width = `${Math.floor(viewport.width)}px`
        layer.style.height = `${Math.floor(viewport.height)}px`
        const text = new TextLayer({
          textContentSource: page.streamTextContent(),
          container: layer,
          viewport,
        })
        await text.render().catch(() => undefined)
      }

      const content = await page.getTextContent()
      if (!cancelled) {
        onText(content.items.map((item) => ('str' in item ? item.str : '')).join(' '))
        setLoading(false)
      }
    }

    void render()
    return () => {
      cancelled = true
      task?.cancel()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdf, pageNumber])

  return (
    <div className="relative mx-auto" style={size ? { width: size.width } : undefined}>
      {loading && (
        <div className="absolute inset-0 z-10 grid place-items-center">
          <Spinner label="Rendering page" />
        </div>
      )}

      <div className="relative shadow-page">
        <canvas ref={canvas} className="block rounded-sm bg-white" />

        {/* Annotation overlays sit under the text layer so selection still works. */}
        <div className="pointer-events-none absolute inset-0 z-[1]">
          {overlays.map((overlay) =>
            overlay.rects.map((rect, index) => (
              <button
                key={`${overlay.id}-${index}`}
                type="button"
                aria-label="Open annotation"
                onClick={() => onOverlayClick(overlay.id)}
                style={{
                  left: `${rect[0] * 100}%`,
                  top: `${rect[1] * 100}%`,
                  width: `${rect[2] * 100}%`,
                  height: `${rect[3] * 100}%`,
                }}
                className={cn(
                  'pointer-events-auto absolute rounded-[2px] transition-colors',
                  overlay.kind === 'discussion'
                    ? 'border-b-2 border-dotted border-[rgb(78_124_122)] bg-[rgb(78_124_122/0.18)]'
                    : 'mix-blend-multiply',
                  overlay.kind === 'highlight' && HIGHLIGHT_BG[overlay.color ?? 'yellow'],
                  activeId === overlay.id && 'ring-2 ring-amber',
                )}
              />
            )),
          )}
        </div>

        <div ref={textLayer} className="textLayer" />
      </div>
    </div>
  )
}

const HIGHLIGHT_BG: Record<HighlightColor, string> = {
  yellow: 'bg-[rgb(240_205_100/0.55)]',
  green: 'bg-[rgb(150_200_130/0.55)]',
  blue: 'bg-[rgb(140_180_230/0.55)]',
  pink: 'bg-[rgb(232_160_195/0.55)]',
  red: 'bg-[rgb(233_140_128/0.55)]',
  purple: 'bg-[rgb(186_160_235/0.55)]',
  black: 'bg-[rgb(150_146_140/0.55)]',
}
