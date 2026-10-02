// src/features/preview/pdfWorkerClient.ts — cliente del worker de PDF (main thread).
//
// Envuelve el `Worker` con una API de promesas indexada por `seq`: el hook
// (`usePdfPreview`) asigna un `seq` creciente a cada render y descarta las
// respuestas cuyo `seq` ya no es el vigente. El `ArrayBuffer` de los bytes
// llega transferido (cero copia); el receptor es dueño del `Uint8Array`.

export interface PdfWorkerInit {
  wasmExecUrl: string
  pdfWasmUrl: string
}

export interface PdfWorkerClient {
  /** Resuelve con los bytes del PDF o rechaza con el mensaje del worker. */
  render(seq: number, text: string): Promise<Uint8Array>
  terminate(): void
}

type Pending = {
  resolve: (bytes: Uint8Array) => void
  reject: (err: Error) => void
}

export function createPdfWorkerClient(init: PdfWorkerInit): PdfWorkerClient {
  const worker = new Worker(new URL('./pdfWorker.ts', import.meta.url))
  const pending = new Map<number, Pending>()
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
  }

  worker.addEventListener('message', (ev: MessageEvent) => {
    const msg = ev.data as {
      type: string
      seq?: number
      bytes?: Uint8Array
      message?: string
    }
    if (msg.type !== 'done' && msg.type !== 'render-error') return
    const p = pending.get(msg.seq ?? -1)
    if (!p) return // seq stale: respuesta de un render ya descartado
    pending.delete(msg.seq ?? -1)
    if (msg.type === 'done' && msg.bytes) p.resolve(msg.bytes)
    else p.reject(new Error(msg.message ?? 'render en worker falló'))
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
