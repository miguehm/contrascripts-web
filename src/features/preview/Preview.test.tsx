// @vitest-environment jsdom
// Render del preview a partir de un Document de fixture (§10): cubre los
// hints del parser (uppercase, inline con fallback a text, dual), titlePage,
// boneyard omitido, note como callout y pageBreak con token -- Page N --.
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { Document } from '@/vendor/fountain.mjs'
import { Preview } from './Preview'

afterEach(cleanup)

const titlePage = {
  title: 'BRICK & STEEL',
  credit: 'Escrito por',
  author: 'Guion de ejemplo',
  draftDate: '',
  contact: '',
  source: '',
  revision: '',
  custom: {},
} as unknown as Document['titlePage']

const doc = {
  titlePage,
  elements: [
    { type: 'sceneHeading', text: 'INT. CASA - DÍA', uppercase: true },
    {
      type: 'action',
      text: 'Un día *precioso*.',
      inline: [
        { type: 'text', text: 'Un día ' },
        { type: 'italic', content: [{ type: 'text', text: 'precioso' }] },
        { type: 'text', text: '.' },
      ],
    },
    { type: 'action', text: 'Sin spans.' },
    { type: 'character', text: 'JUAN', uppercase: true, dual: true },
    { type: 'dialogue', text: 'Hola.' },
    { type: 'boneyard', text: 'oculto' },
    { type: 'note', text: 'nota de producción' },
    { type: 'pageBreak' },
    { type: 'transition', text: 'CORTE A:', uppercase: true },
  ],
} as unknown as Document

describe('Preview', () => {
  it('renderiza portada, slugline y diálogo', () => {
    render(<Preview doc={doc} />)
    expect(screen.getByText('BRICK & STEEL')).toBeDefined()
    expect(screen.getByText('INT. CASA - DÍA')).toBeDefined()
    expect(screen.getByText('JUAN', { exact: false })).toBeDefined()
    expect(screen.getByText('Hola.')).toBeDefined()
    expect(screen.getByText('CORTE A:')).toBeDefined()
  })

  it('honra inline donde el PDF lo hace y cae a text si no', () => {
    const { container } = render(<Preview doc={doc} />)
    const em = container.querySelector('em')
    expect(em?.textContent).toBe('precioso')
    expect(screen.getByText('Sin spans.')).toBeDefined()
  })

  it('omite boneyard, muestra note y salto de página', () => {
    const { container } = render(<Preview doc={doc} />)
    expect(container.textContent).not.toContain('oculto')
    expect(screen.getByText('nota de producción')).toBeDefined()
    expect(screen.getByText('-- Page 2 --')).toBeDefined()
    expect(screen.getByText('dual')).toBeDefined()
  })

  it('sin doc muestra el placeholder de carga', () => {
    render(<Preview doc={null} />)
    expect(screen.getByText('Cargando motor…')).toBeDefined()
  })
})
