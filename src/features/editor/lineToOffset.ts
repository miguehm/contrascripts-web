// src/features/editor/lineToOffset.ts — línea (1-based) a offset del fuente
// (REVIEW.md punto 7).
//
// Los avisos de `lint()` solo traen `line`, así que el salto desde el panel
// de avisos necesita esta traducción antes de reutilizar `jumpToOffset`
// (punto 4: cursor + scroll al 25% + flash). Puro para testear. Se sujeta por
// ambos extremos: líneas ≤ 1 caen al inicio y líneas pasadas del final al
// final del texto.

/**
 * Offset del comienzo de la línea `line` (1-based) en `source`, o el
 * principio/fin del texto cuando la línea queda fuera de rango.
 */
export function lineToOffset(source: string, line: number): number {
  if (!Number.isFinite(line) || line <= 1) return 0
  const target = Math.floor(line)
  let idx = 0
  for (let current = 1; current < target; current++) {
    const nl = source.indexOf('\n', idx)
    if (nl < 0) return source.length
    idx = nl + 1
  }
  return Math.min(idx, source.length)
}
