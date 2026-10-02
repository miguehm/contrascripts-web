// src/fountain.ts — singleton del runtime WASM (§4 del PLAN.md).
//
// Copia tipada de `web/vite/src/fountain.js:19-35` del repo del parser:
// arranca el runtime Go una sola vez y lo comparte.
//
// - `Symbol.for('fountain.instance')` en `globalThis` sobrevive a la doble
//   invocación de efectos de React StrictMode en dev y a la re-evaluación
//   del módulo por HMR de Vite; una variable a nivel de módulo no basta.
// - `base: './fountain'` (relativa) es obligatorio bajo bundler: el
//   `import.meta.url` del wrapper se pierde en el chunk y deja de apuntar
//   a la carpeta de los `.wasm`. La raíz absoluta (`'/fountain'`) funciona
//   en web pero no en `tauri://localhost` ni `https://localhost`
//   (Capacitor, Fase 2).
// - `window.__fountainBoots` es el contador del fixture para la aserción
//   de StrictMode (§9.5): debe valer 1 tras montar en dev.

import { createFountain, type Fountain } from './vendor/fountain.mjs'

const INSTANCE = Symbol.for('fountain.instance')

declare global {
  interface Window {
    __fountainBoots?: number
  }
}

function boot(): Promise<Fountain> {
  window.__fountainBoots = (window.__fountainBoots ?? 0) + 1
  return createFountain({ base: './fountain' })
}

export function loadFountain(): Promise<Fountain> {
  const g = globalThis as Record<symbol, Promise<Fountain> | undefined>
  g[INSTANCE] ??= boot()
  return g[INSTANCE] as Promise<Fountain>
}

export type { Fountain }
