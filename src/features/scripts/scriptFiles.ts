// src/features/scripts/scriptFiles.ts — import/export de archivos `.fountain` (§6).
//
// La E/S vive en `src/platform/files.ts` (web: Blob + `a[download]`; Tauri:
// diálogos nativos). Aquí quedan los nombres (`sanitizeFilename`) y el
// título derivado del nombre de archivo.

import { sanitizeFilename, titleFromFilename } from '@/lib/scripts'
import { getPlatformFiles } from '@/platform/files'
import type { Script } from '@/types/Script'

/** Filtros de importación `.fountain`/`.txt` (diálogo nativo o web). */
export const IMPORT_FILTERS: { name: string; extensions: string[] }[] = [
  { name: 'Fountain', extensions: ['fountain', 'txt'] },
]

const IMPORTABLE_EXTENSIONS = new Set(
  IMPORT_FILTERS.flatMap((f) => f.extensions),
)

/**
 * ¿Nombre importable como guion? En Capacitor no se filtra por `accept`
 * (Android no conoce `.fountain` y lo deshabilita), así que la puerta es
 * esta validación con toast de rechazo en quien llama.
 */
export function isImportableName(name: string): boolean {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  return IMPORTABLE_EXTENSIONS.has(ext)
}

/** Nombre de archivo para exportar un guion. */
export function scriptFilename(script: Script): string {
  return `${sanitizeFilename(script.title)}.fountain`
}

/**
 * Guarda un texto como archivo (web: descarga; Tauri: diálogo nativo).
 * Cancelar el diálogo resuelve en silencio.
 */
export function downloadTextFile(
  filename: string,
  text: string,
  mime = 'text/plain;charset=utf-8',
): Promise<void> {
  return getPlatformFiles().saveTextFile(text, filename, mime)
}

/** Exporta un guion como `.fountain`. */
export function exportScript(script: Script): Promise<void> {
  return downloadTextFile(scriptFilename(script), script.text)
}

/** Deriva el título de un archivo importado (nombre sin extensión). */
export function titleForImport(
  name: string,
  text: string,
): {
  title: string
  text: string
} {
  return { title: titleFromFilename(name), text }
}
