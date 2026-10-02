// src/features/scripts/scriptFiles.ts — import/export de archivos `.fountain` (§6).
//
// Exportar: Blob `text/plain` con extensión `.fountain`; nombre derivado
// del título saneado (sin `/`, `\`, `:`). Importar: leer el `.fountain`/`.txt`
// como texto y derivar el título del nombre de archivo.

import { sanitizeFilename, titleFromFilename } from '@/lib/scripts'
import type { Script } from '@/types/Script'

/** Extensiones aceptadas por el input de importación. */
export const IMPORT_ACCEPT = '.fountain,.txt'

/** Nombre de archivo para exportar un guion. */
export function scriptFilename(script: Script): string {
  return `${sanitizeFilename(script.title)}.fountain`
}

/** Descarga un texto como archivo (web: Blob + `a[download]`). */
export function downloadTextFile(
  filename: string,
  text: string,
  mime = 'text/plain;charset=utf-8',
): void {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** Exporta un guion como `.fountain`. */
export function exportScript(script: Script): void {
  downloadTextFile(scriptFilename(script), script.text)
}

/** Lee un archivo importado: texto + título derivado del nombre. */
export async function readImportFile(
  file: File,
): Promise<{ title: string; text: string }> {
  const text = await file.text()
  return { title: titleFromFilename(file.name), text }
}
