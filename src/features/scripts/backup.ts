// src/features/scripts/backup.ts — copia de seguridad en un único `.json`
// (REVIEW.md punto 12; base del punto 13).
//
// Puro: sin React ni localStorage (la fecha de última copia vive en
// `src/store/backupStorage.ts`). La descarga reutiliza `downloadTextFile`.

import { UNTITLED, newId } from '@/lib/scripts'
import type { Script } from '@/types/Script'
import { downloadTextFile } from './scriptFiles'

/** Versión del formato de copia. */
export const BACKUP_VERSION = 1

export interface BackupPayload {
  version: number
  app: 'guion'
  exportedAt: number
  scripts: Script[]
}

export interface ParseBackupResult {
  scripts: Script[]
  dropped: number
}

/** Construye el payload de copia desde la lista viva. */
export function buildBackup(
  scripts: Script[],
  now: number = Date.now(),
): BackupPayload {
  return { version: BACKUP_VERSION, app: 'guion', exportedAt: now, scripts }
}

/** Nombre de archivo `guiones-AAAA-MM-DD.json` (fecha local). */
export function backupFilename(at: number = Date.now()): string {
  const d = new Date(at)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `guiones-${y}-${m}-${day}.json`
}

/** Descarga la copia (web: Blob + `a[download]`). */
export function downloadBackup(scripts: Script[]): void {
  const payload = buildBackup(scripts)
  downloadTextFile(
    backupFilename(payload.exportedAt),
    JSON.stringify(payload, null, 2),
    'application/json;charset=utf-8',
  )
}

/**
 * Lee una copia: tolerante con archivos ajenos (ids ausentes se generan,
 * `updatedAt` ausente → `0`); solo cuenta como `dropped` lo irreconstruible
 * (no objeto o sin `text` string). Nunca lanza.
 */
export function parseBackup(raw: string): ParseBackupResult {
  try {
    const parsed: unknown = JSON.parse(raw)
    const list: unknown = Array.isArray(parsed)
      ? parsed
      : (parsed as { scripts?: unknown })?.scripts
    if (!Array.isArray(list)) return { scripts: [], dropped: 0 }
    const scripts: Script[] = []
    let dropped = 0
    for (const item of list) {
      if (typeof item !== 'object' || item === null) {
        dropped += 1
        continue
      }
      const v = item as Record<string, unknown>
      if (typeof v.text !== 'string') {
        dropped += 1
        continue
      }
      const id = typeof v.id === 'string' && v.id !== '' ? v.id : newId()
      const title =
        typeof v.title === 'string' && v.title !== '' ? v.title : UNTITLED
      const updatedAt =
        typeof v.updatedAt === 'number' && Number.isFinite(v.updatedAt)
          ? v.updatedAt
          : 0
      scripts.push({ id, title, text: v.text, updatedAt })
    }
    return { scripts, dropped }
  } catch {
    return { scripts: [], dropped: 0 }
  }
}

/**
 * Reasigna ids que choquen con los existentes o dentro del lote, para que
 * importar una copia nunca pise ni fusione guiones vivos.
 */
export function dedupeIds(batch: Script[], existingIds: Set<string>): Script[] {
  const seen = new Set(existingIds)
  return batch.map((s) => {
    if (!seen.has(s.id)) {
      seen.add(s.id)
      return s
    }
    const fresh = { ...s, id: newId() }
    seen.add(fresh.id)
    return fresh
  })
}
