// src/store/preferences.tsx — instancia única de prefs compartidas
// (REVIEW.md punto 9: menú de Ajustes).
//
// `App` instanciaba `usePreviewZoom` y `useWarningsOpen` en local; el
// `SettingsDialog` cuelga de `ScriptsSidebar` (profundo en el árbol) y
// necesita las *mismas* instancias —el zoom debe sobrevivir al cambio de
// tab y las prefs del editor llegar a cada `Editor`—. Este provider las
// concentra (zoom + avisos + editor) y se monta en `main.tsx` por encima
// de `App`. Solo `store/` toca `localStorage` (AGENTS.md nº2): aquí solo
// se componen hooks.

import { createContext, useContext, useMemo } from 'react'
import type { ReactNode } from 'react'
import { useEditorPrefs } from '@/hooks/useEditorPrefs'
import type { EditorPrefsState } from '@/hooks/useEditorPrefs'
import { usePreviewZoom } from '@/hooks/usePreviewZoom'
import type { PreviewZoom } from '@/hooks/usePreviewZoom'
import { useWarningsOpen } from '@/hooks/useWarningsOpen'

export interface PreferencesContextValue {
  zoom: PreviewZoom
  warningsOpen: boolean
  setWarningsOpen: (open: boolean) => void
  toggleWarnings: () => void
  editor: EditorPrefsState
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null)

export function PreferencesProvider({ children }: { children: ReactNode }) {
  // REVIEW.md 1 y 8: fit al ancho por defecto (móvil y desktop); la
  // preferencia guardada (`fitWidth`/`zoom`) manda en siguientes boots.
  const zoom = usePreviewZoom({ fitDefault: true })
  const warnings = useWarningsOpen()
  const editor = useEditorPrefs()

  const value = useMemo<PreferencesContextValue>(
    () => ({
      zoom,
      warningsOpen: warnings.open,
      setWarningsOpen: warnings.setOpen,
      toggleWarnings: warnings.toggle,
      editor,
    }),
    [zoom, warnings, editor],
  )

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext)
  if (!ctx) {
    throw new Error(
      'usePreferences debe usarse dentro de <PreferencesProvider>',
    )
  }
  return ctx
}
