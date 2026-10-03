// src/hooks/useWarningsOpen.test.ts — solapa de avisos (REVIEW.md 4).
// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WARNINGS_KEY } from '@/store/warningsStorage'
import { useWarningsOpen } from './useWarningsOpen'

function stubStorage(initial: Record<string, string> = {}) {
  const store: Record<string, string> = { ...initial }
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => {
      store[k] = v
    },
    removeItem: (k: string) => {
      delete store[k]
    },
    clear: () => {
      for (const k of Object.keys(store)) delete store[k]
    },
  })
  return store
}

beforeEach(() => {
  vi.unstubAllGlobals()
})

describe('useWarningsOpen', () => {
  it('arranca cerrado sin dato guardado', () => {
    stubStorage()
    const { result } = renderHook(() => useWarningsOpen())
    expect(result.current.open).toBe(false)
  })

  it('respeta la preferencia guardada', () => {
    stubStorage({ [WARNINGS_KEY]: JSON.stringify({ open: true }) })
    const { result } = renderHook(() => useWarningsOpen())
    expect(result.current.open).toBe(true)
  })

  it('dato corrupto → cerrado sin tumbar el boot', () => {
    stubStorage({ [WARNINGS_KEY]: '{no-json' })
    const { result } = renderHook(() => useWarningsOpen())
    expect(result.current.open).toBe(false)
  })

  it('expone si había preferencia guardada', () => {
    stubStorage()
    expect(renderHook(() => useWarningsOpen()).result.current.isStored).toBe(
      false,
    )
    vi.unstubAllGlobals()
    stubStorage({ [WARNINGS_KEY]: JSON.stringify({ open: false }) })
    expect(renderHook(() => useWarningsOpen()).result.current.isStored).toBe(
      true,
    )
  })

  it('toggle persiste entre montajes', () => {
    const store = stubStorage()
    const { result } = renderHook(() => useWarningsOpen())
    act(() => result.current.toggle())
    expect(result.current.open).toBe(true)
    expect(store[WARNINGS_KEY]).toBe(JSON.stringify({ open: true }))
    const { result: second } = renderHook(() => useWarningsOpen())
    expect(second.current.open).toBe(true)
  })

  it('setOpen(false) persiste el cierre manual', () => {
    stubStorage({ [WARNINGS_KEY]: JSON.stringify({ open: true }) })
    const { result } = renderHook(() => useWarningsOpen())
    act(() => result.current.setOpen(false))
    expect(result.current.open).toBe(false)
    const { result: second } = renderHook(() => useWarningsOpen())
    expect(second.current.open).toBe(false)
  })
})
