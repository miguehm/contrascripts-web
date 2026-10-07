// src/store/storage.test.ts — persistencia de §6 con localStorage mockeado.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Script } from '@/types/Script'
import {
  CORRUPT_PREFIX,
  LEGACY_CORRUPT_PREFIX,
  LEGACY_SCRIPTS_KEY,
  SCRIPTS_KEY,
  loadScripts,
  loadScriptsDetailed,
  migrateScripts,
  quarantineCorrupt,
  saveScripts,
} from '@/store/storage'

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

  it('detailed distingue corrupto de vacío y cuenta descartados', () => {
    vi.stubGlobal('localStorage', mockStorage({ [SCRIPTS_KEY]: '{no-json' }))
    const corrupt = loadScriptsDetailed()
    expect(corrupt.scripts).toEqual([])
    expect(corrupt.corruptRaw).toBe('{no-json')
    expect(corrupt.dropped).toBe(0)

    vi.stubGlobal('localStorage', mockStorage())
    const empty = loadScriptsDetailed()
    expect(empty).toEqual({ scripts: [], corruptRaw: null, dropped: 0 })
  })

  it('migrateScripts acepta v0 sin updatedAt y cuenta lo irreconstruible', () => {
    const legacy = { id: 's9', title: 'Viejo', text: 'x' }
    const { scripts, dropped } = migrateScripts([script(), legacy, null])
    expect(dropped).toBe(1)
    expect(scripts).toHaveLength(2)
    expect(scripts.find((s) => s.id === 's9')?.updatedAt).toBe(0)
  })

  it('quarantineCorrupt guarda el raw sin lanzar y devuelve clave', () => {
    const storage = mockStorage()
    vi.stubGlobal('localStorage', storage)
    const key = quarantineCorrupt('{no-json')
    expect(key?.startsWith(CORRUPT_PREFIX)).toBe(true)
    expect(key ? storage.store[key] : null).toBe('{no-json')
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
  it('persiste como JSON y reporta sin errores', () => {
    const storage = mockStorage()
    vi.stubGlobal('localStorage', storage)
    const list = [script()]
    expect(saveScripts(list)).toEqual({
      quotaExceeded: false,
      verifyFailed: false,
    })
    expect(storage.store[SCRIPTS_KEY]).toBe(JSON.stringify(list))
  })

  it('read-back distinto → verifyFailed true', () => {
    const storage = mockStorage()
    storage.getItem.mockImplementation(() => 'otro-valor')
    vi.stubGlobal('localStorage', storage)
    expect(saveScripts([script()])).toEqual({
      quotaExceeded: false,
      verifyFailed: true,
    })
  })

  it('QuotaExceededError → { quotaExceeded: true } sin lanzar', () => {
    const err = new DOMException('full', 'QuotaExceededError')
    const storage = mockStorage()
    storage.setItem.mockImplementation(() => {
      throw err
    })
    vi.stubGlobal('localStorage', storage)
    expect(saveScripts([script()])).toEqual({
      quotaExceeded: true,
      verifyFailed: false,
    })
  })

  it('otro error de setItem no se confunde con falta de cuota', () => {
    const storage = mockStorage()
    storage.setItem.mockImplementation(() => {
      throw new Error('boom')
    })
    vi.stubGlobal('localStorage', storage)
    expect(saveScripts([script()])).toEqual({
      quotaExceeded: false,
      verifyFailed: false,
    })
  })
})

describe('migración legacy guion.* → contrascripts.*', () => {
  it('lee la clave vieja, la copia a la nueva y la borra', () => {
    const storage = mockStorage({
      [LEGACY_SCRIPTS_KEY]: JSON.stringify([script()]),
    })
    vi.stubGlobal('localStorage', storage)
    expect(loadScripts()).toHaveLength(1)
    expect(JSON.parse(storage.store[SCRIPTS_KEY])).toHaveLength(1)
    expect(LEGACY_SCRIPTS_KEY in storage.store).toBe(false)
  })

  it('las entradas nuevas de cuarentena usan el prefijo nuevo', () => {
    const storage = mockStorage({
      [`${LEGACY_CORRUPT_PREFIX}abc`]: '{no-json',
    })
    vi.stubGlobal('localStorage', storage)
    // El mock no implementa length/key: no hay dedup y se guarda igual.
    expect(quarantineCorrupt('{otro-daño}')).toContain(CORRUPT_PREFIX)
  })
})
