// src/store/warningsStorage.test.ts — persistencia de la solapa de avisos.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  LEGACY_WARNINGS_KEY,
  WARNINGS_KEY,
  loadWarningsOpen,
  saveWarningsOpen,
} from '@/store/warningsStorage'

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

describe('loadWarningsOpen', () => {
  it('sin dato → null (el hook aplica default cerrado)', () => {
    expect(loadWarningsOpen()).toBeNull()
    vi.stubGlobal('localStorage', mockStorage())
    expect(loadWarningsOpen()).toBeNull()
  })

  it('lee open true/false válidos', () => {
    vi.stubGlobal(
      'localStorage',
      mockStorage({ [WARNINGS_KEY]: JSON.stringify({ open: true }) }),
    )
    expect(loadWarningsOpen()).toBe(true)
  })

  it('JSON corrupto o forma inesperada → null sin lanzar', () => {
    vi.stubGlobal('localStorage', mockStorage({ [WARNINGS_KEY]: '{no-json' }))
    expect(loadWarningsOpen()).toBeNull()
    vi.stubGlobal(
      'localStorage',
      mockStorage({ [WARNINGS_KEY]: JSON.stringify({ open: 'yes' }) }),
    )
    expect(loadWarningsOpen()).toBeNull()
  })
})

describe('saveWarningsOpen', () => {
  it('persiste como JSON sin lanzar', () => {
    const storage = mockStorage()
    vi.stubGlobal('localStorage', storage)
    saveWarningsOpen(true)
    expect(storage.store[WARNINGS_KEY]).toBe(JSON.stringify({ open: true }))
  })

  it('un error de setItem no tumba la UI', () => {
    const storage = mockStorage()
    storage.setItem.mockImplementation(() => {
      throw new Error('boom')
    })
    vi.stubGlobal('localStorage', storage)
    expect(() => saveWarningsOpen(false)).not.toThrow()
  })
})

describe('migración legacy guion.* → contrascripts.*', () => {
  it('lee la clave vieja, la copia a la nueva y la borra', () => {
    const storage = mockStorage({
      [LEGACY_WARNINGS_KEY]: JSON.stringify({ open: true }),
    })
    vi.stubGlobal('localStorage', storage)
    expect(loadWarningsOpen()).toBe(true)
    expect(storage.store[WARNINGS_KEY]).toBe(JSON.stringify({ open: true }))
    expect(LEGACY_WARNINGS_KEY in storage.store).toBe(false)
  })
})
