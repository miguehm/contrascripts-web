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
    lineHeight: '1.625rem',
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
  '.cm-activeLineGutter': {
    backgroundColor: 'transparent',
    color: 'var(--foreground)',
  },
  '.cm-cursor': {
    borderLeftColor: '#d97706',
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
    backgroundColor: 'rgba(217,119,6,0.25)',
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
