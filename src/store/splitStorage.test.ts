// src/store/splitStorage.test.ts — persistencia del split editor/preview.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  LEGACY_SPLIT_KEY,
  SPLIT_KEY,
  isSplitLayout,
  loadSplitLayout,
  saveSplitLayout,
  splitLayoutFromGroup,
} from '@/store/splitStorage'

function mockStorage(initial: Record<string, string> = {}) {
  const store: Record<string, string> = { ...initial }
  return {
    store,
    getItem: vi.fn((k: string) => (k in store ? store[k] : null)),
    setItem: vi.fn((k: string, v: string) => {
      store[k] = v
    }),
    removeItem: vi.fn((k: string) => {
      delete store[k]
    }),
    clear: vi.fn(() => {
      for (const k of Object.keys(store)) delete store[k]
    }),
  }
}

beforeEach(() => {
  vi.unstubAllGlobals()
})

describe('isSplitLayout', () => {
  it('acepta editor/preview con suma 100', () => {
    expect(isSplitLayout({ editor: 60, preview: 40 })).toBe(true)
    expect(isSplitLayout({ editor: 33.333, preview: 66.667 })).toBe(true)
  })

  it('rechaza formas inválidas', () => {
    expect(isSplitLayout(null)).toBe(false)
    expect(isSplitLayout({ editor: 60 })).toBe(false)
    expect(isSplitLayout({ editor: 0, preview: 100 })).toBe(false)
    expect(isSplitLayout({ editor: 60, preview: 60 })).toBe(false)
    expect(isSplitLayout({ editor: '60', preview: 40 })).toBe(false)
    expect(isSplitLayout({ editor: NaN, preview: 40 })).toBe(false)
  })
})

describe('splitLayoutFromGroup', () => {
  it('extrae el par editor/preview e ignora claves extra', () => {
    expect(splitLayoutFromGroup({ editor: 62.5, preview: 37.5 })).toEqual({
      editor: 62.5,
      preview: 37.5,
    })
  })

  it('undefined sin par válido', () => {
    expect(splitLayoutFromGroup({})).toBeUndefined()
    expect(splitLayoutFromGroup({ editor: 50, preview: 50, extra: 0 })).toEqual(
      { editor: 50, preview: 50 },
    )
  })
})

describe('loadSplitLayout/saveSplitLayout', () => {
  it('sin dato → undefined (50/50 por defecto)', () => {
    vi.stubGlobal('localStorage', mockStorage())
    expect(loadSplitLayout()).toBeUndefined()
  })

  it('round-trip válido', () => {
    const storage = mockStorage()
    vi.stubGlobal('localStorage', storage)
    saveSplitLayout({ editor: 62.5, preview: 37.5 })
    expect(storage.store[SPLIT_KEY]).toBe(
      JSON.stringify({ editor: 62.5, preview: 37.5 }),
    )
    expect(loadSplitLayout()).toEqual({ editor: 62.5, preview: 37.5 })
  })

  it('JSON roto o forma inválida → undefined sin lanzar', () => {
    vi.stubGlobal('localStorage', mockStorage({ [SPLIT_KEY]: 'no-json' }))
    expect(loadSplitLayout()).toBeUndefined()
    vi.stubGlobal(
      'localStorage',
      mockStorage({ [SPLIT_KEY]: JSON.stringify({ editor: 80, preview: 80 }) }),
    )
    expect(loadSplitLayout()).toBeUndefined()
  })

  it('no persiste valores inválidos', () => {
    const storage = mockStorage()
    vi.stubGlobal('localStorage', storage)
    saveSplitLayout({ editor: 0, preview: 100 })
    expect(SPLIT_KEY in storage.store).toBe(false)
  })

  it('sin localStorage no lanza', () => {
    expect(() => saveSplitLayout({ editor: 60, preview: 40 })).not.toThrow()
    expect(loadSplitLayout()).toBeUndefined()
  })
})

describe('migración legacy guion.* → contrascripts.*', () => {
  it('lee la clave vieja, la copia a la nueva y la borra', () => {
    const storage = mockStorage({
      [LEGACY_SPLIT_KEY]: JSON.stringify({ editor: 60, preview: 40 }),
    })
    vi.stubGlobal('localStorage', storage)
    expect(loadSplitLayout()).toEqual({ editor: 60, preview: 40 })
    expect(JSON.parse(storage.store[SPLIT_KEY])).toEqual({
      editor: 60,
      preview: 40,
    })
    expect(LEGACY_SPLIT_KEY in storage.store).toBe(false)
  })
})
