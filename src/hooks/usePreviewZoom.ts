// src/hooks/usePreviewZoom.ts — escala del preview (REVIEW.md punto 3).
//
// Botones por escalones (`ZOOM_STEPS`); gestos (pinch / Ctrl+rueda) libres y
// continuos en `[ZOOM_MIN, ZOOM_MAX]`, sin `snap` al soltar: el gesto deja la
// escala donde la deja el usuario. La escala vive en `App` (vía este hook)
// para que el cambio de tab móvil no la reinicie, y persiste en
// `store/uiStorage.ts` (AGENTS.md nº2), pero solo al asentar el gesto
// (`commit`), nunca por tick: un write a `localStorage` por `pointermove`
// mete jank en el gesto.

import { useCallback, useRef, useState } from 'react'
import { DEFAULT_ZOOM, loadZoom, saveZoom } from '@/store/uiStorage'

export const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3]
export const ZOOM_MIN = ZOOM_STEPS[0]
export const ZOOM_MAX = ZOOM_STEPS[ZOOM_STEPS.length - 1]

/** Ganancia del pinch: cada gesto rinde ~×1.4 frente al 1:1 físico. */
export const PINCH_GAIN = 1.4

/** Ganancia de la rueda con Ctrl/Cmd (pellizco del trackpad). */
export const WHEEL_GAIN = 0.004

export function clampZoom(scale: number): number {
  if (!Number.isFinite(scale)) return DEFAULT_ZOOM
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, scale))
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

export interface PreviewZoom {
  scale: number
  percent: number
  canZoomIn: boolean
  canZoomOut: boolean
  zoomIn: () => void
  zoomOut: () => void
  /** Fija y persiste (botones, reset, doble-clic). */
  setScale: (scale: number) => void
  /** Fija sin persistir: ticks del gesto en curso (pinch / rueda). */
  setScaleLive: (scale: number) => void
  /** Persiste la escala vigente: llamar al asentar el gesto. */
  commit: () => void
  reset: () => void
}

export function usePreviewZoom(): PreviewZoom {
  const [scale, setScaleState] = useState<number>(() => clampZoom(loadZoom()))
  // Espejo síncrono para que `commit` persista lo último aunque el gesto
  // dispare muchos ticks entre renders.
  const scaleRef = useRef(scale)

  const setScaleLive = useCallback((next: number) => {
    const clamped = clampZoom(next)
    scaleRef.current = clamped
    setScaleState(clamped)
  }, [])

  const setScale = useCallback(
    (next: number) => {
      setScaleLive(next)
      saveZoom(clampZoom(next))
    },
    [setScaleLive],
  )

  const commit = useCallback(() => {
    saveZoom(scaleRef.current)
  }, [])

  const zoomIn = useCallback(() => {
    setScaleState((prev) => {
      const next = stepIn(prev, 1)
      scaleRef.current = next
      saveZoom(next)
      return next
    })
  }, [])

  const zoomOut = useCallback(() => {
    setScaleState((prev) => {
      const next = stepIn(prev, -1)
      scaleRef.current = next
      saveZoom(next)
      return next
    })
  }, [])

  const reset = useCallback(() => {
    scaleRef.current = DEFAULT_ZOOM
    setScaleState(DEFAULT_ZOOM)
    saveZoom(DEFAULT_ZOOM)
  }, [])

  return {
    scale,
    percent: Math.round(scale * 100),
    canZoomIn: scale < ZOOM_MAX - 1e-9,
    canZoomOut: scale > ZOOM_MIN + 1e-9,
    zoomIn,
    zoomOut,
    setScale,
    setScaleLive,
    commit,
    reset,
  }
}
