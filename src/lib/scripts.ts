// src/lib/scripts.ts — helpers puros de guiones (§6).
//
// Sin dependencias de React ni de localStorage: crear ids, construir el
// guion inicial y sanear títulos para nombres de archivo `.fountain`.
// La persistencia vive en `src/store/storage.ts`.

import type { Script } from '@/types/Script'

/** Título cuando no hay otro mejor (nuevo guion, archivo sin nombre). */
export const UNTITLED = 'Sin título'

/** Caracteres ilegales en nombres de archivo (Windows + separadores). */
const UNSAFE_CHARS = '<>:"/\\|?*'

/** Genera un id único; `crypto.randomUUID()` con fallback sin crypto. */
export function newId(): string {
  const c = globalThis.crypto as { randomUUID?: () => string } | undefined
  if (c?.randomUUID) return c.randomUUID()
  return `s-${Date.now().toString(36)}-${Math.floor(Math.random() * 0xffffffff).toString(36)}`
}

/** Construye un guion nuevo con `updatedAt` actual. */
export function newScript(title?: string, text = ''): Script {
  const clean = (title ?? '').trim()
  return {
    id: newId(),
    title: clean === '' ? UNTITLED : clean,
    text,
    updatedAt: Date.now(),
  }
}

/**
 * Sanea un título para usarlo como nombre de archivo.
 * Quita separadores (`/`, `\`, `:`), el resto de inseguros en Windows
 * (`<>?"*|`) y caracteres de control; colapsa espacios y recorta a 60
 * caracteres. Sin resultado útil → `guion`.
 */
export function sanitizeFilename(title: string): string {
  const cleaned = [...title]
    .filter((ch) => {
      const code = ch.codePointAt(0) ?? 32
      return code >= 32 && !UNSAFE_CHARS.includes(ch)
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '')
    .slice(0, 60)
  return cleaned === '' ? 'guion' : cleaned
}

/** Deriva el título inicial al importar: nombre de archivo sin extensión. */
export function titleFromFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? name
  const withoutExt = base.replace(/\.(fountain|txt)$/i, '').trim()
  return withoutExt === '' ? UNTITLED : withoutExt
}
