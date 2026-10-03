// src/features/preview/sourceMap.ts — del texto del PDF al offset del fuente
// Fountain (REVIEW.md punto 4).
//
// El PDF no lleva posiciones del fuente, pero el parser sí: cada `Node` trae
// `line` (1-based), así que el salto se resuelve en dos pasos:
//
//   1. el texto del ítem se busca dentro del `text` del elemento. La
//      comparación es tolerante a las tres diferencias entre lo que se escribe
//      y lo que se imprime: mayúsculas (`uppercase`), los saltos de línea que
//      el renderer envuelve (un párrafo son varias líneas del fuente unidas
//      por `\n` dentro de `text`) y el marcado inline que el PDF imprime sin
//      él. Comparar contra el `text` completo del elemento —y no contra una
//      línea— es lo que hace que un ítem que cae justo en un salto de línea
//      del ajuste siga coincidiendo;
//   2. el índice dentro de `text` se traduce a offset absoluto: `line` del
//      elemento + los `\n` que le anteceden + la columna, alineada contra la
//      línea real del fuente (que puede llevar un prefijo de forzado delante).
//
// Todo es puro y sin estado: se recalcula en cada doble-clic, que es lo bastante
// barato (un guion son cientos de líneas) para no arrastrar un puntero monótono
// entre llamadas que quedaría obsoleto en cuanto cambie el texto.

import type { Document } from '@/vendor/fountain.mjs'

/** Texto normalizado para comparar y el índice de origen de cada carácter. */
interface Normalized {
  text: string
  /** `map[i]` = índice en el texto original del i-ésimo carácter de `text`. */
  map: number[]
}

/**
 * Mayúsculas, espacios colapsados y marcado inline retirado, remembering the
 * source index of every character that survives.
 *
 * El marcado se descarta en el mismo recorrido (no con un `replace` previo) para
 * que `map` siga apuntando al texto original: quitar `**` antes de indexar
 * desplazaría todos los índices y el cursor caería fuera de la palabra.
 */
function normalize(value: string): Normalized {
  const chars: string[] = []
  const map: number[] = []
  // Espacio pendiente: una racha de blancos solo se emite cuando llega la
  // siguiente letra, que colapsa los interiores y recorta los extremos.
  let pendingSpace = false
  for (let i = 0; i < value.length; i++) {
    const ch = value[i]!
    if (/\s/.test(ch)) {
      pendingSpace = true
      continue
    }
    // `*`, `_` y backtick son marcado, no glifos: no emiten ni espacio.
    if (ch === '*' || ch === '_' || ch === '`') continue
    if (pendingSpace && chars.length > 0) {
      chars.push(' ')
      map.push(i)
    }
    pendingSpace = false
    chars.push(ch.toLocaleUpperCase())
    map.push(i)
  }
  return { text: chars.join(''), map }
}

/** Posición de un índice crudo dentro de un texto con saltos de línea. */
interface RawPosition {
  /** Cuántos `\n` hay antes del índice. */
  lineAbove: number
  /** Caracteres desde el último `\n` (la columna dentro de su línea). */
  col: number
}

function splitAt(value: string, index: number): RawPosition {
  let lineAbove = 0
  let lineStart = 0
  for (let i = 0; i < index; i++) {
    if (value[i] === '\n') {
      lineAbove++
      lineStart = i + 1
    }
  }
  return { lineAbove, col: index - lineStart }
}

/** Offset del comienzo de la línea `line` (1-based), o -1 si no existe. */
function lineStartOffset(source: string, line: number): number {
  if (line < 1) return -1
  let idx = 0
  for (let current = 1; current < line; current++) {
    const nl = source.indexOf('\n', idx)
    if (nl < 0) return -1
    idx = nl + 1
  }
  return idx
}

/** Contenido de la línea `line` (1-based), sin el salto final. */
function lineAt(source: string, line: number): string {
  const start = lineStartOffset(source, line)
  if (start < 0) return ''
  const end = source.indexOf('\n', start)
  return end < 0 ? source.slice(start) : source.slice(start, end)
}

/**
 * Offset absoluto de un índice normalizado dentro de `element.text`.
 *
 * Alinea la columna contra la línea real del fuente porque el `text` del
 * elemento no siempre es la línea completa: un elemento forzado (`.`, `!`,
 * `@`) llega sin su prefijo, y el caret de diálogo dual también se va. Con
 * `indexOf` del segmento se recupera ese desplazamiento en vez de asumirlo.
 */
function offsetInElement(
  element: Document['elements'][number],
  source: string,
  normIndex: number,
): number | null {
  const raw = element.text
  if (!raw) return null
  const inner = normalize(raw)
  if (normIndex < 0 || normIndex >= inner.map.length) return null

  const innerIdx = inner.map[normIndex]!
  const { lineAbove, col } = splitAt(raw, innerIdx)
  const targetLine = element.line + lineAbove
  const start = lineStartOffset(source, targetLine)
  if (start < 0) return null

  // La línea del elemento sin su parte previa, para reenganchar el prefijo.
  const segments = raw.split('\n')
  const segment = segments[lineAbove] ?? ''
  const base = segment ? lineAt(source, targetLine).indexOf(segment) : -1
  return start + (base >= 0 ? base + col : col)
}

/**
 * Offset del fuente para un texto del PDF, o `null` si no se puede ubicar.
 *
 * `charIndex` es la posición dentro del ítem del PDF (estimada por el clic).
 * Los elementos se recorren en orden —que es como el renderer los imprime— y
 * gana el primero que contiene el texto, así que dos `CUT TO:` resuelven al
 * que está más arriba en el documento. La portada se prueba después, en sus
 * propias líneas, porque es lo que el PDF imprime antes que el primer elemento.
 */
export function resolveJumpOffset(
  doc: Document | null,
  source: string,
  itemText: string,
  charIndex: number,
): number | null {
  if (!doc || !itemText.trim()) return null
  const needle = normalize(itemText)
  if (!needle.text) return null
  const step = Math.min(Math.max(charIndex, 0), needle.map.length - 1)

  for (const element of doc.elements ?? []) {
    const inner = normalize(element.text ?? '')
    if (!inner.text) continue
    const at = inner.text.indexOf(needle.text)
    if (at < 0) continue
    return offsetInElement(element, source, at + step)
  }

  // Portada: `titlePageLines` da la línea exacta de cada clave reconocida; si
  // el guion no trae el mapa (o el texto es de una clave `custom`, que el parser
  // no registra) se barre la región anterior al primer elemento.
  const first = doc.elements?.[0]?.line ?? 1
  const lines = new Set<number>(Object.values(doc.titlePageLines ?? {}))
  if (lines.size === 0) {
    for (let line = 1; line < first; line++) lines.add(line)
  }
  for (const line of lines) {
    const start = lineStartOffset(source, line)
    if (start < 0) continue
    const normLine = normalize(lineAt(source, line))
    const at = normLine.text.indexOf(needle.text)
    if (at < 0) continue
    const mapped = normLine.map[at + step]
    if (mapped !== undefined) return start + mapped
  }

  return null
}
