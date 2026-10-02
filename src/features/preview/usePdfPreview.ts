// src/features/preview/usePdfPreview.ts — preview PDF con debounce + worker.
//
// - El texto se renderiza con `fountain-pdf.wasm` dentro de un Web Worker
//   (`pdfWorkerClient.ts`); el main thread nunca se bloquea aunque el render
//   tarde ~1s en guiones largos (baseline T1).
// - Debounce adaptativo al tamaño: el coste se paga una vez por pausa, no
//   por tecla. Cada render lleva un `seq` creciente y las respuestas stale
//   se descartan (el usuario pudo seguir escribiendo).
// - Doble buffer a nivel de hook: ante un error se conserva el PDF anterior
//   y `renderNow()` permite reintentar (o render manual en modo pausa).
// - `visible === false` (tab Editor en móvil, pestaña oculta) no renderiza:
//   marca `dirty` y renderiza al volver.
//
// Nota de lint: los efectos solo gestionan el timer; todos los `setState`
// viven en continuaciones async (timer, worker, pdf.js) o en el event
// handler `renderNow`, nunca síncronos en el cuerpo de un efecto.

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createPdfWorkerClient,
  pdfWorkerUrls,
  type PdfWorkerClient,
  type PdfWorkerInit,
} from './pdfWorkerClient'
import { getDocument, type PdfDocument } from '@/lib/pdfjs'

export type PdfPreviewStatus = 'idle' | 'rendering' | 'ready' | 'error'

export interface PdfPreviewState {
  status: PdfPreviewStatus
  /** Documento pdf.js vigente (dueño: el hook; se destruye al superseder). */
  pdf: PdfDocument | null
  numPages: number
  /** Últimos bytes generados; caché que reutiliza ExportButton. */
  bytes: Uint8Array | null
  error: string | null
  renderNow: () => void
}

export interface PdfPreviewOptions {
  paused?: boolean
  visible?: boolean
  createClient?: (init: PdfWorkerInit) => PdfWorkerClient
  loadDocument?: (data: Uint8Array) => Promise<PdfDocument>
}

/** Debounce según tamaño (baseline T1: 105 KB → render ~1100 ms). */
export function debounceFor(length: number): number {
  if (length < 20_000) return 600
  if (length < 60_000) return 900
  return 1500
}

function defaultLoadDocument(data: Uint8Array): Promise<PdfDocument> {
  return getDocument({ data }).promise
}

export function usePdfPreview(
  text: string,
  options: PdfPreviewOptions = {},
): PdfPreviewState {
  const {
    paused = false,
    visible = true,
    createClient = createPdfWorkerClient,
    loadDocument = defaultLoadDocument,
  } = options

  const [status, setStatus] = useState<PdfPreviewStatus>('idle')
  const [pdf, setPdf] = useState<PdfDocument | null>(null)
  const [numPages, setNumPages] = useState(0)
  const [bytes, setBytes] = useState<Uint8Array | null>(null)
  const [error, setError] = useState<string | null>(null)

  const clientRef = useRef<PdfWorkerClient | null>(null)
  const pdfRef = useRef<PdfDocument | null>(null)
  const seqRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dirtyRef = useRef(false)
  // Fábrica del worker: semántica "una vez" (como el singleton de fountain).
  const createClientRef = useRef(createClient)

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const doRender = useCallback(
    async (snapshot: string, seq: number) => {
      const client = clientRef.current
      if (!client) return
      setStatus('rendering')
      setError(null)
      try {
        const fresh = await client.render(seq, snapshot)
        if (seqRef.current !== seq) return // stale: hubo otro render después
        // Copia para pdf.js; el original queda como caché de exportación.
        const doc = await loadDocument(fresh.slice())
        if (seqRef.current !== seq) {
          await doc.destroy()
          return
        }
        const prev = pdfRef.current
        pdfRef.current = doc
        setPdf(doc)
        setNumPages(doc.numPages)
        setBytes(fresh)
        setStatus('ready')
        if (prev) await prev.destroy()
      } catch (err: unknown) {
        if (seqRef.current !== seq) return
        setError(err instanceof Error ? err.message : String(err))
        setStatus('error')
      }
    },
    [loadDocument],
  )

  const renderNow = useCallback(() => {
    clearTimer()
    dirtyRef.current = false
    const seq = ++seqRef.current
    void doRender(text, seq)
  }, [clearTimer, doRender, text])

  // Cliente worker: una vez (con cleanup que lo termina en StrictMode-dev).
  useEffect(() => {
    const client = createClientRef.current(pdfWorkerUrls())
    clientRef.current = client
    return () => {
      clientRef.current = null
      client.terminate()
    }
  }, [])

  // Planificación: el efecto solo arma/desarma el timer. Al volver visible
  // con cambios pendientes se renderiza "inmediato" vía timeout 0 para no
  // ejecutar setState síncrono en el cuerpo del efecto.
  useEffect(() => {
    if (paused || !visible) {
      clearTimer()
      if (!visible) dirtyRef.current = true
      return
    }
    const delay = dirtyRef.current ? 0 : debounceFor(text.length)
    dirtyRef.current = false
    const snapshot = text
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      const seq = ++seqRef.current
      void doRender(snapshot, seq)
    }, delay)
    return clearTimer
  }, [text, paused, visible, clearTimer, doRender])

  // Destruir el documento vigente al desmontar.
  useEffect(
    () => () => {
      clearTimer()
      const doc = pdfRef.current
      pdfRef.current = null
      if (doc) void doc.destroy()
    },
    [clearTimer],
  )

  return { status, pdf, numPages, bytes, error, renderNow }
}
