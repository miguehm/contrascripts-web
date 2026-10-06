// src/lib/scenes.test.ts — getScenes (REVIEW.md punto 13).

import { describe, expect, it } from 'vitest'
import { getScenes, truncateAction } from '@/lib/scenes'
import type { Document } from '@/vendor/fountain.mjs'

function docOf(elements: Document['elements']): Document {
  return {
    titlePage: {
      title: '',
      credit: '',
      author: '',
      draftDate: '',
      contact: '',
      source: '',
      revision: '',
      logline: '',
      tagline: '',
      synopsis: '',
      genre: '',
      subgenre: '',
      tone: '',
      themes: '',
      comps: '',
      format: '',
      season: '',
      episode: '',
      episodeTitle: '',
      runtime: '',
      pages: '',
      language: '',
      status: '',
      prodCompany: '',
      producer: '',
      director: '',
      budget: '',
      adaptedBy: '',
      basedOn: '',
      copyright: '',
      wga: '',
      rights: '',
      dedication: '',
      disclaimer: '',
      draftType: '',
      version: '',
      revisionColor: '',
      revisionDate: '',
      email: '',
      phone: '',
      agent: '',
      manager: '',
      address: '',
      sceneNumbers: false,
      production: false,
      custom: {},
    },
    elements,
  }
}

describe('getScenes', () => {
  it('null o vacío → []', () => {
    expect(getScenes(null)).toEqual([])
    expect(getScenes(undefined)).toEqual([])
    expect(getScenes(docOf([]))).toEqual([])
  })

  it('extrae título, línea y preview de la primera acción', () => {
    const scenes = getScenes(
      docOf([
        { type: 'sceneHeading', line: 5, text: 'EXT. PATIO - DÍA' },
        { type: 'action', line: 7, text: 'Un día precioso.' },
        { type: 'character', line: 9, text: 'BRICK' },
        { type: 'sceneHeading', line: 12, text: 'INT. CASA - NOCHE' },
        { type: 'action', line: 14, text: 'Brick entra.' },
      ]),
    )
    expect(scenes).toEqual([
      {
        id: 'scene-1-5',
        index: 1,
        title: 'EXT. PATIO - DÍA',
        line: 5,
        preview: 'Un día precioso.',
        previewTruncated: false,
      },
      {
        id: 'scene-2-12',
        index: 2,
        title: 'INT. CASA - NOCHE',
        line: 12,
        preview: 'Brick entra.',
        previewTruncated: false,
      },
    ])
  })

  it('acción larga → preview recortada con flag', () => {
    const scenes = getScenes(
      docOf([
        { type: 'sceneHeading', line: 1, text: 'EXT. PATIO - DÍA' },
        {
          type: 'action',
          line: 3,
          text: `Comienzo ${'palabra '.repeat(60)}fin`,
        },
      ]),
    )
    expect(scenes[0]?.previewTruncated).toBe(true)
    expect(scenes[0]?.preview.endsWith('…')).toBe(false)
  })

  it('sin acción siguiente → preview vacía; ignora acciones tras otro heading', () => {
    const scenes = getScenes(
      docOf([
        { type: 'sceneHeading', line: 1, text: 'EXT. A - DÍA' },
        { type: 'character', line: 2, text: 'ALGUIEN' },
        { type: 'sceneHeading', line: 3, text: 'INT. B - NOCHE' },
      ]),
    )
    expect(scenes[0]?.preview).toBe('')
    expect(scenes[1]?.preview).toBe('')
  })

  it('títulos duplicados mantienen líneas distintas', () => {
    const scenes = getScenes(
      docOf([
        { type: 'sceneHeading', line: 1, text: 'INT. CASA - DÍA' },
        { type: 'sceneHeading', line: 10, text: 'INT. CASA - DÍA' },
      ]),
    )
    expect(scenes.map((s) => s.line)).toEqual([1, 10])
    expect(scenes[0]?.id).not.toBe(scenes[1]?.id)
  })
})

describe('truncateAction', () => {
  it('colapsa blancos y recorta sin romper palabras ni "…"', () => {
    expect(truncateAction('  hola   mundo  ')).toEqual({
      text: 'hola mundo',
      truncated: false,
    })
    const long = `palabra ${'x '.repeat(150)}fin`
    const out = truncateAction(long)
    expect(out.text.length).toBeLessThanOrEqual(240)
    expect(out.text.endsWith('…')).toBe(false)
    expect(out.truncated).toBe(true)
  })
})
