// src/types/Theme.ts — tema de la UI (§8 del PLAN.md).
//
// Valores persistidos en localStorage (`guion.theme.v1`): solo
// `dark | light`. Sin modo `system` a propósito: el plan fija dos temas
// editoriales (Warm / Cinematic) y el arranque por defecto es `light`.

/** Tema activo de la aplicación. */
export type Theme = 'dark' | 'light'
