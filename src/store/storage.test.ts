// src/store/storage.test.ts — persistencia de §6 con localStorage mockeado.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Script } from '@/types/Script'
import { SCRIPTS_KEY, loadScripts, saveScripts } from '@/store/storage'

function script(over: Partial<Script> = {}): Script {
  return {
    id: 's1',
    title: 'T',
    text: 'INT. CASA - DÍA',
    updatedAt: 1_700_000_000_000,
    ...over,
  }
}

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

describe('loadScripts', () => {
  it('devuelve [] sin localStorage o sin dato', () => {
    expect(loadScripts()).toEqual([])
    vi.stubGlobal('localStorage', mockStorage())
    expect(loadScripts()).toEqual([])
  })

  it('lee la lista válida', () => {
    const list = [script(), script({ id: 's2', title: 'Otro' })]
    vi.stubGlobal(
      'localStorage',
      mockStorage({ [SCRIPTS_KEY]: JSON.stringify(list) }),
    )
    expect(loadScripts()).toEqual(list)
  })

  it('un JSON corrupto no tumba el boot: devuelve []', () => {
    vi.stubGlobal('localStorage', mockStorage({ [SCRIPTS_KEY]: '{no-json' }))
    expect(loadScripts()).toEqual([])
  })

  it('forma inesperada (no array / items inválidos) → [] o filtrado', () => {
    vi.stubGlobal(
      'localStorage',
      mockStorage({ [SCRIPTS_KEY]: JSON.stringify({ id: 'x' }) }),
    )
    expect(loadScripts()).toEqual([])

    vi.stubGlobal(
      'localStorage',
      mockStorage({
        [SCRIPTS_KEY]: JSON.stringify([
          script(),
          { id: '', title: 1, text: null },
          null,
        ]),
      }),
    )
    expect(loadScripts()).toEqual([script()])
  })
})

describe('saveScripts', () => {
  it('persiste como JSON y reporta quotaExceeded false', () => {
    const storage = mockStorage()
    vi.stubGlobal('localStorage', storage)
    const list = [script()]
    expect(saveScripts(list)).toEqual({ quotaExceeded: false })
    expect(storage.store[SCRIPTS_KEY]).toBe(JSON.stringify(list))
  })

  it('QuotaExceededError → { quotaExceeded: true } sin lanzar', () => {
    const err = new DOMException('full', 'QuotaExceededError')
    const storage = mockStorage()
    storage.setItem.mockImplementation(() => {
      throw err
    })
    vi.stubGlobal('localStorage', storage)
    expect(saveScripts([script()])).toEqual({ quotaExceeded: true })
  })

  it('otro error de setItem no se confunde con falta de cuota', () => {
    const storage = mockStorage()
    storage.setItem.mockImplementation(() => {
      throw new Error('boom')
    })
    vi.stubGlobal('localStorage', storage)
    expect(saveScripts([script()])).toEqual({ quotaExceeded: false })
  })
})
