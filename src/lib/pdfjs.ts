// src/lib/pdfjs.ts — punto único de configuración de pdf.js.
//
// - El worker se sirve como asset local con hash vía `?url` (patrón
//   recomendado con Vite: sin 404 por rutas relativas en SPA y compatible
//   con `worker-src 'self'` si se endurece la CSP de §7).
// - `pdfjs-dist` está pineado exacto en package.json (regla 1 de AGENTS.md);
//   el worker y la lib deben salir del mismo paquete instalado.

import * as pdfjsLib from 'pdfjs-dist'
import type { PDFDocumentProxy, PDFPageProxy, PageViewport } from 'pdfjs-dist'
// `TextContent` y `TextItem` no se re-exportan desde la raíz del paquete (el
// `pdf.d.ts` solo declara lo que el entry point expone), así que se toman de
// su módulo: son los tipos de `page.getTextContent()`, que usa el hit-test del
// punto 4 para saber qué texto hay bajo el puntero.
import type { TextContent, TextItem } from 'pdfjs-dist/types/src/display/api'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

export const getDocument = pdfjsLib.getDocument
export type PdfDocument = PDFDocumentProxy
export type PdfPage = PDFPageProxy
export type PdfPageViewport = PageViewport
export type PdfTextContent = TextContent
export type PdfTextItem = TextItem
