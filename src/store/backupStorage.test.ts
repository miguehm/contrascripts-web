// src/store/backupStorage.test.ts — fecha de última copia (punto 12).

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  LAST_BACKUP_KEY,
  loadLastBackup,
  saveLastBackup,
} from '@/store/backupStorage'

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

describe('backupStorage', () => {
  it('null sin dato o con dato inválido', () => {
    vi.stubGlobal('localStorage', mockStorage())
    expect(loadLastBackup()).toBe(null)
    vi.stubGlobal('localStorage', mockStorage({ [LAST_BACKUP_KEY]: '"ayer"' }))
    expect(loadLastBackup()).toBe(null)
  })

  it('round-trip de la fecha', () => {
    const storage = mockStorage()
    vi.stubGlobal('localStorage', storage)
    saveLastBackup(123)
    expect(loadLastBackup()).toBe(123)
  })

  it('nunca lanza con cuota llena', () => {
    const storage = mockStorage()
    storage.setItem.mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })
    vi.stubGlobal('localStorage', storage)
    expect(() => saveLastBackup(1)).not.toThrow()
    expect(loadLastBackup()).toBe(null)
  })
})
