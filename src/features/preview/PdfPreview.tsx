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
//   del trackpad) y doble-tap-arrastrar vertical con un dedo (estilo Maps).
//
// Fit al ancho (REVIEW.md puntos 1 y 8, móvil y desktop):
// - `PdfPreview` no decide el modo: lo trae `zoom.fitMode` (vive en `App`
//   para sobrevivir al cambio de tab y persiste en `store/uiStorage.ts`).
//   El modo inicial es fit, salvo zoom manual guardado de otra sesión.
// - Cuando `fitEnabled` (todas las ramas de `App`: móvil y desktop), un
//   `ResizeObserver` sobre el contenedor mide el ancho útil y publica
//   `zoom.setFitScale()` (no persiste: depende del viewport). La escala
//   mostrada es `zoom.effectiveScale`.
// - Volver al ajuste al ancho es tocar el número del porcentaje (el doble-clic
//   ya no lo hace, ahora lleva al editor).
//
// Salto al editor (REVIEW.md punto 4):
// - El doble clic (o doble tap) sobre un texto del documento lleva al editor
//   con el cursor en ese texto. El zoom dejó de depender de este gesto: ahora
//   es por gestos o por el número del porcentaje.
// - Cada página publica sus ítems de texto (`getTextContent`) y aquí se
//   guardan en un ref: no hay re-render porque solo se consultan en el clic.
// - El puntero se convierte a coordenadas de la hoja con el rect de su
//   wrapper, se elige el ítem más cercano (`pickItemAt`) y su texto se
//   traduce a offset del fuente (`resolveJumpOffset`). Si algo no casa —un
//   margen, una nota que no se imprime, un texto que no está— no se hace nada.

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, Maximize2, Minimize2 } from 'lucide-react'
import type { PreviewZoom } from '@/hooks/usePreviewZoom'
import {
  RESTORE_ATTEMPTS,
  RESTORE_STABLE_FRAMES,
  RESTORE_TARGET_EPS,
  RESTORE_TIMEOUT_MS,
  type PreviewScrollStore,
} from '@/hooks/usePreviewScroll'
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
import { pickItemAt } from './textHit'
import { resolveJumpOffset } from './sourceMap'
import { PdfPage } from './PdfPage'
import type { PdfPreviewState } from './usePdfPreview'
import type { PdfDocument, PdfTextItem } from '@/lib/pdfjs'
import type { Document } from '@/vendor/fountain.mjs'

interface PdfPreviewProps {
  preview: PdfPreviewState
  paused: boolean
  onPausedChange: (paused: boolean) => void
  zoom: PreviewZoom
  /** Vista en grande (REVIEW.md punto 2): el panel abarca todo el ancho. */
  expanded?: boolean
  onToggleExpand?: () => void
  /** Fit al ancho (puntos 1 y 8): todas las ramas de `App` lo activan.
   * El modo inicial es fit (salvo preferencia manual guardada); tras un
   * zoom manual, el número del porcentaje vuelve a entrar en fit. */
  fitEnabled?: boolean
  /** Documento parseado y su texto, para resolver el offset del punto 4. */
  doc?: Document | null
  source?: string
  /** Doble clic en un texto: lleva al editor con el cursor ahí. */
  onJumpToSource?: (offset: number) => void
  /**
   * Salto a escena (REVIEW.md punto 13, página exacta de `paginate()`):
   * página absoluta + `key` que se incrementa en cada clic para re-disparar
   * aunque se repita la escena. Se hace scroll a la página; si el número no
   * es válido no se hace nada. `null` = sin petición.
   */
  sceneJump?: { page: number; key: number } | null
  /**
   * Clave del documento visible (id del guion) + almacén de scroll
   * (REVIEW.md 6): al desmontar se guarda la posición y al remontar (o al
   * cambiar de guion) se restituye. Sin ambos, el panel reabre arriba.
   */
  scrollKey?: string | null
  scrollStore?: PreviewScrollStore | null
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
/** Desplazamiento que distingue un tap de un arrastre (px). */
const TAP_SLOP = 10
/** Variación del factor de zoom por debajo de la cual no hubo gesto. */
const TAP_GESTURE_EPS = 0.02
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
  doc = null,
  source = '',
  onJumpToSource,
  scrollKey = null,
  scrollStore = null,
  sceneJump = null,
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
  // Espejo del hook para el listener nativo de rueda (suscripción única).
  const zoomRef = useRef(zoom)
  // Vista previa del gesto (re-render barato: solo cambia un transform).
  const [gesture, setGestureState] = useState<GestureState | null>(null)
  // Texto de cada página para el hit-test del punto 4, en un ref: solo se lee
  // en el clic, así que guardarlo no debe costar un render. Se guarda junto
  // al PDF al que pertenece porque los ítems describen una hoja concreta: al
  // cambiar el PDF, el texto del anterior ya no dice nada de lo que se ve.
  const textByPageRef = useRef<{
    pdf: PdfDocument | null
    pages: Map<number, PdfTextItem[]>
  }>({ pdf: null, pages: new Map() })

  const handleTextContent = useCallback(
    (pageNumber: number, items: PdfTextItem[]) => {
      const store = textByPageRef.current
      if (store.pdf !== pdf) {
        store.pdf = pdf
        store.pages.clear()
      }
      store.pages.set(pageNumber, items)
    },
    [pdf],
  )

  // Escala mostrada: durante el gesto, base × k (sin tocar el layout).
  const displayScale = gesture
    ? clampGestureDisplay(gesture.base * gesture.k)
    : scale
  const displayPercent = Math.round(displayScale * 100)

  // Refs sincronizadas para los handlers nativos (rueda) y de puntero, que
  // viven fuera del render. Solo se escriben en efectos, nunca en el render.
  useEffect(() => {
    scaleRef.current = scale
  }, [scale])

  useEffect(() => {
    zoomRef.current = zoom
  })

  // Puntos 1 y 8: mide el ancho útil del contenedor y publica la
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

  // Punto 6: la posición vive fuera del DOM (el panel se desmonta al
  // cerrar / expandir). Espejos para que el cleanup lea lo último aunque
  // las props cambien sin remontar.
  const scrollKeyRef = useRef(scrollKey)
  const scrollStoreRef = useRef(scrollStore)
  useEffect(() => {
    scrollKeyRef.current = scrollKey
    scrollStoreRef.current = scrollStore
  })
  // Guardar al desmontar: cubre cerrar el panel, la vista en grande y el
  // cambio de tab móvil (todos desmontan este componente).
  useEffect(
    () => () => {
      scrollStoreRef.current?.save(scrollKeyRef.current, scrollRef.current)
    },
    [],
  )
  // Punto 6 (bucle de eco): el restore parcial —contenido aún creciendo—
  // mueve `scrollTop` y ese scroll programático dispararía `onScroll`,
  // pisando la posición buena con el valor intermedio. Mientras hay un
  // restore en vuelo no se guarda; cualquier gesto del usuario lo cancela
  // (su scroll sí vale) y reanuda el guardado normal.
  const restoringRef = useRef(false)
  const cancelRestore = useCallback(() => {
    restoringRef.current = false
  }, [])
  /**
   * Tops de cada página en px desde el inicio del contenido. Vía rects
   * (robusto al chain de offsetParents y al padding del contenedor). Durante
   * los gestos de zoom el wrapper lleva transform y los rects son
   * visuales: no se mide en vuelo (ver `gesture`).
   */
  const measurePageTops = useCallback((): number[] => {
    const scroller = scrollRef.current
    const wrap = docWrapRef.current
    if (!scroller || !wrap) return []
    const crect = scroller.getBoundingClientRect()
    const base = scroller.scrollTop
    const tops: number[] = []
    wrap.querySelectorAll('[data-page]').forEach((node) => {
      const r = (node as HTMLElement).getBoundingClientRect()
      tops.push(r.top - crect.top + base)
    })
    return tops
  }, [])
  // Caché de tops: re-medir en cada tick de scroll forzaría layout; la suma
  // de alturas solo cambia si alguna página cambió, y eso mueve
  // `scrollHeight`, que sí es barato de leer.
  const topsCacheRef = useRef<{ height: number; tops: number[] }>({
    height: -1,
    tops: [],
  })
  const topsFor = useCallback(
    (el: HTMLElement): number[] => {
      const cached = topsCacheRef.current
      // En pleno gesto el wrapper lleva `transform: scale()` y los rects
      // son visuales, no de layout: no se mide (mejor ancla previa que
      // ancla distorsionada).
      if (gestureRef.current) return cached.tops
      if (el.scrollHeight !== cached.height) {
        cached.height = el.scrollHeight
        cached.tops = measurePageTops()
      }
      return cached.tops
    },
    [measurePageTops],
  )
  /** Guarda la posición actual (scroll en curso). Barato: un Map.set. */
  const saveScrollNow = useCallback(() => {
    if (restoringRef.current) return
    const el = scrollRef.current
    if (!el) return
    scrollStoreRef.current?.save(scrollKeyRef.current, el, topsFor(el))
  }, [topsFor])
  // Medida ansiosa durante el restore: todas las páginas reservan su
  // tamaño real (sin rasterizar) para que el ancla resuelva exacto aunque
  // el destino esté muchas páginas abajo, donde el lazy nunca habría
  // medido. Al asentar se apaga (el raster siguió siendo perezoso).
  const [sizingAll, setSizingAll] = useState(false)
  // Restituir al montar, al regenerarse el PDF y al cambiar de guion. Sin
  // dato previo lleva arriba (guion nuevo). El bucle converge re-resolviendo
  // el ancla contra los tops vigentes hasta que el layout asienta
  // (placeholder → altura real por página, en momentos distintos).
  useLayoutEffect(() => {
    if (!pdf || !scrollKey || !scrollStore) return
    const el = scrollRef.current
    if (!el) return
    restoringRef.current = true
    setSizingAll(true)
    // La caché de tops puede traer medidas del documento anterior tras una
    // regeneración: se invalida para que el restore mida de cero.
    topsCacheRef.current = { height: -1, tops: [] }
    scrollStore.restoreWithRetry(scrollKey, el, {
      getPageTops: () => topsFor(el),
      isCancelled: () => !restoringRef.current,
      onSettled: () => {
        restoringRef.current = false
        setSizingAll(false)
      },
    })
    return cancelRestore
  }, [pdf, numPages, scrollKey, scrollStore, cancelRestore, topsFor])

  // Punto 13: salto a escena → página del PDF. La página es la absoluta
  // que `paginate()` calculó en Go (incluye portada, = numeración de
  // pdf.js). Sin destino válido no se hace nada. Solo la `key` dispara: si
  // el PDF se regenera tras el clic (sigues escribiendo), la página vieja
  // ya no vale sobre la paginación nueva y no se re-scrollea.
  //
  // El scroll converge por rAF como el restore del punto 6, por el mismo
  // motivo: las páginas lejanas son placeholders (`minHeight: 200`) hasta
  // que miden su altura real de forma perezosa, así que un solo scroll
  // aterriza "a medio camino" y solo converge a clics. Aquí se activa la
  // medida ansiosa (`sizingAll`), se fija `scrollTop` contra los tops
  // vigentes y se re-resuelve hasta asentar. Instantáneo a propósito: una
  // animación suave lucha contra la re-medición.
  const sceneJumpKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (!sceneJump || !pdf) return
    if (sceneJumpKeyRef.current === sceneJump.key) return
    sceneJumpKeyRef.current = sceneJump.key
    const page = sceneJump.page
    if (!Number.isInteger(page) || page < 1 || page > numPages) return
    const el = scrollRef.current
    if (!el) return
    let cancelled = false
    restoringRef.current = true
    setSizingAll(true)
    // Como en el restore: la caché puede traer medidas del documento
    // anterior tras una regeneración.
    topsCacheRef.current = { height: -1, tops: [] }
    const finish = (settled: boolean) => {
      restoringRef.current = false
      setSizingAll(false)
      if (!settled) return
      // Flash sobre la página destino, ya asentada (el canvas rasterizado
      // no admite highlight DOM).
      const target = docWrapRef.current?.querySelector<HTMLElement>(
        `[data-page="${page}"]`,
      )
      if (!target) return
      const prevOutline = target.style.outline
      const prevOffset = target.style.outlineOffset
      target.style.outline = '2px solid var(--primary)'
      target.style.outlineOffset = '4px'
      window.setTimeout(() => {
        // Limpieza best-effort: si el nodo se desmontó, no pasa nada.
        try {
          target.style.outline = prevOutline
          target.style.outlineOffset = prevOffset
        } catch {
          // Intencionadamente silencioso.
        }
      }, 2000)
    }
    const start = Date.now()
    const attempt = (left: number, stable: number) => {
      if (cancelled || !el.isConnected) {
        finish(false)
        return
      }
      const tops = topsFor(el)
      const target = tops[page - 1]
      if (target === undefined || !Number.isFinite(target)) {
        // Layout aún sin medir: reintentar sin contar como estable.
        if (left <= 0 || Date.now() - start > RESTORE_TIMEOUT_MS) {
          finish(false)
          return
        }
        requestAnimationFrame(() => attempt(left - 1, 0))
        return
      }
      const max = el.scrollHeight - el.clientHeight
      el.scrollTop = Math.min(Math.max(target, 0), Math.max(max, 0))
      if (left <= 0 || typeof requestAnimationFrame === 'undefined') {
        finish(true)
        return
      }
      const height = el.scrollHeight
      const applied = el.scrollTop
      requestAnimationFrame(() => {
        if (cancelled || !el.isConnected) {
          finish(false)
          return
        }
        const settled =
          Math.abs(el.scrollTop - applied) <= RESTORE_TARGET_EPS &&
          el.scrollHeight === height
        const nextStable = settled ? stable + 1 : 0
        if (
          nextStable >= RESTORE_STABLE_FRAMES ||
          Date.now() - start > RESTORE_TIMEOUT_MS
        ) {
          finish(true)
          return
        }
        attempt(left - 1, nextStable)
      })
    }
    // Un frame de cortesía para el remontaje (cambio de tab móvil).
    requestAnimationFrame(() => attempt(RESTORE_ATTEMPTS, 0))
    return () => {
      cancelled = true
      // Un gesto del usuario cancela el salto en vuelo (el `cancelRestore`
      // de rueda/puntero/tecla solo baja el flag): aquí además se apaga la
      // medida ansiosa y se reanuda el guardado normal de scroll.
      restoringRef.current = false
      setSizingAll(false)
    }
  }, [sceneJump, pdf, numPages, topsFor])

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

  /**
   * Punto 4: lleva al editor con el cursor en el texto que hay bajo el puntero.
   *
   * El objetivo del evento da la página (su wrapper lleva `data-page`), el rect
   * de ese wrapper convierte el puntero a coordenadas de la hoja, y con el
   * viewport a la escala vigente se elige el ítem más cercano. Devuelve sin
   * hacer nada si no hay PDF, si no hay texto publicado para la página, si el
   * clic cayó en un margen o si el texto no se puede ubicar en el fuente: un
   * salto a un sitio arbitrario sería peor que no hacer nada.
   */
  const jumpFromPoint = useCallback(
    async (
      target: EventTarget | null,
      clientX: number,
      clientY: number,
    ): Promise<void> => {
      if (!pdf || !onJumpToSource || !(target instanceof Element)) return
      const pageEl = target.closest<HTMLElement>('[data-page]')
      if (!pageEl) return
      const pageNumber = Number(pageEl.dataset.page)
      const store = textByPageRef.current
      // Un PDF nuevo invalida el texto del anterior.
      if (store.pdf !== pdf) {
        store.pdf = pdf
        store.pages.clear()
      }
      // El texto se pide aquí si aún no está: la página puede no haber
      // publicado sus ítems (el raster entra por viewport y el doble clic
      // puede llegar antes), y esperar a que sea preciso haría que el primer
      // doble clic tras abrir el documento no hiciera nada.
      let items = store.pages.get(pageNumber)
      if (!items) {
        try {
          const page = await pdf.getPage(pageNumber)
          items = (await page.getTextContent()).items as PdfTextItem[]
          store.pages.set(pageNumber, items)
        } catch {
          return
        }
      }
      if (items.length === 0) return
      try {
        const page = await pdf.getPage(pageNumber)
        const viewport = page.getViewport({ scale })
        const rect = pageEl.getBoundingClientRect()
        const hit = pickItemAt(
          items,
          viewport,
          clientX - rect.left,
          clientY - rect.top,
        )
        if (!hit) return
        // Hint posicional para desambiguar repeticiones (la 2ª "está" del
        // documento debe ir a la 2ª del fuente, no a la 1ª): ítems de la
        // página en orden + ítems de las páginas previas en orden.
        const prevItems: string[] = []
        const prevPages = [...store.pages.entries()]
          .filter(([num]) => num < pageNumber)
          .sort(([a], [b]) => a - b)
        for (const [, pageItems] of prevPages) {
          for (const it of pageItems) prevItems.push(it.str ?? '')
        }
        const offset = resolveJumpOffset(
          doc,
          source,
          hit.item.str,
          hit.charIndex,
          {
            itemIndex: hit.itemIndex,
            pageItems: items.map((it) => it.str ?? ''),
            prevItems,
          },
        )
        if (offset === null) return
        onJumpToSource(offset)
      } catch {
        // Página no disponible (se está regenerando el PDF): sin salto.
      }
    },
    [pdf, doc, source, scale, onJumpToSource],
  )

  const endPointer = (
    id: number,
    el: HTMLElement | null,
    target: EventTarget | null,
  ) => {
    const tracked = pointersRef.current.get(id)
    pointersRef.current.delete(id)

    // Fin de arrastre con un dedo: confirma y registra el guard anti-dblclick.
    if (dragRef.current && pointersRef.current.size < 2) {
      dragRef.current = null
      if (el) el.style.touchAction = 'pan-x pan-y'
      // Punto 4: el segundo toque de un doble-tap entra aquí con el gesto ya
      // iniciado, aunque luego el dedo no se mueva. Si el factor se quedó en ~1
      // y el dedo apenas se desplazó, fue un doble-tap y no un zoom: salta al
      // editor en vez de confirmar una escala que no ha cambiado.
      const g = gestureRef.current
      const tapped =
        g !== null &&
        Math.abs(g.k - 1) < TAP_GESTURE_EPS &&
        tracked !== undefined &&
        Math.hypot(tracked.x - tracked.sx, tracked.y - tracked.sy) < TAP_SLOP
      if (tapped) {
        gestureRef.current = null
        setGestureState(null)
        tapRef.current = null
        void jumpFromPoint(target, tracked.x, tracked.y)
        return
      }
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
          {/* Puntos 1 y 8: el número es el indicador y, a la vez, el gesto
              de vuelta al ajuste al ancho —el doble-clic ya lleva al
              editor—. */}
          <Button
            size="xs"
            variant="ghost"
            aria-label={
              fitEnabled
                ? fitMode
                  ? `Zoom ${displayPercent} por ciento, ajustado al ancho`
                  : `Zoom ${displayPercent} por ciento. Tocar para ajustar al ancho`
                : `Zoom ${displayPercent} por ciento. Activar para restablecer al 100 por ciento`
            }
            title={
              fitEnabled
                ? `Zoom ${displayPercent} %. Tocar para ajustar al ancho`
                : 'Restablecer zoom al 100 %'
            }
            onClick={() => {
              if (fitEnabled) setFitMode(true)
              else zoom.reset()
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

      <div className="relative flex min-h-0 flex-1 flex-col">
        {/* Punto 2: barra flotante (superpuesta, sin desplazar el
            documento) mientras el worker/pdf.js procesa. Con PDF previo
            indica re-render; sin él, cubre también el arranque (idle). */}
        {status !== 'error' &&
        (status === 'rendering' || pdf === null) &&
        !paused ? (
          <div
            role="status"
            aria-live="polite"
            className="absolute inset-x-0 top-0 z-10 flex items-center gap-2 rounded-t-sm border-b border-border bg-muted/90 px-2 py-1 text-[0.6875rem] text-muted-foreground shadow-sm backdrop-blur-sm"
          >
            <Loader2 aria-hidden="true" className="size-3 animate-spin" />
            {pdf ? 'Actualizando documento…' : 'Procesando documento…'}
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
          // Punto 6: cada scroll actualiza la posición guardada para ese
          // guion, así reabrir restituye donde se dejó. Un gesto del usuario
          // cancela antes cualquier restore en vuelo (ver `restoringRef`).
          onScroll={saveScrollNow}
          onWheel={cancelRestore}
          onKeyDown={cancelRestore}
          onPointerDown={(e) => {
            // Punto 6: el agarre cancela cualquier restore en vuelo (el
            // scroll que sigue es del usuario y sí debe guardarse).
            cancelRestore()
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
                const init = startCapture(
                  (a.x + b.x) / 2,
                  (a.y + b.y) / 2,
                  base,
                )
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
            endPointer(e.pointerId, e.currentTarget, e.target)
          }
          onPointerCancel={(e) =>
            endPointer(e.pointerId, e.currentTarget, e.target)
          }
          onDoubleClick={(e) => {
            // Punto 4: el doble-clic lleva al editor. Ya no alterna el zoom.
            // El guard sigue haciendo falta porque el navegador sintetiza un
            // dblclick tras un arrastre, y ese gesto sí era de zoom.
            if (Date.now() - dragEndRef.current < DRAG_DBLCLICK_GUARD) return
            if (gestureRef.current) return
            void jumpFromPoint(e.target, e.clientX, e.clientY)
          }}
        >
          {pdf ? (
            <div
              ref={docWrapRef}
              role="document"
              aria-label={`Contrascripts en PDF, ${numPages} ${numPages === 1 ? 'página' : 'páginas'}`}
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
                  onTextContent={handleTextContent}
                  eagerSize={sizingAll}
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
