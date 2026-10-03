// src/features/preview/PdfPreview.tsx — vista previa como PDF (scroll continuo).
//
// Sustituye al antiguo render CSS (`Preview.tsx` + `ElementView`, eliminados):
// lo que se ve es exactamente lo que genera `fountain.renderPDF`, rasterizado
// con pdf.js página a página. El `bytes` mostrado y el descargado por
// ExportButton son el mismo (caché del hook), así que preview ≡ PDF final.
//
// Zoom (REVIEW.md punto 3):
// - El tamaño CSS de cada hoja lo manda `scale` sin tope del contenedor
//   (antes `maxWidth:100%` + `w-full` re-encogían la hoja a 150-200% y el
//   zoom parecía no funcionar). El contenedor hace scroll en ambos ejes.
// - Estado en `App` (`usePreviewZoom`): sobrevive al cambio de tab móvil y
//   persiste en `store/uiStorage.ts`. Modelo discreto para botones, continuo
//   durante el gesto con `snap` al soltar.
// - Gestos sobre el contenedor de páginas: pinch de 2 dedos (Pointer Events),
//   `Ctrl/Cmd+rueda` (pínch del trackpad en desktop), doble-clic para
//   alternar 100% ↔ anterior.

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import type { PreviewZoom } from '@/hooks/usePreviewZoom'
import { clampZoom } from '@/hooks/usePreviewZoom'
import { PdfPage } from './PdfPage'
import type { PdfPreviewState } from './usePdfPreview'

interface PdfPreviewProps {
  preview: PdfPreviewState
  paused: boolean
  onPausedChange: (paused: boolean) => void
  zoom: PreviewZoom
}

interface PinchState {
  startDist: number
  startScale: number
}

function pointerDistance(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function PdfPreview({
  preview,
  paused,
  onPausedChange,
  zoom,
}: PdfPreviewProps) {
  const { status, pdf, numPages, error, renderNow } = preview
  const { scale, percent, canZoomIn, canZoomOut } = zoom
  const updating = status === 'rendering' && pdf !== null

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const pointersRef = useRef(new Map<number, { x: number; y: number }>())
  const pinchRef = useRef<PinchState | null>(null)
  const scaleRef = useRef(scale)
  const wheelSnapTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevScaleRef = useRef<number | null>(null)
  const [pinching, setPinching] = useState(false)

  // Ref sincronizada para los handlers nativos (rueda) y de puntero, que
  // viven fuera del render. Solo se escribe en efectos, nunca en el render.
  useEffect(() => {
    scaleRef.current = scale
    if (scale !== 1) prevScaleRef.current = scale
  }, [scale])

  // `Ctrl/Cmd+rueda` sobre el contenedor (trackpad de desktop). Listener
  // no-pasivo para poder hacer `preventDefault` y que la página no haga
  // zoom global ni scroll mientras se ajusta la escala.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      const delta = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY
      const factor = Math.min(1.25, Math.max(0.8, Math.exp(-delta * 0.002)))
      const next = clampZoom(scaleRef.current * factor)
      const rect = el.getBoundingClientRect()
      const atX = e.clientX - rect.left
      const atY = e.clientY - rect.top
      const ratio = next / scaleRef.current
      if (ratio !== 1) {
        el.scrollLeft = (el.scrollLeft + atX) * ratio - atX
        el.scrollTop = (el.scrollTop + atY) * ratio - atY
        zoom.setScale(next)
      }
      // `snap` al escalón más cercano cuando cesa la ráfaga de rueda.
      if (wheelSnapTimer.current !== null) clearTimeout(wheelSnapTimer.current)
      wheelSnapTimer.current = setTimeout(() => {
        wheelSnapTimer.current = null
        zoom.snap()
      }, 200)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      el.removeEventListener('wheel', onWheel)
      if (wheelSnapTimer.current !== null) {
        clearTimeout(wheelSnapTimer.current)
        wheelSnapTimer.current = null
      }
    }
  }, [zoom])

  const endPointer = (id: number) => {
    pointersRef.current.delete(id)
    if (pointersRef.current.size < 2 && pinchRef.current) {
      pinchRef.current = null
      setPinching(false)
      zoom.snap()
    }
  }

  return (
    <section aria-label="Vista previa" className="flex h-full flex-col gap-2">
      <div className="flex items-center gap-2">
        <h2 className="text-[0.6875rem] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
          Vista previa
        </h2>
        <span className="ml-auto flex items-center gap-1">
          {updating ? (
            <span
              role="status"
              className="px-1 font-mono text-[10px] text-muted-foreground uppercase"
            >
              Actualizando…
            </span>
          ) : null}
          <Button
            size="xs"
            variant="ghost"
            aria-label="Reducir zoom"
            title="Reducir zoom"
            disabled={!canZoomOut}
            onClick={zoom.zoomOut}
          >
            −
          </Button>
          <Button
            size="xs"
            variant="ghost"
            aria-label={`Zoom ${percent} por ciento. Activar para restablecer al 100 por ciento`}
            title="Restablecer zoom al 100 % (o doble-clic en la página)"
            onClick={zoom.reset}
            className="min-w-10 font-mono text-[10px] text-muted-foreground tabular-nums"
            aria-live="polite"
          >
            {percent} %
          </Button>
          <Button
            size="xs"
            variant="ghost"
            aria-label="Ampliar zoom"
            title="Ampliar zoom (pellizca con dos dedos o Ctrl + rueda)"
            disabled={!canZoomIn}
            onClick={zoom.zoomIn}
          >
            +
          </Button>
          <Button
            size="xs"
            variant="ghost"
            aria-pressed={paused}
            aria-label={
              paused ? 'Reanudar vista previa' : 'Pausar vista previa'
            }
            title={
              paused
                ? 'Reanudar actualización automática'
                : 'Pausar actualización automática (útil en guiones largos)'
            }
            onClick={() => onPausedChange(!paused)}
          >
            {paused ? 'Reanudar' : 'Pausar'}
          </Button>
        </span>
      </div>

      {status === 'error' && pdf === null ? (
        <div
          role="alert"
          className="flex flex-col items-start gap-2 rounded-sm border border-destructive p-4"
        >
          <p className="text-[0.8125rem] text-destructive">
            No se pudo generar la vista previa.
          </p>
          {error ? (
            <p className="font-mono text-xs text-muted-foreground">{error}</p>
          ) : null}
          <Button size="sm" variant="outline" onClick={renderNow}>
            Reintentar
          </Button>
        </div>
      ) : null}

      <div
        ref={scrollRef}
        data-testid="preview-pages"
        className="min-h-0 flex-1 overflow-auto overscroll-contain rounded-sm border border-border bg-muted/30 p-4 sm:p-6"
        // Solo un dedo hace scroll nativo; dos dedos (pinch) lo gestionamos
        // nosotros con `touch-action:none` durante el gesto.
        style={{ touchAction: pinching ? 'none' : 'pan-x pan-y' }}
        onPointerDown={(e) => {
          if (e.pointerType === 'mouse' && e.button !== 0) return
          pointersRef.current.set(e.pointerId, {
            x: e.clientX,
            y: e.clientY,
          })
          if (pointersRef.current.size === 2) {
            const [a, b] = [...pointersRef.current.values()]
            const startDist = pointerDistance(a, b)
            if (startDist > 0) {
              pinchRef.current = {
                startDist,
                startScale: scaleRef.current,
              }
              setPinching(true)
            }
          }
        }}
        onPointerMove={(e) => {
          if (!pointersRef.current.has(e.pointerId)) return
          pointersRef.current.set(e.pointerId, {
            x: e.clientX,
            y: e.clientY,
          })
          const pinch = pinchRef.current
          const el = scrollRef.current
          if (!pinch || !el || pointersRef.current.size !== 2) return
          const [a, b] = [...pointersRef.current.values()]
          const dist = pointerDistance(a, b)
          if (dist <= 0 || pinch.startDist <= 0) return
          const next = clampZoom((pinch.startScale * dist) / pinch.startDist)
          // Ancla el punto medio entre los dedos para que el contenido
          // bajo ellos se quede quieto durante el gesto.
          const rect = el.getBoundingClientRect()
          const midX = (a.x + b.x) / 2 - rect.left
          const midY = (a.y + b.y) / 2 - rect.top
          const ratio = next / scaleRef.current
          if (ratio !== 1) {
            el.scrollLeft = (el.scrollLeft + midX) * ratio - midX
            el.scrollTop = (el.scrollTop + midY) * ratio - midY
            zoom.setScale(next)
          }
          // Sin `snap` hasta soltar (ver `onPointerUp`).
        }}
        onPointerUp={(e) => endPointer(e.pointerId)}
        onPointerCancel={(e) => endPointer(e.pointerId)}
        onDoubleClick={() => {
          if (scaleRef.current !== 1) {
            prevScaleRef.current = scaleRef.current
            zoom.reset()
          } else if (prevScaleRef.current && prevScaleRef.current !== 1) {
            zoom.setScale(prevScaleRef.current)
          }
        }}
      >
        {pdf ? (
          <div
            role="document"
            aria-label={`Guion en PDF, ${numPages} ${numPages === 1 ? 'página' : 'páginas'}`}
            className="mx-auto flex w-max min-w-full max-w-none flex-col items-center gap-6"
          >
            {Array.from({ length: numPages }, (_, i) => (
              <PdfPage
                key={i + 1}
                pdf={pdf}
                pageNumber={i + 1}
                numPages={numPages}
                scale={scale}
              />
            ))}
          </div>
        ) : (
          <p
            role="status"
            className="mx-auto w-full max-w-[8.5in] rounded-[2px] bg-[var(--paper)] p-8 font-mono text-base text-[var(--paper-ink)] opacity-60"
          >
            {status === 'rendering'
              ? 'Generando vista previa…'
              : paused
                ? 'Vista previa en pausa.'
                : 'Cargando motor…'}
          </p>
        )}
      </div>

      {paused && pdf ? (
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={renderNow}>
            Actualizar ahora
          </Button>
        </div>
      ) : null}
    </section>
  )
}
