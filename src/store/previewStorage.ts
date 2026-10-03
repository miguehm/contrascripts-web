// src/store/previewStorage.ts — único acceso a localStorage del estado del
// preview (AGENTS.md nº2: los componentes no tocan `localStorage`).
//
// Guarda `open` (preview desplegable, REVIEW.md punto 4) + `expanded`
// (vista en grande, REVIEW.md punto 2, opcional por compat con prefs
// viejas que solo traen `open`). Un dato corrupto o ausente devuelve
// `null` en `loadPreviewOpen` para que el hook decida el default por
// layout (abierto en desktop, cerrado en móvil); nunca lanza.

export const PREVIEW_KEY = 'guion.preview.v1'

export interface PreviewPrefs {
  open: boolean
  /** Vista en grande (REVIEW.md punto 2). Opcional en lectura para
   * compatibilidad con prefs guardadas antes (solo `open`). */
  expanded?: boolean
}

function isPreviewPrefs(value: unknown): value is PreviewPrefs {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  if (typeof v.open !== 'boolean') return false
  // `expanded` ausente = prefs viejas (vale); presente debe ser boolean.
  return v.expanded === undefined || typeof v.expanded === 'boolean'
}

/** Lee la preferencia. `null` = sin dato (el hook aplica default por layout). */
export function loadPreviewOpen(): boolean | null {
  try {
    const raw = globalThis.localStorage?.getItem(PREVIEW_KEY)
    if (raw == null || raw === '') return null
    const parsed: unknown = JSON.parse(raw)
    return isPreviewPrefs(parsed) ? parsed.open : null
  } catch {
    return null
  }
}

/** Lee si el preview está en grande. `false` ante ausencia, JSON roto,
 * forma inesperada o prefs viejas sin `expanded`. Nunca lanza. */
export function loadPreviewExpanded(): boolean {
  try {
    const raw = globalThis.localStorage?.getItem(PREVIEW_KEY)
    if (raw == null || raw === '') return false
    const parsed: unknown = JSON.parse(raw)
    if (!isPreviewPrefs(parsed)) return false
    return parsed.expanded === true
  } catch {
    return false
  }
}

/** Persiste la preferencia con read-modify-write, para no pisar `expanded`
 * si cambió en otra pestaña/hook (y viceversa). Nunca lanza (cosmético). */
export function savePreviewOpen(open: boolean, expanded?: boolean): void {
  try {
    let current: PreviewPrefs = { open }
    const raw = globalThis.localStorage?.getItem(PREVIEW_KEY)
    if (raw != null && raw !== '') {
      const parsed: unknown = JSON.parse(raw)
      if (isPreviewPrefs(parsed)) current = { ...parsed }
    }
    current.open = open
    if (typeof expanded === 'boolean') current.expanded = expanded
    globalThis.localStorage?.setItem(PREVIEW_KEY, JSON.stringify(current))
  } catch {
    // Intencionadamente silencioso.
  }
}

/** Persiste solo `expanded` sin pisar `open`. Nunca lanza (cosmético). */
export function savePreviewExpanded(expanded: boolean): void {
  try {
    let open: boolean | null = null
    const raw = globalThis.localStorage?.getItem(PREVIEW_KEY)
    if (raw != null && raw !== '') {
      const parsed: unknown = JSON.parse(raw)
      if (isPreviewPrefs(parsed)) open = parsed.open
    }
    if (open === null) {
      globalThis.localStorage?.setItem(
        PREVIEW_KEY,
        JSON.stringify({ open: true, expanded }),
      )
    } else {
      savePreviewOpen(open, expanded)
    }
  } catch {
    // Intencionadamente silencioso.
  }
}
