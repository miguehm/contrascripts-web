// src/store/keyMigration.test.ts — migración de claves legacy.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { dropLegacyKey, readMigratedKey } from '@/store/keyMigration'

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

describe('readMigratedKey', () => {
  it('lee la clave nueva cuando existe (no toca la legacy)', () => {
    const storage = mockStorage({ new: 'n', old: 'o' })
    vi.stubGlobal('localStorage', storage)
    expect(readMigratedKey('new', 'old')).toBe('n')
    expect(storage.store.old).toBe('o')
  })

  it('migra desde legacy: copia, borra la vieja y devuelve el valor', () => {
    const storage = mockStorage({ old: 'o' })
    vi.stubGlobal('localStorage', storage)
    expect(readMigratedKey('new', 'old')).toBe('o')
    expect(storage.store.new).toBe('o')
    expect('old' in storage.store).toBe(false)
  })

  it('sin ninguna clave → null', () => {
    vi.stubGlobal('localStorage', mockStorage())
    expect(readMigratedKey('new', 'old')).toBeNull()
  })

  it('nunca lanza sin localStorage', () => {
    expect(readMigratedKey('new', 'old')).toBeNull()
    expect(() => dropLegacyKey('old')).not.toThrow()
  })
})
