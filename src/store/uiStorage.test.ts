// src/store/uiStorage.test.ts — persistencia de prefs UI (sidebar + zoom).

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_ZOOM,
  UI_KEY,
  loadFitWidth,
  loadUi,
  loadZoom,
  saveFitWidth,
  saveUi,
  saveZoom,
} from '@/store/uiStorage'

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

describe('loadUi', () => {
  it('sin localStorage o sin dato → defaults', () => {
    expect(loadUi()).toEqual({ collapsed: false, zoom: DEFAULT_ZOOM })
    vi.stubGlobal('localStorage', mockStorage())
    expect(loadUi()).toEqual({ collapsed: false, zoom: DEFAULT_ZOOM })
  })

  it('lee collapsed + zoom válidos', () => {
    vi.stubGlobal(
      'localStorage',
      mockStorage({
        [UI_KEY]: JSON.stringify({ collapsed: true, zoom: 1.5 }),
      }),
    )
    expect(loadUi()).toEqual({ collapsed: true, zoom: 1.5 })
  })

  it('prefs viejas sin zoom → zoom por defecto sin perder collapsed', () => {
    vi.stubGlobal(
      'localStorage',
      mockStorage({ [UI_KEY]: JSON.stringify({ collapsed: true }) }),
    )
    expect(loadUi()).toEqual({ collapsed: true, zoom: DEFAULT_ZOOM })
  })

  it('JSON corrupto o forma inesperada → defecto sin lanzar', () => {
    vi.stubGlobal('localStorage', mockStorage({ [UI_KEY]: '{no-json' }))
    expect(loadUi()).toEqual({ collapsed: false, zoom: DEFAULT_ZOOM })
    vi.stubGlobal(
      'localStorage',
      mockStorage({ [UI_KEY]: JSON.stringify({ collapsed: 'yes' }) }),
    )
    expect(loadUi()).toEqual({ collapsed: false, zoom: DEFAULT_ZOOM })
  })

  it('zoom inválido → cae al defecto sin descartar collapsed', () => {
    vi.stubGlobal(
      'localStorage',
      mockStorage({
        [UI_KEY]: JSON.stringify({ collapsed: true, zoom: 'grande' }),
      }),
    )
    expect(loadUi()).toEqual({ collapsed: true, zoom: DEFAULT_ZOOM })
  })
})

describe('saveUi', () => {
  it('persiste como JSON sin lanzar', () => {
    const storage = mockStorage()
    vi.stubGlobal('localStorage', storage)
    saveUi({ collapsed: true, zoom: 2 })
    expect(storage.store[UI_KEY]).toBe(
      JSON.stringify({ collapsed: true, zoom: 2 }),
    )
  })

  it('un error de setItem no tumba la UI', () => {
    const storage = mockStorage()
    storage.setItem.mockImplementation(() => {
      throw new Error('boom')
    })
    vi.stubGlobal('localStorage', storage)
    expect(() => saveUi({ collapsed: true })).not.toThrow()
  })
})

describe('zoom (loadZoom/saveZoom)', () => {
  it('saveZoom no pisa collapsed (read-modify-write)', () => {
    const storage = mockStorage({
      [UI_KEY]: JSON.stringify({ collapsed: true, zoom: 1 }),
    })
    vi.stubGlobal('localStorage', storage)
    saveZoom(2)
    expect(loadUi()).toEqual({ collapsed: true, zoom: 2 })
    expect(loadZoom()).toBe(2)
  })

  it('loadZoom sin dato → defecto', () => {
    vi.stubGlobal('localStorage', mockStorage())
    expect(loadZoom()).toBe(DEFAULT_ZOOM)
  })
})

describe('fitWidth (REVIEW.md punto 1)', () => {
  it('sin dato o prefs viejas → null (el hook decide por layout)', () => {
    vi.stubGlobal('localStorage', mockStorage())
    expect(loadFitWidth()).toBeNull()
    vi.stubGlobal(
      'localStorage',
      mockStorage({ [UI_KEY]: JSON.stringify({ collapsed: true, zoom: 1.5 }) }),
    )
    expect(loadFitWidth()).toBeNull()
  })

  it('lee y persiste sin pisar collapsed ni zoom', () => {
    const storage = mockStorage({
      [UI_KEY]: JSON.stringify({ collapsed: true, zoom: 1.25 }),
    })
    vi.stubGlobal('localStorage', storage)
    saveFitWidth(true)
    expect(loadFitWidth()).toBe(true)
    expect(loadUi()).toEqual({ collapsed: true, zoom: 1.25, fitWidth: true })
    saveFitWidth(false)
    expect(loadFitWidth()).toBe(false)
    expect(loadUi()).toEqual({ collapsed: true, zoom: 1.25, fitWidth: false })
  })

  it('valor inválido o JSON roto → null sin lanzar', () => {
    vi.stubGlobal(
      'localStorage',
      mockStorage({
        [UI_KEY]: JSON.stringify({ collapsed: true, fitWidth: 'sí' }),
      }),
    )
    expect(loadFitWidth()).toBeNull()
    vi.stubGlobal('localStorage', mockStorage({ [UI_KEY]: '{no-json' }))
    expect(loadFitWidth()).toBeNull()
  })
})
