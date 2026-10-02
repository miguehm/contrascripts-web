// @vitest-environment jsdom
// Tests de PdfPreview/PdfPage con pdf.js falsificado (jsdom no tiene canvas
// 2d ni IntersectionObserver; el raster real se verifica en e2e).
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PdfPreview } from './PdfPreview'
import type { PdfPreviewState } from './usePdfPreview'
import type { PdfDocument } from '@/lib/pdfjs'

afterEach(cleanup)

const drawImage = vi.fn()

function makePdf(pages = 2) {
  const page = {
    getViewport: ({ scale }: { scale: number }) => ({
      width: 612 * scale,
      height: 792 * scale,
    }),
    render: vi.fn(() => ({ promise: Promise.resolve(), cancel: vi.fn() })),
    cleanup: vi.fn(),
  }
  const pdf = {
    getPage: vi.fn(async () => page),
    numPages: pages,
  } as unknown as PdfDocument
  return pdf
}

function makePreview(
  overrides: Partial<PdfPreviewState> = {},
): PdfPreviewState {
  return {
    status: 'ready',
    pdf: null,
    numPages: 0,
    bytes: null,
    error: null,
    renderNow: vi.fn(),
    ...overrides,
  }
}

class FakeObserver {
  cb: IntersectionObserverCallback
  constructor(cb: IntersectionObserverCallback) {
    this.cb = cb
  }
  observe(target: Element) {
    this.cb(
      [{ isIntersecting: true, target } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    )
  }
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  drawImage.mockClear()
  vi.stubGlobal(
    'IntersectionObserver',
    FakeObserver as unknown as typeof IntersectionObserver,
  )
  HTMLCanvasElement.prototype.getContext = vi.fn(
    () => ({ drawImage }) as unknown as CanvasRenderingContext2D,
  ) as unknown as typeof HTMLCanvasElement.prototype.getContext
})

afterEach(() => {
  vi.unstubAllGlobals()
})

async function flush() {
  await act(async () => {
    for (let i = 0; i < 20; i++) await Promise.resolve()
  })
}

describe('PdfPreview', () => {
  it('renderiza un canvas por página del PDF', async () => {
    const pdf = makePdf(2)
    render(
      <PdfPreview
        preview={makePreview({ pdf, numPages: 2 })}
        paused={false}
        onPausedChange={() => {}}
      />,
    )
    expect(await screen.findByLabelText('Página 1 de 2')).toBeDefined()
    expect(screen.getByLabelText('Página 2 de 2')).toBeDefined()
    await waitFor(() => expect(drawImage).toHaveBeenCalledTimes(2))
  })

  it('mientras actualiza conserva las páginas y avisa', () => {
    const pdf = makePdf(1)
    render(
      <PdfPreview
        preview={makePreview({ status: 'rendering', pdf, numPages: 1 })}
        paused={false}
        onPausedChange={() => {}}
      />,
    )
    expect(screen.getByText('Actualizando…')).toBeDefined()
    expect(screen.getByLabelText('Página 1 de 1')).toBeDefined()
  })

  it('sin PDF muestra el placeholder de generación', () => {
    render(
      <PdfPreview
        preview={makePreview({ status: 'rendering' })}
        paused={false}
        onPausedChange={() => {}}
      />,
    )
    expect(screen.getByText('Generando vista previa…')).toBeDefined()
  })

  it('en error sin PDF ofrece reintentar', () => {
    const renderNow = vi.fn()
    render(
      <PdfPreview
        preview={makePreview({ status: 'error', error: 'boom', renderNow })}
        paused={false}
        onPausedChange={() => {}}
      />,
    )
    expect(screen.getByText('boom')).toBeDefined()
    fireEvent.click(screen.getByText('Reintentar'))
    expect(renderNow).toHaveBeenCalledTimes(1)
  })

  it('en pausa sin PDF lo indica y con PDF ofrece actualizar', () => {
    const { unmount } = render(
      <PdfPreview
        preview={makePreview({ status: 'idle' })}
        paused={true}
        onPausedChange={() => {}}
      />,
    )
    expect(screen.getByText('Vista previa en pausa.')).toBeDefined()
    unmount()

    const renderNow = vi.fn()
    render(
      <PdfPreview
        preview={makePreview({ pdf: makePdf(1), numPages: 1, renderNow })}
        paused={true}
        onPausedChange={() => {}}
      />,
    )
    fireEvent.click(screen.getByText('Actualizar ahora'))
    expect(renderNow).toHaveBeenCalledTimes(1)
  })

  it('el toggle de pausa notifica al padre', () => {
    const onPausedChange = vi.fn()
    const { rerender } = render(
      <PdfPreview
        preview={makePreview()}
        paused={false}
        onPausedChange={onPausedChange}
      />,
    )
    fireEvent.click(screen.getByLabelText('Pausar vista previa'))
    expect(onPausedChange).toHaveBeenCalledWith(true)
    rerender(
      <PdfPreview
        preview={makePreview()}
        paused={true}
        onPausedChange={onPausedChange}
      />,
    )
    fireEvent.click(screen.getByLabelText('Reanudar vista previa'))
    expect(onPausedChange).toHaveBeenCalledWith(false)
  })

  it('el zoom re-rasteriza las páginas visibles', async () => {
    const pdf = makePdf(2)
    render(
      <PdfPreview
        preview={makePreview({ pdf, numPages: 2 })}
        paused={false}
        onPausedChange={() => {}}
      />,
    )
    await screen.findByLabelText('Página 1 de 2')
    await waitFor(() => expect(drawImage).toHaveBeenCalledTimes(2))
    expect(screen.getByText('100 %')).toBeDefined()
    fireEvent.click(screen.getByLabelText('Ampliar zoom'))
    expect(screen.getByText('125 %')).toBeDefined()
    await waitFor(() => expect(drawImage).toHaveBeenCalledTimes(4))
    await flush()
  })
})
