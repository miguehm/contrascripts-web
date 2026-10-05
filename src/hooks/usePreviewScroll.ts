// src/hooks/usePreviewScroll.ts — conserva el scroll del preview (REVIEW.md 6).
//
// Al cerrar/abrir el panel (`previewOpen`) o al entrar/salir de la vista en
// grande (`previewExpanded`), `App` desmonta el `PdfPreview` y el contenedor
// de scroll nace de nuevo en 0. Este hook guarda la posición por guion
// (memoria de sesión, no `localStorage`: es estado efímero, no preferencia)
// y la restituye al remontar.
//
// La posición es un ancla (página + offset dentro de ella), no solo px: las
// páginas reservan su tamaño async (`PdfPage` tras `getPage`: primero un
// placeholder y luego la altura real), así que restaurar un px absoluto
// contra alturas parciales cae en otro sitio. El ancla se resuelve contra
// los tops vigentes en cada frame y el bucle converge cuando el layout
// asienta. El px/ratio quedan como respaldo (sin tops medidos o contenido
// que encogió).

import { useCallback, useMemo, useRef } from 'react'

/** Ancla de scroll: página (índice 0-based sobre los tops medidos) + offset
 * en px desde el borde superior de esa página. */
export interface PageAnchor {
  page: number
  dy: number
}

export interface PreviewScrollPos {
  top: number
  left: number
  /** Fracción 0..1 del desplazamiento máximo (para contenido que encoge). */
  ratio: number
  /** Ancla a la página visible (exacta con mismo layout; opcional). */
  anchor?: PageAnchor
}

export interface RestoreOptions {
  /**
   * Tops de página vigentes (px desde el inicio del contenido). Sin ellos
   * se restaura por px/ratio (comportamiento previo).
   */
  getPageTops?: () => number[]
  /** Tope de frames del bucle de convergencia. */
  attempts?: number
  /** Pared de tiempo del bucle (ms). */
  timeoutMs?: number
  /** Frames estables seguidos para dar por asentado el layout. */
  stableFrames?: number
  /** Aborta los reintentos pendientes (gesto del usuario). */
  isCancelled?: () => boolean
  /** Avisa cuando el bucle termina, por el motivo que sea. */
  onSettled?: () => void
}

export interface PreviewScrollStore {
  /**
   * Guarda la posición actual del contenedor bajo `key` (guion). Con
   * `pageTops` calcula además el ancla; sin ellos conserva el ancla previa
   * si la hay.
   */
  save: (
    key: string | null | undefined,
    el: HTMLElement | null,
    pageTops?: number[],
  ) => void
  /**
   * Restituye la posición guardada. Sin dato previo lleva arriba del todo
   * (caso guion nuevo / cambio de guion). Devuelve `true` si había algo que
   * restituir (top > 0) y `false` en caso contrario.
   */
  restore: (key: string | null | undefined, el: HTMLElement | null) => boolean
  /**
   * Como `restore`, pero converge por `rAF`: re-resuelve el ancla contra
   * los tops vigentes hasta que el layout asienta (scroll en destino y
   * altura estable). Sin `rAF` disponible (tests) hace un solo intento.
   */
  restoreWithRetry: (
    key: string | null | undefined,
    el: HTMLElement | null,
    options?: RestoreOptions,
  ) => void
  /** Olvida la posición de un guion. */
  clear: (key: string | null | undefined) => void
}

/** Por debajo de esto se considera "arriba del todo" (ruido de redondeo). */
export const SCROLL_TOP_EPS = 2

/** Tolerancia para dar el scroll por llegado (subpíxeles). */
export const RESTORE_TARGET_EPS = 0.5

export const RESTORE_ATTEMPTS = 120
export const RESTORE_TIMEOUT_MS = 2500
export const RESTORE_STABLE_FRAMES = 3

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback
}

/**
 * Posición a restituir dados la guardada y las métricas actuales.
 * Pura para testear: si el `top` guardado cabe, va intacto; si el contenido
 * encogió, se usa el ratio sobre el máximo actual (sujetado a [0, max]).
 */
export function computeRestoreTop(
  savedTop: number,
  savedRatio: number,
  scrollHeight: number,
  clientHeight: number,
): number {
  const max = scrollHeight - clientHeight
  if (!(max > 0)) return 0
  const top = finiteOr(savedTop, 0)
  if (top <= 0) return 0
  if (top <= max) return top
  const ratio = finiteOr(savedRatio, 1)
  const clampedRatio = Math.min(Math.max(ratio, 0), 1)
  return clampedRatio * max
}

/**
 * Ancla del scroll actual: primera página cuyo fondo queda por debajo del
 * borde superior del viewport + offset dentro de ella. Pura para testear.
 * Sin tops (o vacíos) devuelve el ancla nula `{ page: 0, dy: top }`.
 */
export function findPageAnchor(
  scrollTop: number,
  pageTops: number[],
): PageAnchor {
  const top = Number.isFinite(scrollTop) ? Math.max(scrollTop, 0) : 0
  for (let i = 0; i < pageTops.length; i++) {
    const next = pageTops[i + 1]
    if (!(next > top + 1)) continue
    const pageTop = Number.isFinite(pageTops[i]) ? Math.max(pageTops[i], 0) : 0
    return { page: i, dy: Math.max(top - pageTop, 0) }
  }
  if (pageTops.length > 0) {
    const last = pageTops.length - 1
    const pageTop = Number.isFinite(pageTops[last])
      ? Math.max(pageTops[last], 0)
      : 0
    return { page: last, dy: Math.max(top - pageTop, 0) }
  }
  return { page: 0, dy: top }
}

/**
 * Resuelve el ancla contra los tops vigentes → px desde el inicio.
 * Pura para testear. Si la página ya no existe (menos páginas que antes),
 * cae al px/ratio previo.
 */
export function resolveAnchorTarget(
  anchor: PageAnchor | undefined,
  pageTops: number[],
  fallbackTop: number,
  fallbackRatio: number,
  scrollHeight: number,
  clientHeight: number,
): number {
  const max = scrollHeight - clientHeight
  if (!(max > 0)) return 0
  if (anchor && pageTops.length > anchor.page && anchor.page >= 0) {
    const pageTop = pageTops[anchor.page]
    if (Number.isFinite(pageTop)) {
      const dy = Number.isFinite(anchor.dy) ? Math.max(anchor.dy, 0) : 0
      return Math.min(Math.max(pageTop + dy, 0), max)
    }
  }
  return computeRestoreTop(
    fallbackTop,
    fallbackRatio,
    scrollHeight,
    clientHeight,
  )
}

function readPos(
  el: HTMLElement,
  pageTops?: number[],
  prev?: PreviewScrollPos,
): PreviewScrollPos {
  const top = finiteOr(el.scrollTop, 0)
  const left = finiteOr(el.scrollLeft, 0)
  const max = el.scrollHeight - el.clientHeight
  const ratio = max > 0 ? Math.min(Math.max(top / max, 0), 1) : 0
  const pos: PreviewScrollPos = {
    top: Math.max(top, 0),
    left: Math.max(left, 0),
    ratio,
  }
  if (pageTops && pageTops.length > 0) {
    pos.anchor = findPageAnchor(pos.top, pageTops)
  } else if (prev?.anchor && pos.top > SCROLL_TOP_EPS) {
    // Sin tops frescos (p. ej. cleanup ya desmontado): no se pierde el
    // ancla previa mientras siga habiendo scroll que restituir.
    pos.anchor = prev.anchor
  } else if (pos.top <= SCROLL_TOP_EPS) {
    pos.anchor = { page: 0, dy: 0 }
  }
  return pos
}

function applyPos(
  el: HTMLElement,
  pos: PreviewScrollPos,
  pageTops?: number[],
): number {
  const targetTop = resolveAnchorTarget(
    pos.anchor,
    pageTops ?? [],
    pos.top,
    pos.ratio,
    el.scrollHeight,
    el.clientHeight,
  )
  el.scrollTop = targetTop
  el.scrollLeft = Number.isFinite(pos.left) ? Math.max(pos.left, 0) : 0
  return targetTop
}

function isAlive(el: HTMLElement): boolean {
  try {
    if (typeof document === 'undefined') return true
    return document.contains(el)
  } catch {
    // Fakes de test (no-Nodos): se tratan como vivos.
    return true
  }
}

export function usePreviewScroll(): PreviewScrollStore {
  const positionsRef = useRef(new Map<string, PreviewScrollPos>())

  const save = useCallback<PreviewScrollStore['save']>((key, el, pageTops) => {
    if (!key || !el) return
    try {
      // Cleanup de desmontaje: el contenedor ya está fuera del documento y
      // `scrollTop` leería 0. Si ya hay dato (guardado por `onScroll`), no
      // se pisa con ceros; sin dato, guardar ceros equivale a no guardar.
      if (el.isConnected === false && positionsRef.current.has(key)) return
    } catch {
      // Sin `isConnected` (fakes de test): se guarda igual.
    }
    positionsRef.current.set(
      key,
      readPos(el, pageTops, positionsRef.current.get(key)),
    )
  }, [])

  const restore = useCallback<PreviewScrollStore['restore']>((key, el) => {
    if (!key || !el) return false
    const pos = positionsRef.current.get(key)
    if (!pos) {
      el.scrollTop = 0
      el.scrollLeft = 0
      return false
    }
    applyPos(el, pos)
    return pos.top > SCROLL_TOP_EPS
  }, [])

  const restoreWithRetry = useCallback<PreviewScrollStore['restoreWithRetry']>(
    (key, el, options) => {
      const attempts = options?.attempts ?? RESTORE_ATTEMPTS
      const timeoutMs = options?.timeoutMs ?? RESTORE_TIMEOUT_MS
      const stableFrames = options?.stableFrames ?? RESTORE_STABLE_FRAMES
      const getPageTops = options?.getPageTops
      const isCancelled = options?.isCancelled
      const onSettled = options?.onSettled
      if (!key || !el) {
        onSettled?.()
        return
      }
      const start = Date.now()
      // Converge cuando el layout asienta: el scroll queda en destino y la
      // altura no cambia varios frames seguidos. Así da igual que las
      // páginas pasen de placeholder a altura real en momentos distintos:
      // el ancla se re-resuelve contra los tops vigentes en cada frame.
      const attempt = (left: number, stable: number) => {
        if (isCancelled?.()) {
          onSettled?.()
          return
        }
        const pos = positionsRef.current.get(key)
        if (!pos || !isAlive(el)) {
          if (!pos) {
            el.scrollTop = 0
            el.scrollLeft = 0
          }
          onSettled?.()
          return
        }
        const tops = getPageTops?.() ?? []
        const target = applyPos(el, pos, tops)
        if (left <= 0 || typeof requestAnimationFrame === 'undefined') {
          onSettled?.()
          return
        }
        const height = el.scrollHeight
        requestAnimationFrame(() => {
          if (isCancelled?.() || !isAlive(el)) {
            onSettled?.()
            return
          }
          const settled =
            Math.abs(el.scrollTop - target) <= RESTORE_TARGET_EPS &&
            el.scrollHeight === height
          const nextStable = settled ? stable + 1 : 0
          if (nextStable >= stableFrames || Date.now() - start > timeoutMs) {
            onSettled?.()
            return
          }
          attempt(left - 1, nextStable)
        })
      }
      attempt(attempts, 0)
    },
    [],
  )

  const clear = useCallback<PreviewScrollStore['clear']>((key) => {
    if (!key) return
    positionsRef.current.delete(key)
  }, [])

  // Identidad estable: los consumidores lo usan en deps de efectos y un
  // objeto nuevo por render refiraría la restauración sin necesidad.
  return useMemo(
    () => ({ save, restore, restoreWithRetry, clear }),
    [save, restore, restoreWithRetry, clear],
  )
}
