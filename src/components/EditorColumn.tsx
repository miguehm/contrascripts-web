// src/components/EditorColumn.tsx — columna de editor a alto completo.
//
// El trigger de avisos vive en la capitular (slot `headerAction`, 0px extra
// en reposo) y el panel cae como hoja desde ella. `useId` por columna: móvil
// y desktop coexisten montados (`md:hidden` / `hidden md:flex`), cada
// trigger apunta a su propio panel. `onViewReady` propaga el `EditorView`
// de cada columna para el salto al texto del punto 4. Las dos coexisten
// montadas (una oculta por CSS), así que el consumidor elige la visible
// midiendo su contenedor.

import { useId, useRef } from 'react'
import type { EditorView } from '@codemirror/view'
import { Editor } from '@/features/editor/Editor'
import type { EditorPositionStore } from '@/hooks/useEditorPosition'
import {
  WarningsLive,
  WarningsPanel,
  WarningsTrigger,
} from '@/features/preview/Warnings'
import type { Warning } from '@/vendor/fountain.mjs'

interface EditorColumnProps {
  text: string
  disabled: boolean
  onChange: (value: string) => void
  warnings: Warning[]
  warningsOpen: boolean
  onWarningsOpenChange: (open: boolean) => void
  /** Recibe la vista de esta columna con su contenedor (punto 4). */
  onViewReady?: (view: EditorView | null, container: HTMLElement | null) => void
  /** Salto a la línea de un aviso del panel (punto 7). */
  onJumpToLine?: (line: number) => void
  /** Clave del guion + almacén para conservar cursor/scroll (punto 6). */
  persistKey?: string | null
  persistStore?: EditorPositionStore | null
}

export function EditorColumn({
  text,
  disabled,
  onChange,
  warnings,
  warningsOpen,
  onWarningsOpenChange,
  onViewReady,
  persistKey,
  persistStore,
  onJumpToLine,
}: EditorColumnProps) {
  const panelId = useId()
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  return (
    <div className="relative mx-auto flex min-h-0 w-full max-w-[70ch] flex-1 flex-col xl:max-w-[820px]">
      <div className="min-h-0 flex-1">
        <Editor
          value={text}
          onChange={onChange}
          disabled={disabled}
          onViewReady={onViewReady}
          persistKey={persistKey}
          persistStore={persistStore}
          headerAction={
            <WarningsTrigger
              ref={triggerRef}
              warnings={warnings}
              open={warningsOpen}
              onOpenChange={onWarningsOpenChange}
              panelId={panelId}
            />
          }
        />
      </div>
      <WarningsLive warnings={warnings} />
      <WarningsPanel
        warnings={warnings}
        open={warningsOpen}
        onClose={() => onWarningsOpenChange(false)}
        panelId={panelId}
        triggerRef={triggerRef}
        onJumpToLine={onJumpToLine}
      />
    </div>
  )
}
