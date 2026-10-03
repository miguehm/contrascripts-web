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
//
// Punto 4 (salto desde la vista previa): se publica el `EditorView` real con
// `onViewReady`, porque saltar al texto necesita despachar una transacción
// (selección y `scrollIntoView`) y además enfocar el editor. El wrapper no
// expone un handle imperativo, así que la vista se captura con `onCreateEditor`,
// donde react-codemirror la construye. La transacción vive en `./jumpToOffset`,
// porque react-refresh no admite utilidades junto a componentes.

import CodeMirror from '@uiw/react-codemirror'
import { EditorView } from '@codemirror/view'
import type { Extension } from '@codemirror/state'
import { useEffect, useRef, type ReactNode } from 'react'
import { fountain } from './fountain'
import { fountainTheme } from './fountainTheme'

interface EditorProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  /** Acción a la derecha de la capitular (p. ej. trigger de avisos). */
  headerAction?: ReactNode
  /** Recibe el `EditorView` de esta instancia con su contenedor (punto 4), o
   * `(view, null)` al desmontarse para que el consumidor la retire. */
  onViewReady?: (view: EditorView | null, container: HTMLElement | null) => void
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
  onViewReady,
}: EditorProps) {
  // El padre pasa el callback como arrow inline, así que no puede ser una
  // dependencia de un efecto: si lo fuera, cada render volvería a publicar y la
  // vista se perdería entre uno y otro. El ref lo espeja en un efecto — donde
  // React sí permite mutarlo— para que `onCreateEditor` lea siempre el último.
  const notifyRef = useRef(onViewReady)
  useEffect(() => {
    notifyRef.current = onViewReady
  })

  // La vista creada, para poder identificarla en el cleanup: hay dos editores
  // montados a la vez (móvil y desktop) y cada uno publica la suya. El
  // contenedor es el wrapper del editor, que es lo que el consumidor mide para
  // saber cuál de los dos está visible.
  const viewRef = useRef<EditorView | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)

  // Al desmontar se publica la vista con `container = null`: el consumidor
  // necesita saber *cuál* se va, no solo que alguna se fue. Deps vacías a
  // propósito: es un cleanup de desmontaje, no una sincronización.
  useEffect(
    () => () => {
      const view = viewRef.current
      if (view) notifyRef.current?.(view, null)
      viewRef.current = null
    },
    [],
  )

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
      <div
        ref={wrapRef}
        className="min-h-0 flex-1 overflow-hidden rounded-sm border border-input bg-card focus-within:border-ring"
      >
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
          onCreateEditor={(view) => {
            viewRef.current = view
            notifyRef.current?.(view, wrapRef.current)
          }}
        />
      </div>
    </div>
  )
}
