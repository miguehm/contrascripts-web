// src/store/storage.ts — único acceso a localStorage de guiones (§6).
//
// Los componentes tienen prohibido tocar `localStorage` (AGENTS.md nº2);
// pasan por `ScriptsProvider` → este módulo. Dos guardarraíles del plan:
// - Dato corrupto / `JSON.parse` fallido → `[]` sin tumbar el boot.
// - `QuotaExceededError` en `setItem` → se reporta (`quotaExceeded: true`)
//   para que el provider avise por `sonner`.

import type { Script } from '@/types/Script'

/** Clave de la lista de guiones (fijada por el plan §6). */
export const SCRIPTS_KEY = 'guion.scripts.v1'

function isScript(value: unknown): value is Script {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.id === 'string' &&
    v.id !== '' &&
    typeof v.title === 'string' &&
    typeof v.text === 'string' &&
    typeof v.updatedAt === 'number' &&
    Number.isFinite(v.updatedAt)
  )
}

/**
 * Lee la lista persistida. Nunca lanza: ante ausencia de `localStorage`
 * (SSR/privado), JSON roto o forma inesperada, devuelve `[]`.
 */
export function loadScripts(): Script[] {
  try {
    const raw = globalThis.localStorage?.getItem(SCRIPTS_KEY)
    if (raw == null || raw === '') return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isScript)
  } catch {
    return []
  }
}

export interface SaveResult {
  /** `true` si `setItem` lanzó por falta de cuota. */
  quotaExceeded: boolean
}

/** Detecta falta de cuota en los sabores de error de cada navegador. */
export function isQuotaError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false
  const e = err as { name?: unknown; code?: unknown }
  return (
    e.name === 'QuotaExceededError' ||
    e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    e.code === 22
  )
}

/**
 * Persiste la lista completa. Nunca lanza: devuelve si hubo falta de
 * cuota para que el llamador avise al usuario.
 */
export function saveScripts(scripts: Script[]): SaveResult {
  try {
    globalThis.localStorage?.setItem(SCRIPTS_KEY, JSON.stringify(scripts))
    return { quotaExceeded: false }
  } catch (err) {
    return { quotaExceeded: isQuotaError(err) }
  }
}
