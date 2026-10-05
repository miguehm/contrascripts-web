// src/store/themeStorage.ts — único acceso a localStorage del tema (§8 +
// REVIEW.md punto 9).
//
// Los componentes tienen prohibido tocar `localStorage` (AGENTS.md nº2);
// pasan por `ThemeProvider` → este módulo. Un dato corrupto o ausente
// cae a `system` (por defecto acordado: sigue al SO; la preferencia
// guardada del usuario prevalece siempre) sin tumbar el boot.

import type { Theme } from '@/types/Theme'

/** Clave del tema activo (fijada por el plan §8). */
export const THEME_KEY = 'guion.theme.v1'

/** Tema por defecto (sigue al sistema operativo). */
export const DEFAULT_THEME: Theme = 'system'

function isTheme(value: unknown): value is Theme {
  return value === 'dark' || value === 'light' || value === 'system'
}

/** Lee el tema persistido. Nunca lanza: ante ausencia, JSON roto o valor
 * inesperado, devuelve `system`. */
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
