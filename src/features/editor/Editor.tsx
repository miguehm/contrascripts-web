// src/features/editor/Editor.tsx — editor Fountain v2 (REVIEW.md punto 2).
//
// CodeMirror 6 vía `@uiw/react-codemirror`: números de línea + highlighting
// Fountain (`./fountain` + `./fountainTheme`). El swap quedó local a este
// componente como preveía PLAN.md §5: la firma `value/onChange/disabled` no
// cambia y el store sigue persistiendo con debounce + flush (§6).
//
// `theme="none"`: el fondo/tipografía/colores los pone `fountainTheme()` con
// las CSS vars (§8), así dark/light conmutan sin recrear el editor. Las
// extensiones son constantes de módulo (sin estado por instancia) para no
// reconfigurar el `EditorView` en cada tecla.

import CodeMirror from '@uiw/react-codemirror'
import { EditorView } from '@codemirror/view'
import type { Extension } from '@codemirror/state'
import type { ReactNode } from 'react'
import { fountain } from './fountain'
import { fountainTheme } from './fountainTheme'

interface EditorProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  /** Acción a la derecha de la capitular (p. ej. trigger de avisos). */
  headerAction?: ReactNode
}

const PLACEHOLDER = 'INT. CASA - DÍA\n\nEscribe tu guion en Fountain…'

// Solo lectura/plegado desactivados: un guion no los necesita y el bundle y
// el gutter quedan mínimos en móvil.
const BASIC_SETUP = {
  lineNumbers: true,
  highlightActiveLine: true,
  highlightActiveLineGutter: true,
  highlightSpecialChars: true,
  history: true,
  drawSelection: true,
  dropCursor: true,
  indentOnInput: false,
  syntaxHighlighting: true,
  bracketMatching: false,
  closeBrackets: false,
  autocompletion: false,
  rectangularSelection: false,
  crosshairCursor: false,
  highlightSelectionMatches: false,
  searchKeymap: true,
  foldGutter: false,
} as const

const EXTENSIONS: Extension[] = [
  EditorView.lineWrapping,
  fountain(),
  fountainTheme(),
]

export function Editor({
  value,
  onChange,
  disabled = false,
  headerAction,
}: EditorProps) {
  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span
          id="fountain-editor-caption"
          className="text-[0.6875rem] font-semibold tracking-[0.06em] text-muted-foreground uppercase"
        >
          Fountain
        </span>
        {headerAction}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden rounded-sm border border-input bg-card focus-within:border-ring">
        <CodeMirror
          value={value}
          onChange={(next) => onChange(next)}
          editable={!disabled}
          theme="none"
          placeholder={PLACEHOLDER}
          height="100%"
          aria-labelledby="fountain-editor-caption"
          aria-label="Editor Fountain"
          basicSetup={BASIC_SETUP}
          extensions={EXTENSIONS}
          className="h-full"
        />
      </div>
    </div>
  )
}
