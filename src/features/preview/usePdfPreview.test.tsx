// @vitest-environment jsdom
// Tests de usePdfPreview: debounce adaptativo, descarte de stale por seq,
// error con conservación del PDF previo, pausa, visibilidad y cleanup.
// El worker Go y pdf.js se inyectan como fakes (jsdom no puede con WASM).
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { debounceFor, usePdfPreview } from './usePdfPreview'
import type { PdfWorkerClient } from './pdfWorkerClient'
import type { PdfDocument } from '@/lib/pdfjs'

// pdf.js necesita DOMMatrix al importarse y jsdom no la tiene; los tests
// inyectan `loadDocument`, así que el módulo real nunca se usa aquí.
vi.mock('@/lib/pdfjs', () => ({
  getDocument: vi.fn(),
}))

function makeDoc(pages = 3) {
  return {
    numPages: pages,
    destroy: vi.fn(() => Promise.resolve()),
  } as unknown as PdfDocument
}

interface PendingRender {
  seq: number
  text: string
  resolve: (b: Uint8Array) => void
  reject: (e: Error) => void
}

function makeClient() {
  const renders: PendingRender[] = []
  const client: PdfWorkerClient = {
    render: vi.fn(
      (seq: number, text: string) =>
        new Promise<Uint8Array>((resolve, reject) => {
          renders.push({ seq, text, resolve, reject })
        }),
    ),
    terminate: vi.fn(),
  }
  return { client, renders }
}

const canned = (n: number) => new Uint8Array([n])

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

describe('debounceFor', () => {
  it('escala con el tamaño del texto', () => {
    expect(debounceFor(100)).toBe(600)
    expect(debounceFor(30_000)).toBe(900)
    expect(debounceFor(105_000)).toBe(1500)
  })
})

describe('usePdfPreview', () => {
  it('colapsa teclas rápidas en un solo render con el último texto', async () => {
    const { client, renders } = makeClient()
    const loadDocument = vi.fn(async () => makeDoc())
    const { result, rerender } = renderHook(
      ({ text }: { text: string }) =>
        usePdfPreview(text, {
          createClient: () => client,
          loadDocument,
        }),
      { initialProps: { text: 'a' } },
    )
    expect(result.current.status).toBe('idle')
    rerender({ text: 'ab' })
    await advance(599)
    expect(client.render).not.toHaveBeenCalled()
    rerender({ text: 'abc' })
    await advance(600)
    expect(client.render).toHaveBeenCalledTimes(1)
    expect(renders[0].text).toBe('abc')
  })

  it('llega a ready con páginas y bytes, y destruye el doc previo', async () => {
    const { client, renders } = makeClient()
    const docs = [makeDoc(2), makeDoc(5)]
    const loadDocument = vi.fn(async () => docs.shift() ?? makeDoc())
    const { result, rerender } = renderHook(
      ({ text }: { text: string }) =>
        usePdfPreview(text, {
          createClient: () => client,
          loadDocument,
        }),
      { initialProps: { text: 'uno' } },
    )
    await advance(600)
    const first = canned(1)
    renders[0].resolve(first)
    await flush()
    expect(result.current.status).toBe('ready')
    expect(result.current.numPages).toBe(2)
    expect(result.current.bytes).toBe(first)

    rerender({ text: 'dos' })
    await advance(600)
    renders[1].resolve(canned(2))
    await flush()
    expect(result.current.numPages).toBe(5)
    // El documento anterior se destruye al superseder (sin leaks de pdf.js).
    expect((result.current.bytes as Uint8Array)[0]).toBe(2)
  })

  it('descarta documentos stale que resuelven tarde', async () => {
    const { client, renders } = makeClient()
    const doc1 = makeDoc(2)
    const doc2 = makeDoc(7)
    // loadDocument controlable: cada llamada queda pendiente a mano.
    const docQueue: Array<(d: PdfDocument) => void> = []
    const loadDocument = vi.fn(
      () =>
        new Promise<PdfDocument>((resolve) => {
          docQueue.push(resolve)
        }),
    )
    const { result, rerender } = renderHook(
      ({ text }: { text: string }) =>
        usePdfPreview(text, {
          createClient: () => client,
          loadDocument,
        }),
      { initialProps: { text: 'uno' } },
    )
    await advance(600)
    // El render 1 resuelve bytes pero su documento queda pendiente…
    renders[0].resolve(canned(1))
    await flush()
    expect(loadDocument).toHaveBeenCalledTimes(1)
    // …mientras el texto cambia y el render 2 completa entero.
    rerender({ text: 'dos' })
    await advance(600)
    renders[1].resolve(canned(2))
    await flush()
    docQueue[1](doc2)
    await flush()
    expect(result.current.numPages).toBe(7)
    // …y cuando el documento 1 resuelve tarde, se destruye sin tocar estado.
    docQueue[0](doc1)
    await flush()
    expect(doc1.destroy).toHaveBeenCalled()
    expect(result.current.numPages).toBe(7)
    expect(result.current.bytes?.[0]).toBe(2)
  })

  it('en error conserva el PDF previo y expone reintento', async () => {
    const { client, renders } = makeClient()
    const loadDocument = vi.fn(async () => makeDoc(4))
    const { result, rerender } = renderHook(
      ({ text }: { text: string }) =>
        usePdfPreview(text, {
          createClient: () => client,
          loadDocument,
        }),
      { initialProps: { text: 'ok' } },
    )
    await advance(600)
    renders[0].resolve(canned(1))
    await flush()
    expect(result.current.status).toBe('ready')

    rerender({ text: 'roto' })
    await advance(600)
    renders[1].reject(new Error('boom wasm'))
    await flush()
    expect(result.current.status).toBe('error')
    expect(result.current.error).toBe('boom wasm')
    // Doble buffer: el PDF anterior sigue vigente.
    expect(result.current.numPages).toBe(4)
    expect(result.current.bytes?.[0]).toBe(1)

    await act(async () => {
      result.current.renderNow()
    })
    await flush()
    expect(client.render).toHaveBeenCalledTimes(3)
  })

  it('en pausa no renderiza hasta renderNow', async () => {
    const { client, renders } = makeClient()
    const loadDocument = vi.fn(async () => makeDoc())
    const { result } = renderHook(() =>
      usePdfPreview('hola', {
        paused: true,
        createClient: () => client,
        loadDocument,
      }),
    )
    await advance(5000)
    expect(client.render).not.toHaveBeenCalled()
    expect(result.current.status).toBe('idle')
    await act(async () => {
      result.current.renderNow()
    })
    expect(client.render).toHaveBeenCalledTimes(1)
    renders[0].resolve(canned(9))
    await flush()
    expect(result.current.status).toBe('ready')
  })

  it('oculto no renderiza; al volver renderiza lo pendiente', async () => {
    const { client, renders } = makeClient()
    const loadDocument = vi.fn(async () => makeDoc())
    const { rerender } = renderHook(
      ({ visible }: { visible: boolean }) =>
        usePdfPreview('hola', {
          visible,
          createClient: () => client,
          loadDocument,
        }),
      { initialProps: { visible: false } },
    )
    await advance(5000)
    expect(client.render).not.toHaveBeenCalled()
    rerender({ visible: true })
    await advance(1)
    expect(client.render).toHaveBeenCalledTimes(1)
    renders[0].resolve(canned(1))
    await flush()
  })

  it('al desmontar termina el worker y destruye el documento', async () => {
    const { client, renders } = makeClient()
    const doc = makeDoc()
    const loadDocument = vi.fn(async () => doc)
    const { unmount } = renderHook(() =>
      usePdfPreview('hola', {
        createClient: () => client,
        loadDocument,
      }),
    )
    await advance(600)
    renders[0].resolve(canned(1))
    await flush()
    unmount()
    expect(client.terminate).toHaveBeenCalledTimes(1)
    expect(doc.destroy).toHaveBeenCalled()
  })
})
