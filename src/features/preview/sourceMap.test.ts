// Tests del mapeo del texto del PDF al offset del fuente (REVIEW.md punto 4).
// Funciones puras: sin DOM, sin pdf.js y sin el parser — el `Document` es un
// fixture a mano con las mismas líneas que el parser emitiría.
import { describe, expect, it } from 'vitest'
import { resolveJumpOffset } from './sourceMap'
import type { Document } from '@/vendor/fountain.mjs'

/** Documento mínimo: solo `elements` y `titlePageLines` importan aquí. */
function makeDoc(
  elements: Array<{ type: string; line: number; text?: string }>,
  titlePageLines: Record<string, number> = {},
): Document {
  return {
    titlePage: {} as Document['titlePage'],
    titlePageLines,
    elements: elements as Document['elements'],
  }
}

/** Offset de un texto buscándolo a pelo, para comparar sin recalcular. */
function offsetOf(haystack: string, needle: string): number {
  const at = haystack.indexOf(needle)
  expect(at, `"${needle}" no está en el guion del test`).toBeGreaterThanOrEqual(
    0,
  )
  return at
}

describe('resolveJumpOffset', () => {
  const source = [
    'Title: La señal',
    'Author: Sarahi',
    '',
    'EXT. CASA - DIA',
    '',
    'Stars blanket the void.',
    'A lone satellite orbits.',
    '',
    'ELENA',
    '¿Me oyes?',
    '',
    'CUT TO:',
  ].join('\n')

  it('coloca el cursor en el elemento que contiene el texto del PDF', () => {
    const doc = makeDoc([
      { type: 'sceneHeading', line: 4, text: 'EXT. CASA - DIA' },
      { type: 'action', line: 6, text: 'Stars blanket the void.' },
      { type: 'character', line: 9, text: 'ELENA' },
      { type: 'transition', line: 12, text: 'CUT TO:' },
    ])

    expect(resolveJumpOffset(doc, source, 'Stars blanket the void.', 0)).toBe(
      offsetOf(source, 'Stars blanket'),
    )
  })

  it('desplaza el cursor dentro del elemento con charIndex', () => {
    const doc = makeDoc([
      { type: 'action', line: 6, text: 'Stars blanket the void.' },
    ])

    // "blanket" empieza 6 caracteres dentro del ítem.
    expect(resolveJumpOffset(doc, source, 'Stars blanket the void.', 6)).toBe(
      offsetOf(source, 'blanket'),
    )
  })

  it('el texto forzado en minúsculas se imprime en mayúsculas', () => {
    // Fountain solo reconoce un cue en mayúsculas, así que el desnivel real
    // llega por los elementos forzados: el parser entrega el texto sin el `.`
    // ni la mayúscula, y el renderer lo imprime en caja alta.
    const text = '.forzed escena'
    const doc = makeDoc([
      { type: 'sceneHeading', line: 1, text: 'forzed escena' },
    ])

    expect(resolveJumpOffset(doc, text, 'FORZED ESCENA', 0)).toBe(
      offsetOf(text, 'forzed'),
    )
  })

  it('un párrafo con saltos de línea se busca sobre el texto unido', () => {
    // El PDF ajusta el párrafo en dos líneas visuales y el ítem cae en el
    // cruce, así que no está contenido en ninguna línea suelta.
    const doc = makeDoc([
      {
        type: 'action',
        line: 6,
        text: 'Stars blanket the void.\nA lone satellite orbits.',
      },
    ])

    // "VOID. A LONE" empieza en la primera línea del párrafo; el carácter 6
    // ("A") cae ya en la segunda, que es donde está el salto real.
    expect(resolveJumpOffset(doc, source, 'VOID. A LONE', 0)).toBe(
      offsetOf(source, 'void'),
    )
    expect(resolveJumpOffset(doc, source, 'VOID. A LONE', 6)).toBe(
      offsetOf(source, 'A lone'),
    )
  })

  it('salta el prefijo de un elemento forzado', () => {
    // El parser entrega el texto sin el `.`, pero la línea del fuente lo tiene.
    const text = '.FORCED SCENE'
    const doc = makeDoc([
      { type: 'sceneHeading', line: 1, text: 'FORCED SCENE' },
    ])

    const offset = resolveJumpOffset(doc, text, 'FORCED SCENE', 0)
    expect(offset).toBe(offsetOf(text, 'FORCED'))
  })

  it('descarta el marcado inline que el PDF no imprime', () => {
    const text = 'Dice **bold** y _cursiva_.'
    const doc = makeDoc([{ type: 'action', line: 1, text }])

    const offset = resolveJumpOffset(doc, text, 'DICE BOLD Y', 0)
    expect(offset).toBe(offsetOf(text, 'Dice'))
  })

  it('con texto repetido gana el primer elemento del documento', () => {
    const text = 'CUT TO:\n\nAcción.\n\nCUT TO:\n'
    const doc = makeDoc([
      { type: 'transition', line: 1, text: 'CUT TO:' },
      { type: 'action', line: 3, text: 'Acción.' },
      { type: 'transition', line: 5, text: 'CUT TO:' },
    ])

    expect(resolveJumpOffset(doc, text, 'CUT TO:', 0)).toBe(
      offsetOf(text, 'CUT TO:'),
    )
  })

  it('resuelve un campo de portada por su línea', () => {
    const doc = makeDoc(
      [{ type: 'sceneHeading', line: 4, text: 'EXT. CASA - DIA' }],
      { title: 1, author: 2 },
    )

    expect(resolveJumpOffset(doc, source, 'LA SEÑAL', 0)).toBe(
      offsetOf(source, 'La señal'),
    )
    expect(resolveJumpOffset(doc, source, 'SARAHI', 0)).toBe(
      offsetOf(source, 'Sarahi'),
    )
  })

  it('devuelve null si el texto no está en el guion', () => {
    const doc = makeDoc([{ type: 'action', line: 6, text: 'Stars blanket.' }])
    expect(resolveJumpOffset(doc, source, 'TEXTO INVENTADO', 0)).toBeNull()
  })

  it('devuelve null sin documento, sin texto o con espacios', () => {
    const doc = makeDoc([{ type: 'action', line: 6, text: 'Stars blanket.' }])
    expect(resolveJumpOffset(null, source, 'Stars', 0)).toBeNull()
    expect(resolveJumpOffset(doc, source, '', 0)).toBeNull()
    expect(resolveJumpOffset(doc, source, '   ', 0)).toBeNull()
  })

  it('aguanta charIndex fuera de rango', () => {
    const text = 'A lone satellite orbits.'
    const doc = makeDoc([{ type: 'action', line: 7, text }])
    const start = offsetOf(source, text)
    // Se sujeta a los extremos del ítem, no se desborda al elemento.
    expect(resolveJumpOffset(doc, source, text, 999)).toBe(
      start + text.length - 1,
    )
    expect(resolveJumpOffset(doc, source, text, -5)).toBe(start)
  })
})
