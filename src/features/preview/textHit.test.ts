// Tests del hit-test del punto 4 sobre los ítems de texto del PDF.
// El viewport se falsea con el transform real de pdf.js para una hoja Letter a
// escala 1 —`[1, 0, 0, -1, 0, 792]`, que voltea el eje Y— y los ítems son los
// que emite pdf.js: `transform` en espacio PDF con la línea base en los dos
// últimos elementos de la matriz.
import { describe, expect, it } from 'vitest'
import { charIndexAt, itemRect, pickItemAt } from './textHit'
import type { PdfPageViewport, PdfTextItem } from '@/lib/pdfjs'

/** Alto de la hoja en px a escala 1 (US Letter: 792pt). */
const PAGE_H = 792

/**
 * Hoja a escala 1. El transform voltea el eje Y, así que la línea base de un
 * ítem en `y` cae en pantalla en `PAGE_H - y`, y la caja sube desde ahí.
 */
const viewport = {
  scale: 1,
  transform: [1, 0, 0, -1, 0, PAGE_H],
} as unknown as PdfPageViewport

/**
 * Alto de la caja del fixture: sale de la matriz de texto compuesta con la del
 * viewport, que para una matriz de 12pt da `hypot(0, 12)` = 12 — el tamaño
 * nominal de la fuente, no su em al cuadrado.
 */
const FONT_H = 12

/** Ítem con la línea base en (x, y) y anchura `width` en espacio PDF. */
function item(str: string, x: number, y: number, width: number): PdfTextItem {
  return {
    str,
    width,
    height: 10,
    transform: [12, 0, 0, 12, x, y],
    fontName: 'g_d0_f1',
    hasEOL: false,
    dir: 'ltr',
  } as unknown as PdfTextItem
}

describe('itemRect', () => {
  it('proyecta la línea base a px con el origen arriba a la izquierda', () => {
    const rect = itemRect(item('hola', 100, 700, 40), viewport)
    expect(rect.left).toBeCloseTo(100)
    expect(rect.height).toBeCloseTo(FONT_H)
    // El viewport voltea Y: la línea base está a 92 del borde superior.
    expect(rect.top).toBeCloseTo(PAGE_H - 700 - FONT_H)
    expect(rect.width).toBeCloseTo(40)
  })

  it('escala el ancho del ítem con el viewport', () => {
    const scaled = {
      scale: 2,
      transform: [2, 0, 0, -2, 0, PAGE_H * 2],
    } as unknown as PdfPageViewport
    const rect = itemRect(item('hola', 50, 350, 40), scaled)
    expect(rect.width).toBeCloseTo(80)
    expect(rect.left).toBeCloseTo(100)
    expect(rect.height).toBeCloseTo(FONT_H * 2)
  })
})

describe('charIndexAt', () => {
  const letters = item('ABCDE', 100, 700, 50)
  const rect = itemRect(letters, viewport)

  it('reparte el ancho por igual (fuente monoespaciada)', () => {
    expect(charIndexAt(letters, rect, 100)).toBe(0)
    expect(charIndexAt(letters, rect, 110)).toBe(1)
    expect(charIndexAt(letters, rect, 140)).toBe(4)
  })

  it('sujeta los extremos', () => {
    expect(charIndexAt(letters, rect, -500)).toBe(0)
    expect(charIndexAt(letters, rect, 5000)).toBe(4)
  })

  it('no revienta con un ítem vacío o sin ancho', () => {
    const empty = item('', 0, 0, 0)
    expect(charIndexAt(empty, itemRect(empty, viewport), 0)).toBe(0)
  })
})

describe('pickItemAt', () => {
  // Courier Prime (la fuente del PDF) es monoespaciada: cada carácter ocupa
  // `width / str.length` px, así que el índice sale de la posición horizontal
  // sin medir la fuente. Cada caja ocupa de `top` a `top + FONT_H`, y en
  // pantalla la de una línea base `y` va de `PAGE_H - y - FONT_H` a `PAGE_H - y`.
  const primera = item('primera', 72, 700, 70) // caja: 80..92
  const segunda = item('segunda', 200, 650, 70) // caja: 130..142

  it('devuelve el ítem bajo el punto con su carácter', () => {
    // `segunda` ocupa x=200..270 con 7 letras: x=203 cae en la primera.
    const hit = pickItemAt([primera, segunda], viewport, 203, 135)
    expect(hit?.item.str).toBe('segunda')
    expect(hit?.charIndex).toBe(0)
  })

  it('el carácter se reparte por el ancho del ítem', () => {
    // 10px más a la derecha = un carácter más.
    const hit = pickItemAt([primera, segunda], viewport, 210, 135)
    expect(hit?.item.str).toBe('segunda')
    expect(hit?.charIndex).toBe(1)
  })

  it('tolera un clic cerca del texto entre líneas', () => {
    // 5px por encima de la caja de `segunda` entra en la tolerancia de 8px, y
    // gana ese ítem y no el de la línea de arriba (a 33px).
    const hit = pickItemAt([primera, segunda], viewport, 203, 125)
    expect(hit?.item.str).toBe('segunda')
  })

  it('gana el ítem más cercano cuando varios están en tolerancia', () => {
    const cercano = item('cercano', 72, 670, 200) // caja: 110..122
    // y=105 está a 5px de `cercano` y a 13px de `primera` (caja 80..92).
    const hit = pickItemAt([primera, cercano], viewport, 100, 105, 14)
    expect(hit?.item.str).toBe('cercano')
  })

  it('en un empate gana el primer ítem del PDF', () => {
    const cercano = item('cercano', 72, 670, 200) // caja: 110..122
    // y=101 está a 9px de las dos cajas: gana la primera.
    const hit = pickItemAt([primera, cercano], viewport, 100, 101, 12)
    expect(hit?.item.str).toBe('primera')
  })

  it('devuelve null en el margen, sin inventar un destino', () => {
    expect(pickItemAt([primera, segunda], viewport, 5, 5)).toBeNull()
    expect(pickItemAt([primera, segunda], viewport, 400, PAGE_H - 5)).toBeNull()
  })

  it('aguanta la lista vacía de ítems', () => {
    expect(pickItemAt([], viewport, 100, 100)).toBeNull()
  })

  it('con tolerancia 0, solo acierta dentro de la caja', () => {
    const hit = pickItemAt([primera, segunda], viewport, 203, 135, 0)
    expect(hit?.item.str).toBe('segunda')
    // y=100 está entre las dos cajas: a 8px de la primera.
    expect(pickItemAt([primera, segunda], viewport, 203, 100, 0)).toBeNull()
  })

  it('ignora los ítems vacíos o solo en blanco (saltos de bloque)', () => {
    expect(pickItemAt([item('', 72, 700, 0)], viewport, 72, 85)).toBeNull()
    expect(pickItemAt([item('   ', 72, 700, 30)], viewport, 72, 85)).toBeNull()
  })
})
