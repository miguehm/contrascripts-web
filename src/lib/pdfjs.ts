// src/lib/pdfjs.ts — punto único de configuración de pdf.js.
//
// - El worker se sirve como asset local con hash vía `?url` (patrón
//   recomendado con Vite: sin 404 por rutas relativas en SPA y compatible
//   con `worker-src 'self'` si se endurece la CSP de §7).
// - `pdfjs-dist` está pineado exacto en package.json (regla 1 de AGENTS.md);
//   el worker y la lib deben salir del mismo paquete instalado.

import * as pdfjsLib from 'pdfjs-dist'
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

export const getDocument = pdfjsLib.getDocument
export type PdfDocument = PDFDocumentProxy
export type PdfPage = PDFPageProxy
