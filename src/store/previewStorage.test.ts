// src/store/previewStorage.test.ts — persistencia del preview desplegable.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  PREVIEW_KEY,
  loadPreviewExpanded,
  loadPreviewOpen,
  savePreviewExpanded,
  savePreviewOpen,
} from '@/store/previewStorage'

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

describe('loadPreviewOpen', () => {
  it('sin dato → null (el hook decide por layout)', () => {
    expect(loadPreviewOpen()).toBeNull()
    vi.stubGlobal('localStorage', mockStorage())
    expect(loadPreviewOpen()).toBeNull()
  })

  it('lee open true/false válidos', () => {
    vi.stubGlobal(
      'localStorage',
      mockStorage({ [PREVIEW_KEY]: JSON.stringify({ open: false }) }),
    )
    expect(loadPreviewOpen()).toBe(false)
  })

  it('JSON corrupto o forma inesperada → null sin lanzar', () => {
    vi.stubGlobal('localStorage', mockStorage({ [PREVIEW_KEY]: '{no-json' }))
    expect(loadPreviewOpen()).toBeNull()
    vi.stubGlobal(
      'localStorage',
      mockStorage({ [PREVIEW_KEY]: JSON.stringify({ open: 'yes' }) }),
    )
    expect(loadPreviewOpen()).toBeNull()
  })
})

describe('savePreviewOpen', () => {
  it('persiste como JSON sin lanzar', () => {
    const storage = mockStorage()
    vi.stubGlobal('localStorage', storage)
    savePreviewOpen(false)
    expect(storage.store[PREVIEW_KEY]).toBe(JSON.stringify({ open: false }))
  })

  it('un error de setItem no tumba la UI', () => {
    const storage = mockStorage()
    storage.setItem.mockImplementation(() => {
      throw new Error('boom')
    })
    vi.stubGlobal('localStorage', storage)
    expect(() => savePreviewOpen(true)).not.toThrow()
  })

  it('no pisa expanded al guardar open (read-modify-write)', () => {
    const storage = mockStorage({
      [PREVIEW_KEY]: JSON.stringify({ open: true, expanded: true }),
    })
    vi.stubGlobal('localStorage', storage)
    savePreviewOpen(false)
    expect(storage.store[PREVIEW_KEY]).toBe(
      JSON.stringify({ open: false, expanded: true }),
    )
  })
})

describe('loadPreviewExpanded', () => {
  it('sin dato o prefs viejas sin expanded → false', () => {
    expect(loadPreviewExpanded()).toBe(false)
    vi.stubGlobal('localStorage', mockStorage())
    expect(loadPreviewExpanded()).toBe(false)
    vi.stubGlobal(
      'localStorage',
      mockStorage({ [PREVIEW_KEY]: JSON.stringify({ open: true }) }),
    )
    expect(loadPreviewExpanded()).toBe(false)
  })

  it('lee expanded true/false válidos', () => {
    vi.stubGlobal(
      'localStorage',
      mockStorage({
        [PREVIEW_KEY]: JSON.stringify({ open: true, expanded: true }),
      }),
    )
    expect(loadPreviewExpanded()).toBe(true)
  })

  it('JSON corrupto o forma inesperada → false sin lanzar', () => {
    vi.stubGlobal('localStorage', mockStorage({ [PREVIEW_KEY]: '{no-json' }))
    expect(loadPreviewExpanded()).toBe(false)
    vi.stubGlobal(
      'localStorage',
      mockStorage({
        [PREVIEW_KEY]: JSON.stringify({ open: true, expanded: 'yes' }),
      }),
    )
    expect(loadPreviewExpanded()).toBe(false)
  })
})

describe('savePreviewExpanded', () => {
  it('persiste expanded sin pisar open', () => {
    const storage = mockStorage({
      [PREVIEW_KEY]: JSON.stringify({ open: false }),
    })
    vi.stubGlobal('localStorage', storage)
    savePreviewExpanded(true)
    expect(storage.store[PREVIEW_KEY]).toBe(
      JSON.stringify({ open: false, expanded: true }),
    )
  })

  it('un error de setItem no tumba la UI', () => {
    const storage = mockStorage()
    storage.setItem.mockImplementation(() => {
      throw new Error('boom')
    })
    vi.stubGlobal('localStorage', storage)
    expect(() => savePreviewExpanded(true)).not.toThrow()
  })
})
