// src/store/uiStorage.ts — único acceso a localStorage de prefs UI.
//
// Los componentes tienen prohibido tocar `localStorage` (AGENTS.md nº2);
// pasan por `useSidebarCollapsed` / `usePreviewZoom` / `useSidebarTab` →
// este módulo. Guarda el colapso del sidebar en desktop más la escala del
// zoom del preview (REVIEW.md punto 3), el modo de ajuste al ancho en
// móvil (punto 1) y la pestaña activa del sidebar (punto 13).
// El drawer móvil es efímero y nunca se persiste.
// Un dato corrupto o ausente cae a los defaults sin tumbar el boot.

export const UI_KEY = 'guion.ui.v1'

/** Escala por defecto del preview (100%). */
export const DEFAULT_ZOOM = 1

/** Pestañas del sidebar (REVIEW.md punto 13). */
export type SidebarTab = 'scripts' | 'scenes'

export interface UiPrefs {
  collapsed: boolean
  /** Escala del zoom del preview. Opcional en lectura para compatibilidad
   * con prefs guardadas antes de REVIEW.md punto 3 (solo `collapsed`). */
  zoom?: number
  /** Ajuste al ancho en móvil (REVIEW.md punto 1). Opcional en lectura:
   * ausente = sin preferencia (el hook decide por layout); solo `true` o
   * `false` explícitos cuentan como preferencia guardada. */
  fitWidth?: boolean
  /** Pestaña activa del sidebar (REVIEW.md punto 13). Opcional en lectura:
   * ausente o inválida = `scripts` (compat con prefs viejas). */
  sidebarTab?: SidebarTab
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

function isValidFitWidth(value: unknown): value is boolean {
  return typeof value === 'boolean'
}

function isValidSidebarTab(value: unknown): value is SidebarTab {
  return value === 'scripts' || value === 'scenes'
}

/** Lee las prefs UI. Nunca lanza: ante ausencia, JSON roto o forma
 * inesperada, devuelve el valor por defecto. Un `zoom` inválido cae a
 * `DEFAULT_ZOOM` sin descartar `collapsed`; un `fitWidth` ausente o
 * inválido se omite (compat con prefs viejas: el hook decide por layout). */
export function loadUi(): UiPrefs {
  try {
    const raw = globalThis.localStorage?.getItem(UI_KEY)
    if (raw == null || raw === '') return { ...DEFAULTS }
    const parsed: unknown = JSON.parse(raw)
    if (!isUiPrefs(parsed)) return { ...DEFAULTS }
    const out: UiPrefs = {
      collapsed: parsed.collapsed,
      zoom: isValidZoom(parsed.zoom) ? parsed.zoom : DEFAULT_ZOOM,
    }
    if (isValidFitWidth(parsed.fitWidth)) out.fitWidth = parsed.fitWidth
    if (isValidSidebarTab(parsed.sidebarTab)) out.sidebarTab = parsed.sidebarTab
    return out
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

/** Lee la preferencia de ajuste al ancho. `null` = sin dato guardado
 * (prefs viejas, JSON roto o valor inválido: el hook decide por layout).
 * Nunca lanza. */
export function loadFitWidth(): boolean | null {
  try {
    const raw = globalThis.localStorage?.getItem(UI_KEY)
    if (raw == null || raw === '') return null
    const parsed: unknown = JSON.parse(raw)
    if (!isUiPrefs(parsed)) return null
    return isValidFitWidth(parsed.fitWidth) ? parsed.fitWidth : null
  } catch {
    return null
  }
}

/** Persiste solo `fitWidth` con read-modify-write, sin pisar `collapsed`
 * ni `zoom`. Nunca lanza (cosmético). */
export function saveFitWidth(fitWidth: boolean): void {
  try {
    const current = loadUi()
    saveUi({ ...current, fitWidth })
  } catch {
    // Intencionadamente silencioso: es preferencia cosmética.
  }
}

/** Lee la pestaña activa del sidebar. Inválida o ausente → `scripts`.
 * Nunca lanza. */
export function loadSidebarTab(): SidebarTab {
  try {
    const raw = globalThis.localStorage?.getItem(UI_KEY)
    if (raw == null || raw === '') return 'scripts'
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return 'scripts'
    const tab = (parsed as Record<string, unknown>).sidebarTab
    return isValidSidebarTab(tab) ? tab : 'scripts'
  } catch {
    return 'scripts'
  }
}

/** Persiste solo `sidebarTab` con read-modify-write. Nunca lanza. */
export function saveSidebarTab(tab: SidebarTab): void {
  try {
    const current = loadUi()
    saveUi({ ...current, sidebarTab: tab })
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
