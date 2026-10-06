// @vitest-environment jsdom
// HelpDialog (REVIEW.md punto 11): la barra superior ofrece "Ayuda" y el
// modal muestra el cheatsheet Fountain (elemento, sintaxis, ejemplo y
// representación); Escape lo cierra. Atajo: solo F1 — nada de `?` para no
// colisionar al teclearlo en el editor.
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { act } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { HelpDialog } from './HelpDialog'

afterEach(() => {
  cleanup()
})

async function openDialog() {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Ayuda' }))
  })
  expect(await screen.findByRole('dialog')).toBeTruthy()
}

describe('HelpDialog', () => {
  it('muestra el disparador "Ayuda" con aria-label', () => {
    render(<HelpDialog />)
    expect(screen.getByRole('button', { name: 'Ayuda' })).toBeTruthy()
  })

  it('abre el cheatsheet y Escape lo cierra', async () => {
    render(<HelpDialog />)
    await openDialog()
    expect(
      screen.getByRole('heading', { name: /Sintaxis Fountain/ }),
    ).toBeTruthy()
    // Dos secciones: lo que se imprime y lo que vive solo en el
    // manuscrito (sin muestra de render).
    expect(screen.getByText('Se imprimen en el PDF')).toBeTruthy()
    expect(screen.getByText('No se imprimen en el PDF')).toBeTruthy()
    // Elementos clave con sintaxis, muestra y representación.
    expect(screen.getByText('Encabezado de escena')).toBeTruthy()
    expect(screen.getByText(/INT\. \/ EXT\./)).toBeTruthy()
    expect(screen.getByText('INT. LABORATORIO - NOCHE')).toBeTruthy()
    expect(screen.getByText('CORTE A:')).toBeTruthy()
    expect(screen.getAllByText('MARA').length).toBeGreaterThan(0)
    expect(screen.getByText('Portada')).toBeTruthy()
    expect(screen.getByText('Formato inline')).toBeTruthy()
    // El inline sí se renderiza: la muestra enseña el resultado.
    expect(screen.getByText('Negrita y cursiva')).toBeTruthy()
    // Sección, sinopsis, nota y comentario: título y sintaxis sí,
    // muestra no (la sección ya dice que no se imprimen).
    for (const title of ['Sección', 'Sinopsis', 'Nota', 'Comentario']) {
      expect(screen.getByText(title)).toBeTruthy()
    }
    expect(screen.queryByText('# ACTO PRIMERO')).toBeNull()
    expect(screen.queryByText(/Mara descubre la señal/)).toBeNull()
    expect(screen.queryByText(/Se oye el tren/)).toBeNull()
    expect(screen.queryByText(/Escena descartada/)).toBeNull()
    expect(screen.queryByText('No aparece en el PDF')).toBeNull()
    await act(async () => {
      fireEvent.keyDown(document, { key: 'Escape' })
    })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('F1 abre el modal', async () => {
    render(<HelpDialog />)
    expect(screen.queryByRole('dialog')).toBeNull()
    await act(async () => {
      fireEvent.keyDown(window, { key: 'F1' })
    })
    expect(await screen.findByRole('dialog')).toBeTruthy()
  })

  it('la tecla ? no abre el modal (no colisiona con el editor)', () => {
    render(<HelpDialog />)
    fireEvent.keyDown(window, { key: '?' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
