// src/features/preview/pdfWorkerClient.ts — cliente del worker de PDF (main thread).
//
// Envuelve el `Worker` con una API de promesas indexada por `seq`: el hook
// (`usePdfPreview`) asigna un `seq` creciente a cada render y descarta las
// respuestas cuyo `seq` ya no es el vigente. El `ArrayBuffer` de los bytes
// llega transferido (cero copia); el receptor es dueño del `Uint8Array`.
// `paginate` sigue el mismo esquema con su propio mapa de pendientes: corre
// el mismo layout Go en el worker y devuelve el mapa línea → página.

/**
 * Una escena (línea fuente 1-based) en su página PDF absoluta 1-based.
 * Canónico aquí (`pdfWorker.ts` lo duplica sin exportar: como worker
 * clásico no admite ninguna sentencia `import`/`export`, ver nota allí).
 */
export interface ScenePage {
  line: number
  page: number
}

export interface PdfWorkerInit {
  wasmExecUrl: string
  pdfWasmUrl: string
}

export interface PdfWorkerClient {
  /** Resuelve con los bytes del PDF o rechaza con el mensaje del worker. */
  render(seq: number, text: string): Promise<Uint8Array>
  /** Resuelve con el mapa línea → página absoluta o rechaza. */
  paginate(seq: number, text: string): Promise<ScenePage[]>
  terminate(): void
}

type Pending = {
  resolve: (bytes: Uint8Array) => void
  reject: (err: Error) => void
}

type PendingPaginate = {
  resolve: (pages: ScenePage[]) => void
  reject: (err: Error) => void
}

export function createPdfWorkerClient(init: PdfWorkerInit): PdfWorkerClient {
  const worker = new Worker(new URL('./pdfWorker.ts', import.meta.url))
  const pending = new Map<number, Pending>()
  const pendingPaginate = new Map<number, PendingPaginate>()
  let initError: Error | null = null

  const ready = new Promise<void>((resolve, reject) => {
    const onReady = (ev: MessageEvent) => {
      const msg = ev.data as { type: string; message?: string }
      if (msg.type === 'ready') {
        worker.removeEventListener('message', onReady)
        resolve()
      } else if (msg.type === 'init-error') {
        worker.removeEventListener('message', onReady)
        initError = new Error(msg.message ?? 'init del worker PDF falló')
        reject(initError)
      }
    }
    worker.addEventListener('message', onReady)
    worker.postMessage({
      type: 'init',
      wasmExecUrl: init.wasmExecUrl,
      pdfWasmUrl: init.pdfWasmUrl,
    })
  })
  // Evita unhandled rejection si nadie espera el init (el render lo reeleva).
  ready.catch(() => {})

  const failAll = (err: Error) => {
    for (const [, p] of pending) p.reject(err)
    pending.clear()
    for (const [, p] of pendingPaginate) p.reject(err)
    pendingPaginate.clear()
  }

  worker.addEventListener('message', (ev: MessageEvent) => {
    const msg = ev.data as {
      type: string
      seq?: number
      bytes?: Uint8Array
      pages?: ScenePage[]
      message?: string
    }
    if (msg.type === 'done' || msg.type === 'render-error') {
      const p = pending.get(msg.seq ?? -1)
      if (!p) return // seq stale: respuesta de un render ya descartado
      pending.delete(msg.seq ?? -1)
      if (msg.type === 'done' && msg.bytes) p.resolve(msg.bytes)
      else p.reject(new Error(msg.message ?? 'render en worker falló'))
      return
    }
    if (msg.type === 'paginate-done' || msg.type === 'paginate-error') {
      const p = pendingPaginate.get(msg.seq ?? -1)
      if (!p) return // seq stale: respuesta ya descartada
      pendingPaginate.delete(msg.seq ?? -1)
      if (msg.type === 'paginate-done' && msg.pages) p.resolve(msg.pages)
      else p.reject(new Error(msg.message ?? 'paginate en worker falló'))
    }
  })
  worker.addEventListener('error', () => {
    const err = new Error('el worker del PDF terminó con error')
    initError ??= err
    failAll(err)
  })

  return {
    render(seq: number, text: string): Promise<Uint8Array> {
      return ready.then(
        () =>
          new Promise<Uint8Array>((resolve, reject) => {
            pending.set(seq, { resolve, reject })
            worker.postMessage({ type: 'render', seq, text })
          }),
      )
    },
    paginate(seq: number, text: string): Promise<ScenePage[]> {
      return ready.then(
        () =>
          new Promise<ScenePage[]>((resolve, reject) => {
            pendingPaginate.set(seq, { resolve, reject })
            worker.postMessage({ type: 'paginate', seq, text })
          }),
      )
    },
    terminate() {
      failAll(new Error('worker del PDF terminado'))
      worker.terminate()
    },
  }
}

/** URLs de `public/fountain/` resueltas contra la página (vale en web, Tauri y Capacitor). */
export function pdfWorkerUrls(): PdfWorkerInit {
  return {
    wasmExecUrl: new URL('fountain/wasm_exec.js', document.baseURI).href,
    pdfWasmUrl: new URL('fountain/fountain-pdf.wasm', document.baseURI).href,
  }
}

const SHARED = Symbol.for('fountain.pdfWorker')

/**
 * Cliente compartido del worker de PDF, una sola instancia por página.
 *
 * `usePdfPreview` y `useScenePages` corren el mismo layout Go sobre el
 * mismo texto: con un worker por hook habría dos runtimes Go y dos copias
 * del `.wasm` (~6.8 MiB) en memoria. El singleton vive lo que la página
 * (como el de `loadFountain`), así que nunca se termina: no llamar
 * `terminate()` sobre lo que esto devuelve.
 */
export function getSharedPdfWorkerClient(): PdfWorkerClient {
  const g = globalThis as Record<symbol, PdfWorkerClient | undefined>
  g[SHARED] ??= createPdfWorkerClient(pdfWorkerUrls())
  return g[SHARED] as PdfWorkerClient
}
