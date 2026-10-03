// src/hooks/usePreviewOpen.ts — estado del preview desplegable (REVIEW.md 4)
// + vista en grande (REVIEW.md punto 2).
//
// Acceso vía `store/previewStorage.ts` (AGENTS.md nº2). Default por layout:
// abierto en desktop (`min-width: 768px`), cerrado en móvil (solo renderiza
// al pulsar "Vista previa"). La preferencia explícita del usuario prevalece
// sobre el default en siguientes boots. `expanded` persiste y solo tiene
// sentido con `open === true`: cerrar limpia el ampliado.

import { useCallback, useState } from 'react'
import {
  loadPreviewExpanded,
  loadPreviewOpen,
  savePreviewExpanded,
  savePreviewOpen,
} from '@/store/previewStorage'

function defaultOpen(): boolean {
  const stored = loadPreviewOpen()
  if (typeof stored === 'boolean') return stored
  if (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function'
  ) {
    return window.matchMedia('(min-width: 768px)').matches
  }
  return true
}

export function usePreviewOpen() {
  const [open, setOpenState] = useState<boolean>(defaultOpen)
  const [expanded, setExpandedState] = useState<boolean>(() =>
    loadPreviewExpanded(),
  )

  const setOpen = useCallback((next: boolean) => {
    setOpenState(next)
    // Cerrar limpia el ampliado: "expandido pero oculto" no tiene sentido.
    // Al abrir se respeta el ampliado persistido.
    if (!next) {
      setExpandedState(false)
      savePreviewOpen(next, false)
    } else {
      savePreviewOpen(next, loadPreviewExpanded())
    }
  }, [])

  const toggle = useCallback(() => {
    setOpen(!open)
  }, [open, setOpen])

  const setExpanded = useCallback((next: boolean) => {
    // Ampliar implica abrir (invariante: expanded → open).
    if (next) {
      setOpenState(true)
      setExpandedState(true)
      savePreviewOpen(true, true)
    } else {
      setExpandedState(false)
      savePreviewExpanded(false)
    }
  }, [])

  const toggleExpanded = useCallback(() => {
    setExpanded(!expanded)
  }, [expanded, setExpanded])

  return { open, setOpen, toggle, expanded, setExpanded, toggleExpanded }
}
