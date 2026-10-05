// src/features/settings/sections/PreviewSection.tsx — sección Vista previa
// (REVIEW.md punto 9).
//
// Expone la preferencia ya persistida de ajuste al ancho (`fitWidth`,
// REVIEW.md 1 y 8). Comparte instancia con `App` vía `PreferencesProvider`.
// El interruptor de avisos se retiró de aquí: la solapa se cierra sola al
// pulsar fuera, así que el switch siempre parecía volver a apagado.

import { useId } from 'react'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { usePreferences } from '@/store/preferences'

export function PreviewSection() {
  const { zoom } = usePreferences()
  const fitId = useId()

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h3 className="text-[0.8125rem] font-semibold">Vista previa</h3>
        <p className="text-[0.8125rem] text-muted-foreground">
          Comportamiento por defecto del documento PDF.
        </p>
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="flex flex-col gap-0.5">
          <Label htmlFor={fitId} className="cursor-pointer">
            Ajustar al ancho
          </Label>
          <span className="text-xs text-muted-foreground">
            La hoja llena el panel al abrir; el zoom manual lo desactiva.
          </span>
        </span>
        <Switch
          id={fitId}
          checked={zoom.fitMode}
          onCheckedChange={zoom.setFitMode}
          aria-label="Ajustar al ancho por defecto"
        />
      </div>
    </div>
  )
}
