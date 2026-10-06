// src/store/backupStorage.ts — único acceso a localStorage de la fecha de la
// última copia (REVIEW.md punto 12).
//
// Solo `store/` toca `localStorage` (AGENTS.md nº2). Nunca lanza.

/** Clave de la fecha de la última copia exportada. */
export const LAST_BACKUP_KEY = 'guion.lastBackup.v1'

/** Lee la fecha de la última copia (`null` si nunca hubo). Nunca lanza. */
export function loadLastBackup(): number | null {
  try {
    const raw = globalThis.localStorage?.getItem(LAST_BACKUP_KEY)
    if (raw == null || raw === '') return null
    const parsed: unknown = JSON.parse(raw)
    return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : null
  } catch {
    return null
  }
}

/** Persiste la fecha de la última copia. Nunca lanza. */
export function saveLastBackup(at: number): void {
  try {
    globalThis.localStorage?.setItem(LAST_BACKUP_KEY, JSON.stringify(at))
  } catch {
    // Intencionadamente silencioso.
  }
}
