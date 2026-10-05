// src/hooks/useEditorPosition.ts — conserva cursor + scroll del editor
// (REVIEW.md 6).
//
// Al entrar en la vista en grande (`previewExpanded`) o al cambiar de tab en
// móvil, `App` desmonta la columna del editor y el `EditorView` de CodeMirror
// nace de nuevo con el cursor en 0 y el scroll arriba. Este hook guarda la
// selección y un snapshot de scroll por guion (memoria de sesión, no
// `localStorage`) y los restituye al remontar o al cambiar de guion.
//
// El scroll se guarda con `view.scrollSnapshot()` y se restaura despachando
// ese efecto: CodeMirror ancla a la línea realmente visible arriba
// (`scrollAnchorAt`, no al inicio de su viewport de render con margen) y su
// propio bucle de medición re-ancla hasta estabilizar. Un ancla manual
// (línea de `viewport.from` + px) derivaba en el primer salto a zonas sin
// medir, porque ese `from` incluye margen por encima de lo visible.
//
// Solo se guarda desde vistas con tamaño: hay dos editores montados a la vez
// (móvil + desktop, uno oculto por CSS) y el oculto informaría ceros que
// pisarían la posición real. `saveView` ignora vistas sin layout salvo que
// se le pida explícito (`allowHidden`, para el cleanup de desmontaje, donde
// la vista ya perdió el layout pero la selección sigue siendo válida;
// entonces se conserva el snapshot previo).

import { useCallback, useMemo, useRef } from 'react'
import type { StateEffect } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'

export interface EditorPos {
  anchor: number
  head: number
  /** Efecto de `view.scrollSnapshot()`; `null` si no se pudo capturar. */
  snapshot: StateEffect<unknown> | null
}

export interface RestoreEditorOptions {
  /** Aborta la espera de asentamiento (gesto del usuario). */
  isCancelled?: () => boolean
  /** Avisa cuando la restauración termina, por el motivo que sea. */
  onSettled?: () => void
}

export interface EditorPositionStore {
  /** Lee selección + snapshot de scroll y los guarda bajo `key` (guion). */
  saveView: (
    key: string | null | undefined,
    view: EditorView | null,
    allowHidden?: boolean,
  ) => void
  /**
   * Restituye selección + scroll en la vista. Sujeta los offsets a la
   * longitud del documento (el texto pudo cambiar entre medias); el efecto
   * snapshot lo clampa/mapea con gracia. El cursor no se fuerza a vista:
   * vuelve donde se dejó, visible o no (exactitud total). Devuelve `true`
   * si había dato.
   */
  restoreView: (
    key: string | null | undefined,
    view: EditorView | null,
    options?: RestoreEditorOptions,
  ) => boolean
  /** ¿Hay posición guardada para este guion? */
  has: (key: string | null | undefined) => boolean
  /** Olvida la posición de un guion. */
  clear: (key: string | null | undefined) => void
}

/**
 * Sujeta un offset a [0, docLength]; no-finitos caen al `fallback`.
 * Pura para testear.
 */
export function clampOffset(
  value: number,
  docLength: number,
  fallback = 0,
): number {
  const len = Number.isFinite(docLength) ? Math.max(docLength, 0) : 0
  if (!Number.isFinite(value)) return Math.min(Math.max(fallback, 0), len)
  return Math.min(Math.max(Math.round(value), 0), len)
}

/** ¿Tiene la vista layout medible (no oculta por CSS)? */
export function viewIsVisible(view: EditorView): boolean {
  try {
    const el = view.scrollDOM ?? view.dom
    if (!el) return false
    return (el.clientWidth ?? 0) > 0 || (el.clientHeight ?? 0) > 0
  } catch {
    return false
  }
}

function readSelection(view: EditorView): { anchor: number; head: number } {
  try {
    const main = view.state.selection.main
    return { anchor: main.anchor, head: main.head }
  } catch {
    return { anchor: 0, head: 0 }
  }
}

function readDocLength(view: EditorView): number {
  try {
    return view.state.doc.length
  } catch {
    return 0
  }
}

/**
 * Captura el snapshot de scroll de CodeMirror. Internamente usa
 * `scrollAnchorAt(scrollOffset)` —la línea realmente visible arriba— en
 * vez del inicio del viewport de render (con margen), así que no deriva
 * en el primer salto a zonas sin medir. `null` si no se puede.
 */
function readSnapshot(view: EditorView): StateEffect<unknown> | null {
  try {
    const effect = view.scrollSnapshot()
    return (effect ?? null) as StateEffect<unknown> | null
  } catch {
    return null
  }
}

export function useEditorPosition(): EditorPositionStore {
  const positionsRef = useRef(new Map<string, EditorPos>())

  const saveView = useCallback<EditorPositionStore['saveView']>(
    (key, view, allowHidden = false) => {
      if (!key || !view) return
      const { anchor, head } = readSelection(view)
      if (!viewIsVisible(view)) {
        if (!allowHidden) return
        // Sin layout (oculta por CSS o ya desmontada): la selección sigue
        // válida y se guarda, pero no hay snapshot fiable que capturar:
        // se conserva el previo.
        const prev = positionsRef.current.get(key)
        positionsRef.current.set(key, {
          anchor,
          head,
          snapshot: prev?.snapshot ?? null,
        })
        return
      }
      positionsRef.current.set(key, {
        anchor,
        head,
        snapshot: readSnapshot(view),
      })
    },
    [],
  )

  const restoreView = useCallback<EditorPositionStore['restoreView']>(
    (key, view, options) => {
      if (!key || !view) return false
      const pos = positionsRef.current.get(key)
      if (!pos) return false
      const docLength = readDocLength(view)
      const anchor = clampOffset(pos.anchor, docLength)
      const head = clampOffset(pos.head, docLength)
      try {
        // Selección + snapshot en la misma transacción: CodeMirror coloca
        // el scroll con su propio bucle de medición (re-ancla hasta
        // estabilizar), sin fijación manual.
        view.dispatch({
          selection: { anchor, head },
          effects: pos.snapshot ? [pos.snapshot] : [],
        })
      } catch {
        return false
      }
      const isCancelled = options?.isCancelled
      const onSettled = options?.onSettled
      // CodeMirror resuelve el snapshot en su medida (mayoritariamente
      // síncrona dentro del dispatch); aquí solo se esperan un par de
      // frames para soltar el guard de guardado, que cubre los `scroll`
      // async que dispara la fijación.
      if (typeof requestAnimationFrame === 'undefined') {
        onSettled?.()
        return true
      }
      requestAnimationFrame(() => {
        if (isCancelled?.()) {
          onSettled?.()
          return
        }
        requestAnimationFrame(() => {
          onSettled?.()
        })
      })
      return true
    },
    [],
  )

  const has = useCallback<EditorPositionStore['has']>((key) => {
    if (!key) return false
    return positionsRef.current.has(key)
  }, [])

  const clear = useCallback<EditorPositionStore['clear']>((key) => {
    if (!key) return
    positionsRef.current.delete(key)
  }, [])

  // Identidad estable (ver `usePreviewScroll`: evita refires en efectos).
  return useMemo(
    () => ({ saveView, restoreView, has, clear }),
    [saveView, restoreView, has, clear],
  )
}
