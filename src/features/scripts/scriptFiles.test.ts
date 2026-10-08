// src/features/scripts/scriptFiles.test.ts — puerta de importación en
// nativo (Android no filtra `.fountain` por `accept`; ver `files.ts`).

import { describe, expect, it } from 'vitest'
import { isImportableName } from './scriptFiles'

describe('isImportableName', () => {
  it('acepta .fountain y .txt en cualquier caja', () => {
    expect(isImportableName('vampira.fountain')).toBe(true)
    expect(isImportableName('VAMPIRA.FOUNTAIN')).toBe(true)
    expect(isImportableName('notas.txt')).toBe(true)
    expect(isImportableName('mi guion.Txt')).toBe(true)
  })

  it('rechaza el resto', () => {
    expect(isImportableName('vampira.pdf')).toBe(false)
    expect(isImportableName('copia.json')).toBe(false)
    expect(isImportableName('sin-extension')).toBe(false)
  })
})
