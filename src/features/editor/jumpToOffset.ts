// src/features/editor/jumpToOffset.ts — salto del cursor al texto (punto 4).
//
// Vive aparte de `./Editor.tsx` porque ese archivo exporta un componente y el
// plugin de react-refresh no admite que se exporte otra cosa: mezclar un
// componente con utilidades rompe el fast refresh en desarrollo.

import type { EditorView } from '@codemirror/view'

/**
 * Coloca el cursor en `offset` y trae la vista.
 *
 * `scrollIntoView` va en la misma transacción, que es lo que hace que el texto
 * quede visible sin medirlo aquí, y el `focus` es lo que permite seguir
 * escribiendo tras el salto. El offset se sujeta al documento: si el texto
 * cambió entre el clic y el salto, se recorta a la longitud real en vez de
 * lanzar.
 */
export function jumpToOffset(view: EditorView, offset: number): void {
  const at = Math.min(Math.max(offset, 0), view.state.doc.length)
  view.dispatch({
    selection: { anchor: at },
    scrollIntoView: true,
  })
  view.focus()
}
