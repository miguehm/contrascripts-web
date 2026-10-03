// src/hooks/usePreviewZoom.ts — escala del preview (REVIEW.md punto 3).
//
// Modelo discreto con gestos continuos: los botones se mueven por escalones
// (`ZOOM_STEPS`), el pinch / Ctrl+rueda fijan valores continuos en
// `[ZOOM_MIN, ZOOM_MAX]` y al soltar se hace `snap` al escalón más cercano.
// La escala vive en `App` (vía este hook) para que el cambio de tab móvil
// no la reinicie, y persiste en `store/uiStorage.ts` (AGENTS.md nº2).

import { useCallback, useState } from 'react'
import { DEFAULT_ZOOM, loadZoom, saveZoom } from '@/store/uiStorage'

export const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3]
export const ZOOM_MIN = ZOOM_STEPS[0]
export const ZOOM_MAX = ZOOM_STEPS[ZOOM_STEPS.length - 1]

export function clampZoom(scale: number): number {
  if (!Number.isFinite(scale)) return DEFAULT_ZOOM
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, scale))
}

/** Escalón más cercano a una escala continua (tras pinch / rueda). */
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

export interface PreviewZoom {
  scale: number
  percent: number
  canZoomIn: boolean
  canZoomOut: boolean
  zoomIn: () => void
  zoomOut: () => void
  /** Fija una escala continua (pinch / rueda en curso); la persiste. */
  setScale: (scale: number) => void
  /** Ajusta la escala al escalón más cercano (al soltar el gesto). */
  snap: () => void
  reset: () => void
}

export function usePreviewZoom(): PreviewZoom {
  const [scale, setScaleState] = useState<number>(() => snapZoom(loadZoom()))

  const setScale = useCallback((next: number) => {
    const clamped = clampZoom(next)
    setScaleState(clamped)
    saveZoom(clamped)
  }, [])

  const snap = useCallback(() => {
    setScaleState((prev) => {
      const snapped = snapZoom(prev)
      if (snapped !== prev) saveZoom(snapped)
      return snapped
    })
  }, [])

  const zoomIn = useCallback(() => {
    setScaleState((prev) => {
      const next = stepIn(prev, 1)
      saveZoom(next)
      return next
    })
  }, [])

  const zoomOut = useCallback(() => {
    setScaleState((prev) => {
      const next = stepIn(prev, -1)
      saveZoom(next)
      return next
    })
  }, [])

  const reset = useCallback(() => {
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
    snap,
    reset,
  }
}
