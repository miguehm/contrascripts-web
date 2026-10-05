// src/App.tsx — shell §5 + multi-guion §6: boot + editor + preview PDF +
// warnings + export.
//
// El texto editable ya no es un `useState` local: viene del guion activo
// del store (`useScripts()`); cada tecla hace `updateText()` y el provider
// persiste con debounce (~500ms) + flush al salir/cambiar (§6).
// La vista previa es el PDF generado por `fountain-pdf.wasm` en un Web
// Worker (`usePdfPreview`), rasterizado con pdf.js: lo visible es lo que
// se descarga. Desktop (>md): sidebar de guiones colapsable a rail 56px +
// dual-pane con `ResizablePanelGroup`. Móvil: drawer lateral + tabs
// Editor/Preview. Los tokens Warm/Cinematic (§8) quedan fuera.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Plus,
} from 'lucide-react'
import { Toaster } from '@/components/ui/sonner'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/ThemeToggle'
import type { EditorView } from '@codemirror/view'
import { EditorColumn } from '@/components/EditorColumn'
import { SplitWorkspace } from '@/components/SplitWorkspace'
import { jumpToOffset } from '@/features/editor/jumpToOffset'
import { lineToOffset } from '@/features/editor/lineToOffset'
import { PdfPreview } from '@/features/preview/PdfPreview'
import { usePdfPreview } from '@/features/preview/usePdfPreview'
import { ImportButton } from '@/features/scripts/ImportButton'
import { NewScriptDialog } from '@/features/scripts/NewScriptDialog'
import { ScriptsDrawer } from '@/features/scripts/ScriptsDrawer'
import { ScriptsSidebar } from '@/features/scripts/ScriptsSidebar'
import { ExportButton } from '@/components/ExportButton'
import { useEditorPosition } from '@/hooks/useEditorPosition'
import { useParser } from '@/hooks/useParser'
import { usePreviewOpen } from '@/hooks/usePreviewOpen'
import { usePreviewScroll } from '@/hooks/usePreviewScroll'
import { useScripts } from '@/hooks/useScripts'
import { useSidebarCollapsed } from '@/hooks/useSidebarCollapsed'
import { usePreferences } from '@/store/preferences'
import { sanitizeFilename } from '@/lib/scripts'

type Tab = 'editor' | 'preview'

function StatusBadge({
  status,
  onRetry,
}: {
  status: 'booting' | 'ready' | 'error'
  onRetry: () => void
}) {
  if (status === 'ready') {
    return (
      <span role="status" className="sr-only">
        Motor listo
      </span>
    )
  }
  if (status === 'error') {
    return (
      <span className="flex items-center gap-2">
        <span
          role="alert"
          className="rounded-sm border border-destructive px-2 py-0.5 font-mono text-[10px] text-destructive uppercase"
        >
          Error de motor
        </span>
        <Button size="xs" variant="outline" onClick={onRetry}>
          Reintentar
        </Button>
      </span>
    )
  }
  return (
    <span
      role="status"
      aria-label="Iniciando motor"
      title="Cargando el analizador Fountain…"
      className="rounded-sm border border-border px-2 py-0.5 font-mono text-[10px] text-muted-foreground uppercase"
    >
      Iniciando motor…
    </span>
  )
}

export default function App() {
  const {
    activeScript,
    updateText,
    requestCreateScript,
    isNewOpen,
    newSuggestion,
    confirmNewScript,
    cancelNewScript,
  } = useScripts()
  const [tab, setTab] = useState<Tab>('editor')
  const [previewPaused, setPreviewPaused] = useState(false)
  // REVIEW.md 4: el preview solo trabaja si es visible. En móvil manda el
  // tab activo; en desktop manda el toggle (colapso total). Oculto no
  // renderiza: `usePdfPreview` marca dirty y renderiza al volver.
  const [isDesktop, setIsDesktop] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(min-width: 768px)').matches,
  )
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const onChange = () => setIsDesktop(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  // REVIEW.md 3 y 9: el zoom vive en `PreferencesProvider` (no en
  // `PdfPreview`) para que el cambio de tab móvil —que desmonta el
  // preview— no lo reinicie; persiste vía store. El modal de Ajustes
  // consume la misma instancia. REVIEW.md 1 y 8: fit al ancho por defecto
  // en móvil y desktop (fitDefault); la preferencia guardada
  // (`fitWidth`/`zoom`) manda en siguientes boots. REVIEW.md 8: el fit
  // queda disponible en desktop bajo demanda (el número del porcentaje
  // entra en fit).
  const { zoom } = usePreferences()
  // Al abrir otro guion (nuevo o existente) se re-aplica la preferencia
  // guardada (fit o zoom manual); el cambio de tab editor↔preview con el
  // mismo guion conserva el zoom vigente.
  const activeScriptId = activeScript?.id ?? null
  const lastScriptIdRef = useRef<string | null>(activeScriptId)
  useEffect(() => {
    if (lastScriptIdRef.current !== activeScriptId) {
      lastScriptIdRef.current = activeScriptId
      zoom.resetForScript()
    }
  }, [activeScriptId, zoom])
  const { collapsed, toggle } = useSidebarCollapsed()
  const {
    open: previewOpen,
    toggle: togglePreview,
    expanded: previewExpanded,
    toggleExpanded,
  } = usePreviewOpen()
  // REVIEW.md 6: scroll del preview y cursor/scroll del editor por guion.
  // Viven aquí (no en los paneles) para sobrevivir a los desmontajes al
  // cerrar el panel, expandir o cambiar de tab.
  const previewScroll = usePreviewScroll()
  const editorPosition = useEditorPosition()
  // REVIEW.md 4 y 9: avisos como notas al pie — tira dockada + panel
  // flotante. `open` persiste en `guion.warnings.v1` y se comparte con el
  // modal de Ajustes vía `PreferencesProvider`; ante avisos nuevos solo se
  // ilumina el badge (sin auto-apertura: taparía manuscrito).
  const { warningsOpen, setWarningsOpen } = usePreferences()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const text = activeScript?.text ?? ''
  const { status, doc, warnings, retry } = useParser(text)

  // Punto 4: la vista del editor visible, para saltar al texto que se ha
  // doble-clickado en el documento. Hay dos columnas montadas a la vez —móvil
  // y desktop, una oculta por CSS—, así que se guarda cada vista con su
  // contenedor y el salto elige la que tiene tamaño.
  const editorViewsRef = useRef<
    { view: EditorView; container: HTMLElement | null }[]
  >([])
  // Salto pendiente: en móvil (tab preview) y en desktop con preview expandida
  // el editor está desmontado, así que no hay vista visible donde saltar. Se
  // guarda el offset y se aplica al montar la columna visible; si ya hubiera
  // una visible, el salto es inmediato y esto queda en null.
  const pendingJumpRef = useRef<number | null>(null)
  const handleViewReady = useCallback(
    (view: EditorView | null, container: HTMLElement | null) => {
      const entries = editorViewsRef.current
      // `container = null` al desmontar una columna: solo se retira esa, que la
      // otra puede seguir montada y ser la visible.
      if (!view) return
      if (!container) {
        editorViewsRef.current = entries.filter((entry) => entry.view !== view)
        return
      }
      const at = entries.findIndex((entry) => entry.view === view)
      if (at >= 0) entries[at] = { view, container }
      else entries.push({ view, container })
      // La columna que acaba de montar es la visible y había un salto
      // esperando: se aplica aquí (cursor + 25% + flash) en vez de perderse.
      if (container.offsetWidth > 0 && pendingJumpRef.current !== null) {
        const offset = pendingJumpRef.current
        pendingJumpRef.current = null
        jumpToOffset(view, offset)
      }
    },
    [],
  )

  // El salto va al editor, y en móvil además cambia de tab: el documento solo
  // está visible mientras el tab Editor no lo tapa.
  const handleJumpToSource = useCallback((offset: number) => {
    // La columna visible es la que tiene tamaño. Si no hay ninguna (editor
    // desmontado: móvil en tab preview o preview expandida), el offset queda
    // pendiente y `handleViewReady` lo aplica al montar la columna visible en
    // vez de saltar a una vista oculta donde ni el cursor ni el flash se ven.
    const entries = editorViewsRef.current
    const target = entries
      .filter((entry) => (entry.container?.offsetWidth ?? 0) > 0)
      .at(-1)
    if (target) {
      pendingJumpRef.current = null
      jumpToOffset(target.view, offset)
    } else {
      pendingJumpRef.current = offset
    }
    setTab('editor')
  }, [])

  // REVIEW.md 7: clic en un aviso → línea del fuente en el editor. `lint()`
  // solo trae el nº de línea, se traduce a offset y se reutiliza el camino
  // del punto 4 (elige la columna visible, encola si está desmontada).
  const handleJumpToLine = useCallback(
    (line: number) => {
      handleJumpToSource(lineToOffset(text, line))
    },
    [text, handleJumpToSource],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        toggle()
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        e.key.toLowerCase() === 'p'
      ) {
        e.preventDefault()
        togglePreview()
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        e.key.toLowerCase() === 'f'
      ) {
        e.preventDefault()
        toggleExpanded()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggle, togglePreview, toggleExpanded])
  const previewVisible = isDesktop ? previewOpen : tab === 'preview'
  const preview = usePdfPreview(text, {
    paused: previewPaused,
    visible: previewVisible,
  })

  const stats = useMemo(() => {
    const elements = doc?.elements.length ?? 0
    return { elements, pages: preview.numPages || 1 }
  }, [doc, preview.numPages])

  const booting = status !== 'ready'
  const pdfName = activeScript
    ? `${sanitizeFilename(activeScript.title)}.pdf`
    : 'guion.pdf'

  const handleChange = (value: string) => {
    if (activeScript) updateText(activeScript.id, value)
  }

  return (
    <div
      data-engine-status={status}
      className="flex h-dvh flex-col overflow-hidden bg-background text-foreground"
    >
      <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center gap-3 border-b border-border bg-background px-4">
        <Button
          ref={menuButtonRef}
          variant="ghost"
          size="icon-sm"
          onClick={() => setDrawerOpen(true)}
          aria-label="Abrir guiones"
          aria-expanded={drawerOpen}
          className="md:hidden"
        >
          <Menu aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={toggle}
          aria-label={collapsed ? 'Expandir guiones' : 'Colapsar guiones'}
          aria-expanded={!collapsed}
          aria-controls="scripts-sidebar"
          title={
            collapsed
              ? 'Expandir guiones (Ctrl+B)'
              : 'Colapsar guiones (Ctrl+B)'
          }
          className="hidden md:inline-flex"
        >
          {collapsed ? (
            <PanelLeftOpen aria-hidden="true" />
          ) : (
            <PanelLeftClose aria-hidden="true" />
          )}
        </Button>
        <h1
          className="flex min-w-0 flex-1 items-baseline gap-2 md:max-w-[32ch] md:flex-none"
          title={activeScript?.title ?? 'Sin guiones'}
        >
          <span
            aria-hidden="true"
            className="hidden shrink-0 text-[0.6875rem] font-semibold tracking-[0.06em] text-muted-foreground uppercase md:inline"
          >
            Guion
          </span>
          <span className="truncate text-[0.8125rem] font-medium">
            {activeScript?.title ?? 'Sin guiones'}
          </span>
        </h1>
        <StatusBadge status={status} onRetry={retry} />
        <span className="ml-auto flex items-center gap-3">
          <span className="hidden font-mono text-xs text-muted-foreground tabular-nums sm:inline">
            {stats.elements} elementos · ~{stats.pages} pág.
          </span>
          <ExportButton bytes={preview.bytes} filename={pdfName} />
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={togglePreview}
            aria-label={
              previewOpen ? 'Ocultar vista previa' : 'Mostrar vista previa'
            }
            aria-expanded={previewOpen}
            aria-controls="preview-pane"
            title={
              previewOpen
                ? 'Ocultar vista previa (Ctrl+Mayús+P)'
                : 'Mostrar vista previa (Ctrl+Mayús+P)'
            }
            className="hidden md:inline-flex"
          >
            {previewOpen ? (
              <PanelRightClose aria-hidden="true" />
            ) : (
              <PanelRightOpen aria-hidden="true" />
            )}
          </Button>
          <ThemeToggle />
        </span>
      </header>

      {activeScript === null ? (
        <main className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
          <p className="max-w-sm text-[0.8125rem] text-muted-foreground">
            Sin guiones. Crea uno nuevo o importa un archivo `.fountain` para
            empezar.
          </p>
          <span className="flex items-center gap-2">
            <Button onClick={() => requestCreateScript()} className="h-8">
              <Plus aria-hidden="true" />
              Nuevo guion
            </Button>
            <ImportButton />
          </span>
        </main>
      ) : (
        <>
          {/* Móvil: tabs */}
          <main className="flex min-h-0 flex-1 flex-col gap-3 p-4 md:hidden">
            <div role="tablist" aria-label="Vista" className="flex gap-1">
              {(['editor', 'preview'] as const).map((t) => (
                <Button
                  key={t}
                  role="tab"
                  aria-selected={tab === t}
                  size="sm"
                  variant={tab === t ? 'secondary' : 'ghost'}
                  onClick={() => setTab(t)}
                  className="h-8"
                >
                  {t === 'editor' ? 'Editor' : 'Vista previa'}
                </Button>
              ))}
            </div>
            {tab === 'editor' ? (
              <EditorColumn
                text={text}
                disabled={booting}
                onChange={handleChange}
                warnings={warnings}
                warningsOpen={warningsOpen}
                onWarningsOpenChange={setWarningsOpen}
                onViewReady={handleViewReady}
                persistKey={activeScriptId}
                persistStore={editorPosition}
                onJumpToLine={handleJumpToLine}
              />
            ) : (
              <div className="min-h-0 flex-1">
                <PdfPreview
                  preview={preview}
                  paused={previewPaused}
                  onPausedChange={setPreviewPaused}
                  zoom={zoom}
                  expanded={previewExpanded}
                  onToggleExpand={toggleExpanded}
                  // REVIEW.md 8: el ajuste al ancho está disponible también en
                  // desktop (el número del porcentaje entra en fit).
                  fitEnabled
                  doc={doc}
                  source={text}
                  onJumpToSource={handleJumpToSource}
                  scrollKey={activeScriptId}
                  scrollStore={previewScroll}
                />
              </div>
            )}
          </main>

          {/* Desktop: sidebar + dual-pane */}
          <main className="hidden min-h-0 flex-1 overflow-hidden md:flex">
            <aside
              id="scripts-sidebar"
              className={`min-h-0 shrink-0 overflow-hidden border-r border-border p-4 ${
                collapsed ? 'w-14 px-2' : 'w-60'
              }`}
            >
              <ScriptsSidebar collapsed={collapsed} />
            </aside>
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
              {previewOpen && previewExpanded ? (
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4">
                  <div
                    id="preview-pane"
                    className="mx-auto flex h-full min-h-0 w-full max-w-[110ch] flex-col overflow-hidden"
                  >
                    <PdfPreview
                      preview={preview}
                      paused={previewPaused}
                      onPausedChange={setPreviewPaused}
                      zoom={zoom}
                      expanded={previewExpanded}
                      onToggleExpand={toggleExpanded}
                      // REVIEW.md 8: también aquí (vista en grande).
                      fitEnabled
                      doc={doc}
                      source={text}
                      onJumpToSource={handleJumpToSource}
                      scrollKey={activeScriptId}
                      scrollStore={previewScroll}
                    />
                  </div>
                </div>
              ) : previewOpen ? (
                <SplitWorkspace
                  scriptId={activeScriptId}
                  text={text}
                  disabled={booting}
                  onChange={handleChange}
                  warnings={warnings}
                  warningsOpen={warningsOpen}
                  onWarningsOpenChange={setWarningsOpen}
                  onViewReady={handleViewReady}
                  editorPosition={editorPosition}
                  preview={preview}
                  previewPaused={previewPaused}
                  onPausedChange={setPreviewPaused}
                  zoom={zoom}
                  previewExpanded={previewExpanded}
                  onToggleExpand={toggleExpanded}
                  previewScroll={previewScroll}
                  doc={doc}
                  onJumpToSource={handleJumpToSource}
                  onJumpToLine={handleJumpToLine}
                />
              ) : (
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4">
                  <EditorColumn
                    text={text}
                    disabled={booting}
                    onChange={handleChange}
                    warnings={warnings}
                    warningsOpen={warningsOpen}
                    onWarningsOpenChange={setWarningsOpen}
                    onViewReady={handleViewReady}
                    persistKey={activeScriptId}
                    persistStore={editorPosition}
                    onJumpToLine={handleJumpToLine}
                  />
                </div>
              )}
            </div>
          </main>
        </>
      )}

      <Toaster />
      <ScriptsDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        returnRef={menuButtonRef}
      />
      <NewScriptDialog
        open={isNewOpen}
        suggestion={newSuggestion}
        onConfirm={confirmNewScript}
        onOpenChange={(open) => {
          if (!open) cancelNewScript()
        }}
      />
    </div>
  )
}
