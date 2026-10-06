// src/features/preview/pdfWorker.ts — render de PDF dentro de un Web Worker.
//
// Este módulo corre DENTRO del worker (sin DOM): Vite lo empaqueta como
// worker clásico, de modo que `importScripts` está disponible para cargar
// `wasm_exec.js` (un script clásico, no un módulo).
//
// El runtime Go bloquea el hilo que lo ejecuta: aquí ese hilo es el del
// worker, así el main thread nunca se congela aunque el render tarde ~1s
// en guiones largos (baseline T1: 105 KB → ~1100 ms).
//
// Protocolo con el main thread (ver `pdfWorkerClient.ts`):
//   main → worker  { type: 'init', wasmExecUrl, pdfWasmUrl }
//   worker → main  { type: 'ready' } | { type: 'init-error', message }
//   main → worker  { type: 'render', seq, text }
//   worker → main  { type: 'done', seq, bytes } (buffer transferido)
//                  | { type: 'render-error', seq, message }
//   main → worker  { type: 'paginate', seq, text }
//   worker → main  { type: 'paginate-done', seq, pages } (array clonado)
//                  | { type: 'paginate-error', seq, message }
//
// Los renders se procesan en orden de llegada; un render anterior que siga
// encolado cuando llega otro más nuevo es trabajo desperdiciado que el main
// descarta por `seq`. Con el debounce del hook como mucho hay uno en vuelo.
// `paginate` corre el mismo layout Go que `render` y bloquea igual este
// hilo, por eso vive aquí y no en el main thread.

interface InitMessage {
  type: 'init'
  wasmExecUrl: string
  pdfWasmUrl: string
}

interface RenderMessage {
  type: 'render'
  seq: number
  text: string
}

interface PaginateMessage {
  type: 'paginate'
  seq: number
  text: string
}

type InMessage = InitMessage | RenderMessage | PaginateMessage

// Este archivo corre como worker CLÁSICO (sin `type: 'module'`): no puede
// contener NINGUNA sentencia `import`/`export`, ni siquiera solo de tipos —
// Vite emite entonces `export {};` y el worker no parsea (`SyntaxError:
// Unexpected token 'export'`). Por eso `ScenePage` se duplica aquí sin
// exportar (canónico en `pdfWorkerClient.ts`).
interface ScenePage {
  line: number
  page: number
}

// El worker se compila con los libs DOM de la app, que no traen
// `importScripts` ni el `postMessage` con transfer de un
// `DedicatedWorkerGlobalScope`: se declaran aquí el mínimo necesario sin
// mezclar `lib.webworker` (chocaría con `lib.dom`).
declare function importScripts(...urls: string[]): void

interface WorkerScope {
  postMessage(message: unknown, transfer: Transferable[]): void
  postMessage(message: unknown): void
  onmessage: ((ev: MessageEvent<InMessage>) => void) | null
}

const scope = self as unknown as WorkerScope

let renderPDF: ((text: string) => Uint8Array | null) | null = null
let paginate: ((text: string) => string | null) | null = null
let failure: Error | null = null
let ready: Promise<void> | null = null

async function instantiate(
  pdfWasmUrl: string,
  imports: WebAssembly.Imports,
): Promise<WebAssembly.Instance> {
  if (
    typeof WebAssembly.instantiateStreaming === 'function' &&
    /^https?:/.test(pdfWasmUrl)
  ) {
    try {
      const streamed = await WebAssembly.instantiateStreaming(
        fetch(pdfWasmUrl),
        imports,
      )
      return streamed.instance
    } catch {
      // Fall through: Content-Type incorrecto o 404 en la ruta del wasm.
    }
  }
  const response = await fetch(pdfWasmUrl)
  if (!response.ok) {
    throw new Error(`${pdfWasmUrl} devolvió HTTP ${response.status}`)
  }
  const { instance } = await WebAssembly.instantiate(
    await response.arrayBuffer(),
    imports,
  )
  return instance
}

function ensureReady(wasmExecUrl: string, pdfWasmUrl: string): Promise<void> {
  if (!ready) {
    ready = (async () => {
      importScripts(wasmExecUrl)
      const GoCtor = (globalThis as Record<string, unknown>).Go as
        | (new () => {
            importObject: WebAssembly.Imports
            run: (instance: WebAssembly.Instance) => Promise<unknown>
          })
        | undefined
      if (!GoCtor) {
        throw new Error(
          `${wasmExecUrl} no definió globalThis.Go (¿versión incorrecta de wasm_exec.js?)`,
        )
      }
      const go = new GoCtor()
      const instance = await instantiate(pdfWasmUrl, go.importObject)
      go.run(instance).catch((err: unknown) => {
        failure =
          err instanceof Error
            ? err
            : new Error(`el módulo PDF murió: ${String(err)}`)
      })
      const fn = (globalThis as Record<string, unknown>).fountainRenderPDF
      if (typeof fn !== 'function') {
        throw new Error(
          'el módulo no registró globalThis.fountainRenderPDF (¿wasm desactualizado?)',
        )
      }
      renderPDF = fn as (text: string) => Uint8Array | null
      const pg = (globalThis as Record<string, unknown>).fountainPaginate
      if (typeof pg !== 'function') {
        throw new Error(
          'el módulo no registró globalThis.fountainPaginate (¿wasm desactualizado?)',
        )
      }
      paginate = pg as (text: string) => string | null
    })()
    // Un init fallido no se cachea: el siguiente init reintenta.
    ready.catch(() => {
      ready = null
    })
  }
  return ready
}

scope.onmessage = (ev: MessageEvent<InMessage>) => {
  const msg = ev.data
  if (msg.type === 'init') {
    ensureReady(msg.wasmExecUrl, msg.pdfWasmUrl).then(
      () => scope.postMessage({ type: 'ready' }),
      (err: unknown) =>
        scope.postMessage({
          type: 'init-error',
          message: err instanceof Error ? err.message : String(err),
        }),
    )
    return
  }
  if (msg.type === 'render') {
    if (failure) {
      scope.postMessage({
        type: 'render-error',
        seq: msg.seq,
        message: failure.message,
      })
      return
    }
    if (!renderPDF) {
      scope.postMessage({
        type: 'render-error',
        seq: msg.seq,
        message: 'motor PDF aún no inicializado (falta init)',
      })
      return
    }
    try {
      // Llamada Go síncrona: bloquea ESTE hilo, nunca el main.
      const bytes = renderPDF(msg.text)
      if (!bytes) {
        throw new Error(
          'renderPDF() falló dentro del módulo wasm (ver consola del worker)',
        )
      }
      scope.postMessage({ type: 'done', seq: msg.seq, bytes }, [bytes.buffer])
    } catch (err: unknown) {
      scope.postMessage({
        type: 'render-error',
        seq: msg.seq,
        message: err instanceof Error ? err.message : String(err),
      })
    }
    return
  }
  if (msg.type === 'paginate') {
    if (failure) {
      scope.postMessage({
        type: 'paginate-error',
        seq: msg.seq,
        message: failure.message,
      })
      return
    }
    if (!paginate) {
      scope.postMessage({
        type: 'paginate-error',
        seq: msg.seq,
        message: 'motor PDF aún no inicializado (falta init)',
      })
      return
    }
    try {
      // Llamada Go síncrona: bloquea ESTE hilo, nunca el main. Se parsea
      // aquí para que el main reciba el array listo (clon estructurado).
      const raw = paginate(msg.text)
      if (raw === null || raw === undefined) {
        throw new Error(
          'paginate() falló dentro del módulo wasm (ver consola del worker)',
        )
      }
      const pages = JSON.parse(raw) as ScenePage[]
      scope.postMessage({ type: 'paginate-done', seq: msg.seq, pages })
    } catch (err: unknown) {
      scope.postMessage({
        type: 'paginate-error',
        seq: msg.seq,
        message: err instanceof Error ? err.message : String(err),
      })
    }
  }
}
