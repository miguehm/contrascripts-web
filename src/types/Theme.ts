// src/types/Theme.ts — tema de la UI (§8 del PLAN.md + REVIEW.md punto 9).
//
// Tres preferencias: `light` y `dark` (temas editoriales) más `system`, que
// sigue a `prefers-color-scheme` del SO. Persistidas en localStorage
// (`contrascripts.theme.v1`); `system` es solo preferencia y nunca se aplica
// directa: el hook la resuelve a `ResolvedTheme` antes de tocar `.dark`.

/** Preferencia de tema guardable (incluye seguir al sistema). */
export type Theme = 'light' | 'dark' | 'system'

/** Tema efectivamente aplicado (`system` ya resuelto según el SO). */
export type ResolvedTheme = 'light' | 'dark'
