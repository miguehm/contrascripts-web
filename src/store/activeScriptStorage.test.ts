// src/store/activeScriptStorage.test.ts — persistencia del guion activo
// (REVIEW.md punto 3).

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ACTIVE_ID_KEY,
  loadActiveId,
  saveActiveId,
} from '@/store/activeScriptStorage'

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

describe('loadActiveId', () => {
  it('sin localStorage o sin dato → null', () => {
    expect(loadActiveId()).toBeNull()
    vi.stubGlobal('localStorage', mockStorage())
    expect(loadActiveId()).toBeNull()
  })

  it('lee un id válido', () => {
    vi.stubGlobal('localStorage', mockStorage({ [ACTIVE_ID_KEY]: '"s1"' }))
    expect(loadActiveId()).toBe('s1')
  })

  it('JSON corrupto o valor inesperado → null sin lanzar', () => {
    vi.stubGlobal('localStorage', mockStorage({ [ACTIVE_ID_KEY]: '{no-json' }))
    expect(loadActiveId()).toBeNull()
    vi.stubGlobal(
      'localStorage',
      mockStorage({ [ACTIVE_ID_KEY]: JSON.stringify(42) }),
    )
    expect(loadActiveId()).toBeNull()
    vi.stubGlobal(
      'localStorage',
      mockStorage({ [ACTIVE_ID_KEY]: JSON.stringify('') }),
    )
    expect(loadActiveId()).toBeNull()
  })
})

describe('saveActiveId', () => {
  it('persiste como JSON', () => {
    const storage = mockStorage()
    vi.stubGlobal('localStorage', storage)
    saveActiveId('s2')
    expect(storage.store[ACTIVE_ID_KEY]).toBe('"s2"')
  })

  it('null borra la clave', () => {
    const storage = mockStorage({ [ACTIVE_ID_KEY]: '"s1"' })
    vi.stubGlobal('localStorage', storage)
    saveActiveId(null)
    expect(storage.store[ACTIVE_ID_KEY]).toBeUndefined()
  })

  it('un error de setItem no tumba la UI', () => {
    const storage = mockStorage()
    storage.setItem.mockImplementation(() => {
      throw new Error('boom')
    })
    vi.stubGlobal('localStorage', storage)
    expect(() => saveActiveId('s1')).not.toThrow()
  })
})
