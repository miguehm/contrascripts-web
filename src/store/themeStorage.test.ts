// src/store/themeStorage.test.ts — persistencia del tema (§8).

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_THEME,
  THEME_KEY,
  loadTheme,
  saveTheme,
} from '@/store/themeStorage'

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

describe('loadTheme', () => {
  it('sin localStorage o sin dato → light', () => {
    expect(loadTheme()).toBe(DEFAULT_THEME)
    vi.stubGlobal('localStorage', mockStorage())
    expect(loadTheme()).toBe('light')
  })

  it('lee dark y light válidos', () => {
    vi.stubGlobal('localStorage', mockStorage({ [THEME_KEY]: '"dark"' }))
    expect(loadTheme()).toBe('dark')
    vi.stubGlobal('localStorage', mockStorage({ [THEME_KEY]: '"light"' }))
    expect(loadTheme()).toBe('light')
  })

  it('JSON corrupto o valor inesperado → light sin lanzar', () => {
    vi.stubGlobal('localStorage', mockStorage({ [THEME_KEY]: '{no-json' }))
    expect(loadTheme()).toBe('light')
    vi.stubGlobal(
      'localStorage',
      mockStorage({ [THEME_KEY]: JSON.stringify('system') }),
    )
    expect(loadTheme()).toBe('light')
  })
})

describe('saveTheme', () => {
  it('persiste como JSON sin lanzar', () => {
    const storage = mockStorage()
    vi.stubGlobal('localStorage', storage)
    saveTheme('dark')
    expect(storage.store[THEME_KEY]).toBe('"dark"')
  })

  it('un error de setItem no tumba la UI', () => {
    const storage = mockStorage()
    storage.setItem.mockImplementation(() => {
      throw new Error('boom')
    })
    vi.stubGlobal('localStorage', storage)
    expect(() => saveTheme('dark')).not.toThrow()
  })
})
