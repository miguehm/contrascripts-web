// src/features/preview/PdfPage.tsx — una página del PDF en <canvas>.
//
// - Rasterización perezosa: solo cuando entra al viewport (+margen).
// - Doble buffer por página: se rasteriza en un canvas temporal y se vuelca
//   con `drawImage` de una vez — el canvas visible nunca queda en blanco y
//   no hay flicker al actualizar tras cada debounce.
// - Resolución: `rasterScale * min(devicePixelRatio, 2)` para nitidez sin
//   sobremuestrear en pantallas hi-dpi. El tamaño CSS lo fija `scale` solo.
// - El espacio se reserva en cuanto se conocen las dimensiones (sin
//   rasterizar), para no desplazar el scroll al aparecer cada página.
// - Zoom fluido (REVIEW.md punto 3): el tamaño CSS sigue a `scale` al
//   instante (reescalado proporcional síncrono), mientras el raster —caro—
//   usa `useDeferredValue(scale)`: durante el gesto no se re-rasteriza,
//   solo al asentar la escala. Una re-rasterización por gesto, no por tick.
// - Texto (punto 4): además del raster se pide `getTextContent()` y se
//   publica en `onTextContent` para que el doble-clic sepa qué hay bajo el
//   puntero. Es una llamada extra al worker por página, pero solo para las
//   que entran en viewport y el resultado no se usa para pintar nada: el
//   hit-test es geométrico (ver `./textHit`), sin capa de texto DOM.

import {
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import type { RenderTask } from 'pdfjs-dist'
import type { PdfDocument, PdfTextItem } from '@/lib/pdfjs'

interface PdfPageProps {
  pdf: PdfDocument
  pageNumber: number // 1-based
  numPages: number
  scale: number
  /** Texto de la página para el hit-test del punto 4 (opcional). */
  onTextContent?: (pageNumber: number, items: PdfTextItem[]) => void
  /**
   * Reserva el tamaño sin esperar al viewport (punto 6): durante la
   * restauración del scroll todas las páginas publican su `cssSize` para
   * que los tops del ancla sean reales, no placeholders. El raster y el
   * texto siguen perezosos (`inView`): no hay costo de pintado extra.
   */
  eagerSize?: boolean
}

export function PdfPage({
  pdf,
  pageNumber,
  numPages,
  scale,
  onTextContent,
  eagerSize = false,
}: PdfPageProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [inView, setInView] = useState(false)
  const [cssSize, setCssSize] = useState<{ w: number; h: number } | null>(null)
  const [failed, setFailed] = useState(false)
  // Escala de raster diferida: el CSS crece por tick, el raster solo al
  // asentar. `prevScaleRef` permite reescalar el tamaño conocido sin pasar
  // por `pdf.getPage` (instantáneo y síncrono).
  const rasterScale = useDeferredValue(scale)
  const prevScaleRef = useRef(scale)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setInView(true)
      },
      { rootMargin: '400px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // Tamaño CSS inmediato ante cada cambio de escala (sin rasterizar).
  // Es `useLayoutEffect` a propósito, no `useEffect`: el commit del gesto
  // retira el transform y cambia `scale` en el mismo batch, y la corrección
  // de scroll de `PdfPreview` también corre pre-paint. Si el tamaño se
  // resolviera en un efecto pasivo, la primera frame tras soltar pintaría la
  // hoja en tamaño viejo con el scroll ya corregido (brinco visible); así,
  // el re-render con el tamaño nuevo también ocurre antes de pintar.
  useLayoutEffect(() => {
    const prev = prevScaleRef.current
    prevScaleRef.current = scale
    if (prev === scale || prev <= 0) return
    const ratio = scale / prev
    setCssSize((size) =>
      size ? { w: size.w * ratio, h: size.h * ratio } : size,
    )
  }, [scale])

  // Reserva del espacio: barata (`getPage` + medida, sin píxeles). Con
  // `eagerSize` no espera al viewport para que los tops del ancla del
  // punto 6 sean reales en todas las páginas desde el primer momento.
  useEffect(() => {
    if (!inView && !eagerSize) return
    let cancelled = false
    ;(async () => {
      try {
        const page = await pdf.getPage(pageNumber)
        if (cancelled) {
          page.cleanup()
          return
        }
        const cssViewport = page.getViewport({ scale: rasterScale })
        page.cleanup()
        // Reserva/corrige el espacio con la medida absoluta (converge con
        // el reescalado proporcional del efecto anterior).
        if (!cancelled)
          setCssSize({ w: cssViewport.width, h: cssViewport.height })
      } catch (err: unknown) {
        if (!cancelled) setFailed(true)
        void err
      }
    })()
    return () => {
      cancelled = true
    }
  }, [pdf, pageNumber, rasterScale, inView, eagerSize])

  // Raster perezoso: solo en viewport (+margen). Nunca ansioso, aunque la
  // medida sí lo sea: pintar 100 páginas de golpe sería el costo que el
  // lazy evita.
  useEffect(() => {
    if (!inView) return
    let cancelled = false
    let task: RenderTask | null = null
    ;(async () => {
      try {
        const canvas = canvasRef.current
        if (!canvas) return
        const page = await pdf.getPage(pageNumber)
        if (cancelled) {
          page.cleanup()
          return
        }
        const dpr = Math.min(window.devicePixelRatio || 1, 2)
        const viewport = page.getViewport({ scale: rasterScale * dpr })
        const tmp = document.createElement('canvas')
        tmp.width = Math.floor(viewport.width)
        tmp.height = Math.floor(viewport.height)
        const ctx = tmp.getContext('2d')
        if (!ctx) throw new Error('canvas 2d no disponible')
        // pdf.js v5 rasteriza sobre el elemento canvas (`canvas`, no
        // `canvasContext`); el temporal preserva el doble buffer.
        task = page.render({ canvas: tmp, viewport })
        await task.promise
        page.cleanup()
        if (cancelled) return
        canvas.width = tmp.width
        canvas.height = tmp.height
        canvas.getContext('2d')?.drawImage(tmp, 0, 0)
      } catch (err: unknown) {
        // Cancelación de renders superseded: silencio. Fallo real: aviso.
        if (!cancelled) setFailed(true)
        void err
      }
    })()
    return () => {
      cancelled = true
      task?.cancel()
    }
  }, [pdf, pageNumber, rasterScale, inView])

  // Texto de la página para el hit-test del punto 4. Vive en un efecto aparte
  // y no depende de `scale`: los ítems vienen en espacio PDF (sin escalar), así
  // que un zoom no vuelve a pedirlos. Es una precarga: `PdfPreview` pide el
  // texto bajo demanda si el doble-clic llega antes de que esta página haya
  // entrado en viewport, así que un fallo aquí no rompe nada.
  useEffect(() => {
    if (!inView || !onTextContent) return
    let cancelled = false
    ;(async () => {
      try {
        const page = await pdf.getPage(pageNumber)
        if (cancelled) return
        const text = await page.getTextContent()
        if (cancelled) return
        onTextContent(pageNumber, text.items as PdfTextItem[])
      } catch {
        // Sin texto no hay hit-test; el raster sigue su curso.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [pdf, pageNumber, inView, onTextContent])

  return (
    <div
      ref={wrapRef}
      data-page={pageNumber}
      className="mx-auto bg-[var(--paper)] shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05),0_1px_3px_rgba(15,23,42,0.03)] dark:shadow-[0_2px_4px_rgba(0,0,0,0.2),0_16px_40px_rgba(0,0,0,0.4)]"
      style={
        cssSize
          ? {
              // REVIEW.md 3: el ancho lo manda `scale` sin tope del
              // contenedor (`maxWidth:100%` + `w-full` re-encogía la hoja
              // a 150-200% y el zoom parecía no funcionar). El scroll
              // horizontal lo gestiona el contenedor de `PdfPreview`.
              width: cssSize.w,
              maxWidth: 'none',
              flexShrink: 0,
              aspectRatio: `${cssSize.w} / ${cssSize.h}`,
            }
          : { minHeight: 200, minWidth: 200 }
      }
    >
      {failed ? (
        <p role="alert" className="p-4 font-mono text-xs text-destructive">
          No se pudo rasterizar la página {pageNumber}
        </p>
      ) : (
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={`Página ${pageNumber} de ${numPages}`}
          className="block"
          style={cssSize ? { width: cssSize.w, height: cssSize.h } : undefined}
        />
      )}
    </div>
  )
}
