// src/hooks/useTheme.tsx — tema dark/light/system (REVIEW.md punto 9).
//
// - Único punto que aplica la clase `.dark` en `<html>` (convención shadcn).
// - Lee/escribe vía `store/themeStorage.ts` (los componentes no tocan
//   `localStorage` directamente, AGENTS.md nº2).
// - `theme` es la preferencia (`light | dark | system`); `system` se resuelve
//   contra `prefers-color-scheme` del SO y se sigue en vivo con un listener
//   (solo mientras la preferencia es `system`). Lo aplicado es siempre
//   `resolvedTheme`, calculado en render (sin `setState` en efectos).

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import type { ResolvedTheme, Theme } from '@/types/Theme'
import { loadTheme, saveTheme } from '@/store/themeStorage'

export interface ThemeContextValue {
  /** Preferencia del usuario (puede ser `system`). */
  theme: Theme
  /** Tema aplicado (`system` ya resuelto según el SO). */
  resolvedTheme: ResolvedTheme
  setTheme: (theme: Theme) => void
  /** Cicla la preferencia: claro → oscuro → sistema → claro… */
  cycle: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

/** Orden del ciclo del interruptor del header. */
const THEME_ORDER: Theme[] = ['light', 'dark', 'system']

function prefersDark(): boolean {
  if (
    typeof window === 'undefined' ||
    typeof window.matchMedia !== 'function'
  ) {
    return false
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

/** Resuelve la preferencia a tema aplicable (lectura inicial y tests). */
// eslint-disable-next-line react-refresh/only-export-components
export function resolveTheme(theme: Theme): ResolvedTheme {
  if (theme !== 'system') return theme
  return prefersDark() ? 'dark' : 'light'
}

function applyTheme(theme: ResolvedTheme): void {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => loadTheme())
  // Foto del SO para `system`, siempre fresca gracias al listener
  // permanente; con preferencia explícita se ignora. La lectura inicial
  // ya la hace el `useState`, así que el efecto solo suscribe.
  const [systemDark, setSystemDark] = useState<boolean>(() => prefersDark())
  const resolvedTheme: ResolvedTheme =
    theme === 'system' ? (systemDark ? 'dark' : 'light') : theme

  useEffect(() => {
    applyTheme(resolvedTheme)
  }, [resolvedTheme])

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function'
    ) {
      return
    }
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const update = () => {
      setSystemDark(mq.matches)
    }
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)
    saveTheme(next)
  }, [])

  const cycle = useCallback(() => {
    setThemeState((prev) => {
      const next =
        THEME_ORDER[(THEME_ORDER.indexOf(prev) + 1) % THEME_ORDER.length]
      saveTheme(next)
      return next
    })
  }, [])

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, resolvedTheme, setTheme, cycle }),
    [theme, resolvedTheme, setTheme, cycle],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme debe usarse dentro de <ThemeProvider>')
  return ctx
}
