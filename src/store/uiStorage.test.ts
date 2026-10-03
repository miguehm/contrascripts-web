// src/store/uiStorage.test.ts — persistencia del colapso del sidebar.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UI_KEY, loadUi, saveUi } from '@/store/uiStorage'

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
  it('sin localStorage o sin dato → expandido', () => {
    expect(loadUi()).toEqual({ collapsed: false })
    vi.stubGlobal('localStorage', mockStorage())
    expect(loadUi()).toEqual({ collapsed: false })
  })

  it('lee collapsed true/false válidos', () => {
    vi.stubGlobal(
      'localStorage',
      mockStorage({ [UI_KEY]: JSON.stringify({ collapsed: true }) }),
    )
    expect(loadUi()).toEqual({ collapsed: true })
  })

  it('JSON corrupto o forma inesperada → defecto sin lanzar', () => {
    vi.stubGlobal('localStorage', mockStorage({ [UI_KEY]: '{no-json' }))
    expect(loadUi()).toEqual({ collapsed: false })
    vi.stubGlobal(
      'localStorage',
      mockStorage({ [UI_KEY]: JSON.stringify({ collapsed: 'yes' }) }),
    )
    expect(loadUi()).toEqual({ collapsed: false })
  })
})

describe('saveUi', () => {
  it('persiste como JSON sin lanzar', () => {
    const storage = mockStorage()
    vi.stubGlobal('localStorage', storage)
    saveUi({ collapsed: true })
    expect(storage.store[UI_KEY]).toBe(JSON.stringify({ collapsed: true }))
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
