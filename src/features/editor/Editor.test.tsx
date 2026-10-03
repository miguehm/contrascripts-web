// @vitest-environment jsdom
// Smoke del Editor CodeMirror: monta, muestra gutter de líneas y expone el
// nombre accesible. La escritura real (contenteditable) se verifica en e2e,
// donde hay un navegador de verdad.
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Editor } from './Editor'
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
})
