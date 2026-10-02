// src/store/themeStorage.ts — único acceso a localStorage del tema (§8).
//
// Los componentes tienen prohibido tocar `localStorage` (AGENTS.md nº2);
// pasan por `ThemeProvider` → este módulo. Un dato corrupto o ausente
// cae a `light` (por defecto acordado) sin tumbar el boot.

import type { Theme } from '@/types/Theme'

/** Clave del tema activo (fijada por el plan §8). */
export const THEME_KEY = 'guion.theme.v1'

/** Tema por defecto (Warm Screenplay Minimal). */
export const DEFAULT_THEME: Theme = 'light'

function isTheme(value: unknown): value is Theme {
  return value === 'dark' || value === 'light'
}

/** Lee el tema persistido. Nunca lanza: ante ausencia, JSON roto o valor
 * inesperado, devuelve `light`. */
export function loadTheme(): Theme {
  try {
    const raw = globalThis.localStorage?.getItem(THEME_KEY)
    if (raw == null || raw === '') return DEFAULT_THEME
    const parsed: unknown = JSON.parse(raw)
    return isTheme(parsed) ? parsed : DEFAULT_THEME
  } catch {
    return DEFAULT_THEME
  }
}

/** Persiste el tema. Nunca lanza (un fallo de cuota en 7 bytes es
 * irrelevante, pero no debe tumbar la UI). */
export function saveTheme(theme: Theme): void {
  try {
    globalThis.localStorage?.setItem(THEME_KEY, JSON.stringify(theme))
  } catch {
    // Intencionadamente silencioso: el tema es cosmético.
  }
}
