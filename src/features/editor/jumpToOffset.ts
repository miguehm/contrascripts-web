// src/features/editor/jumpToOffset.ts — salto del cursor al texto (punto 4).
//
// Vive aparte de `./Editor.tsx` porque ese archivo exporta un componente y el
// plugin de react-refresh no admite que se exporte otra cosa: mezclar un
// componente con utilidades rompe el fast refresh en desarrollo.

import { EditorView } from '@codemirror/view'
import { addJumpHighlight, scheduleJumpFlashClear } from './jumpHighlight'

/** Fracción de la altura del editor que queda por encima de la línea destino. */
export const JUMP_TOP_FRACTION = 0.25

/**
 * Margen vertical para el salto: ~25% de la altura visible del editor.
 *
 * Pura para testear. `EditorView.scrollIntoView` exige `yMargin` menor que la
 * altura del editor, así que se sujeta por arriba; con altura 0 (tests jsdom)
 * cae a 0 y el salto sigue funcionando sin posicionamiento.
 */
export function jumpMarginForHeight(height: number): number {
  if (!Number.isFinite(height) || height <= 0) return 0
  return Math.min(Math.round(height * JUMP_TOP_FRACTION), height - 1)
}

/**
 * Coloca el cursor en `offset`, trae la línea al ~25% de la altura del editor
 * y la resalta de forma efímera.
 *
 * El posicionamiento va en la misma transacción (`EditorView.scrollIntoView`
 * con `y: "start"` + `yMargin` del 25%): sin medir bloques a mano y sin
 * carreras con el layout. Cerca del final del documento CodeMirror sujeta el
 * scroll de forma natural (la línea queda abajo: no hay más contenido que
 * mostrar). El `focus` permite seguir escribiendo tras el salto y el flash de
 * `./jumpHighlight` muestra hacia dónde saltó el cursor (~1.2s). El offset se
 * sujeta al documento: si el texto cambió entre el clic y el salto, se
 * recorta a la longitud real en vez de lanzar.
 */
export function jumpToOffset(view: EditorView, offset: number): void {
  const at = Math.min(Math.max(offset, 0), view.state.doc.length)
  const yMargin = jumpMarginForHeight(view.scrollDOM?.clientHeight ?? 0)
  view.dispatch({
    selection: { anchor: at },
    effects: [
      EditorView.scrollIntoView(at, { y: 'start', yMargin }),
      addJumpHighlight.of(at),
    ],
  })
  scheduleJumpFlashClear(view)
  view.focus()
}
