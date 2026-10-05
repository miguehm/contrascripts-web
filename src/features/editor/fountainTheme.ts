// src/features/editor/fountainTheme.ts — tema CodeMirror con los tokens §8.
//
// Sin dependencia extra (`@uiw/codemirror-themes`): `EditorView.theme` para el
// layout + `HighlightStyle` para los tags propios de `./fountain`. Los colores
// salen de las CSS vars (`--card`, `--syntax`, ...), así dark/light conmutan
// solos con la clase `.dark` de `useTheme` — el mismo tema vale para desktop,
// móvil y los webviews de Fase 2. El gutter es compacto a propósito (0.75rem)
// para no robar ancho en pantallas estrechas.

import { EditorView } from '@codemirror/view'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import type { Extension } from '@codemirror/state'
import { fountainTags } from './fountain'

const fountainHighlight = HighlightStyle.define([
  {
    tag: fountainTags.sceneHeading,
    fontWeight: '700',
    letterSpacing: '0.05em',
    // Tinta del panel (`--card`), no de la hoja del preview (`--paper-ink`
    // es casi negro y en dark sería ilegible sobre el fondo oscuro).
    color: 'var(--card-foreground)',
  },
  { tag: fountainTags.character, fontWeight: '700', color: 'var(--syntax)' },
  { tag: fountainTags.transition, fontWeight: '700', color: 'var(--syntax)' },
  {
    tag: fountainTags.parenthetical,
    fontStyle: 'italic',
    color: 'var(--muted-foreground)',
  },
  { tag: fountainTags.dialogue, color: 'var(--card-foreground)' },
  { tag: fountainTags.centered, fontWeight: '700' },
  {
    tag: fountainTags.lyric,
    fontStyle: 'italic',
    color: 'var(--muted-foreground)',
  },
  { tag: fountainTags.section, fontWeight: '700', color: 'var(--syntax)' },
  {
    tag: fountainTags.synopsis,
    fontStyle: 'italic',
    color: 'var(--muted-foreground)',
  },
  { tag: fountainTags.pageBreak, color: 'var(--muted-foreground)' },
  { tag: fountainTags.note, color: 'var(--muted-foreground)' },
  { tag: fountainTags.boneyard, color: 'var(--muted-foreground)' },
  { tag: fountainTags.titlePage, fontWeight: '600' },
  { tag: tags.strong, fontWeight: '700' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.monospace, textDecoration: 'underline' },
])

const fountainLayout = EditorView.theme({
  '&': {
    height: '100%',
    minHeight: '0',
    backgroundColor: 'transparent',
    color: 'var(--card-foreground)',
    fontSize: '1rem',
  },
  // El scroll debe quedar dentro del editor: sin esto, con la rama
  // monopanel (preview oculto) el contenido empuja la altura de la página
  // y el header/sidebar hacen scroll (REVIEW.md punto 1).
  '.cm-editor': {
    height: '100%',
    minHeight: '0',
    overflow: 'hidden',
  },
  '.cm-scroller': {
    minHeight: '0',
    overflow: 'auto',
    // REVIEW.md punto 4: misma fina que `.scroll-slim` (aquí no sirve
    // className: el scroll real es interno de CodeMirror).
    scrollbarWidth: 'thin',
    scrollbarColor: 'var(--border) transparent',
  },
  '.cm-scroller::-webkit-scrollbar': {
    width: '10px',
    height: '10px',
  },
  '.cm-scroller::-webkit-scrollbar-track, .cm-scroller::-webkit-scrollbar-corner':
    {
      background: 'transparent',
    },
  '.cm-scroller::-webkit-scrollbar-thumb': {
    backgroundColor: 'var(--border)',
    borderRadius: '9999px',
    border: '3px solid transparent',
    backgroundClip: 'content-box',
  },
  '.cm-scroller::-webkit-scrollbar-thumb:hover': {
    backgroundColor: 'var(--muted-foreground)',
    backgroundClip: 'content-box',
  },
  '.cm-content': {
    fontFamily: 'var(--font-mono)',
    // REVIEW.md punto 9: tamaño e interlineado configurables. `Editor`
    // escribe `--editor-font-size` (longitud) y `--editor-line-height`
    // (multiplicador) en su envoltura; sin prefs valen lo previo
    // (`1rem` / `1.625rem`).
    fontSize: 'var(--editor-font-size, 1rem)',
    lineHeight:
      'calc(var(--editor-font-size, 1rem) * var(--editor-line-height, 1.625))',
    caretColor: '#d97706',
    padding: '1rem',
  },
  '.cm-gutters': {
    backgroundColor: 'transparent',
    border: 'none',
    color: 'var(--muted-foreground)',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.75rem',
  },
  '.cm-lineNumbers .cm-gutterElement': {
    padding: '0 8px 0 4px',
    minWidth: '2ch',
  },
  '.cm-activeLine': {
    backgroundColor: 'color-mix(in srgb, var(--accent) 45%, transparent)',
  },
  // Punto 4: flash efímero de la línea destino tras saltar desde el PDF.
  // Ámbar de marca (caret, selección, anillo de foco), un punto más fuerte
  // que la selección (`var(--selection)`: 0.30 en light, 0.45 en dark) para destacar sobre ella; no
  // amarillo marcador, ni gris `--accent` (indistinguible del
  // `.cm-activeLine`), ni índigo `--syntax` (reservado a tokens Fountain).
  // OJO: rgba directo, no `color-mix(... transparent)`: mezclar contra negro
  // transparente embarra los canales (daba `rgba(65,36,2,0.3)`, invisible en
  // dark). Va con selector combinado para ganar siempre a `.cm-activeLine`:
  // el salto deja el cursor en esa línea y ambas clases coexisten. La
  // animación de aparición/retirada y el `prefers-reduced-motion` viven en
  // `src/index.css` (CSS plano, sin pelear con el tipado del theme de
  // CodeMirror); con animación desactivada este fondo estático es lo que se ve
  // (coincide con la meseta de la animación).
  '.cm-jump-flash': {
    backgroundColor: 'rgba(217, 119, 6, 0.55)',
  },
  '.cm-activeLine.cm-jump-flash': {
    backgroundColor: 'rgba(217, 119, 6, 0.55)',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'transparent',
    color: 'var(--foreground)',
  },
  '.cm-cursor': {
    borderLeftColor: '#d97706',
  },
  // OJO especificidad: el `baseTheme` de `drawSelection` en
  // `@codemirror/view` pinta `.cm-selectionBackground` con
  // `&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground`
  // (5 clases, `#d7d4f0` en light). Un selector corto (`&.cm-focused
  // .cm-selectionBackground`, 3 clases) pierde siempre y el lila manda — fue
  // la causa del punto 5. Hay que espejar la ruta completa para igualar (5
  // clases) y ganar por orden de montaje (`theme` lleva precedencia por
  // defecto y `baseTheme` va en `Prec.lowest`). La segunda rama cubre el
  // editor sin foco pasando por `.cm-selectionLayer` (3 clases) para batir
  // también al default unfocused `&light .cm-selectionBackground`.
  '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionLayer .cm-selectionBackground':
    {
      // REVIEW.md punto 5: token por tema (`--selection` en `index.css`).
      // El ámbar quemado fijo al 25% quedaba lavado en dark sobre `#131317`
      // con texto `#e4e1e7`; ahora light usa quemado al 30% y dark ámbar claro
      // al 45%, por debajo del flash del punto 4 (0.55) para no confundirse.
      backgroundColor: 'var(--selection)',
    },
  '.cm-placeholder': {
    fontFamily: 'var(--font-mono)',
    color: 'var(--muted-foreground)',
    opacity: '0.6',
  },
})

/** Extensión completa de presentación (layout + colores de sintaxis). */
export function fountainTheme(): Extension {
  return [fountainLayout, syntaxHighlighting(fountainHighlight)]
}
