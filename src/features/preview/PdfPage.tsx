// src/features/preview/PdfPage.tsx — una página del PDF en <canvas>.
//
// - Rasterización perezosa: solo cuando entra al viewport (+margen).
// - Doble buffer por página: se rasteriza en un canvas temporal y se vuelca
//   con `drawImage` de una vez — el canvas visible nunca queda en blanco y
//   no hay flicker al actualizar tras cada debounce.
// - Resolución: `scale * min(devicePixelRatio, 2)` para nitidez sin
//   sobremuestrear en pantallas hi-dpi. El tamaño CSS lo fija `scale` solo.
// - El espacio se reserva en cuanto se conocen las dimensiones (sin
//   rasterizar), para no desplazar el scroll al aparecer cada página.

import { useEffect, useRef, useState } from 'react'
import type { RenderTask } from 'pdfjs-dist'
import type { PdfDocument } from '@/lib/pdfjs'

interface PdfPageProps {
  pdf: PdfDocument
  pageNumber: number // 1-based
  numPages: number
  scale: number
}

export function PdfPage({ pdf, pageNumber, numPages, scale }: PdfPageProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [inView, setInView] = useState(false)
  const [cssSize, setCssSize] = useState<{ w: number; h: number } | null>(null)
  const [failed, setFailed] = useState(false)

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
        const cssViewport = page.getViewport({ scale })
        // Reserva el espacio antes de rasterizar (evita saltos de scroll).
        if (!cancelled)
          setCssSize({ w: cssViewport.width, h: cssViewport.height })
        const viewport = page.getViewport({ scale: scale * dpr })
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
  }, [pdf, pageNumber, scale, inView])

  return (
    <div
      ref={wrapRef}
      className="mx-auto bg-[var(--paper)] shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05),0_1px_3px_rgba(15,23,42,0.03)] dark:shadow-[0_2px_4px_rgba(0,0,0,0.2),0_16px_40px_rgba(0,0,0,0.4)]"
      style={
        cssSize
          ? {
              width: cssSize.w,
              maxWidth: '100%',
              aspectRatio: `${cssSize.w} / ${cssSize.h}`,
            }
          : { minHeight: 200 }
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
          className="block h-auto w-full"
        />
      )}
    </div>
  )
}
