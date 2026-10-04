// src/features/editor/jumpHighlight.ts — flash temporal de la línea destino.
//
// Vive aparte de `./Editor.tsx` por la misma razón que `./jumpToOffset`: el
// plugin de react-refresh no admite utilidades junto a componentes.
//
// El salto desde el PDF (punto 4) mueve el cursor, pero en un guion largo el
// ojo tarda en encontrar dónde cayó. Este field decora la línea destino con
// `.cm-jump-flash` (fondo ámbar de marca, ver `fountainTheme.ts`) durante
// ~1.2s y luego la retira: es un gesto efímero de orientación, no una
// selección. Un segundo salto reemplaza al anterior (no se apilan).
//
// La decoración es `Decoration.line`: cubre la línea lógica completa aunque
// tenga wrapping. El `yMargin` del 25% vive en `jumpToOffset`, no aquí.
//
// OJO (bug real, corregido): `Decoration.line` decora "the line STARTING at the
// given position" (doc de CodeMirror). El offset que llega es el de la palabra
// clicada, casi siempre a MITAD de línea (`sourceMap.ts` devuelve `inicio +
// columna`); decorar ahí no decora nada y la clase no aparecía salvo cuando la
// palabra era el primer carácter de su línea. Por eso se ancla a
// `doc.lineAt(pos).from`: la API exige un inicio de línea real.

import { Decoration, EditorView } from '@codemirror/view'
import { StateEffect, StateField } from '@codemirror/state'
import type { DecorationSet } from '@codemirror/view'

/**
 * Duración del flash (ms): 2s con meseta sólida (~0.8s) y fundido final.
 * El fundido inmediato anterior moría antes de que los ojos llegaran del PDF
 * al editor; la meseta sobrevive a ese viaje. Acoplada a la animación
 * `jump-flash` de `src/index.css`: cambiar ambas a la vez.
 */
export const JUMP_FLASH_DURATION_MS = 2000

/** Añade el flash en la línea que contiene `offset` (reemplaza el anterior). */
export const addJumpHighlight = StateEffect.define<number>()

/** Retira el flash, normalmente vía el timer de `scheduleJumpFlashClear`. */
export const clearJumpHighlight = StateEffect.define<void>()

/** Field de decoración del flash. Se registra en `EXTENSIONS` de `Editor`. */
export const jumpLineHighlightField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update: (value, tr) => {
    value = value.map(tr.changes)
    for (const effect of tr.effects) {
      if (effect.is(addJumpHighlight)) {
        // Ancla al inicio de la línea que contiene el offset: `Decoration.line`
        // solo decora la línea que EMPIEZA en la posición dada, y el offset de
        // la palabra clicada suele ser una columna a mitad de línea.
        const pos = Math.min(Math.max(effect.value, 0), tr.state.doc.length)
        const line = tr.state.doc.lineAt(pos)
        value = Decoration.set([
          Decoration.line({ class: 'cm-jump-flash' }).range(line.from),
        ])
      } else if (effect.is(clearJumpHighlight)) {
        value = Decoration.none
      }
    }
    return value
  },
  provide: (field) => EditorView.decorations.from(field),
})

const clearTimers = new WeakMap<EditorView, ReturnType<typeof setTimeout>>()

/**
 * Programa la retirada del flash tras `duration` ms. Si había un salto
 * anterior pendiente, su timer se cancela: solo hay un flash vivo por vista.
 * El `unref` evita retener el runner en Node/jsdom por un efecto cosmético;
 * en navegador es no-op (el id es un número).
 */
export function scheduleJumpFlashClear(
  view: EditorView,
  duration: number = JUMP_FLASH_DURATION_MS,
): void {
  const prev = clearTimers.get(view)
  if (prev !== undefined) clearTimeout(prev)
  const id = setTimeout(() => {
    clearTimers.delete(view)
    try {
      view.dispatch({ effects: clearJumpHighlight.of() })
    } catch {
      // Vista destruida entre el salto y el timer: nada que retirar.
    }
  }, duration)
  ;(id as unknown as { unref?: () => void }).unref?.()
  clearTimers.set(view, id)
}
