// src/hooks/useSidebarTab.ts — pestaña activa del sidebar (REVIEW.md 13).
//
// Acceso vía hook a `store/uiStorage.ts` (AGENTS.md nº2). La pestaña se
// recuerda tras recarga; ante dato corrupto cae a `scripts`.

import { useCallback, useState } from 'react'
import {
  loadSidebarTab,
  saveSidebarTab,
  type SidebarTab,
} from '@/store/uiStorage'

export type { SidebarTab }

export function useSidebarTab() {
  const [tab, setTabState] = useState<SidebarTab>(() => loadSidebarTab())

  const setTab = useCallback((next: SidebarTab) => {
    setTabState(next)
    saveSidebarTab(next)
  }, [])

  return { tab, setTab }
}
