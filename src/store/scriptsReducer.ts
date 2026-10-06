// src/store/scriptsReducer.ts — reducer puro de la lista de guiones (§6).
//
// Sin React, sin localStorage, sin fechas del sistema salvo `Date.now()`
// para `updatedAt`: así es testeable en Vitest sin mocks. La persistencia
// (debounce + flush) vive en `ScriptsProvider`, no aquí.

import { newScript } from '@/lib/scripts'
import type { Script } from '@/types/Script'
import { TRASH_RETENTION_MS } from '@/store/trashStorage'
import type { TrashedScript } from '@/store/trashStorage'

/** Estado mínimo: lista + guion activo + papelera. */
export interface ScriptsState {
  scripts: Script[]
  activeId: string | null
  trash: TrashedScript[]
}

export type ScriptsAction =
  | { type: 'create'; title?: string; text?: string }
  | { type: 'import'; title: string; text: string }
  | { type: 'rename'; id: string; title: string }
  | { type: 'remove'; id: string }
  | { type: 'restore'; id: string }
  | { type: 'purge'; id: string }
  | { type: 'select'; id: string }
  | { type: 'updateText'; id: string; text: string }
  | { type: 'importMany'; scripts: Script[] }

/** Reciente primero (por `updatedAt`, desempate por `id` para estabilidad). */
function byRecent(a: Script, b: Script): number {
  if (b.updatedAt !== a.updatedAt) return b.updatedAt - a.updatedAt
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

function sorted(scripts: Script[]): Script[] {
  return [...scripts].sort(byRecent)
}

/** Estado inicial desde lo cargado de `localStorage` (ya validado).
 * `preferredId` (guion activo persistido, REVIEW.md punto 3) tiene
 * prioridad; si ya no existe en la lista, se cae al más reciente.
 * La papelera llega ya cargada; aquí se purgan los caducados (>30 días). */
export function initScriptsState(
  scripts: Script[],
  preferredId?: string | null,
  trash: TrashedScript[] = [],
  now: number = Date.now(),
): ScriptsState {
  const list = sorted(scripts)
  const preferred =
    preferredId != null && list.some((s) => s.id === preferredId)
      ? preferredId
      : null
  return {
    scripts: list,
    activeId: preferred ?? list[0]?.id ?? null,
    trash: purgeExpired(trash, now),
  }
}

/** Filtra la papelera caducada (puro, testeable). */
export function purgeExpired(
  trash: TrashedScript[],
  now: number = Date.now(),
): TrashedScript[] {
  return trash.filter((t) => now - t.deletedAt < TRASH_RETENTION_MS)
}

export function scriptsReducer(
  state: ScriptsState,
  action: ScriptsAction,
): ScriptsState {
  switch (action.type) {
    case 'create':
    case 'import': {
      const s = newScript(action.title, action.text ?? '')
      return {
        scripts: sorted([s, ...state.scripts]),
        activeId: s.id,
        trash: state.trash,
      }
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
      const target = state.scripts.find((s) => s.id === action.id)
      if (!target) return state
      const scripts = sorted(state.scripts.filter((s) => s.id !== action.id))
      const activeId =
        state.activeId === action.id ? (scripts[0]?.id ?? null) : state.activeId
      return {
        scripts,
        activeId,
        trash: [{ script: target, deletedAt: Date.now() }, ...state.trash],
      }
    }
    case 'restore': {
      const entry = state.trash.find((t) => t.script.id === action.id)
      if (!entry) return state
      // Si ya existe un vivo con ese id (p. ej. importado tras borrar), no
      // duplicar: solo se saca de la papelera.
      const exists = state.scripts.some((s) => s.id === action.id)
      const scripts = exists
        ? state.scripts
        : sorted([...state.scripts, entry.script])
      return {
        scripts,
        activeId: action.id,
        trash: state.trash.filter((t) => t.script.id !== action.id),
      }
    }
    case 'purge': {
      if (!state.trash.some((t) => t.script.id === action.id)) return state
      return {
        ...state,
        trash: state.trash.filter((t) => t.script.id !== action.id),
      }
    }
    case 'importMany': {
      if (action.scripts.length === 0) return state
      return {
        scripts: sorted([...action.scripts, ...state.scripts]),
        activeId: action.scripts[0]?.id ?? state.activeId,
        trash: state.trash,
      }
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
