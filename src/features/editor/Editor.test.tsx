// @vitest-environment jsdom
// Smoke del Editor CodeMirror: monta, muestra gutter de líneas y expone el
// nombre accesible. La escritura real (contenteditable) se verifica en e2e,
// donde hay un navegador de verdad. El salto al texto (punto 4) sí se prueba
// aquí: `jumpToOffset` solo despacha en la vista.
import { cleanup, render } from '@testing-library/react'
import { EditorState } from '@codemirror/state'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { EditorView } from '@codemirror/view'
import { Editor } from './Editor'
import { jumpToOffset } from './jumpToOffset'
import { ThemeProvider } from '@/hooks/useTheme'

afterEach(cleanup)

function renderEditor(value = 'INT. CASA - DÍA') {
  return render(
    <ThemeProvider>
      <Editor value={value} onChange={vi.fn()} />
    </ThemeProvider>,
  )
}

describe('Editor', () => {
  it('monta el contenido con números de línea', () => {
    const { container } = renderEditor()
    expect(container.querySelector('.cm-content')).toBeTruthy()
    expect(container.querySelector('.cm-lineNumbers')).toBeTruthy()
    expect(
      container.querySelector('[aria-label="Editor Fountain"]'),
    ).toBeTruthy()
  })

  it('muestra el placeholder con el documento vacío', () => {
    const { container } = renderEditor('')
    expect(container.querySelector('.cm-placeholder')).toBeTruthy()
  })

  it('deshabilitado no es editable', () => {
    const { container } = render(
      <ThemeProvider>
        <Editor value="x" onChange={vi.fn()} disabled />
      </ThemeProvider>,
    )
    expect(container.querySelector('[contenteditable="false"]')).toBeTruthy()
  })

  it('sin headerAction la capitular va sola', () => {
    const { container } = renderEditor()
    expect(container.textContent).toContain('Fountain')
  })

  it('headerAction se monta a la derecha de la capitular', () => {
    const { getByRole } = render(
      <ThemeProvider>
        <Editor
          value="x"
          onChange={vi.fn()}
          headerAction={<button type="button">Acción</button>}
        />
      </ThemeProvider>,
    )
    expect(getByRole('button', { name: 'Acción' })).toBeDefined()
  })

  it('publica el EditorView y lo suelta al desmontar (punto 4)', () => {
    const onViewReady = vi.fn()
    const { unmount } = render(
      <ThemeProvider>
        <Editor value="x" onChange={vi.fn()} onViewReady={onViewReady} />
      </ThemeProvider>,
    )
    // Al montar publica la vista con su contenedor (lo que mide el padre para
    // saber cuál de los editores está visible).
    expect(onViewReady).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
    )
    unmount()
    // Al desmontar publica `(view, null)`: el consumidor retira esa vista sin
    // tocar la de la otra columna montada.
    expect(onViewReady).toHaveBeenLastCalledWith(expect.anything(), null)
  })

  it('mantiene la vista si el callback cambia de identidad', () => {
    // El padre pasa un arrow inline: si `onViewReady` fuera dependencia del
    // efecto de limpieza, cada render publicaría `null` y la vista se perdería.
    const seen: unknown[] = []
    const { rerender } = render(
      <ThemeProvider>
        <Editor
          value="x"
          onChange={vi.fn()}
          onViewReady={(v) => seen.push(v)}
        />
      </ThemeProvider>,
    )
    rerender(
      <ThemeProvider>
        <Editor
          value="y"
          onChange={vi.fn()}
          onViewReady={(v) => seen.push(v)}
        />
      </ThemeProvider>,
    )
    expect(seen[0]).not.toBeNull()
    expect(seen[seen.length - 1]).not.toBeNull()
  })
})

describe('jumpToOffset (punto 4)', () => {
  /** Vista mínima: `jumpToOffset` solo necesita `state` y `dispatch`. */
  function makeView(doc: string) {
    const state = EditorState.create({ doc })
    const dispatched: unknown[] = []
    const focus = vi.fn()
    const view = {
      state,
      focus,
      dispatch: (tr: { selection: { anchor: number } }) => {
        dispatched.push(tr)
      },
    } as unknown as EditorView
    return { view, dispatched, focus }
  }

  it('coloca el cursor en el offset y enfoca la vista', () => {
    // `scrollIntoView` en la misma transacción es lo que trae el texto.
    const { view, dispatched, focus } = makeView('una línea\notra')
    jumpToOffset(view, 12)

    expect(dispatched).toHaveLength(1)
    expect(dispatched[0]).toMatchObject({
      selection: { anchor: 12 },
      scrollIntoView: true,
    })
    expect(focus).toHaveBeenCalled()
  })

  it('acepta un offset absoluto en un documento multilínea', () => {
    // El offset es un índice del documento, no un par línea/columna.
    const { view, dispatched } = makeView('primera\nsegunda')
    const at = 'primera\nseg'.length
    jumpToOffset(view, at)
    expect(dispatched[0]).toMatchObject({ selection: { anchor: at } })
  })

  it('sujeta el offset a los límites del documento', () => {
    // Si el texto cambió entre el clic y el salto, se recorta en vez de fallar.
    const high = makeView('corto')
    jumpToOffset(high.view, 999)
    expect(high.dispatched[0]).toMatchObject({ selection: { anchor: 5 } })

    const low = makeView('corto')
    jumpToOffset(low.view, -20)
    expect(low.dispatched[0]).toMatchObject({ selection: { anchor: 0 } })
  })

  it('salta al inicio del texto que se ha clicado', () => {
    // El caso que motivó el punto 4: el offset del texto impreso en la hoja,
    // traducido a su posición en el guion.
    const doc = 'EXT. CASA - DIA\n\nStars blanket the void.'
    const { view, dispatched } = makeView(doc)
    const at = doc.indexOf('Stars')
    jumpToOffset(view, at)
    expect(dispatched[0]).toMatchObject({ selection: { anchor: at } })
  })

  it('no recorta un offset que ya es válido', () => {
    // Sanity del recorte: dentro del documento el offset pasa intacto.
    const { view, dispatched } = makeView('corto')
    jumpToOffset(view, 2)
    expect(dispatched[0]).toMatchObject({ selection: { anchor: 2 } })
  })
})
