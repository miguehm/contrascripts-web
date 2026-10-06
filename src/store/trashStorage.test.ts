// src/store/trashStorage.test.ts — papelera punto 12 con localStorage mockeado.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TRASH_KEY, loadTrash, saveTrash } from '@/store/trashStorage'

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

describe('loadTrash', () => {
  it('vacío sin dato', () => {
    vi.stubGlobal('localStorage', mockStorage())
    expect(loadTrash()).toEqual([])
  })

  it('JSON roto → [] sin lanzar', () => {
    vi.stubGlobal('localStorage', mockStorage({ [TRASH_KEY]: '{no-json' }))
    expect(loadTrash()).toEqual([])
  })

  it('filtra entradas inválidas', () => {
    const good = {
      script: { id: 's1', title: 'T', text: 'x', updatedAt: 1 },
      deletedAt: 2,
    }
    vi.stubGlobal(
      'localStorage',
      mockStorage({
        [TRASH_KEY]: JSON.stringify([good, null, { script: { id: '' } }]),
      }),
    )
    expect(loadTrash()).toEqual([good])
  })
})

describe('saveTrash', () => {
  it('persiste y nunca lanza con cuota llena', () => {
    const storage = mockStorage()
    storage.setItem.mockImplementationOnce(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })
    vi.stubGlobal('localStorage', storage)
    expect(() =>
      saveTrash([
        {
          script: { id: 's1', title: 'T', text: 'x', updatedAt: 1 },
          deletedAt: 2,
        },
      ]),
    ).not.toThrow()
  })
})
