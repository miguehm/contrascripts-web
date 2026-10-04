// Flash efímero de la línea destino tras saltar desde el PDF (punto 4).
//
// El field se prueba con un `EditorState` real (sin DOM): añadir decora la
// línea, un segundo salto reemplaza al anterior y limpiar la vacía. El timer
// de retirada se prueba con una vista mock y fake timers.
import { EditorState } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  JUMP_FLASH_DURATION_MS,
  addJumpHighlight,
  clearJumpHighlight,
  jumpLineHighlightField,
  scheduleJumpFlashClear,
} from './jumpHighlight'

function stateWithFlash(doc: string): EditorState {
  return EditorState.create({ doc, extensions: [jumpLineHighlightField] })
}

/** Rangos de la decoración como `[from, to]` (el cursor de CM no es iterable). */
function flashRanges(state: EditorState): Array<{ from: number; to: number }> {
  const out: Array<{ from: number; to: number }> = []
  state
    .field(jumpLineHighlightField)
    .between(0, state.doc.length, (from, to) => {
      out.push({ from, to })
    })
  return out
}

describe('jumpLineHighlightField', () => {
  it('empieza sin decoración', () => {
    const state = stateWithFlash('una\notra')
    expect(state.field(jumpLineHighlightField).size).toBe(0)
  })

  it('decora la línea del salto', () => {
    let state = stateWithFlash('una\notra')
    state = state.update({ effects: addJumpHighlight.of(5) }).state
    expect(state.field(jumpLineHighlightField).size).toBe(1)
  })

  it('ancla el flash al inicio de la línea aunque el offset sea a mitad (bug real)', () => {
    // El salto pasa el offset de la palabra clicada, casi siempre una columna a
    // mitad de línea. `Decoration.line` solo decora la línea que EMPIEZA en la
    // posición dada: sin anclar, la clase no aparecía.
    const doc = 'primera línea\notra línea'
    const lineStart = doc.indexOf('otra') // inicio de la 2ª línea
    const midLine = doc.indexOf('línea', lineStart) // dentro de "otra línea"
    expect(midLine).toBeGreaterThan(lineStart)

    let state = stateWithFlash(doc)
    state = state.update({ effects: addJumpHighlight.of(midLine) }).state
    const ranges = flashRanges(state)
    expect(ranges).toHaveLength(1)
    expect(ranges[0]!.from).toBe(lineStart)
    expect(ranges[0]!.to).toBe(lineStart)
  })

  it('clampa un offset fuera del documento', () => {
    const doc = 'una\notra'
    let state = stateWithFlash(doc)
    state = state.update({ effects: addJumpHighlight.of(9999) }).state
    const ranges = flashRanges(state)
    expect(ranges).toHaveLength(1)
    expect(ranges[0]!.from).toBe(doc.indexOf('otra'))
    expect(ranges[0]!.to).toBe(doc.indexOf('otra'))
  })

  it('un segundo salto reemplaza al anterior, no se apila', () => {
    let state = stateWithFlash('una\notra\ntercera')
    state = state.update({ effects: addJumpHighlight.of(0) }).state
    state = state.update({ effects: addJumpHighlight.of(9) }).state
    expect(state.field(jumpLineHighlightField).size).toBe(1)
  })

  it('limpiar vacía la decoración', () => {
    let state = stateWithFlash('una\notra')
    state = state.update({ effects: addJumpHighlight.of(0) }).state
    state = state.update({ effects: clearJumpHighlight.of() }).state
    expect(state.field(jumpLineHighlightField).size).toBe(0)
  })

  it('limpiar sin flash previo es no-op', () => {
    let state = stateWithFlash('una\notra')
    state = state.update({ effects: clearJumpHighlight.of() }).state
    expect(state.field(jumpLineHighlightField).size).toBe(0)
  })
})

describe('scheduleJumpFlashClear', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  function mockView() {
    const dispatch = vi.fn()
    const view = { dispatch } as unknown as EditorView
    return { view, dispatch }
  }

  it('dura 2s por defecto (meseta que sobrevive al viaje de los ojos)', () => {
    expect(JUMP_FLASH_DURATION_MS).toBe(2000)
  })

  it('retira el flash tras la duración', () => {
    const { view, dispatch } = mockView()
    scheduleJumpFlashClear(view)
    expect(dispatch).not.toHaveBeenCalled()
    vi.advanceTimersByTime(JUMP_FLASH_DURATION_MS)
    expect(dispatch).toHaveBeenCalledTimes(1)
  })

  it('un segundo salto cancela la retirada del anterior', () => {
    const { view, dispatch } = mockView()
    scheduleJumpFlashClear(view)
    vi.advanceTimersByTime(JUMP_FLASH_DURATION_MS / 2)
    // Segundo salto antes de que caduque el primero: solo una retirada.
    scheduleJumpFlashClear(view)
    vi.advanceTimersByTime(JUMP_FLASH_DURATION_MS / 2)
    expect(dispatch).not.toHaveBeenCalled()
    vi.advanceTimersByTime(JUMP_FLASH_DURATION_MS / 2)
    expect(dispatch).toHaveBeenCalledTimes(1)
  })

  it('respeta una duración explícita', () => {
    const { view, dispatch } = mockView()
    scheduleJumpFlashClear(view, 3000)
    vi.advanceTimersByTime(2000)
    expect(dispatch).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1000)
    expect(dispatch).toHaveBeenCalledTimes(1)
  })
})
