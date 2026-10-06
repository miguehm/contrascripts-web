// src/store/ScriptsProvider.tsx — estado global de guiones + persistencia (§6).
//
// - Único lector/escritor de `localStorage` (vía `storage.ts` + `trashStorage.ts`,
//   AGENTS.md nº2).
// - Arranque: `loadScriptsDetailed()` (nunca tumba el boot); dato dañado →
//   cuarentena y sin seed encima (punto 12 R1); vacío limpio → ejemplo de §5.
// - Guardado con debounce ~500ms; `flush()` escribe lo pendiente de forma
//   síncrona y se llama en `beforeunload`/`pagehide`, al ocultar el documento
//   y antes de cambiar/borrar/renombrar/importar (sin flush se perderían teclas).
// - `QuotaExceededError` o fallo de verificación → `toast.error`.
// - Papelera 30 días: `remove` mueve a `trash`, `restore` deshace.

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import { toast } from 'sonner'
import { uniqueScriptName } from '@/lib/names'
import { SAMPLE_FOUNTAIN } from '@/lib/sample'
import { newScript } from '@/lib/scripts'
import { loadTrash, saveTrash } from '@/store/trashStorage'
import type { Script } from '@/types/Script'
import { initScriptsState, scriptsReducer } from '@/store/scriptsReducer'
import type { ScriptsState } from '@/store/scriptsReducer'
import { loadActiveId, saveActiveId } from '@/store/activeScriptStorage'
import {
  SCRIPTS_KEY,
  loadScriptsDetailed,
  quarantineCorrupt,
  saveScripts,
  setBootNotice,
  takeBootNotice,
} from '@/store/storage'

/** Retardo del autosave tras la última edición. */
export const SAVE_DEBOUNCE_MS = 500

/** Estado del autosave para el badge discreto del header. */
export type SaveState = 'saved' | 'saving' | 'error'

export interface ScriptsContextValue extends ScriptsState {
  /** Guion activo (o `null` si la lista está vacía). */
  activeScript: Script | null
  /** Estado del último guardado (badge `Guardado HH:MM / Guardando… / Error`). */
  saveState: SaveState
  /** Hora del último guardado verificado (`null` antes del primero). */
  lastSavedAt: number | null
  createScript: (title?: string, text?: string) => void
  /** Abre el modal "Nuevo guion" (REVIEW-1); cancelar no crea nada. */
  requestCreateScript: () => void
  /** Estado del modal global de creación. */
  isNewOpen: boolean
  newSuggestion: string
  confirmNewScript: (title: string) => void
  cancelNewScript: () => void
  importScript: (title: string, text: string) => void
  importManyScripts: (scripts: Script[]) => void
  renameScript: (id: string, title: string) => void
  removeScript: (id: string) => void
  restoreScript: (id: string) => void
  purgeScript: (id: string) => void
  selectScript: (id: string) => void
  updateText: (id: string, text: string) => void
  /** Escribe ya lo pendiente (debounce); seguro llamarlo sin cambios. */
  flush: () => void
}

// eslint-disable-next-line react-refresh/only-export-components
export const ScriptsContext = createContext<ScriptsContextValue | null>(null)

function seedIfEmpty(scripts: Script[], allowSeed: boolean): Script[] {
  if (scripts.length > 0 || !allowSeed) return scripts
  return [newScript('Brick & Steel', SAMPLE_FOUNTAIN)]
}

function initState(): ScriptsState {
  const trash = loadTrash()
  const detailed = loadScriptsDetailed()
  if (detailed.corruptRaw != null) {
    // Dato dañado: cuarentena y NO sembrar ejemplo encima (R1). El
    // autosave posterior guardará la lista recuperable, la cuarentena queda.
    quarantineCorrupt(detailed.corruptRaw)
    setBootNotice({ quarantined: true, dropped: detailed.dropped })
    return initScriptsState(detailed.scripts, loadActiveId(), trash)
  }
  if (detailed.dropped > 0) {
    setBootNotice({ quarantined: false, dropped: detailed.dropped })
  }
  return initScriptsState(
    seedIfEmpty(detailed.scripts, true),
    loadActiveId(),
    trash,
  )
}

export function ScriptsProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(scriptsReducer, undefined, initState)
  const stateRef = useRef(state)
  const timerRef = useRef<number | null>(null)
  const [isNewOpen, setIsNewOpen] = useState(false)
  const [newSuggestion, setNewSuggestion] = useState('')
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)

  // Marca "Guardando…" ante cada mutación (el autosave lo confirma como
  // `saved`/`error`). Se llama en los handlers, no en el efecto, para no
  // encadenar renders (react-hooks/set-state-in-effect).
  const markDirty = useCallback(() => {
    setSaveState((prev) => (prev === 'error' ? prev : 'saving'))
  }, [])

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
    const { quotaExceeded, verifyFailed } = saveScripts(
      stateRef.current.scripts,
    )
    if (quotaExceeded) {
      setSaveState('error')
      toast.error('No se pudo guardar: almacenamiento lleno', {
        description: 'Exporta tus guiones como .fountain para no perderlos.',
      })
    } else if (verifyFailed) {
      setSaveState('error')
      toast.error('No se pudo verificar el guardado', {
        description: 'Exporta tus guiones como .fountain para no perderlos.',
      })
    } else {
      setSaveState('saved')
      setLastSavedAt(Date.now())
    }
  }, [])

  // Aviso de boot con dato dañado (R1): se toastea en efecto, no en init.
  useEffect(() => {
    const notice = takeBootNotice()
    if (!notice) return
    if (notice.quarantined) {
      toast.warning('Se encontró un guardado dañado', {
        description:
          'Se conservó una copia de seguridad y se recuperó lo posible. Exporta tus guiones para protegerlos.',
      })
    } else if (notice.dropped > 0) {
      toast.warning('Algunos guiones no se pudieron recuperar', {
        description: `${notice.dropped} elemento(s) con formato inválido.`,
      })
    }
  }, [])

  // Persistir el guion activo (REVIEW.md punto 3): cubre select, create,
  // import y remove sin duplicar lógica en cada handler.
  useEffect(() => {
    saveActiveId(state.activeId)
  }, [state.activeId])

  // Persistir la papelera ante cada cambio (best-effort silencioso).
  useEffect(() => {
    saveTrash(state.trash)
  }, [state.trash])

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

  // Flush al cerrar/ocultar (`pagehide` cubre el kill móvil mejor que
  // `beforeunload`): el debounce solo perdería las últimas teclas.
  useEffect(() => {
    const onBeforeUnload = () => persistNow()
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') persistNow()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    window.addEventListener('pagehide', onBeforeUnload)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      window.removeEventListener('pagehide', onBeforeUnload)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [persistNow])

  // Multi-tab (punto 12 R4): aviso manual, sin merge automático. `storage`
  // solo dispara en las *otras* pestañas, así que todo evento con valor
  // distinto es un conflicto real: Recargar trae lo ajeno, Mantener lo
  // sobrescribe con lo propio.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== SCRIPTS_KEY) return
      const current = JSON.stringify(stateRef.current.scripts)
      if (e.newValue === current) return
      toast.warning('Cambios en otra pestaña', {
        description:
          'Otra pestaña guardó guiones distintos. Recarga para verlos o mantén los de aquí.',
        duration: 15000,
        action: {
          label: 'Recargar',
          onClick: () => window.location.reload(),
        },
        cancel: {
          label: 'Mantener los míos',
          onClick: () => persistNow(),
        },
      })
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [persistNow])

  // Cambiar/borrar/renombrar/importar tras volcar lo pendiente (el timer aún
  // guarda el texto anterior y el debounce posterior guardará el nuevo igual).
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
      markDirty()
      dispatch({ type: 'remove', id })
    },
    [persistNow, markDirty],
  )
  const renameScript = useCallback(
    (id: string, title: string) => {
      persistNow()
      markDirty()
      dispatch({ type: 'rename', id, title })
    },
    [persistNow, markDirty],
  )
  const importScript = useCallback(
    (title: string, text: string) => {
      persistNow()
      markDirty()
      dispatch({ type: 'import', title, text })
    },
    [persistNow, markDirty],
  )

  const value = useMemo<ScriptsContextValue>(() => {
    const activeScript =
      state.scripts.find((s) => s.id === state.activeId) ?? null
    return {
      ...state,
      activeScript,
      saveState,
      lastSavedAt,
      createScript: (title?: string, text?: string) => {
        markDirty()
        dispatch({ type: 'create', title, text })
      },
      requestCreateScript: () => {
        setNewSuggestion(uniqueScriptName(state.scripts.map((s) => s.title)))
        setIsNewOpen(true)
      },
      isNewOpen,
      newSuggestion,
      confirmNewScript: (title: string) => {
        markDirty()
        dispatch({ type: 'create', title })
        setIsNewOpen(false)
      },
      cancelNewScript: () => setIsNewOpen(false),
      importScript,
      importManyScripts: (scripts: Script[]) => {
        markDirty()
        dispatch({ type: 'importMany', scripts })
      },
      renameScript,
      removeScript,
      restoreScript: (id: string) => {
        markDirty()
        dispatch({ type: 'restore', id })
      },
      purgeScript: (id: string) => {
        markDirty()
        dispatch({ type: 'purge', id })
      },
      selectScript,
      updateText: (id: string, text: string) => {
        markDirty()
        dispatch({ type: 'updateText', id, text })
      },
      flush: persistNow,
    }
  }, [
    state,
    isNewOpen,
    newSuggestion,
    removeScript,
    selectScript,
    renameScript,
    importScript,
    persistNow,
    markDirty,
    saveState,
    lastSavedAt,
  ])

  return (
    <ScriptsContext.Provider value={value}>{children}</ScriptsContext.Provider>
  )
}
