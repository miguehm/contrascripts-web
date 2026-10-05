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
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { EditorPositionStore } from '@/hooks/useEditorPosition'
import { fountain } from './fountain'
import { fountainTheme } from './fountainTheme'
import { jumpLineHighlightField } from './jumpHighlight'

interface EditorProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  /** Acción a la derecha de la capitular (p. ej. trigger de avisos). */
  headerAction?: ReactNode
  /** Recibe el `EditorView` de esta instancia con su contenedor (punto 4), o
   * `(view, null)` al desmontarse para que el consumidor la retire. */
  onViewReady?: (view: EditorView | null, container: HTMLElement | null) => void
  /**
   * Clave del documento visible (id del guion) + almacén de posición
   * (REVIEW.md 6): guarda cursor + scroll por guion y los restituye al
   * remontar (salir de la vista en grande / cambio de tab móvil) o al
   * cambiar de guion.
   */
  persistKey?: string | null
  persistStore?: EditorPositionStore | null
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
  // Punto 4: flash efímero de la línea destino tras saltar desde el PDF.
  jumpLineHighlightField,
]

export function Editor({
  value,
  onChange,
  disabled = false,
  headerAction,
  onViewReady,
  persistKey = null,
  persistStore = null,
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

  // Punto 6: espejos para que los cleanups y listeners lean lo último (el
  // padre pasa arrow inline y key por guion, ambos cambian sin remontar).
  const persistKeyRef = useRef(persistKey)
  const persistStoreRef = useRef(persistStore)
  useEffect(() => {
    persistKeyRef.current = persistKey
    persistStoreRef.current = persistStore
  })
  // Limpieza del listener de scroll del scroller (se registra por vista).
  const scrollCleanupRef = useRef<(() => void) | null>(null)
  // Punto 6: mientras el restore asienta (CodeMirror mueve `scrollTop`
  // al resolver el snapshot), ese scroll programático no debe ni guardarse
  // ni cancelar el restore; solo los gestos del usuario lo cancelan (su
  // scroll sí vale).
  const restoringRef = useRef(false)
  const cancelRestore = useCallback(() => {
    restoringRef.current = false
  }, [])

  /**
   * Expone el offset del cursor para e2e (`data-cursor-offset`): sin efecto
   * visual, solo lectura de tests. Se actualiza en cada guardado y al
   * restaurar.
   */
  const markCursor = useCallback(() => {
    try {
      const head = viewRef.current?.state.selection.main.head
      if (wrapRef.current && Number.isFinite(head)) {
        wrapRef.current.setAttribute('data-cursor-offset', String(head))
      }
    } catch {
      // Vista en transición: sin marcador hasta el próximo guardado.
    }
  }, [])

  /** Restituye la posición del guion (selección + snapshot de CodeMirror)
   * con espera de asentamiento cancelable por gesto. */
  const doRestore = useCallback(
    (view: EditorView) => {
      const store = persistStoreRef.current
      const k = persistKeyRef.current
      if (!store || !k || !store.has(k)) return
      restoringRef.current = true
      store.restoreView(k, view, {
        isCancelled: () => !restoringRef.current,
        onSettled: () => {
          restoringRef.current = false
          markCursor()
        },
      })
    },
    [markCursor],
  )

  // Al desmontar se publica la vista con `container = null`: el consumidor
  // necesita saber *cuál* se va, no solo que alguna se fue. Deps vacías a
  // propósito: es un cleanup de desmontaje, no una sincronización. Además se
  // guarda cursor + scroll (punto 6) con `allowHidden`: al desmontar el
  // layout puede estar ido pero la selección sigue válida.
  useEffect(
    () => () => {
      const view = viewRef.current
      if (view) {
        persistStoreRef.current?.saveView(persistKeyRef.current, view, true)
        notifyRef.current?.(view, null)
      }
      scrollCleanupRef.current?.()
      scrollCleanupRef.current = null
      viewRef.current = null
    },
    [],
  )

  // Punto 6: al cambiar de guion sin remontar (misma instancia, otro texto),
  // restituye la posición de ese guion si la hay. Corre tras el sync del doc
  // del hijo CodeMirror (los efectos hijos van antes que los del padre).
  useEffect(() => {
    const view = viewRef.current
    if (!view || !persistKey || !persistStore) return
    doRestore(view)
  }, [persistKey, persistStore, doRestore])

  /** Guarda cursor + scroll de la vista vigente (ignora la oculta). */
  const savePosition = useCallback(() => {
    const view = viewRef.current
    if (view) {
      persistStoreRef.current?.saveView(persistKeyRef.current, view)
      markCursor()
    }
  }, [markCursor])

  /**
   * Guarda el cursor movido sin escribir ni scrollear (flechas, clic,
   * Ctrl+End…): extensión por instancia, estable por `useMemo` para no
   * reconfigurar la vista en cada tecla. Guardar no despacha, así que no
   * hay bucle con el restore.
   */
  // Guarda el cursor movido sin escribir ni scrollear (flechas, clic,
  // Ctrl+End…): se crea en efecto —la regla react-hooks/refs prohíbe leer
  // refs durante el render (también vía callbacks usados en `useMemo`)— y
  // react-codemirror la aplica reconfigurando la vista viva (sin remontar).
  // Guardar no despacha, así que no hay bucle con el restore. Se pausa
  // mientras hay restore en vuelo: el dispatch propio del restore también
  // trae `selectionSet` y guardaría el scroll transitorio (0 pre-fijación)
  // pisando la entrada buena.
  const [selectionSaver, setSelectionSaver] = useState<Extension | null>(null)
  useEffect(() => {
    setSelectionSaver(
      EditorView.updateListener.of((update) => {
        if (update.selectionSet && !restoringRef.current) {
          persistStoreRef.current?.saveView(persistKeyRef.current, update.view)
          markCursor()
        }
      }),
    )
  }, [markCursor])
  const extensions = useMemo(
    () => (selectionSaver ? [...EXTENSIONS, selectionSaver] : EXTENSIONS),
    [selectionSaver],
  )

  /** Escucha el scroll del scroller y lo guarda síncrono (un Map.set: el
   * navegador ya coalescea por frame; el throttle rAF dejaba el último
   * frame sin guardar ante un toggle inmediato). Pausado durante el
   * restore en vuelo (misma razón que el `selectionSaver`). */
  const watchScroller = useCallback(
    (view: EditorView) => {
      const scroller = view.scrollDOM
      if (!scroller) return
      const onScroll = () => {
        if (restoringRef.current) return
        persistStoreRef.current?.saveView(persistKeyRef.current, view)
        markCursor()
      }
      scroller.addEventListener('scroll', onScroll, { passive: true })
      scrollCleanupRef.current?.()
      scrollCleanupRef.current = () => {
        scroller.removeEventListener('scroll', onScroll)
      }
    },
    [markCursor],
  )

  const handleCreateEditor = useCallback(
    (view: EditorView) => {
      viewRef.current = view
      notifyRef.current?.(view, wrapRef.current)
      watchScroller(view)
      // Punto 6: remontaje tras la vista en grande / cambio de tab: vuelve
      // a donde se dejó en vez de al inicio.
      doRestore(view)
    },
    [watchScroller, doRestore],
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
        // Punto 6: un gesto del usuario corta la espera de asentamiento en
        // vuelo (su scroll/cursor mandan sobre el restore).
        onPointerDown={cancelRestore}
        onWheel={cancelRestore}
        onKeyDown={cancelRestore}
      >
        <CodeMirror
          value={value}
          onChange={(next) => {
            onChange(next)
            // Punto 6: cada tecla deja la posición al día (cubre el cambio
            // de guion sin remontar: al volver ya hay dato que restituir).
            savePosition()
          }}
          editable={!disabled}
          theme="none"
          placeholder={PLACEHOLDER}
          height="100%"
          aria-labelledby="fountain-editor-caption"
          aria-label="Editor Fountain"
          basicSetup={BASIC_SETUP}
          extensions={extensions}
          className="h-full"
          onCreateEditor={handleCreateEditor}
        />
      </div>
    </div>
  )
}
