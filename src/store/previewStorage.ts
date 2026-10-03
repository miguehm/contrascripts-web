// src/store/previewStorage.ts — único acceso a localStorage del estado del
// preview (AGENTS.md nº2: los componentes no tocan `localStorage`).
//
// Guarda solo `open` (preview desplegable, REVIEW.md punto 4). Un dato
// corrupto o ausente devuelve `null` para que el hook decida el default por
// layout (abierto en desktop, cerrado en móvil); nunca lanza.

export const PREVIEW_KEY = 'guion.preview.v1'

function isPreviewPrefs(value: unknown): value is { open: boolean } {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return typeof v.open === 'boolean'
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

/** Persiste la preferencia. Nunca lanza (cosmético). */
export function savePreviewOpen(open: boolean): void {
  try {
    globalThis.localStorage?.setItem(PREVIEW_KEY, JSON.stringify({ open }))
  } catch {
    // Intencionadamente silencioso.
  }
}
