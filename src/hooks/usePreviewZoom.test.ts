// src/hooks/usePreviewZoom.test.ts — modelo discreto + gestos continuos.
// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ZOOM_MAX,
  ZOOM_MIN,
  clampZoom,
  snapZoom,
  usePreviewZoom,
} from './usePreviewZoom'

beforeEach(() => {
  // jsdom sin URL es origen opaco (sin localStorage real): stub en memoria.
  const store: Record<string, string> = {}
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
})

describe('clampZoom/snapZoom', () => {
  it('sujeta al rango y rechaza no-finitos', () => {
    expect(clampZoom(99)).toBe(ZOOM_MAX)
    expect(clampZoom(0.01)).toBe(ZOOM_MIN)
    expect(clampZoom(NaN)).toBe(1)
    expect(clampZoom(1.5)).toBe(1.5)
  })

  it('ajusta al escalón más cercano', () => {
    expect(snapZoom(1.22)).toBe(1.25)
    expect(snapZoom(1.1)).toBe(1)
    expect(snapZoom(2.4)).toBe(2.5)
  })
})

describe('usePreviewZoom', () => {
  it('arranca al 100% y avanza por escalones', () => {
    const { result } = renderHook(() => usePreviewZoom())
    expect(result.current.scale).toBe(1)
    act(() => result.current.zoomIn())
    expect(result.current.scale).toBe(1.25)
    act(() => result.current.zoomOut())
    expect(result.current.scale).toBe(1)
  })

  it('setScale acepta continuo y snap lo redondea', () => {
    const { result } = renderHook(() => usePreviewZoom())
    act(() => result.current.setScale(1.22))
    expect(result.current.scale).toBeCloseTo(1.22)
    act(() => result.current.snap())
    expect(result.current.scale).toBe(1.25)
  })

  it('reset vuelve al 100% y persiste la escala', () => {
    const { result } = renderHook(() => usePreviewZoom())
    act(() => result.current.zoomIn())
    act(() => result.current.reset())
    expect(result.current.scale).toBe(1)
    const { result: second } = renderHook(() => usePreviewZoom())
    expect(second.current.scale).toBe(1)
  })

  it('persiste el zoom entre montajes sin perder collapsed', () => {
    const { result } = renderHook(() => usePreviewZoom())
    act(() => result.current.setScale(2))
    const { result: second } = renderHook(() => usePreviewZoom())
    // `snap` en el arranque lo deja en el escalón exacto.
    expect(second.current.scale).toBe(2)
  })

  it('respeta los topes', () => {
    const { result } = renderHook(() => usePreviewZoom())
    act(() => result.current.setScale(99))
    expect(result.current.scale).toBe(ZOOM_MAX)
    expect(result.current.canZoomIn).toBe(false)
    act(() => result.current.setScale(-5))
    expect(result.current.scale).toBe(ZOOM_MIN)
    expect(result.current.canZoomOut).toBe(false)
  })
})
