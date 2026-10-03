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
//   persiste en `store/uiStorage.ts`. Botones por escalones; gestos libres y
//   continuos, sin `snap`.
// - Los gestos NO mutan `scale` por tick (eso provocaba una carrera entre el
//   scroll corregido a mano y el layout de React: deriva y rebotes). En su
//   lugar aplican un `transform: scale()` GPU al wrapper —síncrono, sin
//   layout— con origen en el punto de agarre; al asentar se confirma la escala
//   real (un solo render + una sola re-rasterización) con un único ajuste de
//   scroll post-layout.
// - Gestos: pinch de 2 dedos amplificado (×2.0), `Ctrl/Cmd+rueda` (pellizco
//   del trackpad), doble-tap-arrastrar vertical con un dedo (estilo Maps) y
//   doble-clic para alternar 100% ↔ anterior.

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { Button } from '@/components/ui/button'
import type { PreviewZoom } from '@/hooks/usePreviewZoom'
import {
  clampZoom,
  contentPointUnder,
  dragZoomFactor,
  pinchScale,
  scrollForAnchor,
  wheelFactor,
} from '@/hooks/usePreviewZoom'
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
}

/** Gesto de zoom en curso: vista previa por transform, pendiente de commit. */
interface GestureState {
  /** Escala real (layout) al empezar el gesto; el transform multiplica. */
  base: number
  /** Factor relativo acumulado (display = base * k, sujetado al rango). */
  k: number
  /** Origen del transform = ancla (punto bajo los dedos, coords de layout). */
  ox: number
  oy: number
  /** Punto de agarre en coords del viewport del contenedor (para el ancla). */
  midX: number
  midY: number
  /** Ancla en coords de layout base (coincide con el origen vigente). */
  ax: number
  ay: number
  /** Offset del wrapper respecto al origen del contenido (fijo en el gesto). */
  wx: number
  wy: number
  /** Rect del contenedor al empezar el gesto (el layout no cambia en él). */
  cl: number
  ct: number
}

/** Toque rápido candidato a primer tap de un doble-tap. */
interface TapState {
  t: number
  x: number
  y: number
}

interface DragState {
  startY: number
}

/** Ventana para el segundo tap (ms) y distancia máxima entre taps (px). */
const TAP_TIMEOUT = 300
const TAP_MAX_DIST = 24
/** Pausa tras un pinch durante la que no se registra tap (ms). */
const PINCH_TAP_SUPPRESS = 500
/** La ráfaga de rueda se confirma tras este silencio (ms). */
const WHEEL_COMMIT_DELAY = 300
/** Tras un arrastre, el dblclick sintético del navegador se ignora (ms). */
const DRAG_DBLCLICK_GUARD = 600
/** Bajo este delta el commit es no-op (no ensucia estado ni storage). */
const COMMIT_EPS = 0.001

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
  const { scale, canZoomIn, canZoomOut } = zoom
  const updating = status === 'rendering' && pdf !== null

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const docWrapRef = useRef<HTMLDivElement | null>(null)
  const pointersRef = useRef(
    new Map<number, { x: number; y: number; sx: number; sy: number }>(),
  )
  const pinchRef = useRef<PinchState | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const tapRef = useRef<TapState | null>(null)
  const pinchEndRef = useRef(0)
  const dragEndRef = useRef(0)
  const gestureRef = useRef<GestureState | null>(null)
  const pendingAnchorRef = useRef<{
    ax: number
    ay: number
    wx: number
    wy: number
    midX: number
    midY: number
    base: number
    newScale: number
  } | null>(null)
  const wheelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scaleRef = useRef(scale)
  const prevScaleRef = useRef<number | null>(null)
  // Espejo del hook para el listener nativo de rueda (suscripción única).
  const zoomRef = useRef(zoom)
  // Vista previa del gesto (re-render barato: solo cambia un transform).
  const [gesture, setGestureState] = useState<GestureState | null>(null)

  // Escala mostrada: durante el gesto, base × k (sin tocar el layout).
  const displayScale = gesture ? clampZoom(gesture.base * gesture.k) : scale
  const displayPercent = Math.round(displayScale * 100)

  // Refs sincronizadas para los handlers nativos (rueda) y de puntero, que
  // viven fuera del render. Solo se escriben en efectos, nunca en el render.
  useEffect(() => {
    scaleRef.current = scale
    if (scale !== 1) prevScaleRef.current = scale
  }, [scale])

  useEffect(() => {
    zoomRef.current = zoom
  })

  /** Captura el origen del gesto: rects + scroll + punto bajo los dedos.
   * Válido porque al empezar no hay transform activo (layout = base).
   * Estable (solo refs): el listener de rueda se suscribe una vez. */
  const startCapture = useCallback(
    (clientX: number, clientY: number, base: number): GestureState | null => {
      const wrap = docWrapRef.current
      const el = scrollRef.current
      if (!wrap || !el) return null
      const wr = wrap.getBoundingClientRect()
      const cr = el.getBoundingClientRect()
      const bl = el.clientLeft
      const bt = el.clientTop
      const wx = wr.left - cr.left - bl + el.scrollLeft
      const wy = wr.top - cr.top - bt + el.scrollTop
      const midX = clientX - cr.left - bl
      const midY = clientY - cr.top - bt
      // Con k=1 el ancla es el punto de contenido bajo los dedos.
      const ax = midX + el.scrollLeft - wx
      const ay = midY + el.scrollTop - wy
      return {
        base,
        k: 1,
        ox: ax,
        oy: ay,
        midX,
        midY,
        ax,
        ay,
        wx,
        wy,
        cl: cr.left,
        ct: cr.top,
      }
    },
    [],
  )

  /** Re-ancla el gesto al punto que está AHORA bajo los dedos con un nuevo
   * factor `k1`: mueve el origen al ancla vigente y ajusta el scroll en el
   * mismo tick para que ese punto quede clavado. Como el transform es
   * síncrono y el layout no cambia en el gesto, no hay carrera posible
   * (el bug anterior corregía contra geometría pre-layout). */
  const retarget = useCallback(
    (clientX: number, clientY: number, k1: number): boolean => {
      const g = gestureRef.current
      const el = scrollRef.current
      if (!g || !el) return false
      const bl = el.clientLeft
      const bt = el.clientTop
      const midX = clientX - g.cl - bl
      const midY = clientY - g.ct - bt
      const ax = contentPointUnder(midX, el.scrollLeft, g.wx, g.ox, g.k)
      const ay = contentPointUnder(midY, el.scrollTop, g.wy, g.oy, g.k)
      el.scrollLeft = g.wx + ax - midX
      el.scrollTop = g.wy + ay - midY
      const next: GestureState = {
        ...g,
        k: k1,
        ox: ax,
        oy: ay,
        midX,
        midY,
        ax,
        ay,
      }
      gestureRef.current = next
      setGestureState(next)
      return true
    },
    [],
  )

  /** Confirma el gesto: escala real + un único ajuste de scroll post-layout.
   * Con el re-anclaje por tick la deriva es ~cero y la corrección es no-op;
   * si se pasa el punto de suelta se refresca el `mid` antes de confirmar.
   * Devuelve la escala confirmada (o null si no había gesto). */
  const commitGesture = useCallback(
    (clientX?: number, clientY?: number): number | null => {
      if (wheelTimerRef.current !== null) {
        clearTimeout(wheelTimerRef.current)
        wheelTimerRef.current = null
      }
      let g = gestureRef.current
      if (!g) return null
      if (clientX !== undefined && clientY !== undefined) {
        retarget(clientX, clientY, g.k)
        g = gestureRef.current
        if (!g) return null
      }
      const newScale = clampZoom(g.base * g.k)
      gestureRef.current = null
      setGestureState(null)
      if (Math.abs(newScale - g.base) < COMMIT_EPS) return g.base
      pendingAnchorRef.current = {
        ax: g.ax,
        ay: g.ay,
        wx: g.wx,
        wy: g.wy,
        midX: g.midX,
        midY: g.midY,
        base: g.base,
        newScale,
      }
      zoomRef.current.setScale(newScale)
      return newScale
    },
    [retarget],
  )

  // Único ajuste de scroll por gesto, ya con el DOM nuevo y pre-paint: lleva
  // el ancla (clavada durante todo el gesto) a su posición del viewport.
  useLayoutEffect(() => {
    const a = pendingAnchorRef.current
    const el = scrollRef.current
    if (!a || !el) return
    pendingAnchorRef.current = null
    el.scrollLeft = scrollForAnchor(a.wx, a.ax, a.base, a.newScale, a.midX)
    el.scrollTop = scrollForAnchor(a.wy, a.ay, a.base, a.newScale, a.midY)
  }, [scale])

  // `Ctrl/Cmd+rueda` sobre el contenedor (trackpad de desktop). Listener
  // no-pasivo para poder hacer `preventDefault` y que la página no haga
  // zoom global ni scroll mientras se ajusta la escala. Suscripción única:
  // el hook se lee vía `zoomRef` porque su identidad cambia por render.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      // Sin mezclar con gestos táctiles en curso.
      if (pinchRef.current || dragRef.current) return
      let g = gestureRef.current
      if (!g) {
        const init = startCapture(e.clientX, e.clientY, scaleRef.current)
        if (!init) return
        gestureRef.current = init
        setGestureState(init)
        g = init
      }
      retarget(e.clientX, e.clientY, g.k * wheelFactor(e.deltaY, e.deltaMode))
      // Se confirma al asentar la ráfaga, nunca por tick.
      if (wheelTimerRef.current !== null) clearTimeout(wheelTimerRef.current)
      wheelTimerRef.current = setTimeout(() => {
        wheelTimerRef.current = null
        commitGesture()
      }, WHEEL_COMMIT_DELAY)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      el.removeEventListener('wheel', onWheel)
      if (wheelTimerRef.current !== null) {
        clearTimeout(wheelTimerRef.current)
        wheelTimerRef.current = null
      }
    }
  }, [startCapture, retarget, commitGesture])

  const endPointer = (
    id: number,
    el: HTMLElement | null,
    clientX?: number,
    clientY?: number,
  ) => {
    const tracked = pointersRef.current.get(id)
    pointersRef.current.delete(id)

    // Fin de arrastre con un dedo: confirma y registra el guard anti-dblclick.
    if (dragRef.current && pointersRef.current.size < 2) {
      dragRef.current = null
      if (el) el.style.touchAction = 'pan-x pan-y'
      commitGesture(clientX, clientY)
      dragEndRef.current = Date.now()
      tapRef.current = null
      return
    }

    if (pointersRef.current.size < 2 && pinchRef.current) {
      pinchRef.current = null
      // Restaura el scroll nativo de un dedo.
      if (el) el.style.touchAction = 'pan-x pan-y'
      commitGesture(clientX, clientY)
      pinchEndRef.current = Date.now()
      tapRef.current = null
      return
    }

    // Toque simple y quieto: candidato a primer tap (doble-tap-arrastrar).
    if (
      tracked &&
      pointersRef.current.size === 0 &&
      !gestureRef.current &&
      Date.now() > pinchEndRef.current + PINCH_TAP_SUPPRESS &&
      Math.hypot(tracked.x - tracked.sx, tracked.y - tracked.sy) < 10
    ) {
      tapRef.current = { t: Date.now(), x: tracked.x, y: tracked.y }
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
            aria-label={`Zoom ${displayPercent} por ciento. Activar para restablecer al 100 por ciento`}
            title="Restablecer zoom al 100 % (o doble-clic en la página)"
            onClick={zoom.reset}
            className="min-w-10 font-mono text-[10px] text-muted-foreground tabular-nums"
            aria-live="polite"
          >
            {displayPercent} %
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
        // Un dedo hace scroll nativo (`pan-x pan-y`, sin zoom nativo); los
        // gestos propios ponen `touch-action:none` síncrono al DOM en
        // `onPointerDown` (sin esperar al re-render, o el navegador inicia
        // su gesto nativo y nos aborta con `pointercancel`).
        style={{ touchAction: 'pan-x pan-y' }}
        onPointerDown={(e) => {
          if (e.pointerType === 'mouse' && e.button !== 0) return
          pointersRef.current.set(e.pointerId, {
            x: e.clientX,
            y: e.clientY,
            sx: e.clientX,
            sy: e.clientY,
          })
          if (pointersRef.current.size === 2) {
            // El pinch toma precedencia: confirma cualquier gesto en curso
            // (arrastre o ráfaga de rueda) y arranca desde la escala
            // resultante, cancelando su timer pendiente.
            let base = scaleRef.current
            if (gestureRef.current) {
              dragRef.current = null
              const committed = commitGesture()
              if (committed !== null) base = committed
            }
            const [a, b] = [...pointersRef.current.values()]
            const startDist = pointerDistance(a, b)
            if (startDist > 0) {
              pinchRef.current = { startDist }
              const init = startCapture((a.x + b.x) / 2, (a.y + b.y) / 2, base)
              if (init) {
                gestureRef.current = init
                setGestureState(init)
              }
              e.currentTarget.style.touchAction = 'none'
              tapRef.current = null
            }
            return
          }
          // Candidato a doble-tap-arrastrar: segundo toque rápido y cercano.
          const tap = tapRef.current
          if (
            pointersRef.current.size === 1 &&
            !pinchRef.current &&
            tap &&
            Date.now() - tap.t < TAP_TIMEOUT &&
            Date.now() > pinchEndRef.current + PINCH_TAP_SUPPRESS &&
            Math.hypot(e.clientX - tap.x, e.clientY - tap.y) < TAP_MAX_DIST
          ) {
            // Si había una ráfaga de rueda a medias, se confirma primero.
            let base = scaleRef.current
            if (gestureRef.current) {
              const committed = commitGesture()
              if (committed !== null) base = committed
            }
            const init = startCapture(e.clientX, e.clientY, base)
            if (init) {
              dragRef.current = { startY: e.clientY }
              tapRef.current = null
              gestureRef.current = init
              setGestureState(init)
              e.currentTarget.style.touchAction = 'none'
            }
          }
        }}
        onPointerMove={(e) => {
          const tracked = pointersRef.current.get(e.pointerId)
          if (!tracked) return
          tracked.x = e.clientX
          tracked.y = e.clientY
          // Pinch: razón de distancias con ganancia, re-anclado al punto
          // medio en cada tick (el origen sigue a los dedos: deriva cero).
          const pinch = pinchRef.current
          if (pinch && pointersRef.current.size === 2) {
            const g = gestureRef.current
            if (!g) return
            const [a, b] = [...pointersRef.current.values()]
            const dist = pointerDistance(a, b)
            retarget(
              (a.x + b.x) / 2,
              (a.y + b.y) / 2,
              pinchScale(g.base, pinch.startDist, dist) / g.base,
            )
            return
          }
          // Arrastre vertical con un dedo: subir amplía, bajar reduce.
          const drag = dragRef.current
          if (drag && pointersRef.current.size === 1) {
            retarget(
              e.clientX,
              e.clientY,
              dragZoomFactor(e.clientY - drag.startY),
            )
          }
        }}
        onPointerUp={(e) =>
          endPointer(e.pointerId, e.currentTarget, e.clientX, e.clientY)
        }
        onPointerCancel={(e) =>
          endPointer(e.pointerId, e.currentTarget, e.clientX, e.clientY)
        }
        onDoubleClick={() => {
          // El navegador puede sintetizar dblclick tras un arrastre: el zoom
          // ya quedó confirmado, no resetear.
          if (Date.now() - dragEndRef.current < DRAG_DBLCLICK_GUARD) return
          if (gestureRef.current) return
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
            ref={docWrapRef}
            role="document"
            aria-label={`Guion en PDF, ${numPages} ${numPages === 1 ? 'página' : 'páginas'}`}
            className="mx-auto flex w-max min-w-full max-w-none flex-col items-center gap-6"
            style={
              gesture
                ? {
                    transform: `scale(${clampZoom(gesture.base * gesture.k) / gesture.base})`,
                    transformOrigin: `${gesture.ox}px ${gesture.oy}px`,
                  }
                : undefined
            }
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
