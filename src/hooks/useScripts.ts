// src/hooks/useScripts.ts — acceso al store de guiones (§6).
//
// Los componentes nunca tocan `localStorage` directamente (AGENTS.md nº2).

import { useContext } from 'react'
import { ScriptsContext } from '@/store/ScriptsProvider'
import type { ScriptsContextValue } from '@/store/ScriptsProvider'

export function useScripts(): ScriptsContextValue {
  const ctx = useContext(ScriptsContext)
  if (!ctx)
    throw new Error('useScripts debe usarse dentro de <ScriptsProvider>')
  return ctx
}
