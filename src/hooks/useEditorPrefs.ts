// src/hooks/useEditorPrefs.ts — preferencias del editor (REVIEW.md 9).
//
// Acceso vía `store/editorStorage.ts` (AGENTS.md nº2: los componentes no
// tocan `localStorage`). Se consume a través de `PreferencesProvider` para
// que `Editor` y `SettingsDialog` compartan la misma instancia.

import { useCallback, useState } from 'react'
import {
  FONT_SIZE_STEPS,
  clampFontSize,
  clampLineHeight,
  loadEditorPrefs,
  saveEditorPrefs,
  stepFontSize,
} from '@/store/editorStorage'

export interface EditorPrefsState {
  fontSize: number
  lineHeight: number
  canDecreaseFontSize: boolean
  canIncreaseFontSize: boolean
  /** Fija el tamaño (sujetado al rango) y lo persiste. */
  setFontSize: (px: number) => void
  /** Sube/baja un escalón y lo persiste. */
  stepFont: (dir: 1 | -1) => void
  /** Fija el interlineado (sujetado al rango) y lo persiste. */
  setLineHeight: (ratio: number) => void
}

export function useEditorPrefs(): EditorPrefsState {
  const [prefs, setPrefsState] = useState(() => loadEditorPrefs())

  const setFontSize = useCallback((px: number) => {
    setPrefsState((prev) => {
      const next = { ...prev, fontSize: clampFontSize(px) }
      saveEditorPrefs(next)
      return next
    })
  }, [])

  const stepFont = useCallback((dir: 1 | -1) => {
    setPrefsState((prev) => {
      const next = { ...prev, fontSize: stepFontSize(prev.fontSize, dir) }
      saveEditorPrefs(next)
      return next
    })
  }, [])

  const setLineHeight = useCallback((ratio: number) => {
    setPrefsState((prev) => {
      const next = { ...prev, lineHeight: clampLineHeight(ratio) }
      saveEditorPrefs(next)
      return next
    })
  }, [])

  return {
    fontSize: prefs.fontSize,
    lineHeight: prefs.lineHeight,
    canDecreaseFontSize: prefs.fontSize > FONT_SIZE_STEPS[0],
    canIncreaseFontSize:
      prefs.fontSize < FONT_SIZE_STEPS[FONT_SIZE_STEPS.length - 1],
    setFontSize,
    stepFont,
    setLineHeight,
  }
}
