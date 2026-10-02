// src/components/ThemeToggle.tsx — interruptor dark/light (§8).
//
// Clase `.dark` en `<html>` + localStorage (`guion.theme.v1`), aplicado
// por `useTheme`. Con `aria-label` y `aria-pressed` para a11y (§9.8).

import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/hooks/useTheme'

export function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const dark = theme === 'dark'
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={toggle}
      aria-label={dark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
      aria-pressed={dark}
      title={dark ? 'Tema claro' : 'Tema oscuro'}
      className="h-8"
    >
      {dark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
    </Button>
  )
}
