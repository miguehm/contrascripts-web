// src/hooks/useWarningsOpen.ts — estado de la solapa de avisos (REVIEW.md 4).
//
// Acceso vía `store/warningsStorage.ts` (AGENTS.md nº2). Default: cerrado.
// La preferencia explícita del usuario prevalece en siguientes boots.
// El auto-open ante nuevos warnings lo decide `App` (fingerprint), no el hook.

import { useCallback, useState } from 'react'
import { loadWarningsOpen, saveWarningsOpen } from '@/store/warningsStorage'

function defaultOpen(): boolean {
  const stored = loadWarningsOpen()
  if (typeof stored === 'boolean') return stored
  return false
}

export function useWarningsOpen() {
  const [open, setOpenState] = useState<boolean>(defaultOpen)
  // `true` si ya existía preferencia guardada (para que `App` respete el
  // cierre persistido en el primer render en lugar de forzar auto-open).
  const [isStored] = useState<boolean>(() => loadWarningsOpen() !== null)

  const setOpen = useCallback((next: boolean) => {
    setOpenState(next)
    saveWarningsOpen(next)
  }, [])

  const toggle = useCallback(() => {
    setOpenState((prev) => {
      const next = !prev
      saveWarningsOpen(next)
      return next
    })
  }, [])

  return { open, setOpen, toggle, isStored }
}
