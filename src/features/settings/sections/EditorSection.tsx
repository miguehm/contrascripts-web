// src/features/settings/sections/EditorSection.tsx — sección Editor
// (REVIEW.md punto 9).
//
// Tamaño de fuente (escalones) e interlineado del editor vía las prefs
// compartidas (`PreferencesProvider`); `Editor` las aplica con CSS vars
// sin reconfigurar la vista de CodeMirror.

import { useId } from 'react'
import { Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { LINE_HEIGHT_STEPS } from '@/store/editorStorage'
import { usePreferences } from '@/store/preferences'

const LINE_HEIGHT_LABELS: Record<number, string> = {
  [LINE_HEIGHT_STEPS[0]]: 'Compacto',
  [LINE_HEIGHT_STEPS[1]]: 'Normal',
  [LINE_HEIGHT_STEPS[2]]: 'Amplio',
}

export function EditorSection() {
  const { editor } = usePreferences()
  const groupId = useId()

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h3 className="text-[0.8125rem] font-semibold">Editor</h3>
        <p className="text-[0.8125rem] text-muted-foreground">
          Tipografía del manuscrito (Courier Prime). Se aplica al instante.
        </p>
      </div>

      <div className="flex items-center justify-between gap-3">
        <Label id={`${groupId}-size-label`} className="cursor-default">
          Tamaño de fuente
        </Label>
        <span
          className="flex items-center gap-1"
          role="group"
          aria-labelledby={`${groupId}-size-label`}
        >
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={() => editor.stepFont(-1)}
            disabled={!editor.canDecreaseFontSize}
            aria-label="Reducir tamaño de fuente"
          >
            <Minus aria-hidden="true" />
          </Button>
          <span
            aria-live="polite"
            className="w-14 text-center font-mono text-xs tabular-nums"
          >
            {editor.fontSize}px
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={() => editor.stepFont(1)}
            disabled={!editor.canIncreaseFontSize}
            aria-label="Aumentar tamaño de fuente"
          >
            <Plus aria-hidden="true" />
          </Button>
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <span
          id={`${groupId}-leading-label`}
          className="text-sm leading-none font-medium"
        >
          Interlineado
        </span>
        <RadioGroup
          value={String(editor.lineHeight)}
          onValueChange={(value) => editor.setLineHeight(Number(value))}
          aria-labelledby={`${groupId}-leading-label`}
          className="gap-3"
        >
          {LINE_HEIGHT_STEPS.map((ratio) => {
            const id = `${groupId}-leading-${ratio}`
            return (
              <div key={ratio} className="flex items-center gap-2.5">
                <RadioGroupItem value={String(ratio)} id={id} />
                <Label htmlFor={id} className="cursor-pointer">
                  {LINE_HEIGHT_LABELS[ratio] ?? `${ratio}×`}
                </Label>
              </div>
            )
          })}
        </RadioGroup>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm leading-none font-medium">Vista previa</span>
        <div
          role="img"
          aria-label="Vista previa del editor"
          className="overflow-hidden rounded-sm border border-input bg-card p-3 text-card-foreground"
        >
          <p
            className="font-mono font-bold tracking-[0.05em]"
            style={{
              fontSize: editor.fontSize,
              lineHeight: editor.lineHeight,
            }}
          >
            INT. CASA - DÍA
          </p>
          <p
            className="font-mono"
            style={{
              fontSize: editor.fontSize,
              lineHeight: editor.lineHeight,
            }}
          >
            Una línea de acción con el tamaño e interlineado elegidos.
          </p>
        </div>
      </div>
    </div>
  )
}
