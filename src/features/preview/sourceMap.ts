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
// Con `hint` (posición del clic en orden de lectura del PDF) hay un paso
// previo: recortar a la palabra bajo el cursor y elegir su k-ésima aparición
// en el fuente, que es lo que desambigua palabras repetidas ("está" en dos
// párrafos). Sin `hint` se mantiene el modo clásico (primer match).
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
 *
 * Se normaliza a NFC antes de comparar: pdf.js puede devolver tildes
 * descompuestas (NFD: `a` + acento combinante) mientras el fuente está en
 * NFC (`á`), y sin esto `indexOf` no casa palabras como "está".
 */
function normalize(value: string): Normalized {
  const src = value.normalize('NFC')
  const chars: string[] = []
  const map: number[] = []
  // Espacio pendiente: una racha de blancos solo se emite cuando llega la
  // siguiente letra, que colapsa los interiores y recorta los extremos.
  let pendingSpace = false
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!
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
 * Palabra bajo el cursor y su contexto vecino, en texto ya normalizado.
 *
 * El ítem del PDF puede ser una línea entera o un fragmento suelto (gofpdf
 * emite `Tj` por runs y pdf.js los devuelve tal cual): buscar el ítem entero
 * con `indexOf` y quedarse con el primer match es lo que llevaba a la
 * primera "está" del documento clicaras donde clicaras. Recortar a la
 * palabra + ±2 vecinas da un needle mucho más discriminante y permite
 * desambiguar por ordinal de ocurrencia (ver `JumpHint`).
 */
export interface WordContext {
  /** Palabra normalizada bajo el cursor (p. ej. `ESTÁ`). */
  word: string
  /** Palabra ±2 vecinas dentro del mismo ítem; cae a `word` si no hay más. */
  context: string
  /** Índice de `word` dentro de `context`. */
  wordOffset: number
  /** Desplazamiento del carácter clicado dentro de `word`. */
  charOffset: number
}

/** Un carácter de palabra: letra o número Unicode (con tilde incluida). */
function isWordChar(ch: string): boolean {
  return /[\p{L}\p{N}']/u.test(ch)
}

export function extractWordContext(
  itemText: string,
  charIndex: number,
): WordContext | null {
  const needle = normalize(itemText)
  if (!needle.text) return null
  const step = Math.min(Math.max(charIndex, 0), needle.text.length - 1)

  let start = step
  while (start > 0 && isWordChar(needle.text[start - 1]!)) start--
  let end = step
  while (end < needle.text.length && isWordChar(needle.text[end]!)) end++
  const word = needle.text.slice(start, end)
  if (!word) return null

  // ±2 palabras a cada lado dentro del mismo ítem.
  let ctxStart = start
  for (let n = 0; n < 2; n++) {
    let i = ctxStart - 1
    while (i >= 0 && !isWordChar(needle.text[i]!)) i--
    if (i < 0) break
    while (i > 0 && isWordChar(needle.text[i - 1]!)) i--
    ctxStart = i
  }
  let ctxEnd = end
  for (let n = 0; n < 2; n++) {
    let i = ctxEnd
    while (i < needle.text.length && !isWordChar(needle.text[i]!)) i++
    if (i >= needle.text.length) break
    while (i < needle.text.length && isWordChar(needle.text[i]!)) i++
    ctxEnd = i
  }
  const context = needle.text.slice(ctxStart, ctxEnd)
  return {
    word,
    context,
    wordOffset: start - ctxStart,
    charOffset: Math.min(Math.max(step - start, 0), word.length - 1),
  }
}

/**
 * Pista posicional del clic para desambiguar repeticiones.
 *
 * `resolveJumpOffset` buscaba el texto del ítem y devolvía el primer
 * elemento que lo contenía, ignorando dónde se clicó. Con el hint se
 * cuenta la k-ésima aparición de la palabra en orden de lectura del PDF
 * (páginas previas + ítems anteriores de la página + ocurrencias previas
 * dentro del propio ítem) y se elige la k-ésima en el fuente.
 */
export interface JumpHint {
  /** Índice del ítem clicado en su página (orden de `getTextContent()`). */
  itemIndex: number
  /** Textos crudos de los ítems de la página actual, en orden. */
  pageItems: string[]
  /** Textos crudos de los ítems de las páginas anteriores, en orden. */
  prevItems: string[]
}

/** Todas las posiciones de `needle` en `haystack` (pueden solaparse, no aquí). */
function allOccurrences(haystack: string, needle: string): number[] {
  const out: number[] = []
  if (!needle) return out
  let from = 0
  for (;;) {
    const at = haystack.indexOf(needle, from)
    if (at < 0) return out
    out.push(at)
    from = at + needle.length
  }
}

/** Veces que `word` aparece en los textos dados (normalizando cada uno). */
function countOccurrences(texts: string[], word: string): number {
  let total = 0
  for (const t of texts) {
    total += allOccurrences(normalize(t).text, word).length
  }
  return total
}
/**
 * Offset del fuente para un texto del PDF, o `null` si no se puede ubicar.
 *
 * `charIndex` es la posición dentro del ítem del PDF (estimada por el clic).
 *
 * Sin `hint` (compat): los elementos se recorren en orden —que es como el
 * renderer los imprime— y gana el primero que contiene el texto, así que dos
 * `CUT TO:` resuelven al que está más arriba en el documento.
 *
 * Con `hint`: se recorta a la palabra bajo el cursor (+ contexto vecino) y
 * se elige la k-ésima aparición en el fuente, donde k es el ordinal de esa
 * palabra en orden de lectura del PDF. Así la segunda "está" del documento
 * lleva a la segunda "está" del fuente. La portada se prueba después, en sus
 * propias líneas, porque es lo que el PDF imprime antes que el primer elemento.
 */
export function resolveJumpOffset(
  doc: Document | null,
  source: string,
  itemText: string,
  charIndex: number,
  hint?: JumpHint,
): number | null {
  if (!doc || !itemText.trim()) return null
  const needle = normalize(itemText)
  if (!needle.text) return null
  const step = Math.min(Math.max(charIndex, 0), needle.map.length - 1)

  if (hint) {
    const resolved = resolveByOccurrence(doc, source, itemText, step, hint)
    // `undefined` = el hint no pudo contar (palabra vacía): caer al modo
    // clásico antes que no hacer nada. `null` = se contó pero no hay
    // candidato: no inventar un destino.
    if (resolved !== undefined) return resolved
  }

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

/**
 * Resuelve por ordinal de ocurrencia. Devuelve `undefined` si no se puede
 * ni contar (y el llamante debe usar el modo clásico), `null` si se contó
 * pero no hay candidato en el fuente.
 */
function resolveByOccurrence(
  doc: Document,
  source: string,
  itemText: string,
  step: number,
  hint: JumpHint,
): number | null | undefined {
  const ctx = extractWordContext(itemText, step)
  if (!ctx) return undefined
  const { word, context, charOffset } = ctx

  // Ordinal en el PDF: ocurrencias en páginas previas + ítems anteriores de
  // la página + ocurrencias previas dentro del propio ítem (el ítem puede
  // traer la palabra dos veces y el clic ser en la segunda).
  const itemNorm = normalize(itemText).text
  const inItem = allOccurrences(itemNorm, word)
  if (inItem.length === 0) return undefined
  let rankInItem = 0
  for (let i = 0; i < inItem.length; i++) {
    const at = inItem[i]!
    if (step >= at && step < at + word.length) {
      rankInItem = i
      break
    }
    if (step >= at + word.length) rankInItem = i + 1
  }
  rankInItem = Math.min(rankInItem, inItem.length - 1)
  const ordinal =
    countOccurrences(hint.prevItems, word) +
    countOccurrences(
      hint.pageItems.slice(0, Math.max(hint.itemIndex, 0)),
      word,
    ) +
    rankInItem

  // Candidatos del fuente en orden de documento: todas las ocurrencias de
  // la palabra en cada elemento (no solo la primera).
  interface Candidate {
    element: Document['elements'][number]
    normIndex: number
    withContext: boolean
  }
  const candidates: Candidate[] = []
  for (const element of doc.elements ?? []) {
    const inner = normalize(element.text ?? '')
    if (!inner.text) continue
    for (const at of allOccurrences(inner.text, word)) {
      candidates.push({
        element,
        normIndex: at + Math.min(charOffset, word.length - 1),
        withContext:
          context.length > word.length && inner.text.includes(context),
      })
    }
  }
  if (candidates.length > 0) {
    // El contexto largo (línea entera en el ítem) ya es casi único: si algún
    // candidato lo contiene, el ordinal sobra.
    const scoped = candidates.some((c) => c.withContext)
      ? candidates.filter((c) => c.withContext)
      : candidates
    // Sujeción en vez de `null`: notas/boneyard no se imprimen y pueden
    // descuadrar el conteo en ±1; volver al primero/último es mejor que no
    // saltar, y nunca peor que el modo clásico (que siempre daba el primero).
    const pick = scoped[Math.min(ordinal, scoped.length - 1)]!
    return offsetInElement(pick.element, source, pick.normIndex)
  }

  // Portada con la misma regla de ordinal.
  const first = doc.elements?.[0]?.line ?? 1
  const lines = new Set<number>(Object.values(doc.titlePageLines ?? {}))
  if (lines.size === 0) {
    for (let line = 1; line < first; line++) lines.add(line)
  }
  interface TitleCandidate {
    line: number
    mapped: number
  }
  const titleCandidates: TitleCandidate[] = []
  for (const line of lines) {
    const start = lineStartOffset(source, line)
    if (start < 0) continue
    const normLine = normalize(lineAt(source, line))
    for (const at of allOccurrences(normLine.text, word)) {
      const mapped =
        normLine.map[Math.min(at + charOffset, normLine.map.length - 1)]
      if (mapped !== undefined) titleCandidates.push({ line, mapped })
    }
  }
  if (titleCandidates.length === 0) return null
  const titlePick =
    titleCandidates[Math.min(ordinal, titleCandidates.length - 1)]!
  const lineStart = lineStartOffset(source, titlePick.line)
  return lineStart < 0 ? null : lineStart + titlePick.mapped
}
