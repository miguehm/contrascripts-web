// src/hooks/usePreviewZoom.test.ts — botones por escalones + gestos libres.
// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  PINCH_GAIN,
  ZOOM_MAX,
  ZOOM_MIN,
  clampZoom,
  dragZoomFactor,
  pinchScale,
  snapZoom,
  usePreviewZoom,
  wheelFactor,
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

  it('setScaleLive no persiste hasta commit', () => {
    const { result } = renderHook(() => usePreviewZoom())
    act(() => result.current.setScaleLive(1.22))
    expect(result.current.scale).toBeCloseTo(1.22)
    // Un remontaje aún ve el valor anterior: el tick no persistió.
    const { result: before } = renderHook(() => usePreviewZoom())
    expect(before.current.scale).toBe(1)
    act(() => result.current.commit())
    const { result: after } = renderHook(() => usePreviewZoom())
    expect(after.current.scale).toBeCloseTo(1.22)
  })

  it('el gesto libre conserva valores continuos (sin snap)', () => {
    const { result } = renderHook(() => usePreviewZoom())
    act(() => {
      result.current.setScaleLive(1.13)
      result.current.commit()
    })
    const { result: second } = renderHook(() => usePreviewZoom())
    expect(second.current.scale).toBeCloseTo(1.13)
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

describe('pinchScale', () => {
  it('aplica la ganancia sobre la razón de distancias', () => {
    expect(pinchScale(1, 100, 150)).toBeCloseTo(Math.pow(1.5, PINCH_GAIN))
    // Un gesto amplio de verdad rinde en uno solo: 100→150px ≈ ×2.25.
    expect(pinchScale(1, 100, 150)).toBeCloseTo(2.25)
    expect(pinchScale(1, 100, 100)).toBe(1)
  })

  it('reduce al cerrar los dedos y sujeta a los topes', () => {
    expect(pinchScale(1, 150, 100)).toBeLessThan(1)
    expect(pinchScale(1, 100, 10000)).toBe(ZOOM_MAX)
    expect(pinchScale(1, 10000, 100)).toBe(ZOOM_MIN)
  })

  it('entradas inválidas → escala de partida sujetada', () => {
    expect(pinchScale(1, 0, 150)).toBe(1)
    expect(pinchScale(1, 100, -5)).toBe(1)
    expect(pinchScale(NaN, 100, 150)).toBe(1)
  })
})

describe('wheelFactor', () => {
  it('muesca de rueda con Ctrl rinde más que antes (×~1.4)', () => {
    expect(wheelFactor(-120, 0)).toBeCloseTo(1.4, 1)
    expect(wheelFactor(120, 0)).toBeLessThan(0.75)
  })

  it('modo líneas (Firefox) se normaliza y el reposo es neutro', () => {
    expect(wheelFactor(-3, 1)).toBeGreaterThan(1)
    expect(wheelFactor(0, 0)).toBe(1)
  })
})

describe('dragZoomFactor', () => {
  it('subir amplía y bajar reduce, con gran recorrido por arrastre', () => {
    // Subir 150px ≈ ×2.1: de 100% a 200% en un solo arrastre.
    expect(dragZoomFactor(-150)).toBeCloseTo(Math.exp(0.75))
    expect(dragZoomFactor(-150)).toBeGreaterThan(2)
    expect(dragZoomFactor(150)).toBeLessThan(0.5)
    expect(dragZoomFactor(0)).toBe(1)
  })
})
