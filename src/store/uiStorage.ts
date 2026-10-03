// src/store/uiStorage.ts — único acceso a localStorage de prefs UI.
//
// Los componentes tienen prohibido tocar `localStorage` (AGENTS.md nº2);
// pasan por `useSidebarCollapsed` → este módulo. Guarda solo el colapso
// del sidebar en desktop. El drawer móvil es efímero y nunca se persiste.
// Un dato corrupto o ausente cae a `{ collapsed: false }` sin tumbar el boot.

export const UI_KEY = 'guion.ui.v1'

export interface UiPrefs {
  collapsed: boolean
}

const DEFAULTS: UiPrefs = { collapsed: false }

function isUiPrefs(value: unknown): value is UiPrefs {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return typeof v.collapsed === 'boolean'
}

/** Lee las prefs UI. Nunca lanza: ante ausencia, JSON roto o forma
 * inesperada, devuelve el valor por defecto. */
export function loadUi(): UiPrefs {
  try {
    const raw = globalThis.localStorage?.getItem(UI_KEY)
    if (raw == null || raw === '') return { ...DEFAULTS }
    const parsed: unknown = JSON.parse(raw)
    return isUiPrefs(parsed) ? parsed : { ...DEFAULTS }
  } catch {
    return { ...DEFAULTS }
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
