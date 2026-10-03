// src/hooks/usePreviewOpen.ts — estado del preview desplegable (REVIEW.md 4).
//
// Acceso vía `store/previewStorage.ts` (AGENTS.md nº2). Default por layout:
// abierto en desktop (`min-width: 768px`), cerrado en móvil (solo renderiza
// al pulsar "Vista previa"). La preferencia explícita del usuario prevalece
// sobre el default en siguientes boots.

import { useCallback, useState } from 'react'
import { loadPreviewOpen, savePreviewOpen } from '@/store/previewStorage'

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

  const setOpen = useCallback((next: boolean) => {
    setOpenState(next)
    savePreviewOpen(next)
  }, [])

  const toggle = useCallback(() => {
    setOpenState((prev) => {
      const next = !prev
      savePreviewOpen(next)
      return next
    })
  }, [])

  return { open, setOpen, toggle }
}
