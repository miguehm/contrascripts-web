// src/lib/scenes.ts — listado de escenas (REVIEW.md punto 13).
//
// Deriva del `Document` ya parseado: cada `sceneHeading` aporta título y
// línea; la preview es la primera `action` siguiente hasta el próximo
// `sceneHeading`. Puro para testear. No re-parsea el fuente con regex:
// usa `doc.elements` como fuente de verdad.

import type { Document } from '@/vendor/fountain.mjs'

/**
 * Guarda de rendimiento (caracteres): la preview viaja a `line-clamp-2` y el
 * recorte visible lo decide el CSS, no este presupuesto. Sin "…" final: el
 * indicador de continuación es el fundido de `ScenesList`.
 */
export const SCENE_PREVIEW_MAX = 240

export interface SceneItem {
  /** Estable por parse: índice + línea inicial. */
  id: string
  /** Posición 1-based en el listado (1, 2, …). */
  index: number
  /** Título tal cual lo trae el parser (`e.text`). */
  title: string
  /** Línea fuente 1-based donde empieza la escena. */
  line: number
  /** Primera acción siguiente, recortada; '' si no hay. */
  preview: string
  /** `true` si la acción completa sigue más allá de `preview`. */
  previewTruncated: boolean
}

/** Colapsa blancos y recorta a `SCENE_PREVIEW_MAX` sin romper palabras. */
export function truncateAction(value: string): {
  text: string
  truncated: boolean
} {
  const flat = value.replace(/\s+/g, ' ').trim()
  if (flat.length <= SCENE_PREVIEW_MAX) return { text: flat, truncated: false }
  const cut = flat.slice(0, SCENE_PREVIEW_MAX)
  const at = cut.lastIndexOf(' ')
  return { text: at > 40 ? cut.slice(0, at) : cut, truncated: true }
}

/**
 * Escenas del documento en orden. `null`/sin elementos → [].
 * La preview es la primera `action` con texto hasta el próximo heading.
 */
export function getScenes(doc: Document | null | undefined): SceneItem[] {
  if (!doc || !Array.isArray(doc.elements)) return []
  const out: SceneItem[] = []
  const els = doc.elements
  for (let i = 0; i < els.length; i++) {
    const el = els[i]!
    if (el.type !== 'sceneHeading') continue
    const line = el.line
    const title = (el.text ?? '').trim()
    let preview = ''
    let previewTruncated = false
    for (let j = i + 1; j < els.length; j++) {
      const next = els[j]!
      if (next.type === 'sceneHeading') break
      if (next.type === 'action' && next.text?.trim()) {
        const cut = truncateAction(next.text)
        preview = cut.text
        previewTruncated = cut.truncated
        break
      }
    }
    out.push({
      id: `scene-${out.length + 1}-${line}`,
      index: out.length + 1,
      title,
      line,
      preview,
      previewTruncated,
    })
  }
  return out
}
