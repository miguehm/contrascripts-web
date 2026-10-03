// src/store/uiStorage.ts — único acceso a localStorage de prefs UI.
//
// Los componentes tienen prohibido tocar `localStorage` (AGENTS.md nº2);
// pasan por `useSidebarCollapsed` / `usePreviewZoom` → este módulo. Guarda
// el colapso del sidebar en desktop más la escala del zoom del preview
// (REVIEW.md punto 3). El drawer móvil es efímero y nunca se persiste.
// Un dato corrupto o ausente cae a los defaults sin tumbar el boot.

export const UI_KEY = 'guion.ui.v1'

/** Escala por defecto del preview (100%). */
export const DEFAULT_ZOOM = 1

export interface UiPrefs {
  collapsed: boolean
  /** Escala del zoom del preview. Opcional en lectura para compatibilidad
   * con prefs guardadas antes de REVIEW.md punto 3 (solo `collapsed`). */
  zoom?: number
}

const DEFAULTS: UiPrefs = { collapsed: false, zoom: DEFAULT_ZOOM }

function isValidZoom(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function isUiPrefs(value: unknown): value is UiPrefs {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  // Solo `collapsed` es estructural; `zoom` se valida aparte en `loadUi`
  // para no descartar `collapsed` ante un zoom corrupto o de prefs viejas.
  return typeof v.collapsed === 'boolean'
}

/** Lee las prefs UI. Nunca lanza: ante ausencia, JSON roto o forma
 * inesperada, devuelve el valor por defecto. Un `zoom` inválido cae a
 * `DEFAULT_ZOOM` sin descartar `collapsed`. */
export function loadUi(): UiPrefs {
  try {
    const raw = globalThis.localStorage?.getItem(UI_KEY)
    if (raw == null || raw === '') return { ...DEFAULTS }
    const parsed: unknown = JSON.parse(raw)
    if (!isUiPrefs(parsed)) return { ...DEFAULTS }
    return {
      collapsed: parsed.collapsed,
      zoom: isValidZoom(parsed.zoom) ? parsed.zoom : DEFAULT_ZOOM,
    }
  } catch {
    return { ...DEFAULTS }
  }
}

/** Lee solo la escala de zoom persistida (atajo para `usePreviewZoom`). */
export function loadZoom(): number {
  return loadUi().zoom ?? DEFAULT_ZOOM
}

/** Persiste solo la escala de zoom con read-modify-write, para no pisar
 * `collapsed` si el sidebar cambió en otra pestaña/hook. Nunca lanza. */
export function saveZoom(zoom: number): void {
  try {
    const current = loadUi()
    saveUi({ ...current, zoom })
  } catch {
    // Intencionadamente silencioso: es preferencia cosmética.
  }
}

/** Persiste las prefs UI. Nunca lanza (un fallo de cuota en ~20 bytes es
 * irrelevante, pero no debe tumbar la UI). */
export function saveUi(prefs: UiPrefs): void {
  try {
    globalThis.localStorage?.setItem(UI_KEY, JSON.stringify(prefs))
  } catch {
    // Intencionadamente silencioso: es preferencia cosmética.
  }
}
