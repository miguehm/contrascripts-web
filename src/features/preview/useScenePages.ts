// src/features/preview/useScenePages.ts — línea del fuente → página del PDF.
//
// Fuente de verdad para el salto a escena (sustituye a `sceneToPage.ts`,
// que buscaba títulos por substring en el texto de pdf.js y fallaba con
// duplicados en la misma página): llama a `paginate()` del módulo Go en el
// worker, que corre el mismo layout que `renderPDF` y devuelve la página
// absoluta (incluye portada, = numeración de pdf.js) de cada heading.
//
// - Debounce adaptativo al tamaño (el de `usePdfPreview`): el coste se paga
//   una vez por pausa, no por tecla. Cada petición lleva un `seq` creciente
//   y las respuestas stale se descartan.
// - `paused === true` o `visible === false` no pide: marca `dirty` y
//   resuelve al volver (igual que la preview).
// - Sin escenas el mapa es vacío, nunca null.
//
// Nota de lint: como en `usePdfPreview`, los efectos solo gestionan el
// timer; todos los `setState` viven en continuaciones async o en el event
// handler `refreshNow`, nunca síncronos en el cuerpo de un efecto.

import { useCallback, useEffect, useRef, useState } from 'react'
import { debounceFor } from './usePdfPreview'
import type { PdfWorkerClient, ScenePage } from './pdfWorkerClient'

export type { ScenePage }

export interface ScenePagesState {
  /** Mapa línea fuente 1-based → página PDF absoluta 1-based. */
  byLine: Map<number, number>
  /** Respuesta cruda en orden de documento (para depurar/tests). */
  entries: ScenePage[]
  /** Texto exacto que produjo `byLine`/`entries`. `App` solo salta el PDF
   * cuando coincide con el texto vigente: con líneas desplazadas, una
   * clave vieja podría pertenecer a otra escena. */
  snapshot: string
  error: string | null
  refreshNow: () => void
}

export interface ScenePagesOptions {
  paused?: boolean
  visible?: boolean
  /**
   * Cliente ya existente (p. ej. el compartido de `getSharedPdfWorkerClient`).
   * Si se omite se usa el compartido, para no cargar el `.wasm` dos veces.
   */
  client?: PdfWorkerClient | null
  getSharedClient?: () => PdfWorkerClient
}

export function useScenePages(
  text: string,
  options: ScenePagesOptions = {},
): ScenePagesState {
  const {
    paused = false,
    visible = true,
    client = null,
    getSharedClient,
  } = options

  const [byLine, setByLine] = useState<Map<number, number>>(new Map())
  const [entries, setEntries] = useState<ScenePage[]>([])
  const [snapshot, setSnapshot] = useState('')
  const [error, setError] = useState<string | null>(null)

  const clientRef = useRef<PdfWorkerClient | null>(client)
  const seqRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dirtyRef = useRef(false)

  // Adopción del cliente: externo tal cual, o el compartido bajo demanda.
  // El compartido vive lo que la página: nunca se termina desde aquí.
  useEffect(() => {
    if (client) {
      clientRef.current = client
      return
    }
    if (getSharedClient) {
      clientRef.current = getSharedClient()
    }
  }, [client, getSharedClient])

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const doPaginate = useCallback(async (text: string, seq: number) => {
    const worker = clientRef.current
    if (!worker) return
    setError(null)
    try {
      const fresh = await worker.paginate(seq, text)
      if (seqRef.current !== seq) return // stale: hubo otra petición después
      setEntries(fresh)
      setByLine(new Map(fresh.map((e) => [e.line, e.page])))
      setSnapshot(text)
    } catch (err: unknown) {
      if (seqRef.current !== seq) return
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [])

  const refreshNow = useCallback(() => {
    clearTimer()
    dirtyRef.current = false
    const seq = ++seqRef.current
    void doPaginate(text, seq)
  }, [clearTimer, doPaginate, text])

  // Planificación: el efecto solo arma/desarma el timer.
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
      void doPaginate(snapshot, seq)
    }, delay)
    return clearTimer
  }, [text, paused, visible, clearTimer, doPaginate])

  useEffect(() => () => clearTimer(), [clearTimer])

  return { byLine, entries, snapshot, error, refreshNow }
}
