// src/lib/scripts.test.ts — helpers puros de §6 (sin React ni localStorage).

import { describe, expect, it } from 'vitest'
import {
  UNTITLED,
  newId,
  newScript,
  sanitizeFilename,
  titleFromFilename,
} from '@/lib/scripts'

describe('newId', () => {
  it('genera ids únicos no vacíos', () => {
    const a = newId()
    const b = newId()
    expect(a).not.toBe('')
    expect(a).not.toBe(b)
  })
})

describe('newScript', () => {
  it('usa título y texto dados', () => {
    const s = newScript('Mi guion', 'INT. CASA - DÍA')
    expect(s.title).toBe('Mi guion')
    expect(s.text).toBe('INT. CASA - DÍA')
    expect(s.id).not.toBe('')
    expect(s.updatedAt).toBeLessThanOrEqual(Date.now())
  })

  it('cae a "Sin título" con título vacío o ausente', () => {
    expect(newScript('   ').title).toBe(UNTITLED)
    expect(newScript().title).toBe(UNTITLED)
    expect(newScript(undefined, 'x').text).toBe('x')
  })
})

describe('sanitizeFilename', () => {
  it('quita /, \\ y :', () => {
    expect(sanitizeFilename('a/b\\c:d')).toBe('abcd')
  })

  it('quita el resto de caracteres inseguros y colapsa espacios', () => {
    expect(sanitizeFilename('  Mi  guion: <final>?.fountain ')).toBe(
      'Mi guion final.fountain',
    )
  })

  it('recorta a 60 caracteres y cae a "guion" si queda vacío', () => {
    expect(sanitizeFilename('x'.repeat(100))).toHaveLength(60)
    expect(sanitizeFilename('///')).toBe('guion')
    expect(sanitizeFilename('   ')).toBe('guion')
  })
})

describe('titleFromFilename', () => {
  it('quita la extensión .fountain/.txt', () => {
    expect(titleFromFilename('mi-guion.fountain')).toBe('mi-guion')
    expect(titleFromFilename('notas.TXT')).toBe('notas')
  })

  it('ignora directorios y cae a "Sin título" sin base útil', () => {
    expect(titleFromFilename('docs/mi guion.fountain')).toBe('mi guion')
    expect(titleFromFilename('.fountain')).toBe(UNTITLED)
  })
})
