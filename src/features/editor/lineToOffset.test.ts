// src/features/editor/lineToOffset.test.ts — línea (1-based) a offset
// (REVIEW.md punto 7).
import { describe, expect, it } from 'vitest'
import { lineToOffset } from './lineToOffset'

const DOC = 'primera\nsegunda\ntercera'

describe('lineToOffset', () => {
  it('la línea 1 cae al inicio', () => {
    expect(lineToOffset(DOC, 1)).toBe(0)
  })

  it('traduce líneas intermedias al inicio de su línea', () => {
    expect(lineToOffset(DOC, 2)).toBe(DOC.indexOf('segunda'))
    expect(lineToOffset(DOC, 3)).toBe(DOC.indexOf('tercera'))
  })

  it('una línea pasada del final cae al final del texto', () => {
    expect(lineToOffset(DOC, 4)).toBe(DOC.length)
    expect(lineToOffset(DOC, 9999)).toBe(DOC.length)
  })

  it('líneas ≤ 1 o no finitas caen al inicio', () => {
    expect(lineToOffset(DOC, 0)).toBe(0)
    expect(lineToOffset(DOC, -3)).toBe(0)
    expect(lineToOffset(DOC, NaN)).toBe(0)
  })

  it('redondea hacia abajo las líneas fraccionarias', () => {
    expect(lineToOffset(DOC, 2.9)).toBe(DOC.indexOf('segunda'))
  })

  it('documento vacío siempre cae a 0', () => {
    expect(lineToOffset('', 1)).toBe(0)
    expect(lineToOffset('', 5)).toBe(0)
  })
})
