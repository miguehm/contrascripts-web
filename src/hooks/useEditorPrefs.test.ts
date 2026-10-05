// src/hooks/useEditorPrefs.test.ts — prefs del editor (REVIEW.md punto 9).
// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EDITOR_KEY } from '@/store/editorStorage'
import { useEditorPrefs } from './useEditorPrefs'

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

describe('useEditorPrefs', () => {
  it('arranca con defaults sin dato guardado', () => {
    stubStorage()
    const { result } = renderHook(() => useEditorPrefs())
    expect(result.current.fontSize).toBe(16)
    expect(result.current.lineHeight).toBe(1.625)
  })

  it('respeta la preferencia guardada', () => {
    stubStorage({
      [EDITOR_KEY]: JSON.stringify({ fontSize: 18, lineHeight: 1.4 }),
    })
    const { result } = renderHook(() => useEditorPrefs())
    expect(result.current.fontSize).toBe(18)
    expect(result.current.lineHeight).toBe(1.4)
  })

  it('stepFont sube/baja por escalones y persiste', () => {
    const store = stubStorage()
    const { result } = renderHook(() => useEditorPrefs())
    act(() => result.current.stepFont(1))
    expect(result.current.fontSize).toBe(18)
    expect(store[EDITOR_KEY]).toBe(
      JSON.stringify({ fontSize: 18, lineHeight: 1.625 }),
    )
    act(() => result.current.stepFont(-1))
    expect(result.current.fontSize).toBe(16)
  })

  it('los topes de escalón deshabilitan el paso', () => {
    stubStorage({ [EDITOR_KEY]: JSON.stringify({ fontSize: 14 }) })
    const { result } = renderHook(() => useEditorPrefs())
    expect(result.current.canDecreaseFontSize).toBe(false)
    expect(result.current.canIncreaseFontSize).toBe(true)
  })

  it('setLineHeight persiste el interlineado', () => {
    const store = stubStorage()
    const { result } = renderHook(() => useEditorPrefs())
    act(() => result.current.setLineHeight(1.9))
    expect(result.current.lineHeight).toBe(1.9)
    expect(store[EDITOR_KEY]).toBe(
      JSON.stringify({ fontSize: 16, lineHeight: 1.9 }),
    )
  })
})
