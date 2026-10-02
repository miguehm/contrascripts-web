// src/store/ScriptsProvider.tsx — estado global de guiones + persistencia (§6).
//
// - Único lector/escritor de `localStorage` (vía `storage.ts`, AGENTS.md nº2).
// - Arranque: `loadScripts()` (nunca tumba el boot: corrupto → `[]`); si
//   queda vacío, siembra un guion con el ejemplo de §5.
// - Guardado con debounce ~500ms; `flush()` escribe lo pendiente de forma
//   síncrona y se llama en `beforeunload`, al ocultar el documento y antes
//   de cambiar/borrar el guion activo (sin flush se perderían las teclas).
// - `QuotaExceededError` → `toast.error` (los guiones son texto, pero varias
//   copias + autosave pueden rozar los ~5MB del origen).

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react'
import type { ReactNode } from 'react'
import { toast } from 'sonner'
import { SAMPLE_FOUNTAIN } from '@/lib/sample'
import { newScript } from '@/lib/scripts'
import type { Script } from '@/types/Script'
import { initScriptsState, scriptsReducer } from '@/store/scriptsReducer'
import type { ScriptsState } from '@/store/scriptsReducer'
import { loadScripts, saveScripts } from '@/store/storage'

/** Retardo del autosave tras la última edición. */
export const SAVE_DEBOUNCE_MS = 500

export interface ScriptsContextValue extends ScriptsState {
  /** Guion activo (o `null` si la lista está vacía). */
  activeScript: Script | null
  createScript: (title?: string, text?: string) => void
  importScript: (title: string, text: string) => void
  renameScript: (id: string, title: string) => void
  removeScript: (id: string) => void
  selectScript: (id: string) => void
  updateText: (id: string, text: string) => void
  /** Escribe ya lo pendiente (debounce); seguro llamarlo sin cambios. */
  flush: () => void
}

// eslint-disable-next-line react-refresh/only-export-components
export const ScriptsContext = createContext<ScriptsContextValue | null>(null)

function seedIfEmpty(scripts: Script[]): Script[] {
  if (scripts.length > 0) return scripts
  return [newScript('Brick & Steel', SAMPLE_FOUNTAIN)]
}

function initState(): ScriptsState {
  return initScriptsState(seedIfEmpty(loadScripts()))
}

export function ScriptsProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(scriptsReducer, undefined, initState)
  const stateRef = useRef(state)
  const timerRef = useRef<number | null>(null)

  // Ref sincronizada en efecto (no en render, ver react-hooks/refs):
  // declarado antes del autosave para que el timer lea el estado nuevo.
  useEffect(() => {
    stateRef.current = state
  }, [state])

  const persistNow = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    const { quotaExceeded } = saveScripts(stateRef.current.scripts)
    if (quotaExceeded) {
      toast.error('No se pudo guardar: almacenamiento lleno', {
        description: 'Exporta tus guiones como .fountain para no perderlos.',
      })
    }
  }, [])

  // Autosave con debounce ante cada cambio.
  useEffect(() => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(persistNow, SAVE_DEBOUNCE_MS)
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [state, persistNow])

  // Flush al cerrar/ocultar: el debounce solo perdería las últimas teclas.
  useEffect(() => {
    const onBeforeUnload = () => persistNow()
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') persistNow()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [persistNow])

  // Cambiar/borrar tras volcar lo pendiente (el timer aún guarda el texto
  // anterior y el debounce posterior guardará el nuevo estado igual).
  const selectScript = useCallback(
    (id: string) => {
      persistNow()
      dispatch({ type: 'select', id })
    },
    [persistNow],
  )
  const removeScript = useCallback(
    (id: string) => {
      persistNow()
      dispatch({ type: 'remove', id })
    },
    [persistNow],
  )

  const value = useMemo<ScriptsContextValue>(() => {
    const activeScript =
      state.scripts.find((s) => s.id === state.activeId) ?? null
    return {
      ...state,
      activeScript,
      createScript: (title?: string, text?: string) =>
        dispatch({ type: 'create', title, text }),
      importScript: (title: string, text: string) =>
        dispatch({ type: 'import', title, text }),
      renameScript: (id: string, title: string) =>
        dispatch({ type: 'rename', id, title }),
      removeScript,
      selectScript,
      updateText: (id: string, text: string) =>
        dispatch({ type: 'updateText', id, text }),
      flush: persistNow,
    }
  }, [state, removeScript, selectScript, persistNow])

  return (
    <ScriptsContext.Provider value={value}>{children}</ScriptsContext.Provider>
  )
}
