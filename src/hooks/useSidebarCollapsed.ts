// src/hooks/useSidebarCollapsed.ts — colapso del sidebar desktop.
//
// Acceso vía hook a `store/uiStorage.ts` (AGENTS.md nº2: los componentes no
// tocan `localStorage`). Solo persiste el modo icono de desktop; el drawer
// móvil se gestiona con estado efímero en `App`.

import { useCallback, useState } from 'react'
import { loadUi, saveUi } from '@/store/uiStorage'

export function useSidebarCollapsed() {
  const [collapsed, setCollapsedState] = useState<boolean>(
    () => loadUi().collapsed,
  )

  const setCollapsed = useCallback((next: boolean) => {
    setCollapsedState(next)
    saveUi({ collapsed: next })
  }, [])

  const toggle = useCallback(() => {
    setCollapsedState((prev) => {
      const next = !prev
      saveUi({ collapsed: next })
      return next
    })
  }, [])

  return { collapsed, setCollapsed, toggle }
}
