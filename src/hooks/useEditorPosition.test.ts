// src/hooks/useEditorPosition.test.ts — cursor + scroll del editor (punto 6).
// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { EditorState } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  clampOffset,
  useEditorPosition,
  viewIsVisible,
} from './useEditorPosition'

afterEach(() => {
  vi.unstubAllGlobals()
})

/**
 * Vista mínima con estado real (selección/doc), scrollDOM falso y
 * `scrollSnapshot()` falso que devuelve un centinela trazable.
 */
function makeView(
  doc: string,
  opts: Partial<{
    anchor: number
    head: number
    scrollTop: number
    scrollHeight: number
    clientHeight: number
    clientWidth: number
    /** Sin `scrollSnapshot`: simula vista que no puede capturarlo. */
    noSnapshot: boolean
  }> = {},
) {
  const {
    anchor = 0,
    head = 0,
    scrollTop = 0,
    scrollHeight = 2000,
    clientHeight = 600,
    clientWidth = 400,
    noSnapshot = false,
  } = opts
  const state = EditorState.create({
    doc,
    selection: { anchor, head },
  })
  const dispatched: unknown[] = []
  const scrollDOM = {
    scrollTop,
    scrollHeight,
    clientHeight,
    clientWidth,
  }
  const snapshots: unknown[] = []
  const view = {
    state,
    scrollDOM,
    dispatch: (tr: unknown) => {
      dispatched.push(tr)
    },
    ...(noSnapshot
      ? {}
      : {
          scrollSnapshot: () => {
            const snap = { marker: `snap@${scrollDOM.scrollTop}` }
            snapshots.push(snap)
            return snap
          },
        }),
  } as unknown as EditorView
  return { view, dispatched, scrollDOM, snapshots }
}

describe('clampOffset', () => {
  it('sujeta a [0, longitud]', () => {
    expect(clampOffset(3, 10)).toBe(3)
    expect(clampOffset(99, 10)).toBe(10)
    expect(clampOffset(-5, 10)).toBe(0)
  })

  it('no-finitos caen al fallback sujetado', () => {
    expect(clampOffset(NaN, 10)).toBe(0)
    expect(clampOffset(NaN, 10, 4)).toBe(4)
  })
})

describe('viewIsVisible', () => {
  it('vista con tamaño es visible; sin layout no', () => {
    expect(viewIsVisible(makeView('hola').view)).toBe(true)
    const hidden = makeView('hola', { clientWidth: 0, clientHeight: 0 })
    expect(viewIsVisible(hidden.view)).toBe(false)
  })
})

describe('useEditorPosition', () => {
  it('guarda selección + snapshot y restaura con ambos', () => {
    const { result } = renderHook(() => useEditorPosition())
    const doc = 'línea uno\nlínea dos\nlínea tres\n'
    const src = makeView(doc, { anchor: 12, head: 12, scrollTop: 240 })
    act(() => result.current.saveView('a', src.view))
    expect(src.snapshots).toHaveLength(1)

    const dst = makeView(doc)
    let restored = false
    act(() => {
      restored = result.current.restoreView('a', dst.view)
    })
    expect(restored).toBe(true)
    expect(dst.dispatched).toHaveLength(1)
    expect(dst.dispatched[0]).toMatchObject({
      selection: { anchor: 12, head: 12 },
    })
    // El snapshot viaja en la misma transacción para que CodeMirror lo
    // resuelva con su bucle de medición.
    expect(dst.dispatched[0]).toHaveProperty('effects')
    const effects = (dst.dispatched[0] as { effects: unknown[] }).effects
    expect(effects).toHaveLength(1)
    expect(effects[0]).toBe(src.snapshots[0])
  })

  it('sin snapshot capturable restaura solo la selección', () => {
    const { result } = renderHook(() => useEditorPosition())
    const doc = 'línea uno\nlínea dos\n'
    act(() => {
      result.current.saveView(
        'a',
        makeView(doc, { anchor: 8, head: 8, noSnapshot: true }).view,
      )
    })
    const dst = makeView(doc)
    act(() => {
      result.current.restoreView('a', dst.view)
    })
    expect(dst.dispatched).toHaveLength(1)
    expect(dst.dispatched[0]).toMatchObject({
      selection: { anchor: 8, head: 8 },
    })
    expect((dst.dispatched[0] as { effects: unknown[] }).effects).toHaveLength(
      0,
    )
  })

  it('la vista oculta no pisa la posición real', () => {
    const { result } = renderHook(() => useEditorPosition())
    const doc = 'línea uno\nlínea dos\n'
    act(() => {
      result.current.saveView(
        'a',
        makeView(doc, { anchor: 8, head: 8, scrollTop: 120 }).view,
      )
    })
    // La columna oculta (sin layout) intenta guardar ceros: se ignora.
    act(() => {
      result.current.saveView(
        'a',
        makeView(doc, { clientWidth: 0, clientHeight: 0 }).view,
      )
    })
    const dst = makeView(doc)
    act(() => {
      result.current.restoreView('a', dst.view)
    })
    expect(dst.dispatched[0]).toMatchObject({
      selection: { anchor: 8, head: 8 },
    })
    // El snapshot bueno sobrevive (no hay scroll manual que fijar: lo
    // resuelve CodeMirror al despachar).
    const effects = (dst.dispatched[0] as { effects: unknown[] }).effects
    expect(effects).toHaveLength(1)
  })

  it('el cleanup de desmontaje conserva el snapshot previo', () => {
    const { result } = renderHook(() => useEditorPosition())
    const doc = 'línea uno\nlínea dos\n'
    const live = makeView(doc, { anchor: 3, head: 3, scrollTop: 60 })
    act(() => result.current.saveView('a', live.view))
    // Al desmontar ya no hay layout: actualiza la selección pero conserva
    // el snapshot capturado en vivo.
    const gone = makeView(doc, {
      anchor: 5,
      head: 5,
      clientWidth: 0,
      clientHeight: 0,
    })
    act(() => result.current.saveView('a', gone.view, true))
    const dst = makeView(doc)
    act(() => {
      result.current.restoreView('a', dst.view)
    })
    expect(dst.dispatched[0]).toMatchObject({
      selection: { anchor: 5, head: 5 },
    })
    const effects = (dst.dispatched[0] as { effects: unknown[] }).effects
    expect(effects).toHaveLength(1)
    expect(effects[0]).toBe(live.snapshots[0])
  })

  it('sujeta los offsets si el texto se acortó', () => {
    const { result } = renderHook(() => useEditorPosition())
    const long = makeView('un documento bastante largo', {
      anchor: 20,
      head: 20,
    })
    act(() => result.current.saveView('a', long.view))
    const short = makeView('corto')
    act(() => {
      result.current.restoreView('a', short.view)
    })
    expect(short.dispatched[0]).toMatchObject({
      selection: { anchor: 5, head: 5 },
    })
  })

  it('sin dato devuelve false y no despacha', () => {
    const { result } = renderHook(() => useEditorPosition())
    const dispatch = vi.fn()
    const view = {
      state: EditorState.create({ doc: 'hola' }),
      scrollDOM: makeView('hola').scrollDOM,
      dispatch,
    } as unknown as EditorView
    let restored = true
    act(() => {
      restored = result.current.restoreView('nuevo', view)
    })
    expect(restored).toBe(false)
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('cada guion conserva su propia posición', () => {
    const { result } = renderHook(() => useEditorPosition())
    const doc = 'línea uno\nlínea dos\nlínea tres\nlínea cuatro\n'
    const srcA = makeView(doc, { anchor: 3, head: 3 })
    const srcB = makeView(doc, { anchor: 25, head: 25 })
    act(() => {
      result.current.saveView('a', srcA.view)
      result.current.saveView('b', srcB.view)
    })
    expect(result.current.has('a')).toBe(true)
    expect(result.current.has('zzz')).toBe(false)
    const dstA = makeView(doc)
    const dstB = makeView(doc)
    act(() => {
      result.current.restoreView('a', dstA.view)
      result.current.restoreView('b', dstB.view)
    })
    expect(dstA.dispatched[0]).toMatchObject({ selection: { anchor: 3 } })
    expect(dstB.dispatched[0]).toMatchObject({ selection: { anchor: 25 } })
    const effectsA = (dstA.dispatched[0] as { effects: unknown[] }).effects
    const effectsB = (dstB.dispatched[0] as { effects: unknown[] }).effects
    expect(effectsA[0]).toBe(srcA.snapshots[0])
    expect(effectsB[0]).toBe(srcB.snapshots[0])
  })

  it('onSettled se avisa tras un par de frames; cancelar también asienta', () => {
    const queue: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      queue.push(cb)
      return queue.length
    })
    const { result } = renderHook(() => useEditorPosition())
    const doc = 'uno\ndos\ntres\n'
    act(() => {
      result.current.saveView('a', makeView(doc, { anchor: 4, head: 4 }).view)
    })
    const dst = makeView(doc)
    const settled = vi.fn()
    act(() => {
      result.current.restoreView('a', dst.view, { onSettled: settled })
    })
    // Selección + snapshot aplicados de forma síncrona en el dispatch.
    expect(dst.dispatched).toHaveLength(1)
    act(() => {
      queue.shift()?.(0)
      queue.shift()?.(0)
    })
    expect(settled).toHaveBeenCalledTimes(1)
  })

  it('cancelar durante la espera asienta sin más frames', () => {
    const queue: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      queue.push(cb)
      return queue.length
    })
    const { result } = renderHook(() => useEditorPosition())
    const doc = 'uno\ndos\ntres\n'
    act(() => {
      result.current.saveView('a', makeView(doc, { anchor: 4, head: 4 }).view)
    })
    const dst = makeView(doc)
    const settled = vi.fn()
    let cancel = false
    act(() => {
      result.current.restoreView('a', dst.view, {
        isCancelled: () => cancel,
        onSettled: settled,
      })
    })
    cancel = true
    act(() => {
      queue.shift()?.(0)
    })
    expect(settled).toHaveBeenCalledTimes(1)
    // La selección ya quedó aplicada en el dispatch inicial.
    expect(dst.dispatched).toHaveLength(1)
  })
})
