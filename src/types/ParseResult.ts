// src/types/ParseResult.ts — tipos de la UI de §5 (no del parser).
//
// El parser aporta `Document | Warning | Fountain` (ver
// `src/vendor/fountain.d.mts`); aquí solo el estado que la UI necesita
// para boot, parse reactivo y exportar PDF.

import type { Document, Warning } from '../vendor/fountain.mjs'

/** Estado del boot del runtime WASM (`loadFountain()` en `src/fountain.ts`). */
export type BootStatus = 'booting' | 'ready' | 'error'

/** Resultado del parse reactivo que consume `<Preview>`. */
export interface ParseResult {
  status: BootStatus
  /** Documento parseado del texto actual; `null` antes del primer parse. */
  doc: Document | null
  /** Avisos de `lint()` para el texto actual. */
  warnings: Warning[]
  /** Mensaje de error de boot (solo cuando `status === 'error'`). */
  bootError: string | null
}
