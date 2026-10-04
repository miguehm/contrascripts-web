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
import type { Document } from '@/vendor/fountain.mjs'

afterEach(cleanup)

const drawImage = vi.fn()

function makePdf(pages = 2) {
  const page = {
    getViewport: ({ scale }: { scale: number }) => ({
      width: 612 * scale,
      height: 792 * scale,
      scale,
      // Transform real de pdf.js para una Letter sin rotación: voltea el eje Y,
      // que es lo que hace que el hit-test del punto 4 use `PAGE_H - y`.
      transform: [scale, 0, 0, -scale, 0, 792 * scale],
    }),
    getTextContent: vi.fn(async () => ({ items: [] })),
    render: vi.fn(() => ({ promise: Promise.resolve(), cancel: vi.fn() })),
    cleanup: vi.fn(),
  }
  const pdf = {
    getPage: vi.fn(async () => page),
    numPages: pages,
  } as unknown as PdfDocument
  return pdf
}

/** Hoja del fixture: una línea de texto en el tercio superior. */
function textItem(str: string, x = 72, y = 700, width = 120) {
  return {
    str,
    width,
    height: 10,
    transform: [12, 0, 0, 12, x, y],
    fontName: 'g_d0_f1',
    hasEOL: false,
    dir: 'ltr',
  }
}

/** PDF con una página que publica `items` en `getTextContent`. */
function makePdfWithText(items: ReturnType<typeof textItem>[]) {
  const pdf = makePdf(1)
  const page = pdf.getPage as unknown as ReturnType<typeof vi.fn>
  page.mockResolvedValue({
    getViewport: ({ scale }: { scale: number }) => ({
      width: 612 * scale,
      height: 792 * scale,
      scale,
      transform: [scale, 0, 0, -scale, 0, 792 * scale],
    }),
    getTextContent: vi.fn(async () => ({ items })),
    render: vi.fn(() => ({ promise: Promise.resolve(), cancel: vi.fn() })),
    cleanup: vi.fn(),
  })
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
  fitEnabled = false,
  fitDefault = false,
  doc = null,
  source = '',
  onJumpToSource,
}: {
  preview: PdfPreviewState
  paused?: boolean
  onPausedChange?: (paused: boolean) => void
  fitEnabled?: boolean
  fitDefault?: boolean
  doc?: Document | null
  source?: string
  onJumpToSource?: (offset: number) => void
}) {
  const zoom = usePreviewZoom({ fitDefault })
  return (
    <PdfPreview
      preview={preview}
      paused={paused}
      onPausedChange={onPausedChange}
      zoom={zoom}
      fitEnabled={fitEnabled}
      doc={doc}
      source={source}
      onJumpToSource={onJumpToSource}
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
    expect(screen.getByText('Actualizando documento…')).toBeDefined()
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

  it('el doble-clic ya no toca el zoom (punto 4)', async () => {
    // El zoom dejó de depender del doble-clic: ahora es por gestos o por el
    // número del porcentaje, y el doble-clic lleva al editor.
    const pdf = makePdf(1)
    render(<Harness preview={makePreview({ pdf, numPages: 1 })} />)
    await screen.findByLabelText('Página 1 de 1')
    fireEvent.click(screen.getByLabelText('Ampliar zoom'))
    expect(screen.getByText('125 %')).toBeDefined()
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

describe('vista en grande (REVIEW.md punto 2)', () => {
  it('sin onToggleExpand no hay botón de ampliar', () => {
    render(<Harness preview={makePreview()} />)
    expect(
      screen.queryByRole('button', { name: 'Ver vista previa en grande' }),
    ).toBeNull()
    expect(
      screen.queryByRole('button', { name: 'Salir de vista ampliada' }),
    ).toBeNull()
  })

  it('el botón alterna etiqueta/aria-expanded y llama al toggle', () => {
    const onToggleExpand = vi.fn()
    const zoom = {
      scale: 1,
      percent: 100,
      canZoomIn: true,
      canZoomOut: true,
      zoomIn: vi.fn(),
      zoomOut: vi.fn(),
      setScale: vi.fn(),
      setScaleLive: vi.fn(),
      commit: vi.fn(),
      reset: vi.fn(),
      fitMode: false,
      fitScale: null,
      effectiveScale: 1,
      effectivePercent: 100,
      setFitMode: vi.fn(),
      setFitScale: vi.fn(),
      resetForScript: vi.fn(),
    }
    const { rerender } = render(
      <PdfPreview
        preview={makePreview()}
        paused={false}
        onPausedChange={() => {}}
        zoom={zoom}
        expanded={false}
        onToggleExpand={onToggleExpand}
      />,
    )
    const expand = screen.getByRole('button', {
      name: 'Ver vista previa en grande',
    })
    expect(expand.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(expand)
    expect(onToggleExpand).toHaveBeenCalledTimes(1)
    rerender(
      <PdfPreview
        preview={makePreview()}
        paused={false}
        onPausedChange={() => {}}
        zoom={zoom}
        expanded={true}
        onToggleExpand={onToggleExpand}
      />,
    )
    expect(
      screen.getByRole('button', { name: 'Salir de vista ampliada' }),
    ).toBeDefined()
  })
})

describe('fit al ancho (REVIEW.md punto 1, móvil)', () => {
  it('no hay botón "Ajustar" y hacer zoom sale de fit', async () => {
    const pdf = makePdf(1)
    render(
      <Harness
        preview={makePreview({ pdf, numPages: 1 })}
        fitEnabled
        fitDefault
      />,
    )
    await screen.findByLabelText('Página 1 de 1')
    expect(screen.queryByRole('button', { name: 'Ajustar' })).toBeNull()
    // En jsdom no hay ResizeObserver: effectiveScale cae al manual, pero
    // el modo fit (persistido) sí arranca activo en móvil.
    fireEvent.click(screen.getByLabelText('Ampliar zoom'))
    expect(screen.getByText('125 %')).toBeDefined()
    await flush()
  })

  it('click en el porcentaje entra en fit (no resetea a 100%)', async () => {
    const pdf = makePdf(1)
    render(
      <Harness
        preview={makePreview({ pdf, numPages: 1 })}
        fitEnabled
        fitDefault={false}
      />,
    )
    await screen.findByLabelText('Página 1 de 1')
    fireEvent.click(screen.getByLabelText('Ampliar zoom'))
    expect(screen.getByText('125 %')).toBeDefined()
    fireEvent.click(screen.getByText('125 %'))
    // Sigue sin resetear a 100%: el modo manual persiste hasta que RO mida.
    expect(screen.queryByText('100 %')).toBeNull()
    await flush()
  })

  it('en móvil el porcentaje vuelve al ajuste al ancho', async () => {
    // Tras el punto 4 el doble-clic lleva al editor, así que el fit se
    // recupera tocando el número del porcentaje.
    const pdf = makePdf(1)
    render(
      <Harness
        preview={makePreview({ pdf, numPages: 1 })}
        fitEnabled
        fitDefault={false}
      />,
    )
    await screen.findByLabelText('Página 1 de 1')
    fireEvent.click(screen.getByLabelText('Ampliar zoom'))
    const percent = screen.getByText('125 %')
    // Fuera de fit: el número ofrece volver a ajustarlo.
    expect(percent.getAttribute('aria-label')).toContain('Tocar para ajustar')
    fireEvent.click(percent)
    // jsdom no tiene ResizeObserver, así que no hay escala medida; lo que se
    // verifica es que el modo fit queda activo.
    expect(screen.getByText('125 %').getAttribute('aria-label')).toContain(
      'ajustado al ancho',
    )
    await flush()
  })

  it('desktop: el porcentaje resetea a 100% y el doble-clic no lo toca', async () => {
    const pdf = makePdf(1)
    render(<Harness preview={makePreview({ pdf, numPages: 1 })} />)
    await screen.findByLabelText('Página 1 de 1')
    fireEvent.click(screen.getByLabelText('Ampliar zoom'))
    fireEvent.click(screen.getByText('125 %'))
    expect(screen.getByText('100 %')).toBeDefined()
    fireEvent.doubleClick(screen.getByTestId('preview-pages'))
    expect(screen.getByText('100 %')).toBeDefined()
    await flush()
  })
})

describe('banner de procesamiento (REVIEW.md punto 2, móvil)', () => {
  it('sin PDF muestra "Procesando documento…" con role status', () => {
    render(<Harness preview={makePreview({ status: 'rendering' })} />)
    const banner = screen.getByText('Procesando documento…')
    expect(banner.closest('[role="status"]')).not.toBeNull()
    // Flotante: no empuja el documento (clase absolute, no flujo normal).
    expect(banner.closest('[role="status"]')!.className).toContain('absolute')
  })

  it('con PDF previo muestra "Actualizando documento…"', () => {
    const pdf = makePdf(1)
    render(
      <Harness
        preview={makePreview({ status: 'rendering', pdf, numPages: 1 })}
      />,
    )
    expect(screen.getByText('Actualizando documento…')).toBeDefined()
  })

  it('no aparece cuando está listo ni en error ni en pausa', () => {
    const { unmount } = render(
      <Harness preview={makePreview({ pdf: makePdf(1), numPages: 1 })} />,
    )
    expect(screen.queryByText('Actualizando documento…')).toBeNull()
    unmount()

    const { unmount: u2 } = render(
      <Harness preview={makePreview({ status: 'error', error: 'boom' })} />,
    )
    expect(screen.queryByText('Procesando documento…')).toBeNull()
    u2()

    render(
      <Harness preview={makePreview({ status: 'rendering' })} paused={true} />,
    )
    expect(screen.queryByText('Procesando documento…')).toBeNull()
  })
})

describe('salto al editor (REVIEW.md punto 4)', () => {
  const source = [
    'EXT. CASA - DIA',
    '',
    'Stars blanket the void.',
    '',
    'ELENA',
    '¿Me oyes?',
  ].join('\n')

  /** Documento con las mismas líneas que el parser emitiría. */
  function doc(): Document {
    return {
      titlePage: {} as Document['titlePage'],
      elements: [
        { type: 'sceneHeading', line: 1, text: 'EXT. CASA - DIA' },
        { type: 'action', line: 3, text: 'Stars blanket the void.' },
        { type: 'character', line: 5, text: 'ELENA' },
        { type: 'dialogue', line: 6, text: '¿Me oyes?' },
      ],
    } as unknown as Document
  }

  /** Rect de la hoja en el viewport: sin scroll ni margen. */
  function stubPageRect(page: HTMLElement, top = 0) {
    page.getBoundingClientRect = vi.fn(
      () => ({ left: 0, top, width: 612, height: 792 }) as DOMRect,
    )
  }

  async function renderReady(items: ReturnType<typeof textItem>[]) {
    const pdf = makePdfWithText(items)
    const onJumpToSource = vi.fn()
    render(
      <Harness
        preview={makePreview({ pdf, numPages: 1 })}
        doc={doc()}
        source={source}
        onJumpToSource={onJumpToSource}
      />,
    )
    await screen.findByLabelText('Página 1 de 1')
    const page = document.querySelector<HTMLElement>('[data-page="1"]')!
    stubPageRect(page)
    await flush()
    return { pdf, onJumpToSource, page }
  }

  it('el doble clic sobre un texto salta a su offset', async () => {
    const { onJumpToSource, page } = await renderReady([
      textItem('Stars blanket the void.'),
    ])
    // La caja de la línea va de 792-700-12=80 a 92, y el clic cae en su borde
    // izquierdo para apuntar al primer carácter.
    fireEvent.doubleClick(page, { clientX: 73, clientY: 86 })
    await flush()

    expect(onJumpToSource).toHaveBeenCalledWith(source.indexOf('Stars'))
  })

  it('el doble clic sitúa el cursor en el carácter clicado', async () => {
    const { onJumpToSource, page } = await renderReady([
      textItem('Stars blanket the void.', 72, 700, 240),
    ])
    // Courier Prime es monoespaciada: con 240px para 23 letras, el carácter 6
    // ("blanket") está en x = 72 + 240/23·6.
    fireEvent.doubleClick(page, { clientX: 72 + (240 / 23) * 6, clientY: 86 })
    await flush()

    expect(onJumpToSource).toHaveBeenCalledWith(source.indexOf('blanket'))
  })

  it('el doble clic en una palabra repetida salta a su párrafo (no al primero)', async () => {
    // Repro del bug: "está" en dos párrafos; el clic en el segundo iba al
    // primero porque `resolveJumpOffset` devolvía el primer match.
    const dupSource = ['Todo está en calma.', '', 'Nada está claro.'].join('\n')
    const dupDoc = {
      titlePage: {},
      elements: [
        { type: 'action', line: 1, text: 'Todo está en calma.' },
        { type: 'action', line: 3, text: 'Nada está claro.' },
      ],
    } as unknown as Document
    const pdf = makePdfWithText([
      textItem('Todo está en calma.', 72, 700, 140),
      textItem('Nada está claro.', 72, 650, 119),
    ])
    const onJumpToSource = vi.fn()
    render(
      <Harness
        preview={makePreview({ pdf, numPages: 1 })}
        doc={dupDoc}
        source={dupSource}
        onJumpToSource={onJumpToSource}
      />,
    )
    await screen.findByLabelText('Página 1 de 1')
    const page = document.querySelector<HTMLElement>('[data-page="1"]')!
    stubPageRect(page)
    await flush()

    // Segundo ítem (caja y=130..142): clic en su "está" ('Nada está claro.'
    // tiene 16 letras en 119px; la "e" de "está" es el índice 5).
    fireEvent.doubleClick(page, {
      clientX: 72 + (119 / 16) * 5 + 2,
      clientY: 136,
    })
    await flush()

    expect(onJumpToSource).toHaveBeenCalledWith(
      dupSource.indexOf('está', dupSource.indexOf('está') + 1),
    )
  })

  it('no salta con un clic en el margen, lejos de todo texto', async () => {
    const { onJumpToSource, page } = await renderReady([
      textItem('Stars blanket the void.'),
    ])

    fireEvent.doubleClick(page, { clientX: 300, clientY: 400 })
    await flush()

    expect(onJumpToSource).not.toHaveBeenCalled()
  })

  it('no salta si el texto del PDF no aparece en el guion', async () => {
    const { onJumpToSource, page } = await renderReady([
      textItem('TEXTO QUE NO EXISTE'),
    ])

    fireEvent.doubleClick(page, { clientX: 100, clientY: 86 })
    await flush()

    expect(onJumpToSource).not.toHaveBeenCalled()
  })

  it('no salta si la página no ha publicado su texto', async () => {
    // El PDF llega sin `getTextContent`, o aún no ha resuelto: no hay hit-test.
    const pdf = makePdf(1)
    const onJumpToSource = vi.fn()
    render(
      <Harness
        preview={makePreview({ pdf, numPages: 1 })}
        doc={doc()}
        source={source}
        onJumpToSource={onJumpToSource}
      />,
    )
    await screen.findByLabelText('Página 1 de 1')
    stubPageRect(document.querySelector<HTMLElement>('[data-page="1"]')!)
    await flush()

    fireEvent.doubleClick(screen.getByTestId('preview-pages'), {
      clientX: 100,
      clientY: 86,
    })
    await flush()

    expect(onJumpToSource).not.toHaveBeenCalled()
  })

  it('sin callback, el doble clic no rompe nada', async () => {
    const pdf = makePdfWithText([textItem('Stars blanket the void.')])
    render(
      <Harness
        preview={makePreview({ pdf, numPages: 1 })}
        doc={doc()}
        source={source}
      />,
    )
    await screen.findByLabelText('Página 1 de 1')
    stubPageRect(document.querySelector<HTMLElement>('[data-page="1"]')!)
    await flush()

    // Sin `onJumpToSource` el gesto es un no-op, no un error.
    fireEvent.doubleClick(screen.getByTestId('preview-pages'), {
      clientX: 100,
      clientY: 86,
    })
    await flush()
  })

  it('el doble-tap quieto en móvil salta al editor', async () => {
    // Dos toques separados 100ms (dentro de TAP_TIMEOUT) y sin mover el dedo:
    // el gesto queda en k≈1, sin zoom. Arrastrarlo sí sería zoom.
    const { onJumpToSource, page } = await renderReady([
      textItem('Stars blanket the void.'),
    ])
    const base = Date.now()
    const now = vi.spyOn(Date, 'now').mockReturnValue(base)
    const touch = {
      pointerId: 1,
      pointerType: 'touch',
      isPrimary: true,
      clientX: 73,
      clientY: 86,
    }
    fireEvent.pointerDown(page, touch)
    fireEvent.pointerUp(page, touch)
    now.mockReturnValue(base + 100)
    fireEvent.pointerDown(page, touch)
    fireEvent.pointerUp(page, touch)
    await flush()

    expect(onJumpToSource).toHaveBeenCalledWith(source.indexOf('Stars'))
    now.mockRestore()
  })

  it('el doble-tap-arrastrado no salta al editor, hace zoom', async () => {
    // El segundo toque se convierte en arrastre (el dedo sube 150px): el zoom
    // queda intacto y el salto no se dispara.
    const { onJumpToSource } = await renderReady([
      textItem('Stars blanket the void.'),
    ])
    const scroller = screen.getByTestId('preview-pages')
    const base = Date.now()
    const now = vi.spyOn(Date, 'now').mockReturnValue(base)
    const touch = {
      pointerId: 1,
      pointerType: 'touch',
      isPrimary: true,
      clientX: 73,
      clientY: 86,
    }
    fireEvent.pointerDown(scroller, touch)
    fireEvent.pointerUp(scroller, touch)
    now.mockReturnValue(base + 100)
    fireEvent.pointerDown(scroller, touch)
    fireEvent.pointerMove(scroller, { ...touch, clientY: 86 - 150 })
    fireEvent.pointerUp(scroller, { ...touch, clientY: 86 - 150 })
    await flush()

    expect(onJumpToSource).not.toHaveBeenCalled()
    now.mockRestore()
  })
})
