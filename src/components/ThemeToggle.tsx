// src/components/ThemeToggle.tsx — interruptor de tema (§8 + REVIEW.md 9).
//
// Cicla claro → oscuro → sistema. El icono y la etiqueta describen el tema
// destino (convención previa): Luna = ir a oscuro, Monitor = ir a sistema,
// Sol = ir a claro.

import { Monitor, Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/hooks/useTheme'

const NEXT_LABEL: Record<string, string> = {
  light: 'Cambiar a tema oscuro',
  dark: 'Cambiar a tema del sistema',
  system: 'Cambiar a tema claro',
}

export function ThemeToggle() {
  const { theme, cycle } = useTheme()
  const label = NEXT_LABEL[theme] ?? NEXT_LABEL.light
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={cycle}
      aria-label={label}
      title={label.replace('Cambiar a ', 'Tema ')}
      className="h-8"
    >
      {theme === 'dark' ? (
        <Monitor aria-hidden="true" />
      ) : theme === 'system' ? (
        <Sun aria-hidden="true" />
      ) : (
        <Moon aria-hidden="true" />
      )}
    </Button>
  )
}
