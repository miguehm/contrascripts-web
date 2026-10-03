// src/hooks/usePreviewZoom.ts — escala del preview (REVIEW.md puntos 1 y 3).
//
// Botones por escalones (`ZOOM_STEPS`); gestos (pinch / Ctrl+rueda) libres y
// continuos en `[ZOOM_MIN, ZOOM_MAX]`, sin `snap` al soltar: el gesto deja la
// escala donde la deja el usuario. La escala vive en `App` (vía este hook)
// para que el cambio de tab móvil no la reinicie. No persiste en
// localStorage: el zoom vive solo en sesión (AGENTS.md nº2).
//
// Punto 1 (solo móvil): modo `fit` que ajusta la hoja al ancho del
// contenedor. `fitScale` lo mide `PdfPreview` con `ResizeObserver` (no se
// persiste: depende del viewport); `fitMode` tampoco persiste: el ajuste
// se aplica una vez al abrir el documento y el zoom queda en sesión.
// La escala mostrada es `effectiveScale = fitMode && fitScale ? fitScale
// : scale`. Cualquier zoom manual sale de fit.

import { useCallback, useRef, useState } from 'react'
import { DEFAULT_ZOOM } from '@/store/uiStorage'

export const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3]
export const ZOOM_MIN = ZOOM_STEPS[0]
export const ZOOM_MAX = ZOOM_STEPS[ZOOM_STEPS.length - 1]

/** Ancho de página US Letter en puntos (8.5in × 72). */
export const PAGE_WIDTH_PT = 612
/** Rango propio del fit: un móvil de 320px da ~0.47, por debajo del
 * `ZOOM_MIN` manual (0.5). No debe clamparse a 0.5 con scroll residual. */
export const FIT_MIN = 0.3
export const FIT_MAX = 1.5

/** Ganancia del pinch: cada gesto rinde el cuadrado frente al 1:1 físico
 * (abrir dedos de 100→150px da ×2.25 en un solo gesto). */
export const PINCH_GAIN = 2.0

/** Ganancia de la rueda con Ctrl/Cmd (pellizco del trackpad). */
export const WHEEL_GAIN = 0.004

/** Ganancia del arrastre vertical tras doble-tap (un dedo): subir 150px
 * multiplica por ~×2.1. */
export const DRAG_GAIN = 0.005

export function clampZoom(scale: number): number {
  if (!Number.isFinite(scale)) return DEFAULT_ZOOM
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, scale))
}

/** Escala que hace caber la hoja (`pageW`) en el contenedor (`containerW`
 * menos `padding`). Función pura para testear sin DOM. Ante medidas
 * inválidas devuelve `DEFAULT_ZOOM`. Sujeta a `[FIT_MIN, FIT_MAX]`,
 * distinto del rango manual: el fit puede bajar de `ZOOM_MIN`. */
export function computeFitScale(
  containerW: number,
  pageW: number = PAGE_WIDTH_PT,
  padding: number = 32,
): number {
  if (
    !Number.isFinite(containerW) ||
    !Number.isFinite(pageW) ||
    !Number.isFinite(padding) ||
    pageW <= 0 ||
    containerW <= 0
  ) {
    return DEFAULT_ZOOM
  }
  const raw = (containerW - padding) / pageW
  if (!Number.isFinite(raw)) return DEFAULT_ZOOM
  return Math.min(FIT_MAX, Math.max(FIT_MIN, raw))
}

function clampFit(scale: number): number {
  if (!Number.isFinite(scale)) return DEFAULT_ZOOM
  return Math.min(FIT_MAX, Math.max(FIT_MIN, scale))
}

/** Escalón más cercano (solo botones: parten del escalón vecino). */
export function snapZoom(scale: number): number {
  const clamped = clampZoom(scale)
  let best = ZOOM_STEPS[0]
  for (const step of ZOOM_STEPS) {
    if (Math.abs(step - clamped) < Math.abs(best - clamped)) best = step
  }
  return best
}

function stepIn(scale: number, dir: 1 | -1): number {
  const current = snapZoom(scale)
  const idx = ZOOM_STEPS.indexOf(current)
  const next = Math.min(ZOOM_STEPS.length - 1, Math.max(0, idx + dir))
  return ZOOM_STEPS[next]
}

/** Escala resultante de un pinch: razón de distancias elevada a la
 * ganancia, anclada a la escala inicial del gesto. Función pura para
 * poder testearla sin DOM. */
export function pinchScale(
  startScale: number,
  startDist: number,
  dist: number,
): number {
  if (
    !Number.isFinite(startScale) ||
    !Number.isFinite(startDist) ||
    !Number.isFinite(dist) ||
    startDist <= 0 ||
    dist <= 0
  ) {
    return clampZoom(startScale)
  }
  return clampZoom(startScale * Math.pow(dist / startDist, PINCH_GAIN))
}

/** Factor multiplicativo de un tick de rueda (`deltaMode`: 0 píxeles,
 * 1 líneas). Función pura para poder testearla sin DOM. */
export function wheelFactor(deltaY: number, deltaMode: number): number {
  if (!Number.isFinite(deltaY)) return 1
  const delta = deltaMode === 1 ? deltaY * 33 : deltaY
  return Math.min(1.4, Math.max(0.7, Math.exp(-delta * WHEEL_GAIN)))
}

/** Factor multiplicativo del arrastre vertical tras doble-tap: `dy` son los
 * píxeles arrastrados (negativo al subir = ampliar). Función pura. */
export function dragZoomFactor(dy: number): number {
  if (!Number.isFinite(dy)) return 1
  return Math.exp(-dy * DRAG_GAIN)
}

/** Punto local del wrapper (coords de layout sin transformar) que se muestra
 * ahora mismo en la posición `viewX` del viewport (coords relativas a la
 * caja de padding del contenedor). `scroll`/`wrapOffset` en px de contenido,
 * `origin`/`k` el transform vigente. Función pura para testear el anclaje. */
export function contentPointUnder(
  viewX: number,
  scroll: number,
  wrapOffset: number,
  origin: number,
  k: number,
): number {
  if (
    !Number.isFinite(viewX) ||
    !Number.isFinite(scroll) ||
    !Number.isFinite(wrapOffset) ||
    !Number.isFinite(origin) ||
    !Number.isFinite(k) ||
    k <= 0
  ) {
    return origin
  }
  return origin + (viewX + scroll - wrapOffset - origin) / k
}

export interface PreviewZoom {
  scale: number
  percent: number
  canZoomIn: boolean
  canZoomOut: boolean
  zoomIn: () => void
  zoomOut: () => void
  /** Fija y persiste (botones, reset, doble-clic). Sale de fit. */
  setScale: (scale: number) => void
  /** Fija sin persistir: ticks del gesto en curso (pinch / rueda). */
  setScaleLive: (scale: number) => void
  /** Persiste la escala vigente: llamar al asentar el gesto. */
  commit: () => void
  reset: () => void
  /** Restablece zoom y fit al cambiar de documento (nuevo/existente). */
  resetForScript: () => void
  /** Modo ajuste al ancho (punto 1, solo móvil). */
  fitMode: boolean
  /** Escala medida por `PdfPreview` (null = aún sin medir). No persiste. */
  fitScale: number | null
  /** Escala mostrada: fit medido o manual. */
  effectiveScale: number
  effectivePercent: number
  /** Activa/desactiva fit (persiste `fitWidth`). */
  setFitMode: (fit: boolean) => void
  /** Registra la medida del contenedor (no persiste). */
  setFitScale: (scale: number | null) => void
}

export function usePreviewZoom(options?: {
  fitDefault?: boolean
}): PreviewZoom {
  const [scale, setScaleState] = useState<number>(() => DEFAULT_ZOOM)
  // Espejo síncrono para que `commit` persista lo último aunque el gesto
  // dispare muchos ticks entre renders.
  const scaleRef = useRef(scale)
  // `fitWidth` guardado manda; sin dato, decide el layout (`fitDefault`:
  // true en móvil, false en desktop/tests).
  const [fitMode, setFitModeState] = useState<boolean>(
    () => options?.fitDefault ?? false,
  )
  const fitModeRef = useRef(fitMode)
  const [fitScale, setFitScaleState] = useState<number | null>(null)

  const setFitMode = useCallback((fit: boolean) => {
    fitModeRef.current = fit
    setFitModeState(fit)
  }, [])

  const setFitScale = useCallback((next: number | null) => {
    setFitScaleState(next === null ? null : clampFit(next))
  }, [])

  /** Salida de fit por zoom manual: estado inmediato + persistencia. */
  const exitFit = useCallback(() => {
    if (fitModeRef.current) {
      fitModeRef.current = false
      setFitModeState(false)
    }
  }, [])

  const setScaleLive = useCallback((next: number) => {
    const clamped = clampZoom(next)
    scaleRef.current = clamped
    setScaleState(clamped)
    // Sin persistir (el `commit` lo hace al asentar).
    if (fitModeRef.current) {
      fitModeRef.current = false
      setFitModeState(false)
    }
  }, [])

  const setScale = useCallback(
    (next: number) => {
      exitFit()
      setScaleLive(next)
    },
    [exitFit, setScaleLive],
  )

  const commit = useCallback(() => {
    // Sin persistencia: el estado ya quedó fijado por los ticks del gesto.
  }, [])

  const zoomIn = useCallback(() => {
    // Desde fit: escalón vecino a la escala mostrada (p.ej. fit 0.54 → 0.75).
    const base =
      fitModeRef.current && fitScale !== null ? fitScale : scaleRef.current
    const next = stepIn(base, 1)
    exitFit()
    scaleRef.current = next
    setScaleState(next)
  }, [exitFit, fitScale])

  const zoomOut = useCallback(() => {
    const base =
      fitModeRef.current && fitScale !== null ? fitScale : scaleRef.current
    const next = stepIn(base, -1)
    exitFit()
    scaleRef.current = next
    setScaleState(next)
  }, [exitFit, fitScale])

  const reset = useCallback(() => {
    exitFit()
    scaleRef.current = DEFAULT_ZOOM
    setScaleState(DEFAULT_ZOOM)
  }, [exitFit])

  // Documento nuevo/existente: el fit inicial vuelve a aplicarse (móvil);
  // el cambio de tab del preview con el mismo documento NO pasa por aquí.
  const resetForScript = useCallback(() => {
    const fit = options?.fitDefault ?? false
    fitModeRef.current = fit
    setFitModeState(fit)
    setFitScaleState(null)
    scaleRef.current = DEFAULT_ZOOM
    setScaleState(DEFAULT_ZOOM)
  }, [options?.fitDefault])

  const effectiveScale = fitMode && fitScale !== null ? fitScale : scale

  return {
    scale,
    percent: Math.round(scale * 100),
    canZoomIn: effectiveScale < ZOOM_MAX - 1e-9,
    canZoomOut: effectiveScale > ZOOM_MIN + 1e-9,
    zoomIn,
    zoomOut,
    setScale,
    setScaleLive,
    commit,
    reset,
    resetForScript,
    fitMode,
    fitScale,
    effectiveScale,
    effectivePercent: Math.round(effectiveScale * 100),
    setFitMode,
    setFitScale,
  }
}
