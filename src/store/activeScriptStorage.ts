// src/store/activeScriptStorage.ts — único acceso a localStorage del id del
// guion activo (REVIEW.md punto 3).
//
// Los componentes tienen prohibido tocar `localStorage` (AGENTS.md nº2);
// pasan por `ScriptsProvider` → este módulo. Un dato corrupto o ausente
// devuelve `null` y el provider cae al más reciente; nunca lanza.

import { dropLegacyKey, readMigratedKey } from '@/store/keyMigration'

export const ACTIVE_ID_KEY = 'contrascripts.active.v1'

/** Clave anterior (renombre de marca): se migra en lectura. */
export const LEGACY_ACTIVE_ID_KEY = 'guion.active.v1'

/** Lee el id persistido. Nunca lanza: ausencia, JSON roto o valor que no
 * es string → `null`. */
export function loadActiveId(): string | null {
  try {
    const raw = readMigratedKey(ACTIVE_ID_KEY, LEGACY_ACTIVE_ID_KEY)
    if (raw == null || raw === '') return null
    const parsed: unknown = JSON.parse(raw)
    return typeof parsed === 'string' && parsed !== '' ? parsed : null
  } catch {
    return null
  }
}

/** Persiste el id; `null` borra la clave. Nunca lanza (cosmético). */
export function saveActiveId(id: string | null): void {
  try {
    if (id === null) {
      globalThis.localStorage?.removeItem(ACTIVE_ID_KEY)
      dropLegacyKey(LEGACY_ACTIVE_ID_KEY)
    } else {
      globalThis.localStorage?.setItem(ACTIVE_ID_KEY, JSON.stringify(id))
      dropLegacyKey(LEGACY_ACTIVE_ID_KEY)
    }
  } catch {
    // Intencionadamente silencioso.
  }
}
