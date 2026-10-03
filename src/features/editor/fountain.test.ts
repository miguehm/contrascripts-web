// src/features/editor/fountain.test.ts — unit del lenguaje Fountain (REVIEW-2).
//
// `classifyFountainLine` es pura (sin DOM); el bloque final parsea un guion
// de muestra con `EditorState` + `syntaxTree` (árboles lezer, sin DOM) para
// fijar que cada elemento llega al gutter con su token.

import { EditorState } from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'
import { describe, expect, it } from 'vitest'
import {
  classifyFountainLine,
  fountain,
  type FountainLineContext,
  type FountainToken,
} from './fountain'

function ctx(
  overrides: Partial<FountainLineContext> = {},
): FountainLineContext {
  return {
    inBoneyard: false,
    inTitlePage: false,
    prevBlank: true,
    prevElement: 'other',
    ...overrides,
  }
}

function expectToken(line: string, token: FountainToken, c = ctx()): void {
  expect(classifyFountainLine(line, c)).toBe(token)
}

describe('classifyFountainLine', () => {
  it('escenas: INT/EXT/I-E insensibles a mayúsculas y forzada con punto', () => {
    expectToken('INT. CASA - DÍA', 'sceneHeading')
    expectToken('EXT. PLAYA - NOCHE', 'sceneHeading')
    expectToken('int. casa - día', 'sceneHeading')
    expectToken('INT./EXT. COCHE - DÍA', 'sceneHeading')
    expectToken('.OPENING TITLES', 'sceneHeading')
  })

  it('bloques: sección, sinopsis, corte de página, lyric', () => {
    expectToken('# Acto 1', 'section')
    expectToken('### Secuencia', 'section')
    expectToken('= Un resumen de la escena', 'synopsis')
    expectToken('===', 'pageBreak')
    expectToken('~Cantando bajo la lluvia', 'lyric')
  })

  it('centrado y transiciones', () => {
    expectToken('>FIN<', 'centered')
    expectToken('CORTE A:', 'transition')
    expectToken('CUT TO:', 'transition')
    expectToken('> DISSOLVE', 'transition')
    expectToken('FADE IN:', 'transition')
  })

  it('personaje: mayúsculas tras vacía, extensión, dual y forzado', () => {
    expectToken('JUAN', 'character')
    expectToken('MARÍA (O.S.)', 'character')
    expectToken('JOHN ^', 'character')
    expectToken('@Sr. X', 'character')
  })

  it('personaje: rechaza minúsculas, TO:, dos puntos y gritos largos', () => {
    expectToken('Juan', 'action')
    expectToken('CUT TO:', 'transition', ctx())
    // Mayúscula terminada en `:` es transición (`CORTE A:`, `CONTINUED:`),
    // nunca cue — ver `looksLikeTransition`.
    expectToken('CONTINUED:', 'transition')
    expectToken(
      'JUAN GRITA DURANTE MEDIA PÁGINA SIN PARAR HASTA QUE SE ACABA EL AIRE DEL PULMÓN',
      'action',
    )
  })

  it('paréntesis solo en contexto de diálogo', () => {
    expectToken(
      '(riendo)',
      'parenthetical',
      ctx({ prevBlank: false, prevElement: 'character' }),
    )
    expectToken('(un beat)', 'action')
  })

  it('diálogo tras cue/paréntesis, incluso con vacías de por medio', () => {
    expectToken(
      'No puedo creerlo.',
      'dialogue',
      ctx({ prevBlank: false, prevElement: 'character' }),
    )
    expectToken(
      'Sigue hablando.',
      'dialogue',
      ctx({ prevBlank: false, prevElement: 'dialogue' }),
    )
    expectToken(
      'Tras una vacía sigue siendo diálogo.',
      'dialogue',
      ctx({ prevBlank: true, prevElement: 'character' }),
    )
  })

  it('acción por defecto y nota de línea completa', () => {
    expectToken('Llueve sobre la ciudad.', 'action')
    expectToken('[[nota para el escritor]]', 'note')
  })

  it('boneyard dentro del bloque o al abrirlo', () => {
    expectToken('texto viejo', 'boneyard', ctx({ inBoneyard: true }))
    expectToken('/* empieza el corte', 'boneyard')
    expectToken('acción /* corte */ sigue', 'boneyard')
  })

  it('title page solo al inicio con clave no-mayúscula', () => {
    const start = ctx({ inTitlePage: true })
    expectToken('Title: Mi guion', 'titlePage', start)
    expectToken('Draft date: 2026-10-02', 'titlePage', start)
    expectToken('DRAFT DATE: 2026', 'action', start)
    expectToken('Title: Mi guion', 'action')
  })
})

/** Nombres de nodos del árbol para un documento de muestra. */
function tokenNames(doc: string): string[] {
  const state = EditorState.create({ doc, extensions: [fountain()] })
  const names: string[] = []
  syntaxTree(state).iterate({
    enter: (node) => {
      names.push(node.name)
    },
  })
  return names
}

describe('fountain() en CodeMirror', () => {
  it('emite un token por elemento del guion', () => {
    const names = tokenNames(
      [
        'Title: Demo',
        '',
        'INT. CASA - DÍA',
        '',
        'JUAN',
        '(riendo)',
        'Hola **mundo**.',
        '',
        'CORTE A:',
      ].join('\n'),
    )
    for (const expected of [
      'titlePage',
      'sceneHeading',
      'character',
      'parenthetical',
      'dialogue',
      'strong',
      'transition',
    ]) {
      expect(names).toContain(expected)
    }
  })

  it('boneyard multi-línea tiñe hasta el cierre', () => {
    const names = tokenNames('/* viejo\ntodavía viejo */\nLlueve.')
    expect(names.filter((n) => n === 'boneyard').length).toBeGreaterThanOrEqual(
      2,
    )
  })
})
