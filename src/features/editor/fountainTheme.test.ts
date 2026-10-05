// @vitest-environment jsdom
// Punto 5: la selección del editor debe pintarse con `var(--selection)` y con
// un selector que bata al default de `drawSelection` (`#d7d4f0`, 5 clases).
// Si el selector se simplifica, el lila de CodeMirror vuelve a mandar en
// silencio: este test monta un `EditorView` real y lee el CSS generado por
// style-mod.
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { describe, expect, it } from 'vitest'
import { fountainTheme } from './fountainTheme'

/** Reglas del documento que mencionan el fondo de selección. */
function selectionRules(): string[] {
  const parent = document.createElement('div')
  document.body.appendChild(parent)
  const view = new EditorView({
    state: EditorState.create({
      doc: 'INT. CASA - DÍA',
      extensions: [fountainTheme()],
    }),
    parent,
  })
  const css = Array.from(document.head.querySelectorAll('style'))
    .map((s) => s.textContent ?? '')
    .join('\n')
  view.destroy()
  parent.remove()
  return css.match(/[^{}]*cm-selectionBackground\s*\{[^}]*\}/g) ?? []
}

describe('fountainTheme selección (punto 5)', () => {
  it('la regla focused espeja la ruta del default de CM con var(--selection)', () => {
    // El default es `&.cm-focused > .cm-scroller > .cm-selectionLayer
    // .cm-selectionBackground` (5 clases): hay que igualarlo para ganar por
    // orden de montaje (`theme` sobre `baseTheme` en `Prec.lowest`).
    const ours = selectionRules().filter((r) => r.includes('var(--selection)'))
    expect(ours.length).toBeGreaterThan(0)
    expect(
      ours.some(
        (r) =>
          r.includes('cm-focused') &&
          r.includes('cm-scroller') &&
          r.includes('cm-selectionLayer'),
      ),
    ).toBe(true)
  })

  it('todas nuestras ramas pasan por .cm-selectionLayer (también unfocused)', () => {
    // El default unfocused (`&light .cm-selectionBackground`) bate a un
    // `.cm-selectionBackground` pelado: la rama sin foco también debe llevar
    // la ruta larga.
    const ours = selectionRules().filter((r) => r.includes('var(--selection)'))
    expect(ours.length).toBeGreaterThan(0)
    expect(ours.every((r) => r.includes('cm-selectionLayer'))).toBe(true)
  })
})
