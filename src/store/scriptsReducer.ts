// src/store/scriptsReducer.ts — reducer puro de la lista de guiones (§6).
//
// Sin React, sin localStorage, sin fechas del sistema salvo `Date.now()`
// para `updatedAt`: así es testeable en Vitest sin mocks. La persistencia
// (debounce + flush) vive en `ScriptsProvider`, no aquí.

import { newScript } from '@/lib/scripts'
import type { Script } from '@/types/Script'

/** Estado mínimo: lista + guion activo. */
export interface ScriptsState {
  scripts: Script[]
  activeId: string | null
}

export type ScriptsAction =
  | { type: 'create'; title?: string; text?: string }
  | { type: 'import'; title: string; text: string }
  | { type: 'rename'; id: string; title: string }
  | { type: 'remove'; id: string }
  | { type: 'select'; id: string }
  | { type: 'updateText'; id: string; text: string }

/** Reciente primero (por `updatedAt`, desempate por `id` para estabilidad). */
function byRecent(a: Script, b: Script): number {
  if (b.updatedAt !== a.updatedAt) return b.updatedAt - a.updatedAt
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

function sorted(scripts: Script[]): Script[] {
  return [...scripts].sort(byRecent)
}

/** Estado inicial desde lo cargado de `localStorage` (ya validado). */
export function initScriptsState(scripts: Script[]): ScriptsState {
  const list = sorted(scripts)
  return { scripts: list, activeId: list[0]?.id ?? null }
}

export function scriptsReducer(
  state: ScriptsState,
  action: ScriptsAction,
): ScriptsState {
  switch (action.type) {
    case 'create':
    case 'import': {
      const s = newScript(action.title, action.text ?? '')
      return { scripts: sorted([s, ...state.scripts]), activeId: s.id }
    }
    case 'rename': {
      const title = action.title.trim()
      if (title === '') return state
      let found = false
      const scripts = state.scripts.map((s) => {
        if (s.id !== action.id) return s
        found = true
        return { ...s, title, updatedAt: Date.now() }
      })
      if (!found) return state
      return { ...state, scripts: sorted(scripts) }
    }
    case 'remove': {
      if (!state.scripts.some((s) => s.id === action.id)) return state
      const scripts = sorted(state.scripts.filter((s) => s.id !== action.id))
      const activeId =
        state.activeId === action.id ? (scripts[0]?.id ?? null) : state.activeId
      return { scripts, activeId }
    }
    case 'select': {
      if (!state.scripts.some((s) => s.id === action.id)) return state
      return { ...state, activeId: action.id }
    }
    case 'updateText': {
      let found = false
      const scripts = state.scripts.map((s) => {
        if (s.id !== action.id) return s
        if (s.text === action.text) {
          found = true
          return s
        }
        found = true
        return { ...s, text: action.text, updatedAt: Date.now() }
      })
      if (!found) return state
      // No reordenar al teclear: re-sorted en cada tecla movería el item
      // bajo el cursor en la sidebar. El orden se recalcula en flush/select.
      return { ...state, scripts }
    }
    default:
      return state
  }
}
