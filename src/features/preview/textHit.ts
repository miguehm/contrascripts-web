// src/features/preview/textHit.ts — hit-test del puntero sobre los ítems de
// texto del PDF (REVIEW.md punto 4).
//
// El preview es un canvas rasterizado, así que no hay nodos DOM bajo el cursor:
// para saber qué texto se ha doble-clickado hay que consultar los ítems que
// pdf.js devuelve en `page.getTextContent()` y compararlos con el punto del
// puntero. Se hace por geometría y no por una capa de texto superpuesta a
// propósito: los spans de `TextLayer` son seleccionables (`cursor: text`) y se
// llevarían por delante el gesto de zoom por doble-tap-arrastre, que hoy vive
// en este mismo contenedor.
//
// Todo el módulo es pura y sin DOM para poder testearla con números.
// Las unidades son CSS px relativas a la esquina superior izquierda de la hoja,
// que es como `viewport.transform` proyecta los ítems.

import type { PdfPageViewport, PdfTextItem } from '@/lib/pdfjs'

/** Caja del ítem en px de la hoja: origen arriba-izquierda, alto = alto de fuente. */
export interface ItemRect {
  left: number
  top: number
  width: number
  height: number
}

/** Ítem alcanzado y el carácter dentro de él, estimado por posición horizontal. */
export interface ItemHit {
  item: PdfTextItem
  /** Índice del carácter más cercano al clic dentro de `item.str`. */
  charIndex: number
}

/**
 * Producto de dos matrices de transformación 2D de 6 elementos (afín).
 *
 * Es el cálculo que hace `pdfjsLib.Util.transform`, copiado aquí a propósito:
 * importar `Util` arrastraría el runtime entero de pdf.js —que necesita
 * `DOMMatrix`, es decir un DOM— dentro de un módulo que solo hace aritmética y
 * que así se testea en node sin navegador.
 */
function transform(m1: readonly number[], m2: readonly number[]): number[] {
  return [
    m1[0]! * m2[0]! + m1[2]! * m2[1]!,
    m1[1]! * m2[0]! + m1[3]! * m2[1]!,
    m1[0]! * m2[2]! + m1[2]! * m2[3]!,
    m1[1]! * m2[2]! + m1[3]! * m2[3]!,
    m1[0]! * m2[4]! + m1[2]! * m2[5]! + m1[4]!,
    m1[1]! * m2[4]! + m1[3]! * m2[5]! + m1[5]!,
  ]
}

/**
 * Caja del ítem en px de la hoja.
 *
 * `item.transform` es la matriz de texto en espacio PDF y `viewport.transform`
 * la del visor (ya escalada y con el eje Y volteado): compuestas dan la línea
 * base en px de pantalla. El alto sale de la propia matriz en vez de las
 * métricas de la fuente, que no están disponibles sin cargar el stylesheet.
 */
export function itemRect(
  item: PdfTextItem,
  viewport: PdfPageViewport,
): ItemRect {
  const tx = transform(viewport.transform, item.transform)
  const height = Math.hypot(tx[2], tx[3])
  return {
    left: tx[4],
    top: tx[5] - height,
    // `item.width` viene en espacio PDF (sin escalar): la escala la pone el
    // viewport, no el ítem.
    width: item.width * viewport.scale,
    height,
  }
}

/**
 * Carácter del ítem más cercano a `x`.
 *
 * Courier Prime es monoespaciada —también en el PDF que genera el renderer—,
 * así que el ancho del ítem se reparte por igual entre sus caracteres y la
 * posición horizontal da el índice sin medir la fuente. El redondeo elige el
 * carácter cuyo centro está bajo el cursor.
 */
export function charIndexAt(
  item: PdfTextItem,
  rect: ItemRect,
  x: number,
): number {
  const len = item.str.length
  if (len === 0 || rect.width <= 0) return 0
  const raw = ((x - rect.left) / rect.width) * len
  return Math.min(len - 1, Math.max(0, Math.round(raw)))
}

/** Distancia de un punto a una caja (0 si está dentro). */
function distanceToRect(rect: ItemRect, x: number, y: number): number {
  const dx =
    x < rect.left
      ? rect.left - x
      : x > rect.left + rect.width
        ? x - rect.left - rect.width
        : 0
  const dy =
    y < rect.top
      ? rect.top - y
      : y > rect.top + rect.height
        ? y - rect.top - rect.height
        : 0
  return Math.hypot(dx, dy)
}

/**
 * Ítem de texto bajo el punto `(x, y)`, o `null` si el clic cayó en un margen.
 *
 * El margen devuelve `null` a propósito: el doble-clic en el papel sin texto no
 * tiene a dónde saltar y así el gesto no hace nada en lugar de llevar al
 * cursor a un sitio arbitrario.
 */
export function pickItemAt(
  items: readonly PdfTextItem[],
  viewport: PdfPageViewport,
  x: number,
  y: number,
  tolerance = 8,
): ItemHit | null {
  let best: ItemHit | null = null
  let bestDist = Number.POSITIVE_INFINITY
  for (const item of items) {
    // Los ítems vacíos son los saltos de línea que gofpdf escribe entre
    // bloques: sin texto no hay nada a dónde saltar.
    if (!item.str || !item.str.trim()) continue
    const rect = itemRect(item, viewport)
    if (!(rect.height > 0) || !(rect.width > 0)) continue
    const dist = distanceToRect(rect, x, y)
    if (dist > tolerance || dist >= bestDist) continue
    bestDist = dist
    best = { item, charIndex: charIndexAt(item, rect, x) }
  }
  return best
}
