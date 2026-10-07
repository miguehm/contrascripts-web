// src/store/trashStorage.ts — único acceso a localStorage de la papelera
// (REVIEW.md punto 12: borrado seguro).
//
// Los componentes tienen prohibido tocar `localStorage` (AGENTS.md nº2);
// pasan por `ScriptsProvider` → este módulo. Nunca lanza: dato corrupto
// o forma inesperada → `[]`. El guardado es best-effort silencioso (el
// aviso de cuota ya lo da la lista principal).

import type { Script } from '@/types/Script'
import { dropLegacyKey, readMigratedKey } from '@/store/keyMigration'

/** Clave de la papelera. */
export const TRASH_KEY = 'contrascripts.trash.v1'

/** Clave anterior (renombre de marca): se migra en lectura. */
export const LEGACY_TRASH_KEY = 'guion.trash.v1'

/** Retención de la papelera: 30 días. */
export const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000

/** Un guion borrado con fecha para purga. */
export interface TrashedScript {
  script: Script
  deletedAt: number
}

function isTrashed(value: unknown): value is TrashedScript {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  const s = v.script as Record<string, unknown> | undefined
  return (
    typeof s === 'object' &&
    s !== null &&
    typeof s.id === 'string' &&
    s.id !== '' &&
    typeof s.title === 'string' &&
    typeof s.text === 'string' &&
    typeof v.deletedAt === 'number' &&
    Number.isFinite(v.deletedAt)
  )
}

/** Lee la papelera. Nunca lanza: ausencia, JSON roto o forma inesperada → `[]`. */
export function loadTrash(): TrashedScript[] {
  try {
    const raw = readMigratedKey(TRASH_KEY, LEGACY_TRASH_KEY)
    if (raw == null || raw === '') return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isTrashed)
  } catch {
    return []
  }
}

/** Persiste la papelera. Nunca lanza (best-effort silencioso). */
export function saveTrash(trash: TrashedScript[]): void {
  try {
    globalThis.localStorage?.setItem(TRASH_KEY, JSON.stringify(trash))
    dropLegacyKey(LEGACY_TRASH_KEY)
  } catch {
    // Intencionadamente silencioso.
  }
}
