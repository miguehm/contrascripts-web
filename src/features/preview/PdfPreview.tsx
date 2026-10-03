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
//
// Fit al ancho (REVIEW.md punto 1, solo móvil):
// - `PdfPreview` no decide el modo: lo trae `zoom.fitMode` (vive en `App`
//   para sobrevivir al cambio de tab y persiste en `store/uiStorage.ts`).
// - Cuando `fitEnabled`, un `ResizeObserver` sobre el contenedor mide el
//   ancho útil y publica `zoom.setFitScale()` (no persiste: depende del
//   viewport). La escala mostrada es `zoom.effectiveScale`.
// - Cualquier zoom manual (`setScale`, botones, gestos, doble-clic) sale
//   de fit; el botón "Ajustar al ancho" vuelve a entrar.

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { Button } from '@/components/ui/button'
import { Maximize2, Minimize2 } from 'lucide-react'
import type { PreviewZoom } from '@/hooks/usePreviewZoom'
import {
  FIT_MIN,
  PAGE_WIDTH_PT,
  ZOOM_MAX,
  computeFitScale,
  contentPointUnder,
  dragZoomFactor,
  pinchScale,
  wheelFactor,
} from '@/hooks/usePreviewZoom'
import { PdfPage } from './PdfPage'
import type { PdfPreviewState } from './usePdfPreview'

interface PdfPreviewProps {
  preview: PdfPreviewState
  paused: boolean
  onPausedChange: (paused: boolean) => void
  zoom: PreviewZoom
  /** Vista en grande (REVIEW.md punto 2): el panel abarca todo el ancho. */
  expanded?: boolean
  onToggleExpand?: () => void
  /** Fit al ancho (punto 1): solo la rama móvil de `App` lo activa.
   * En desktop se omite (falso) y el zoom manual queda intacto. */
  fitEnabled?: boolean
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

/** Sujeción para la vista previa del gesto: admite el rango de fit
 * (`FIT_MIN`, bajo el `ZOOM_MIN` manual) para no pegar un salto al
 * gesticular desde el ajuste al ancho. El commit sí cae al rango manual
 * vía `setScale`. */
function clampGestureDisplay(value: number): number {
  if (!Number.isFinite(value)) return 1
  return Math.min(ZOOM_MAX, Math.max(FIT_MIN, value))
}

export function PdfPreview({
  preview,
  paused,
  onPausedChange,
  zoom,
  expanded = false,
  onToggleExpand,
  fitEnabled = false,
}: PdfPreviewProps) {
  const { status, pdf, numPages, error, renderNow } = preview
  const {
    effectiveScale: scale,
    canZoomIn,
    canZoomOut,
    fitMode,
    setFitMode,
    setFitScale,
  } = zoom
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
  // Sonda del commit: rect visual + scroll justo antes de confirmar, para
  // compensar post-layout lo que el layout nuevo desplace (centrado,
  // redondeos), mida lo que mida la causa.
  const pendingProbeRef = useRef<{
    left: number
    top: number
    scrollLeft: number
    scrollTop: number
  } | null>(null)
  const wheelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scaleRef = useRef(scale)
  const prevScaleRef = useRef<number | null>(null)
  // Espejo del hook para el listener nativo de rueda (suscripción única).
  const zoomRef = useRef(zoom)
  // Vista previa del gesto (re-render barato: solo cambia un transform).
  const [gesture, setGestureState] = useState<GestureState | null>(null)

  // Escala mostrada: durante el gesto, base × k (sin tocar el layout).
  const displayScale = gesture
    ? clampGestureDisplay(gesture.base * gesture.k)
    : scale
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

  // Punto 1 (solo móvil): mide el ancho útil del contenedor y publica la
  // escala de fit. `useLayoutEffect` a propósito: la primera medida debe
  // estar lista pre-paint, o el usuario ve un frame a 100% antes de que
  // la hoja salte al ancho. Ante navegadores sin `ResizeObserver` (tests
  // jsdom) se omite sin romper: `effectiveScale` cae al zoom manual.
  // No persiste (depende del viewport).
  useLayoutEffect(() => {
    if (!fitEnabled) return
    const el = scrollRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const measure = () => {
      let padTotal = 32
      try {
        const cs = getComputedStyle(el)
        const pl = Number.parseFloat(cs.paddingLeft)
        const pr = Number.parseFloat(cs.paddingRight)
        if (Number.isFinite(pl) && Number.isFinite(pr)) padTotal = pl + pr
      } catch {
        // getComputedStyle inaccesible: estimación p-4.
      }
      const w = el.clientWidth
      if (w > 0) setFitScale(computeFitScale(w, PAGE_WIDTH_PT, padTotal))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => {
      ro.disconnect()
    }
  }, [fitEnabled, setFitScale])

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

  /** Confirma el gesto: escala real + compensación post-layout por medición.
   * El `mid` vigente es el del último tick: el dedo que se levanta no debe
   * mover el ancla (la suelta no es punto de agarre). La sonda
   * (`pendingProbeRef`) guarda el rect visual con transform y el scroll
   * vigentes: el layout effect compara contra el rect ya sin transform y
   * restituye la diferencia. Así da igual que el origen del contenido se
   * mueva entre layouts (régimen centrado ~100-140%, donde la hoja es más
   * estrecha que el contenedor) o haya redondeos fraccionales: lo medido se
   * corrige exacto. Devuelve la escala confirmada (o null si no hay gesto). */
  const commitGesture = useCallback((): number | null => {
    if (wheelTimerRef.current !== null) {
      clearTimeout(wheelTimerRef.current)
      wheelTimerRef.current = null
    }
    const g = gestureRef.current
    if (!g) return null
    const newScale = clampGestureDisplay(g.base * g.k)
    gestureRef.current = null
    setGestureState(null)
    if (Math.abs(newScale - g.base) < COMMIT_EPS) return g.base
    const wrap = docWrapRef.current
    const el = scrollRef.current
    if (wrap && el) {
      const r = wrap.getBoundingClientRect()
      pendingProbeRef.current = {
        left: r.left,
        top: r.top,
        scrollLeft: el.scrollLeft,
        scrollTop: el.scrollTop,
      }
    }
    zoomRef.current.setScale(newScale)
    return newScale
  }, [])

  // Compensación del commit por medición, pre-paint y una sola vez: si el
  // layout nuevo desplazó el contenido respecto a lo que se veía con el
  // transform, se devuelve el scroll lo mismo que se desplazó. Cuando la
  // conmutación es perfecta el delta es 0 (no-op).
  useLayoutEffect(() => {
    const p = pendingProbeRef.current
    const wrap = docWrapRef.current
    const el = scrollRef.current
    if (!p || !wrap || !el) return
    pendingProbeRef.current = null
    const r = wrap.getBoundingClientRect()
    el.scrollLeft = p.scrollLeft + (r.left - p.left)
    el.scrollTop = p.scrollTop + (r.top - p.top)
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

  const endPointer = (id: number, el: HTMLElement | null) => {
    const tracked = pointersRef.current.get(id)
    pointersRef.current.delete(id)

    // Fin de arrastre con un dedo: confirma y registra el guard anti-dblclick.
    if (dragRef.current && pointersRef.current.size < 2) {
      dragRef.current = null
      if (el) el.style.touchAction = 'pan-x pan-y'
      commitGesture()
      dragEndRef.current = Date.now()
      tapRef.current = null
      return
    }

    if (pointersRef.current.size < 2 && pinchRef.current) {
      pinchRef.current = null
      // Restaura el scroll nativo de un dedo.
      if (el) el.style.touchAction = 'pan-x pan-y'
      commitGesture()
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
          {/* Punto 1 (móvil): el número de porcentaje es solo indicador;
              el fit se aplica al abrir el documento. En desktop sigue
              reseteando al 100 %. */}
          <Button
            size="xs"
            variant="ghost"
            aria-label={
              fitEnabled
                ? fitMode
                  ? `Zoom ${displayPercent} por ciento, ajustado al ancho`
                  : `Zoom ${displayPercent} por ciento`
                : `Zoom ${displayPercent} por ciento. Activar para restablecer al 100 por ciento`
            }
            title={
              fitEnabled
                ? `Zoom ${displayPercent} %`
                : 'Restablecer zoom al 100 % (o doble-clic en la página)'
            }
            onClick={() => {
              if (!fitEnabled) zoom.reset()
            }}
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
          {onToggleExpand ? (
            <Button
              size="icon-xs"
              variant="ghost"
              aria-expanded={expanded}
              aria-controls="preview-pane"
              aria-label={
                expanded
                  ? 'Salir de vista ampliada'
                  : 'Ver vista previa en grande'
              }
              title={
                expanded
                  ? 'Volver a vista dividida (Ctrl+Mayús+F)'
                  : 'Ver en grande (Ctrl+Mayús+F)'
              }
              onClick={onToggleExpand}
              className="hidden md:inline-flex"
            >
              {expanded ? (
                <Minimize2 aria-hidden="true" />
              ) : (
                <Maximize2 aria-hidden="true" />
              )}
            </Button>
          ) : null}
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
        className="scroll-slim min-h-0 flex-1 overflow-auto overscroll-contain rounded-sm border border-border bg-muted/30 p-4 sm:p-6"
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
        onPointerUp={(e) => endPointer(e.pointerId, e.currentTarget)}
        onPointerCancel={(e) => endPointer(e.pointerId, e.currentTarget)}
        onDoubleClick={() => {
          // El navegador puede sintetizar dblclick tras un arrastre: el zoom
          // ya quedó confirmado, no resetear.
          if (Date.now() - dragEndRef.current < DRAG_DBLCLICK_GUARD) return
          if (gestureRef.current) return
          // Móvil (punto 1): no hay reset a 100%; doble-clic reajusta al ancho.
          if (fitEnabled) {
            setFitMode(true)
            return
          }
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
                    transform: `scale(${clampGestureDisplay(gesture.base * gesture.k) / gesture.base})`,
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
