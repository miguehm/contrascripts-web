// src/store/scriptsReducer.test.ts — lógica pura del store de §6.

import { describe, expect, it, vi } from 'vitest'
import type { Script } from '@/types/Script'
import { initScriptsState, scriptsReducer } from '@/store/scriptsReducer'
import type { ScriptsState } from '@/store/scriptsReducer'

function script(over: Partial<Script> = {}): Script {
  return {
    id: 's1',
    title: 'T',
    text: 'x',
    updatedAt: 1000,
    ...over,
  }
}

function state(over: Partial<ScriptsState> = {}): ScriptsState {
  const scripts = [script(), script({ id: 's2', updatedAt: 2000 })]
  return { scripts, activeId: 's1', trash: [], ...over }
}

describe('initScriptsState', () => {
  it('lista vacía → sin activo', () => {
    expect(initScriptsState([])).toEqual({
      scripts: [],
      activeId: null,
      trash: [],
    })
  })

  it('ordena reciente primero y activa el primero', () => {
    const s = initScriptsState([
      script(),
      script({ id: 's2', updatedAt: 2000 }),
    ])
    expect(s.scripts.map((x) => x.id)).toEqual(['s2', 's1'])
    expect(s.activeId).toBe('s2')
  })

  it('preferredId válido tiene prioridad sobre el más reciente', () => {
    const s = initScriptsState(
      [script(), script({ id: 's2', updatedAt: 2000 })],
      's1',
    )
    expect(s.activeId).toBe('s1')
  })

  it('preferredId inválido, null o ausente → más reciente', () => {
    const list = [script(), script({ id: 's2', updatedAt: 2000 })]
    expect(initScriptsState(list, 'nope').activeId).toBe('s2')
    expect(initScriptsState(list, null).activeId).toBe('s2')
    expect(initScriptsState(list).activeId).toBe('s2')
  })
})

describe('create / import', () => {
  it('create activa el nuevo guion', () => {
    const s = scriptsReducer(state(), { type: 'create', title: 'Nuevo' })
    expect(s.scripts).toHaveLength(3)
    expect(s.activeId).not.toBe('s1')
    expect(s.scripts.find((x) => x.id === s.activeId)?.title).toBe('Nuevo')
  })

  it('import guarda título y texto', () => {
    const s = scriptsReducer(state(), {
      type: 'import',
      title: 'Imp',
      text: 'hola',
    })
    const active = s.scripts.find((x) => x.id === s.activeId)
    expect(active?.title).toBe('Imp')
    expect(active?.text).toBe('hola')
  })
})

describe('rename', () => {
  it('renombra y toca updatedAt', () => {
    const before = Date.now()
    const s = scriptsReducer(state(), {
      type: 'rename',
      id: 's1',
      title: '  Nuevo  ',
    })
    const renamed = s.scripts.find((x) => x.id === 's1')
    expect(renamed?.title).toBe('Nuevo')
    expect(renamed?.updatedAt).toBeGreaterThanOrEqual(before)
  })

  it('título vacío o id desconocido → sin cambios (misma referencia)', () => {
    const st = state()
    expect(scriptsReducer(st, { type: 'rename', id: 's1', title: '  ' })).toBe(
      st,
    )
    expect(scriptsReducer(st, { type: 'rename', id: 'no', title: 'X' })).toBe(
      st,
    )
  })
})

describe('remove / restore / purge', () => {
  it('borra a papelera y mueve el activo al más reciente restante', () => {
    const s = scriptsReducer(state({ activeId: 's1' }), {
      type: 'remove',
      id: 's1',
    })
    expect(s.scripts.map((x) => x.id)).toEqual(['s2'])
    expect(s.activeId).toBe('s2')
    expect(s.trash).toHaveLength(1)
    expect(s.trash[0]?.script.id).toBe('s1')
  })

  it('borrar el último deja lista vacía sin activo pero con papelera', () => {
    const st = state({ scripts: [script()], activeId: 's1' })
    const s = scriptsReducer(st, { type: 'remove', id: 's1' })
    expect(s.scripts).toEqual([])
    expect(s.activeId).toBe(null)
    expect(s.trash).toHaveLength(1)
  })

  it('id desconocido → sin cambios', () => {
    const st = state()
    expect(scriptsReducer(st, { type: 'remove', id: 'no' })).toBe(st)
  })

  it('restore devuelve el guion y lo activa', () => {
    const removed = scriptsReducer(state(), { type: 'remove', id: 's1' })
    const s = scriptsReducer(removed, { type: 'restore', id: 's1' })
    expect(s.scripts.map((x) => x.id).sort()).toEqual(['s1', 's2'])
    expect(s.activeId).toBe('s1')
    expect(s.trash).toEqual([])
  })

  it('restore con id desconocido → sin cambios', () => {
    const st = state()
    expect(scriptsReducer(st, { type: 'restore', id: 'no' })).toBe(st)
  })

  it('purge elimina definitivo solo de papelera', () => {
    const removed = scriptsReducer(state(), { type: 'remove', id: 's1' })
    const s = scriptsReducer(removed, { type: 'purge', id: 's1' })
    expect(s.trash).toEqual([])
    expect(s.scripts.map((x) => x.id)).toEqual(['s2'])
  })

  it('init purga papelera caducada (>30 días)', () => {
    const now = 2_000_000_000_000
    const old = {
      script: script({ id: 'old' }),
      deletedAt: now - 31 * 86400_000,
    }
    const fresh = { script: script({ id: 'new' }), deletedAt: now - 86400_000 }
    const s = initScriptsState([script()], null, [old, fresh], now)
    expect(s.trash.map((t) => t.script.id)).toEqual(['new'])
  })

  it('importMany añade y activa el primero', () => {
    const s = scriptsReducer(state(), {
      type: 'importMany',
      scripts: [script({ id: 'imp', title: 'Imp' })],
    })
    expect(s.scripts.some((x) => x.id === 'imp')).toBe(true)
    expect(s.activeId).toBe('imp')
  })
})

describe('select / updateText', () => {
  it('select cambia el activo; id desconocido no hace nada', () => {
    const st = state()
    expect(scriptsReducer(st, { type: 'select', id: 's2' }).activeId).toBe('s2')
    expect(scriptsReducer(st, { type: 'select', id: 'no' })).toBe(st)
  })

  it('updateText cambia texto y updatedAt sin reordenar', () => {
    vi.useFakeTimers()
    vi.setSystemTime(5000)
    const st = state()
    const s = scriptsReducer(st, {
      type: 'updateText',
      id: 's1',
      text: 'nuevo',
    })
    expect(s.scripts.find((x) => x.id === 's1')?.text).toBe('nuevo')
    expect(s.scripts.find((x) => x.id === 's1')?.updatedAt).toBe(5000)
    expect(s.scripts.map((x) => x.id)).toEqual(['s1', 's2'])
    vi.useRealTimers()
  })

  it('updateText con id desconocido → sin cambios', () => {
    const st = state()
    expect(
      scriptsReducer(st, { type: 'updateText', id: 'no', text: 'x' }),
    ).toBe(st)
  })
})
