// src/features/settings/sections/AppearanceSection.tsx — sección Apariencia
// (REVIEW.md punto 9).
//
// Preferencia de tema (`light | dark | system`) vía `useTheme`; la
// resolución a claro/oscuro y el listener del SO viven en el hook.

import { useId } from 'react'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useTheme } from '@/hooks/useTheme'
import type { Theme } from '@/types/Theme'

const OPTIONS: { value: Theme; label: string; hint: string }[] = [
  {
    value: 'system',
    label: 'Sistema',
    hint: 'Sigue al sistema operativo',
  },
  { value: 'light', label: 'Claro', hint: 'Warm Screenplay Minimal' },
  { value: 'dark', label: 'Oscuro', hint: 'Cinematic' },
]

export function AppearanceSection() {
  const { theme, setTheme } = useTheme()
  const groupId = useId()

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h3 className="text-[0.8125rem] font-semibold">Apariencia</h3>
        <p className="text-[0.8125rem] text-muted-foreground">
          Tema del editor y de la interfaz.
        </p>
      </div>
      <RadioGroup
        value={theme}
        onValueChange={(value) => setTheme(value as Theme)}
        aria-label="Tema"
        id={groupId}
        className="gap-3"
      >
        {OPTIONS.map((opt) => {
          const id = `${groupId}-${opt.value}`
          return (
            <div key={opt.value} className="flex items-center gap-2.5">
              <RadioGroupItem value={opt.value} id={id} />
              <span className="flex flex-col gap-0.5">
                <Label htmlFor={id} className="cursor-pointer">
                  {opt.label}
                </Label>
                <span className="text-xs text-muted-foreground">
                  {opt.hint}
                </span>
              </span>
            </div>
          )
        })}
      </RadioGroup>
    </div>
  )
}
