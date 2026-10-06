// src/store/storage.ts — único acceso a localStorage de guiones (§6).
//
// Los componentes tienen prohibido tocar `localStorage` (AGENTS.md nº2);
// pasan por `ScriptsProvider` → este módulo. Guardarraíles:
// - Dato corrupto / `JSON.parse` fallido → detalle en `loadScriptsDetailed`
//   + cuarentena (`quarantineCorrupt`); el seed jamás sobrescribe el daño.
// - Migración tolerante `migrateScripts` (v0 sin `updatedAt` → default).
// - `QuotaExceededError` en `setItem` → se reporta (`quotaExceeded: true`)
//   para que el provider avise por `sonner`; read-back detecta
//   escrituras no verificadas (`verifyFailed`).

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

/** Prefijo de las claves de cuarentena (un dato corrupto nunca se borra). */
export const CORRUPT_PREFIX = 'guion.scripts.corrupt.'

/** Resultado detallado de la lectura: distingue vacío real de dato dañado. */
export interface LoadResult {
  scripts: Script[]
  /** Texto crudo que no se pudo parsear/migrar (`null` si no hubo daño). */
  corruptRaw: string | null
  /** Items descartados por irreconstruibles dentro de un JSON válido. */
  dropped: number
}

function isLegacyScript(value: unknown): value is Script {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.id === 'string' &&
    v.id !== '' &&
    typeof v.title === 'string' &&
    typeof v.text === 'string'
  )
}

/**
 * Migra un JSON ya parseado a `Script[]` sin perder de más: acepta items
 * `v0` sin `updatedAt` (default `0`) y conserva campos extra; solo cuenta
 * como `dropped` lo irreconstruible.
 */
export function migrateScripts(parsed: unknown): {
  scripts: Script[]
  dropped: number
} {
  if (!Array.isArray(parsed)) return { scripts: [], dropped: 0 }
  const scripts: Script[] = []
  let dropped = 0
  for (const item of parsed) {
    if (isScript(item)) {
      scripts.push(item)
    } else if (isLegacyScript(item)) {
      const raw = item as unknown as Record<string, unknown>
      const updatedAt =
        typeof raw.updatedAt === 'number' && Number.isFinite(raw.updatedAt)
          ? raw.updatedAt
          : 0
      scripts.push({
        ...(item as object),
        updatedAt,
      } as Script)
    } else {
      dropped += 1
    }
  }
  return { scripts, dropped }
}

/**
 * Lee la lista persistida con detalle. Nunca lanza: ante ausencia de
 * `localStorage`, JSON roto o forma inesperada, devuelve lista vacía y el
 * texto crudo en `corruptRaw` para cuarentena (el llamador decide si
 * sembrar ejemplo o no; jamás sobrescribir el daño con el seed).
 */
export function loadScriptsDetailed(): LoadResult {
  try {
    const raw = globalThis.localStorage?.getItem(SCRIPTS_KEY)
    if (raw == null || raw === '')
      return { scripts: [], corruptRaw: null, dropped: 0 }
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      return { scripts: [], corruptRaw: raw, dropped: 0 }
    }
    if (!Array.isArray(parsed))
      return { scripts: [], corruptRaw: raw, dropped: 0 }
    const { scripts, dropped } = migrateScripts(parsed)
    return { scripts, corruptRaw: null, dropped }
  } catch {
    return { scripts: [], corruptRaw: null, dropped: 0 }
  }
}

/**
 * Lee la lista persistida. Nunca lanza: ante ausencia de `localStorage`
 * (SSR/privado), JSON roto o forma inesperada, devuelve `[]`.
 * Compatibilidad: equivale a `loadScriptsDetailed().scripts`.
 */
export function loadScripts(): Script[] {
  return loadScriptsDetailed().scripts
}

/**
 * Guarda el texto crudo dañado en cuarentena (`guion.scripts.corrupt.*`).
 * Idempotente: si el mismo texto ya está en cuarentena no duplica (el
 * StrictMode monta dos veces en dev y cada boot re-ejecutaría el init).
 * Nunca lanza ni borra nada; devuelve la clave usada o `null`.
 */
export function quarantineCorrupt(raw: string): string | null {
  try {
    const ls = globalThis.localStorage
    try {
      const storage = ls as unknown as {
        length?: unknown
        key?: unknown
        getItem?: unknown
      }
      if (
        typeof storage.length === 'number' &&
        typeof storage.key === 'function' &&
        typeof storage.getItem === 'function'
      ) {
        const keyFn = storage.key as (index: number) => string | null
        const getItem = storage.getItem as (key: string) => string | null
        for (let i = 0; i < storage.length; i++) {
          const k = keyFn.call(ls, i)
          if (k?.startsWith(CORRUPT_PREFIX) && getItem.call(ls, k) === raw) {
            return k
          }
        }
      }
    } catch {
      // Best-effort: si no se puede enumerar, se guarda igual.
    }
    const key = `${CORRUPT_PREFIX}${Date.now().toString(36)}-${Math.floor(Math.random() * 0xffffffff).toString(36)}`
    ls?.setItem(key, raw)
    return key
  } catch {
    return null
  }
}

/** Aviso de boot con dato dañado (se toastea en efecto, se consume una vez). */
export interface BootNotice {
  quarantined: boolean
  dropped: number
}

let pendingBootNotice: BootNotice | null = null

/** Registra el aviso de boot (lo consume `takeBootNotice`). */
export function setBootNotice(notice: BootNotice): void {
  pendingBootNotice = notice
}

/** Lee y limpia el aviso de boot (`null` si no hubo daño). */
export function takeBootNotice(): BootNotice | null {
  const n = pendingBootNotice
  pendingBootNotice = null
  return n
}

export interface SaveResult {
  /** `true` si `setItem` lanzó por falta de cuota. */
  quotaExceeded: boolean
  /** `true` si el read-back no coincide (escritura no verificada). */
  verifyFailed: boolean
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
 * cuota o fallo de verificación para que el llamador avise al usuario.
 */
export function saveScripts(scripts: Script[]): SaveResult {
  try {
    const expected = JSON.stringify(scripts)
    globalThis.localStorage?.setItem(SCRIPTS_KEY, expected)
    try {
      const actual = globalThis.localStorage?.getItem(SCRIPTS_KEY)
      if (actual !== undefined && actual !== null && actual !== expected) {
        return { quotaExceeded: false, verifyFailed: true }
      }
    } catch {
      // El read-back es best-effort; si falla la lectura no se reporta.
    }
    return { quotaExceeded: false, verifyFailed: false }
  } catch (err) {
    return { quotaExceeded: isQuotaError(err), verifyFailed: false }
  }
}
