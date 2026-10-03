// src/features/preview/Warnings.test.tsx — marginalia (REVIEW.md 4).
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Warning } from '@/vendor/fountain.mjs'
import { WarningsLive, WarningsPanel, WarningsTrigger } from './Warnings'

afterEach(cleanup)

const SAMPLE: Warning[] = [
  { line: 3, code: 'foo', message: 'Falta algo' } as Warning,
  { line: 7, code: 'bar', message: 'Otro aviso' } as Warning,
]

const PANEL_ID = 'warnings-panel-test'

function renderTrigger(
  warnings: Warning[] = SAMPLE,
  open = false,
  onOpenChange: (open: boolean) => void = () => {},
) {
  return render(
    <WarningsTrigger
      warnings={warnings}
      open={open}
      onOpenChange={onOpenChange}
      panelId={PANEL_ID}
    />,
  )
}

function renderPanel(
  warnings: Warning[] = SAMPLE,
  open = true,
  onClose: () => void = () => {},
) {
  return render(
    <WarningsPanel
      warnings={warnings}
      open={open}
      onClose={onClose}
      panelId={PANEL_ID}
      triggerRef={{ current: null }}
    />,
  )
}

describe('WarningsTrigger', () => {
  it('sin avisos no se monta: cero ruido en la capitular', () => {
    const { container } = renderTrigger([])
    expect(container.firstChild).toBeNull()
  })

  it('con avisos muestra el recuento y expone aria-expanded', () => {
    renderTrigger(SAMPLE, false)
    const trigger = screen.getByRole('button', { name: /avisos, 2 avisos/i })
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(trigger.getAttribute('aria-controls')).toBe(PANEL_ID)
  })

  it('el trigger notifica el cambio al padre', () => {
    const onOpenChange = vi.fn()
    renderTrigger(SAMPLE, false, onOpenChange)
    fireEvent.click(screen.getByRole('button', { name: /avisos/i }))
    expect(onOpenChange).toHaveBeenCalledWith(true)
  })
})

describe('WarningsLive', () => {
  it('anuncia formato válido sin avisos', () => {
    render(<WarningsLive warnings={[]} />)
    const live = screen.getByRole('status')
    expect(live.getAttribute('aria-live')).toBe('polite')
    expect(live.textContent).toMatch(/sin avisos/i)
  })

  it('anuncia el recuento con avisos', () => {
    render(<WarningsLive warnings={SAMPLE} />)
    expect(screen.getByRole('status').textContent).toMatch(/2 avisos/i)
  })
})

describe('WarningsPanel', () => {
  it('cerrado no se monta', () => {
    const { container } = renderPanel(SAMPLE, false)
    expect(container.firstChild).toBeNull()
  })

  it('abierto muestra la lista con línea, código y mensaje', () => {
    renderPanel()
    expect(screen.getByTestId('warnings-panel')).toBeDefined()
    expect(screen.getByText('L3')).toBeDefined()
    expect(screen.getByText('foo')).toBeDefined()
    expect(screen.getByText('Falta algo')).toBeDefined()
  })

  it('abierto sin avisos muestra el vacío', () => {
    renderPanel([])
    expect(screen.getByText('Sin avisos. El formato es válido.')).toBeDefined()
  })

  it('Escape cierra el panel', () => {
    const onClose = vi.fn()
    renderPanel(SAMPLE, true, onClose)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('clic fuera del panel lo cierra', () => {
    const onClose = vi.fn()
    renderPanel(SAMPLE, true, onClose)
    fireEvent.pointerDown(document.body, { bubbles: true })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('clic dentro del panel no lo cierra', () => {
    const onClose = vi.fn()
    renderPanel(SAMPLE, true, onClose)
    fireEvent.pointerDown(screen.getByText('Falta algo'), { bubbles: true })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('clic en el trigger (misma u otra columna) no dispara el cierre', () => {
    // Regresión: móvil y desktop coexisten montados con distinto `panelId`.
    // El `pointerdown` del panel ajeno cerraba y el `click` posterior
    // reabría con `open` obsoleto: el panel no se llegaba a cerrar nunca.
    const onClose = vi.fn()
    render(
      <>
        <WarningsTrigger
          warnings={SAMPLE}
          open={true}
          onOpenChange={() => {}}
          panelId="panel-a"
        />
        <WarningsTrigger
          warnings={SAMPLE}
          open={true}
          onOpenChange={() => {}}
          panelId="panel-b"
        />
        <WarningsPanel
          warnings={SAMPLE}
          open={true}
          onClose={onClose}
          panelId="panel-a"
          triggerRef={{ current: null }}
        />
      </>,
    )
    const triggers = screen.getAllByRole('button', { name: /avisos/i })
    expect(triggers).toHaveLength(2)
    fireEvent.pointerDown(triggers[0], { bubbles: true })
    fireEvent.pointerDown(triggers[1], { bubbles: true })
    expect(onClose).not.toHaveBeenCalled()
  })
})
