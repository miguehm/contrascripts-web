// src/store/editorStorage.test.ts — prefs del editor (REVIEW.md punto 9).

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_FONT_SIZE,
  DEFAULT_LINE_HEIGHT,
  EDITOR_KEY,
  FONT_SIZE_STEPS,
  LINE_HEIGHT_STEPS,
  clampFontSize,
  clampLineHeight,
  loadEditorPrefs,
  saveEditorPrefs,
  stepFontSize,
} from '@/store/editorStorage'

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

describe('loadEditorPrefs', () => {
  it('sin localStorage o sin dato → defaults', () => {
    expect(loadEditorPrefs()).toEqual({
      fontSize: DEFAULT_FONT_SIZE,
      lineHeight: DEFAULT_LINE_HEIGHT,
    })
    vi.stubGlobal('localStorage', mockStorage())
    expect(loadEditorPrefs()).toEqual({
      fontSize: DEFAULT_FONT_SIZE,
      lineHeight: DEFAULT_LINE_HEIGHT,
    })
  })

  it('lee prefs válidas', () => {
    vi.stubGlobal(
      'localStorage',
      mockStorage({
        [EDITOR_KEY]: JSON.stringify({ fontSize: 18, lineHeight: 1.9 }),
      }),
    )
    expect(loadEditorPrefs()).toEqual({ fontSize: 18, lineHeight: 1.9 })
  })

  it('cada campo inválido cae a su default sin descartar el otro', () => {
    vi.stubGlobal(
      'localStorage',
      mockStorage({
        [EDITOR_KEY]: JSON.stringify({ fontSize: 'grande', lineHeight: 1.4 }),
      }),
    )
    expect(loadEditorPrefs()).toEqual({
      fontSize: DEFAULT_FONT_SIZE,
      lineHeight: 1.4,
    })
  })

  it('JSON corrupto o forma inesperada → defaults sin lanzar', () => {
    vi.stubGlobal('localStorage', mockStorage({ [EDITOR_KEY]: '{no-json' }))
    expect(loadEditorPrefs()).toEqual({
      fontSize: DEFAULT_FONT_SIZE,
      lineHeight: DEFAULT_LINE_HEIGHT,
    })
    vi.stubGlobal(
      'localStorage',
      mockStorage({ [EDITOR_KEY]: JSON.stringify([1, 2]) }),
    )
    expect(loadEditorPrefs()).toEqual({
      fontSize: DEFAULT_FONT_SIZE,
      lineHeight: DEFAULT_LINE_HEIGHT,
    })
  })
})

describe('saveEditorPrefs', () => {
  it('persiste como JSON sin lanzar', () => {
    const storage = mockStorage()
    vi.stubGlobal('localStorage', storage)
    saveEditorPrefs({ fontSize: 20, lineHeight: 1.4 })
    expect(storage.store[EDITOR_KEY]).toBe(
      JSON.stringify({ fontSize: 20, lineHeight: 1.4 }),
    )
  })
})

describe('clamp/step', () => {
  it('clampFontSize sujeta al rango de escalones', () => {
    expect(clampFontSize(Number.NaN)).toBe(DEFAULT_FONT_SIZE)
    expect(clampFontSize(1)).toBe(FONT_SIZE_STEPS[0])
    expect(clampFontSize(999)).toBe(FONT_SIZE_STEPS[FONT_SIZE_STEPS.length - 1])
    expect(clampFontSize(18)).toBe(18)
  })

  it('clampLineHeight sujeta a su rango', () => {
    expect(clampLineHeight(Number.NaN)).toBe(DEFAULT_LINE_HEIGHT)
    expect(clampLineHeight(1)).toBe(LINE_HEIGHT_STEPS[0])
    expect(clampLineHeight(9)).toBe(
      LINE_HEIGHT_STEPS[LINE_HEIGHT_STEPS.length - 1],
    )
  })

  it('stepFontSize recorre escalones sin salirse', () => {
    expect(stepFontSize(16, 1)).toBe(18)
    expect(stepFontSize(15, 1)).toBe(16)
    expect(stepFontSize(20, 1)).toBe(20)
    expect(stepFontSize(14, -1)).toBe(14)
  })
})
