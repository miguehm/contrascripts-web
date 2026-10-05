// @vitest-environment jsdom
// SettingsDialog (REVIEW.md punto 9): el pie del sidebar ofrece "Ajustes"
// y el modal navega por secciones (Apariencia / Editor / Vista previa /
// Acerca de); Escape lo cierra. El About vive como sección con
// versión/motor/licencia.
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ThemeProvider } from '@/hooks/useTheme'
import { PreferencesProvider } from '@/store/preferences'
import { EDITOR_KEY } from '@/store/editorStorage'
import { SettingsDialog } from './SettingsDialog'

function mockStorage(initial: Record<string, string> = {}) {
  const store: Record<string, string> = { ...initial }
  return {
    store,
    getItem: vi.fn((k: string) => (k in store ? store[k] : null)),
    setItem: vi.fn((k: string, v: string) => {
      store[k] = v
    }),
    removeItem: vi.fn((k: string) => {
      delete store[k]
    }),
    clear: vi.fn(() => {
      for (const k of Object.keys(store)) delete store[k]
    }),
  }
}

// El localStorage de jsdom no implementa la API: se usa el stub como en
// los tests de `store/` y se asevera contra el almacén.
let storage: ReturnType<typeof mockStorage>

beforeEach(() => {
  storage = mockStorage()
  vi.stubGlobal('localStorage', storage)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  document.documentElement.classList.remove('dark')
})

function renderSettings(
  props: {
    variant?: 'outline' | 'ghost'
    size?: 'sm' | 'icon-sm'
    className?: string
  } = {},
) {
  return render(
    <ThemeProvider>
      <PreferencesProvider>
        <SettingsDialog {...props} />
      </PreferencesProvider>
    </ThemeProvider>,
  )
}

async function openDialog() {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Ajustes' }))
  })
  expect(await screen.findByRole('dialog')).toBeTruthy()
}

describe('SettingsDialog', () => {
  it('muestra el disparador "Ajustes" con aria-label', () => {
    renderSettings({ variant: 'outline', size: 'sm', className: 'w-full' })
    expect(screen.getByRole('button', { name: 'Ajustes' })).toBeTruthy()
  })

  it('en modo icon-sm no muestra texto visible', () => {
    const { container } = renderSettings({
      variant: 'ghost',
      size: 'icon-sm',
    })
    const btn = screen.getByRole('button', { name: 'Ajustes' })
    expect(btn.textContent).toBe('')
    expect(container.querySelector('svg')).toBeTruthy()
  })

  it('abre el modal con navegación y Escape lo cierra', async () => {
    renderSettings()
    await openDialog()
    expect(screen.getByRole('heading', { name: 'Ajustes' })).toBeTruthy()
    for (const section of [
      'Apariencia',
      'Editor',
      'Vista previa',
      'Acerca de',
    ]) {
      expect(screen.getByRole('button', { name: section })).toBeTruthy()
    }
    await act(async () => {
      fireEvent.keyDown(document, { key: 'Escape' })
    })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('la sección Acerca de muestra versión, motor y licencia', async () => {
    renderSettings()
    await openDialog()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Acerca de' }))
    })
    expect(screen.getByText(/fountain-parser/i)).toBeTruthy()
    expect(screen.getByText(/MIT/i)).toBeTruthy()
    expect(screen.getByText(/v\d+\.\d+\.\d+/)).toBeTruthy()
  })

  it('Sistema es el tema por defecto sin preferencia guardada', async () => {
    renderSettings()
    await openDialog()
    const system = screen.getByRole('radio', { name: 'Sistema' })
    expect(system.getAttribute('aria-checked')).toBe('true')
  })

  it('cambiar a tema Oscuro aplica .dark en <html>', async () => {
    renderSettings()
    await openDialog()
    await act(async () => {
      fireEvent.click(screen.getByText('Oscuro'))
    })
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('el stepper de fuente cambia el tamaño y lo persiste', async () => {
    renderSettings()
    await openDialog()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Editor' }))
    })
    expect(screen.getByText('16px')).toBeTruthy()
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'Aumentar tamaño de fuente' }),
      )
    })
    expect(screen.getByText('18px')).toBeTruthy()
    expect(storage.store[EDITOR_KEY]).toBe(
      JSON.stringify({ fontSize: 18, lineHeight: 1.625 }),
    )
  })

  it('la vista previa del editor refleja el tamaño elegido', async () => {
    renderSettings()
    await openDialog()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Editor' }))
    })
    const preview = screen.getByRole('img', {
      name: 'Vista previa del editor',
    })
    const sample = preview.querySelector('p')
    expect(sample?.style.fontSize).toBe('16px')
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'Aumentar tamaño de fuente' }),
      )
    })
    expect(sample?.style.fontSize).toBe('18px')
  })
})
