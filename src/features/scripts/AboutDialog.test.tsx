// @vitest-environment jsdom
// AboutDialog (§REVIEW-3): el pie del sidebar ofrece "Acerca de" y el modal
// muestra versión/motor/atajo/licencia; Escape lo cierra.
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { act } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { AboutDialog } from './AboutDialog'

afterEach(cleanup)

describe('AboutDialog', () => {
  it('muestra el disparador "Acerca de" con aria-label', () => {
    render(<AboutDialog variant="outline" size="sm" className="w-full" />)
    expect(screen.getByRole('button', { name: 'Acerca de Guion' })).toBeTruthy()
  })

  it('en modo icon-sm no muestra texto visible', () => {
    const { container } = render(<AboutDialog variant="ghost" size="icon-sm" />)
    const btn = screen.getByRole('button', { name: 'Acerca de Guion' })
    expect(btn.textContent).toBe('')
    expect(container.querySelector('svg')).toBeTruthy()
  })

  it('abre el modal con contenido y Escape lo cierra', async () => {
    render(<AboutDialog />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Acerca de Guion' }))
    })
    expect(await screen.findByRole('dialog')).toBeTruthy()
    expect(screen.getByText('Guion')).toBeTruthy()
    expect(screen.getByText(/fountain-parser/i)).toBeTruthy()
    expect(screen.getByText(/MIT/i)).toBeTruthy()
    await act(async () => {
      fireEvent.keyDown(document, { key: 'Escape' })
    })
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
