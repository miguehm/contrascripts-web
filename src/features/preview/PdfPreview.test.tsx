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
import { usePreviewZoom } from '@/hooks/usePreviewZoom'
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

/** Harness con el hook real: los botones/pinch mutan la escala de verdad. */
function Harness({
  preview,
  paused = false,
  onPausedChange = () => {},
}: {
  preview: PdfPreviewState
  paused?: boolean
  onPausedChange?: () => void
}) {
  const zoom = usePreviewZoom()
  return (
    <PdfPreview
      preview={preview}
      paused={paused}
      onPausedChange={onPausedChange}
      zoom={zoom}
    />
  )
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

/** Stub de `getBoundingClientRect` del wrapper con cola de valores: el
 * componente lo lee al empezar el gesto (1), al confirmar (2) y en el layout
 * effect post-commit (3). Así se simula que el layout nuevo desplazó el
 * contenido (régimen centrado) y se verifica la compensación por medición. */
function stubWrapRects(
  el: HTMLElement,
  rects: Array<{ left: number; top: number }>,
) {
  let i = 0
  el.getBoundingClientRect = vi.fn(() => {
    const r = rects[Math.min(i, rects.length - 1)]
    i += 1
    return { left: r.left, top: r.top } as unknown as DOMRect
  })
}

beforeEach(() => {
  drawImage.mockClear()
  // jsdom sin URL es origen opaco (sin localStorage real): stub en memoria
  // para que `usePreviewZoom` arranque siempre al 100%.
  const store: Record<string, string> = {}
  vi.stubGlobal('localStorage', {
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
  })
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
    render(<Harness preview={makePreview({ pdf, numPages: 2 })} />)
    expect(await screen.findByLabelText('Página 1 de 2')).toBeDefined()
    expect(screen.getByLabelText('Página 2 de 2')).toBeDefined()
    await waitFor(() => expect(drawImage).toHaveBeenCalledTimes(2))
  })

  it('mientras actualiza conserva las páginas y avisa', () => {
    const pdf = makePdf(1)
    render(
      <Harness
        preview={makePreview({ status: 'rendering', pdf, numPages: 1 })}
      />,
    )
    expect(screen.getByText('Actualizando…')).toBeDefined()
    expect(screen.getByLabelText('Página 1 de 1')).toBeDefined()
  })

  it('sin PDF muestra el placeholder de generación', () => {
    render(<Harness preview={makePreview({ status: 'rendering' })} />)
    expect(screen.getByText('Generando vista previa…')).toBeDefined()
  })

  it('en error sin PDF ofrece reintentar', () => {
    const renderNow = vi.fn()
    render(
      <Harness
        preview={makePreview({ status: 'error', error: 'boom', renderNow })}
      />,
    )
    expect(screen.getByText('boom')).toBeDefined()
    fireEvent.click(screen.getByText('Reintentar'))
    expect(renderNow).toHaveBeenCalledTimes(1)
  })

  it('en pausa sin PDF lo indica y con PDF ofrece actualizar', () => {
    const { unmount } = render(
      <Harness preview={makePreview({ status: 'idle' })} paused={true} />,
    )
    expect(screen.getByText('Vista previa en pausa.')).toBeDefined()
    unmount()

    const renderNow = vi.fn()
    render(
      <Harness
        preview={makePreview({ pdf: makePdf(1), numPages: 1, renderNow })}
        paused={true}
      />,
    )
    fireEvent.click(screen.getByText('Actualizar ahora'))
    expect(renderNow).toHaveBeenCalledTimes(1)
  })

  it('el toggle de pausa notifica al padre', () => {
    const onPausedChange = vi.fn()
    const { rerender } = render(
      <Harness preview={makePreview()} onPausedChange={onPausedChange} />,
    )
    fireEvent.click(screen.getByLabelText('Pausar vista previa'))
    expect(onPausedChange).toHaveBeenCalledWith(true)
    rerender(
      <Harness
        preview={makePreview()}
        paused={true}
        onPausedChange={onPausedChange}
      />,
    )
    fireEvent.click(screen.getByLabelText('Reanudar vista previa'))
    expect(onPausedChange).toHaveBeenCalledWith(false)
  })

  it('el zoom re-rasteriza y cambia el tamaño real de la hoja', async () => {
    const pdf = makePdf(2)
    render(<Harness preview={makePreview({ pdf, numPages: 2 })} />)
    const canvas = (await screen.findByLabelText(
      'Página 1 de 2',
    )) as unknown as HTMLElement
    await waitFor(() => expect(drawImage).toHaveBeenCalledTimes(2))
    expect(screen.getByText('100 %')).toBeDefined()
    const before = canvas.style.width
    expect(before).toBe('612px')
    fireEvent.click(screen.getByLabelText('Ampliar zoom'))
    expect(screen.getByText('125 %')).toBeDefined()
    // La hoja crece de verdad (antes maxWidth:100% la re-encogía).
    await waitFor(() =>
      expect(
        (screen.getByLabelText('Página 1 de 2') as unknown as HTMLElement).style
          .width,
      ).toBe('765px'),
    )
    await waitFor(() => expect(drawImage).toHaveBeenCalledTimes(4))
    await flush()
  })

  it('el indicador de porcentaje restablece al 100%', async () => {
    const pdf = makePdf(1)
    render(<Harness preview={makePreview({ pdf, numPages: 1 })} />)
    await screen.findByLabelText('Página 1 de 1')
    fireEvent.click(screen.getByLabelText('Ampliar zoom'))
    expect(screen.getByText('125 %')).toBeDefined()
    fireEvent.click(screen.getByText('125 %'))
    expect(screen.getByText('100 %')).toBeDefined()
    await flush()
  })

  it('doble-clic alterna 100% y anterior', async () => {
    const pdf = makePdf(1)
    render(<Harness preview={makePreview({ pdf, numPages: 1 })} />)
    await screen.findByLabelText('Página 1 de 1')
    fireEvent.click(screen.getByLabelText('Ampliar zoom'))
    expect(screen.getByText('125 %')).toBeDefined()
    fireEvent.doubleClick(screen.getByTestId('preview-pages'))
    expect(screen.getByText('100 %')).toBeDefined()
    fireEvent.doubleClick(screen.getByTestId('preview-pages'))
    expect(screen.getByText('125 %')).toBeDefined()
    await flush()
  })

  it('Ctrl+rueda ajusta el zoom sin scroll global ni snap', async () => {
    const pdf = makePdf(1)
    render(<Harness preview={makePreview({ pdf, numPages: 1 })} />)
    await screen.findByLabelText('Página 1 de 1')
    const scroller = screen.getByTestId('preview-pages')
    fireEvent.wheel(scroller, { ctrlKey: true, deltaY: -120 })
    // Ganancia 0.004 con tope 1.4: 100 % → 140 % en una muesca, y el valor
    // se queda (gesto libre, sin snap que lo revierta).
    await waitFor(() => expect(screen.getByText('140 %')).toBeDefined())
    await flush()
  })

  it('el pinch amplificado rinde en un solo gesto y confirma al soltar', async () => {
    // Invariante: tamaño y scroll se resuelven en el mismo commit (el tamaño
    // va en `useLayoutEffect` pre-paint en `PdfPage`); jsdom no observa el
    // timing de pintado, así que el no-flash se verifica manual, no aquí.
    // El commit compensa por medición: si el layout nuevo desplazó el
    // contenido (R0→R1), el scroll se restituye en la misma medida.
    const pdf = makePdf(1)
    render(<Harness preview={makePreview({ pdf, numPages: 1 })} />)
    await screen.findByLabelText('Página 1 de 1')
    const scroller = screen.getByTestId('preview-pages')
    stubWrapRects(screen.getByRole('document'), [
      { left: 0, top: 0 },
      { left: 10, top: 20 },
      { left: 25, top: 20 },
    ])
    fireEvent.pointerDown(scroller, {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 0,
      clientY: 0,
    })
    fireEvent.pointerDown(scroller, {
      pointerId: 2,
      pointerType: 'touch',
      clientX: 100,
      clientY: 0,
    })
    // Síncrono al DOM: bloquea el gesto nativo sin esperar al re-render.
    expect(scroller.style.touchAction).toBe('none')
    fireEvent.pointerMove(scroller, {
      pointerId: 2,
      pointerType: 'touch',
      clientX: 150,
      clientY: 0,
    })
    // 1.5^2 = ×2.25 en una sola apertura, por transform (sin tocar layout).
    expect(screen.getByText('225 %')).toBeDefined()
    const doc = screen.getByRole('document')
    expect(doc.style.transform).toContain('scale(2.25)')
    fireEvent.pointerUp(scroller, { pointerId: 1 })
    fireEvent.pointerUp(scroller, { pointerId: 2 })
    expect(scroller.style.touchAction).toBe('pan-x pan-y')
    // Al soltar se confirma la escala real (el transform se retira) y el
    // desplazamiento medido (25−10) se restituye en el scroll: 0 + 15.
    expect(screen.getByText('225 %')).toBeDefined()
    expect(screen.getByRole('document').style.transform).toBe('')
    expect(scroller.scrollLeft).toBe(15)
    expect(scroller.scrollTop).toBe(0)
    await flush()
  })

  it('el origen sigue a los dedos y el commit no salta', async () => {
    const pdf = makePdf(1)
    render(<Harness preview={makePreview({ pdf, numPages: 1 })} />)
    await screen.findByLabelText('Página 1 de 1')
    const scroller = screen.getByTestId('preview-pages')
    stubWrapRects(screen.getByRole('document'), [
      { left: 0, top: 0 },
      { left: 5, top: 5 },
      { left: 25, top: 0 },
    ])
    fireEvent.pointerDown(scroller, {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 0,
      clientY: 0,
    })
    fireEvent.pointerDown(scroller, {
      pointerId: 2,
      pointerType: 'touch',
      clientX: 100,
      clientY: 0,
    })
    fireEvent.pointerMove(scroller, {
      pointerId: 2,
      pointerType: 'touch',
      clientX: 150,
      clientY: 0,
    })
    const doc = screen.getByRole('document')
    expect(doc.style.transformOrigin).toBe('75px 0px')
    // El primer dedo también se desliza: el origen lo sigue (ya no es 75).
    fireEvent.pointerMove(scroller, {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 40,
      clientY: 0,
    })
    // Punto medio 95 con k=2.25 previo: 75 + (95−75)/2.25 ≈ 83.89.
    expect(screen.getByRole('document').style.transformOrigin).toContain(
      '83.88',
    )
    expect(screen.getByText('121 %')).toBeDefined()
    // Al soltar con el dedo en (40,0) se confirma y la sonda restituye el
    // desplazamiento medido entre layouts (20 en X, −5 en Y). La suelta no
    // mueve el ancla: vale el `mid` del último tick (−11.11 + 20 ≈ 8.89).
    fireEvent.pointerUp(scroller, {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 40,
      clientY: 0,
    })
    fireEvent.pointerUp(scroller, { pointerId: 2 })
    expect(screen.getByText('121 %')).toBeDefined()
    expect(scroller.scrollLeft).toBeCloseTo(8.89, 1)
    expect(scroller.scrollTop).toBe(-5)
    await flush()
  })

  it('doble-tap-arrastrar amplía con un dedo y no lo revierte el dblclick', async () => {
    const pdf = makePdf(1)
    render(<Harness preview={makePreview({ pdf, numPages: 1 })} />)
    await screen.findByLabelText('Página 1 de 1')
    const scroller = screen.getByTestId('preview-pages')
    stubWrapRects(screen.getByRole('document'), [
      { left: 0, top: 0 },
      { left: 7, top: 3 },
      { left: 9, top: 3 },
    ])
    // Primer tap.
    fireEvent.pointerDown(scroller, {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 50,
      clientY: 100,
    })
    fireEvent.pointerUp(scroller, { pointerId: 1 })
    // Segundo toque + arrastre hacia arriba con el dedo apoyado.
    fireEvent.pointerDown(scroller, {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 50,
      clientY: 100,
    })
    expect(scroller.style.touchAction).toBe('none')
    fireEvent.pointerMove(scroller, {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 50,
      clientY: 0,
    })
    // Subir 100px ≈ ×1.65.
    expect(screen.getByText('165 %')).toBeDefined()
    fireEvent.pointerUp(scroller, { pointerId: 1 })
    expect(screen.getByText('165 %')).toBeDefined()
    // El commit restituye el desplazamiento medido (9−7): 0 + 2.
    expect(scroller.scrollLeft).toBe(2)
    // El dblclick sintético del navegador tras el arrastre se ignora.
    fireEvent.doubleClick(scroller)
    expect(screen.getByText('165 %')).toBeDefined()
    await flush()
  })
})
