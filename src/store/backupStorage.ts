// src/store/backupStorage.ts — único acceso a localStorage de la fecha de la
// última copia (REVIEW.md punto 12).
//
// Solo `store/` toca `localStorage` (AGENTS.md nº2). Nunca lanza.
import { dropLegacyKey, readMigratedKey } from '@/store/keyMigration'

/** Clave de la fecha de la última copia exportada. */
export const LAST_BACKUP_KEY = 'contrascripts.lastBackup.v1'

/** Clave anterior (renombre de marca): se migra en lectura. */
export const LEGACY_LAST_BACKUP_KEY = 'guion.lastBackup.v1'

/** Lee la fecha de la última copia (`null` si nunca hubo). Nunca lanza. */
export function loadLastBackup(): number | null {
  try {
    const raw = readMigratedKey(LAST_BACKUP_KEY, LEGACY_LAST_BACKUP_KEY)
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
    dropLegacyKey(LEGACY_LAST_BACKUP_KEY)
  } catch {
    // Intencionadamente silencioso.
  }
}
