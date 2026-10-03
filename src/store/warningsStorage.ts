// src/store/warningsStorage.ts — único acceso a localStorage del estado de
// la solapa de avisos (AGENTS.md nº2: los componentes no tocan `localStorage`).
//
// Guarda solo `open` (REVIEW.md punto 4: avisos ocultos y desplegables).
// Un dato corrupto o ausente devuelve `null` para que el hook aplique el
// default (cerrado); nunca lanza.

export const WARNINGS_KEY = 'guion.warnings.v1'

function isWarningsPrefs(value: unknown): value is { open: boolean } {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return typeof v.open === 'boolean'
}

/** Lee la preferencia. `null` = sin dato (el hook aplica default cerrado). */
export function loadWarningsOpen(): boolean | null {
  try {
    const raw = globalThis.localStorage?.getItem(WARNINGS_KEY)
    if (raw == null || raw === '') return null
    const parsed: unknown = JSON.parse(raw)
    return isWarningsPrefs(parsed) ? parsed.open : null
  } catch {
    return null
  }
}

/** Persiste la preferencia. Nunca lanza (cosmético). */
export function saveWarningsOpen(open: boolean): void {
  try {
    globalThis.localStorage?.setItem(WARNINGS_KEY, JSON.stringify({ open }))
  } catch {
    // Intencionadamente silencioso.
  }
}
