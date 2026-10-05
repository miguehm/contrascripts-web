// src/hooks/usePreviewScroll.test.ts — scroll del preview por guion (punto 6).
// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  computeRestoreTop,
  findPageAnchor,
  resolveAnchorTarget,
  usePreviewScroll,
} from './usePreviewScroll'

afterEach(() => {
  vi.unstubAllGlobals()
})

/** Contenedor falso con las métricas que lee el hook (mutable a propósito:
 * el test simula el crecimiento async del contenido reasignando). */
interface FakeScroller extends HTMLElement {
  scrollTop: number
  scrollLeft: number
  scrollHeight: number
  clientHeight: number
}

function makeEl(overrides: Partial<FakeScroller> = {}): FakeScroller {
  return {
    scrollTop: 0,
    scrollLeft: 0,
    scrollHeight: 0,
    clientHeight: 0,
    ...overrides,
  } as unknown as FakeScroller
}

describe('computeRestoreTop', () => {
  it('devuelve el top guardado cuando cabe', () => {
    expect(computeRestoreTop(300, 0.5, 2000, 600)).toBe(300)
  })

  it('sin recorrido posible cae a 0', () => {
    expect(computeRestoreTop(300, 0.5, 500, 600)).toBe(0)
    expect(computeRestoreTop(300, 0.5, 0, 0)).toBe(0)
  })

  it('contenido encogido: usa el ratio sobre el máximo actual', () => {
    // Guardado al 50% de un doc largo; ahora solo caben 400px.
    expect(computeRestoreTop(1500, 0.5, 1000, 600)).toBe(200)
  })

  it('entradas inválidas no rompen', () => {
    expect(computeRestoreTop(NaN, 0.5, 2000, 600)).toBe(0)
    expect(computeRestoreTop(300, NaN, 2000, 600)).toBe(300)
    expect(computeRestoreTop(1500, NaN, 1000, 600)).toBe(400)
    expect(computeRestoreTop(-10, 0.5, 2000, 600)).toBe(0)
  })
})

describe('usePreviewScroll', () => {
  it('guarda y restituye scroll + ratio por guion', () => {
    const { result } = renderHook(() => usePreviewScroll())
    const scrolled = makeEl({
      scrollTop: 300,
      scrollLeft: 20,
      scrollHeight: 2000,
      clientHeight: 600,
    })
    act(() => result.current.save('a', scrolled))
    const fresh = makeEl({ scrollHeight: 2000, clientHeight: 600 })
    let restored = false
    act(() => {
      restored = result.current.restore('a', fresh)
    })
    expect(restored).toBe(true)
    expect(fresh.scrollTop).toBe(300)
    expect(fresh.scrollLeft).toBe(20)
  })

  it('cada guion conserva su propia posición', () => {
    const { result } = renderHook(() => usePreviewScroll())
    act(() => {
      result.current.save(
        'a',
        makeEl({ scrollTop: 100, scrollHeight: 2000, clientHeight: 600 }),
      )
      result.current.save(
        'b',
        makeEl({ scrollTop: 700, scrollHeight: 2000, clientHeight: 600 }),
      )
    })
    const elA = makeEl({ scrollHeight: 2000, clientHeight: 600 })
    const elB = makeEl({ scrollHeight: 2000, clientHeight: 600 })
    act(() => {
      result.current.restore('a', elA)
      result.current.restore('b', elB)
    })
    expect(elA.scrollTop).toBe(100)
    expect(elB.scrollTop).toBe(700)
  })

  it('sin dato previo lleva arriba y devuelve false', () => {
    const { result } = renderHook(() => usePreviewScroll())
    const el = makeEl({ scrollTop: 250, scrollHeight: 2000, clientHeight: 600 })
    let restored = true
    act(() => {
      restored = result.current.restore('nuevo', el)
    })
    expect(restored).toBe(false)
    expect(el.scrollTop).toBe(0)
  })

  it('contenido encogido al reabrir: restituye proporcional', () => {
    const { result } = renderHook(() => usePreviewScroll())
    act(() => {
      result.current.save(
        'a',
        makeEl({ scrollTop: 700, scrollHeight: 2000, clientHeight: 600 }),
      )
    })
    // El PDF se regeneró más corto: solo caben 400px de recorrido.
    const el = makeEl({ scrollHeight: 1000, clientHeight: 600 })
    act(() => {
      result.current.restore('a', el)
    })
    expect(el.scrollTop).toBeCloseTo(200, 5)
  })

  it('clear olvida la posición', () => {
    const { result } = renderHook(() => usePreviewScroll())
    act(() => {
      result.current.save(
        'a',
        makeEl({ scrollTop: 300, scrollHeight: 2000, clientHeight: 600 }),
      )
      result.current.clear('a')
    })
    const el = makeEl({ scrollTop: 50, scrollHeight: 2000, clientHeight: 600 })
    let restored = true
    act(() => {
      restored = result.current.restore('a', el)
    })
    expect(restored).toBe(false)
    expect(el.scrollTop).toBe(0)
  })

  it('claves o elementos nulos son no-op', () => {
    const { result } = renderHook(() => usePreviewScroll())
    const el = makeEl({ scrollHeight: 2000, clientHeight: 600 })
    act(() => {
      result.current.save(null, el)
      result.current.save('a', null)
      result.current.clear(null)
    })
    expect(result.current.restore(null, el)).toBe(false)
    expect(result.current.restore('a', null)).toBe(false)
  })
})

describe('findPageAnchor', () => {
  const tops = [0, 824, 1648]

  it('ancla a la primera página visible + offset dentro de ella', () => {
    expect(findPageAnchor(900, tops)).toEqual({ page: 1, dy: 76 })
    expect(findPageAnchor(0, tops)).toEqual({ page: 0, dy: 0 })
  })

  it('el borde exacto entre páginas pertenece a la siguiente', () => {
    expect(findPageAnchor(824, tops)).toEqual({ page: 1, dy: 0 })
  })

  it('más allá de la última página ancla al final', () => {
    expect(findPageAnchor(5000, tops)).toEqual({ page: 2, dy: 3352 })
  })

  it('sin tops o entradas inválidas no rompe', () => {
    expect(findPageAnchor(300, [])).toEqual({ page: 0, dy: 300 })
    expect(findPageAnchor(NaN, tops)).toEqual({ page: 0, dy: 0 })
  })
})

describe('resolveAnchorTarget', () => {
  it('mismo layout: el ancla resuelve al px exacto', () => {
    expect(
      resolveAnchorTarget(
        { page: 1, dy: 76 },
        [0, 824, 1648],
        900,
        0.5,
        2600,
        600,
      ),
    ).toBe(900)
  })

  it('páginas de arriba crecidas: mismo contenido, px desplazado', () => {
    // La página 0 pasó de 824 a 924 de alta: el contenido se ve igual en
    // 924 + 76 = 1000, no en el px viejo 900.
    expect(
      resolveAnchorTarget(
        { page: 1, dy: 76 },
        [0, 924, 1748],
        900,
        0.5,
        2700,
        600,
      ),
    ).toBe(1000)
  })

  it('página desaparecida: cae al px/ratio previo', () => {
    expect(
      resolveAnchorTarget({ page: 5, dy: 10 }, [0, 824], 300, 0.5, 2000, 600),
    ).toBe(300)
    expect(resolveAnchorTarget(undefined, [0, 824], 300, 0.5, 2000, 600)).toBe(
      300,
    )
  })

  it('sujeta al recorrido máximo', () => {
    expect(
      resolveAnchorTarget(
        { page: 1, dy: 76 },
        [0, 824, 1648],
        900,
        0.5,
        900,
        600,
      ),
    ).toBe(300)
  })
})

describe('ancla guardada', () => {
  it('save con tops guarda página + offset', () => {
    const { result } = renderHook(() => usePreviewScroll())
    act(() => {
      result.current.save(
        'a',
        makeEl({ scrollTop: 900, scrollHeight: 2600, clientHeight: 600 }),
        [0, 824, 1648],
      )
    })
    // Mismo contenido con las páginas de arriba 100px más altas.
    const el = makeEl({ scrollHeight: 2700, clientHeight: 600 })
    act(() => {
      result.current.restoreWithRetry('a', el, {
        getPageTops: () => [0, 924, 1748],
      })
    })
    expect(el.scrollTop).toBe(1000)
  })

  it('save sin tops conserva el ancla previa', () => {
    const { result } = renderHook(() => usePreviewScroll())
    act(() => {
      result.current.save(
        'a',
        makeEl({ scrollTop: 900, scrollHeight: 2600, clientHeight: 600 }),
        [0, 824, 1648],
      )
      // Sin tops frescos (p. ej. save tardío): el px se actualiza pero el
      // ancla previa sigue valiendo para re-resolver.
      result.current.save(
        'a',
        makeEl({ scrollTop: 950, scrollHeight: 2600, clientHeight: 600 }),
      )
    })
    const el = makeEl({ scrollHeight: 2700, clientHeight: 600 })
    act(() => {
      result.current.restoreWithRetry('a', el, {
        getPageTops: () => [0, 924, 1748],
      })
    })
    // Ancla {page:1, dy:76} contra tops nuevos → 1000 (no el px 950).
    expect(el.scrollTop).toBe(1000)
  })
})

describe('restoreWithRetry · convergencia', () => {
  it('converge al ancla aunque las alturas lleguen por fases', () => {
    const queue: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      queue.push(cb)
      return queue.length
    })
    const { result } = renderHook(() => usePreviewScroll())
    // Guardado con layout completo: 3 páginas (gaps incluidos).
    act(() => {
      result.current.save(
        'a',
        makeEl({ scrollTop: 900, scrollHeight: 2600, clientHeight: 600 }),
        [0, 824, 1648],
      )
    })
    // Al reabrir, placeholders aún sin medir: misma cuenta de páginas.
    const tops = [0, 300, 600]
    const el = makeEl({ scrollHeight: 900, clientHeight: 200 })
    const settled = vi.fn()
    act(() => {
      result.current.restoreWithRetry('a', el, {
        getPageTops: () => tops,
        onSettled: settled,
      })
    })
    // Ancla {page:1, dy:76} contra tops parciales → 300 + 76.
    expect(el.scrollTop).toBe(376)
    // Las páginas miden su altura real de golpe.
    tops[1] = 824
    tops[2] = 1648
    el.scrollHeight = 2600
    act(() => {
      queue.shift()?.(0)
    })
    expect(el.scrollTop).toBe(900)
    // Altura estable + en destino varios frames seguidos → asienta.
    act(() => {
      queue.shift()?.(0)
      queue.shift()?.(0)
      queue.shift()?.(0)
    })
    expect(settled).toHaveBeenCalled()
    expect(el.scrollTop).toBe(900)
  })

  it('sin rAF hace un solo intento', () => {
    vi.stubGlobal('requestAnimationFrame', undefined)
    const { result } = renderHook(() => usePreviewScroll())
    act(() => {
      result.current.save(
        'a',
        makeEl({ scrollTop: 300, scrollHeight: 2000, clientHeight: 600 }),
        [0, 800, 1600],
      )
    })
    const el = makeEl({ scrollHeight: 2000, clientHeight: 600 })
    const settled = vi.fn()
    act(() => {
      result.current.restoreWithRetry('a', el, {
        getPageTops: () => [0, 800, 1600],
        onSettled: settled,
      })
    })
    expect(el.scrollTop).toBe(300)
    expect(settled).toHaveBeenCalled()
  })
})
