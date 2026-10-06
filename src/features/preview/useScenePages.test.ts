// @vitest-environment jsdom
// Tests de useScenePages: debounce, descarte de stale por seq, mapa
// línea → página (incl. duplicados en la misma página), error, pausa y
// visibilidad. El worker Go se inyecta como fake (jsdom no puede con WASM).
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useScenePages } from './useScenePages'
import type { PdfWorkerClient, ScenePage } from './pdfWorkerClient'

// pdf.js necesita DOMMatrix al importarse y jsdom no la tiene; el hook real
// nunca toca pdf.js, el import llega vía `debounceFor` de `usePdfPreview`.
vi.mock('@/lib/pdfjs', () => ({
  getDocument: vi.fn(),
}))

interface PendingPaginate {
  seq: number
  text: string
  resolve: (p: ScenePage[]) => void
  reject: (e: Error) => void
}

function makeClient() {
  const calls: PendingPaginate[] = []
  const client: PdfWorkerClient = {
    render: vi.fn(() => Promise.resolve(new Uint8Array())),
    paginate: vi.fn(
      (seq: number, text: string) =>
        new Promise<ScenePage[]>((resolve, reject) => {
          calls.push({ seq, text, resolve, reject })
        }),
    ),
    terminate: vi.fn(),
  }
  return { client, calls }
}

async function flush() {
  await act(async () => {
    for (let i = 0; i < 20; i++) await Promise.resolve()
  })
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useScenePages', () => {
  it('colapsa teclas rápidas en una sola petición con el último texto', async () => {
    const { client, calls } = makeClient()
    const { rerender } = renderHook(
      ({ text }: { text: string }) => useScenePages(text, { client }),
      {
        initialProps: { text: 'INT. A - DÍA\n' },
      },
    )
    rerender({ text: 'INT. A - DÍA\n\nAcción.\n' })
    rerender({ text: 'INT. A - DÍA\n\nAcción.\n\nINT. B - NOCHE\n' })
    expect(calls).toHaveLength(0)
    await advance(600)
    expect(calls).toHaveLength(1)
    expect(calls[0]?.text).toBe('INT. A - DÍA\n\nAcción.\n\nINT. B - NOCHE\n')
  })

  it('construye el mapa línea → página, con duplicados en la misma página', async () => {
    const { client, calls } = makeClient()
    const { result } = renderHook(() => useScenePages('x', { client }))
    await advance(600)
    expect(calls).toHaveLength(1)
    const pages = [
      { line: 1, page: 1 },
      { line: 5, page: 1 },
    ]
    await act(async () => {
      calls[0]?.resolve(pages)
    })
    await flush()
    expect(result.current.entries).toEqual(pages)
    expect(result.current.byLine.get(1)).toBe(1)
    expect(result.current.byLine.get(5)).toBe(1)
    expect(result.current.snapshot).toBe('x')
  })

  it('descarta respuestas stale cuando el usuario siguió escribiendo', async () => {
    const { client, calls } = makeClient()
    const { result, rerender } = renderHook(
      ({ text }: { text: string }) => useScenePages(text, { client }),
      { initialProps: { text: 'INT. A - DÍA\n' } },
    )
    await advance(600)
    expect(calls).toHaveLength(1)
    rerender({ text: 'INT. A - DÍA\n\nMás.\n' })
    await advance(600)
    expect(calls).toHaveLength(2)
    // La primera respuesta llega tarde: se ignora.
    await act(async () => {
      calls[0]?.resolve([{ line: 1, page: 9 }])
    })
    await flush()
    expect(result.current.byLine.size).toBe(0)
    await act(async () => {
      calls[1]?.resolve([{ line: 1, page: 2 }])
    })
    await flush()
    expect(result.current.byLine.get(1)).toBe(2)
  })

  it('expone el error sin romper el mapa previo', async () => {
    const { client, calls } = makeClient()
    const { result } = renderHook(() => useScenePages('x', { client }))
    await advance(600)
    await act(async () => {
      calls[0]?.resolve([{ line: 1, page: 1 }])
    })
    await flush()
    expect(result.current.byLine.get(1)).toBe(1)
    result.current.refreshNow()
    await flush()
    expect(calls).toHaveLength(2)
    await act(async () => {
      calls[1]?.reject(new Error('worker caído'))
    })
    await flush()
    expect(result.current.error).toMatch(/worker caído/)
    expect(result.current.byLine.get(1)).toBe(1)
  })

  it('en pausa o invisible no pide; al volver resuelve inmediato', async () => {
    const { client, calls } = makeClient()
    const { rerender } = renderHook(
      ({ paused }: { paused: boolean }) =>
        useScenePages('x', { client, paused }),
      { initialProps: { paused: true } },
    )
    await advance(2000)
    expect(calls).toHaveLength(0)
    rerender({ paused: false })
    // dirty no aplica a pausa (solo a invisible): debounce normal.
    await advance(600)
    expect(calls).toHaveLength(1)
  })

  it('invisible marca dirty y al volver pide sin esperar el debounce', async () => {
    const { client, calls } = makeClient()
    const { rerender } = renderHook(
      ({ visible }: { visible: boolean }) =>
        useScenePages('x', { client, visible }),
      { initialProps: { visible: true } },
    )
    rerender({ visible: false })
    await advance(2000)
    expect(calls).toHaveLength(0)
    rerender({ visible: true })
    await advance(0)
    expect(calls).toHaveLength(1)
  })
})
