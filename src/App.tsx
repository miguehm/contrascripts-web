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

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
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
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import { Editor } from '@/features/editor/Editor'
import { jumpToOffset } from '@/features/editor/jumpToOffset'
import { PdfPreview } from '@/features/preview/PdfPreview'
import { usePdfPreview } from '@/features/preview/usePdfPreview'
import {
  WarningsLive,
  WarningsPanel,
  WarningsTrigger,
} from '@/features/preview/Warnings'
import { ImportButton } from '@/features/scripts/ImportButton'
import { NewScriptDialog } from '@/features/scripts/NewScriptDialog'
import { ScriptsDrawer } from '@/features/scripts/ScriptsDrawer'
import { ScriptsSidebar } from '@/features/scripts/ScriptsSidebar'
import { ExportButton } from '@/components/ExportButton'
import { useParser } from '@/hooks/useParser'
import { usePreviewOpen } from '@/hooks/usePreviewOpen'
import { usePreviewZoom } from '@/hooks/usePreviewZoom'
import { useScripts } from '@/hooks/useScripts'
import { useSidebarCollapsed } from '@/hooks/useSidebarCollapsed'
import { useWarningsOpen } from '@/hooks/useWarningsOpen'
import { sanitizeFilename } from '@/lib/scripts'
import type { Warning } from '@/vendor/fountain.mjs'

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

// Columna de editor a alto completo: el trigger de avisos vive en la
// capitular (slot `headerAction`, 0px extra en reposo) y el panel cae como
// hoja desde ella. `useId` por columna: móvil y desktop coexisten montados
// (`md:hidden` / `hidden md:flex`), cada trigger apunta a su propio panel.
// `onViewReady` propaga el `EditorView` de cada columna para el salto al texto
// del punto 4. Las dos coexisten montadas (una oculta por CSS), así que el
// consumidor elige la visible midiendo su contenedor.
function EditorColumn({
  text,
  disabled,
  onChange,
  warnings,
  warningsOpen,
  onWarningsOpenChange,
  onViewReady,
}: {
  text: string
  disabled: boolean
  onChange: (value: string) => void
  warnings: Warning[]
  warningsOpen: boolean
  onWarningsOpenChange: (open: boolean) => void
  /** Recibe la vista de esta columna con su contenedor (punto 4). */
  onViewReady?: (view: EditorView | null, container: HTMLElement | null) => void
}) {
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
      />
    </div>
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
  // REVIEW.md 3: el zoom vive aquí (no en `PdfPreview`) para que el cambio
  // de tab móvil —que desmonta el preview— no lo reinicie; persiste vía store.
  // REVIEW.md 1: fit al ancho por defecto solo en móvil (fitDefault); en
  // desktop siempre entra manual.
  const zoom = usePreviewZoom({ fitDefault: !isDesktop })
  // Al abrir otro guion (nuevo o existente) el fit inicial vuelve a
  // aplicarse; el cambio de tab editor↔preview con el mismo guion conserva
  // el zoom vigente.
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
  // REVIEW.md 4: avisos como notas al pie — tira dockada + panel flotante.
  // `open` persiste en `guion.warnings.v1`; ante avisos nuevos solo se
  // ilumina el badge (sin auto-apertura: taparía manuscrito).
  const { open: warningsOpen, setOpen: setWarningsOpen } = useWarningsOpen()
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
    },
    [],
  )

  // El salto va al editor, y en móvil además cambia de tab: el documento solo
  // está visible mientras el tab Editor no lo tapa.
  const handleJumpToSource = useCallback((offset: number) => {
    // La columna visible es la que tiene tamaño; si ninguna midiera (aún
    // montando, o un breakpoint raro con las dos a pantalla completa) se usa la
    // última registrada.
    const entries = editorViewsRef.current
    const target =
      entries
        .filter((entry) => (entry.container?.offsetWidth ?? 0) > 0)
        .at(-1) ?? entries.at(-1)
    if (target) jumpToOffset(target.view, offset)
    setTab('editor')
  }, [])

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
                  fitEnabled={!isDesktop}
                  doc={doc}
                  source={text}
                  onJumpToSource={handleJumpToSource}
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
                      doc={doc}
                      source={text}
                      onJumpToSource={handleJumpToSource}
                    />
                  </div>
                </div>
              ) : previewOpen ? (
                <ResizablePanelGroup
                  orientation="horizontal"
                  className="min-h-0 overflow-hidden p-4"
                >
                  <ResizablePanel
                    defaultSize={50}
                    minSize={30}
                    className="min-h-0 overflow-hidden"
                  >
                    <div className="flex h-full min-h-0 flex-col overflow-hidden pr-2">
                      <EditorColumn
                        text={text}
                        disabled={booting}
                        onChange={handleChange}
                        warnings={warnings}
                        warningsOpen={warningsOpen}
                        onWarningsOpenChange={setWarningsOpen}
                        onViewReady={handleViewReady}
                      />
                    </div>
                  </ResizablePanel>
                  <ResizableHandle withHandle />
                  <ResizablePanel
                    defaultSize={50}
                    minSize={30}
                    className="min-h-0 overflow-hidden"
                  >
                    <div
                      id="preview-pane"
                      className="flex h-full min-h-0 flex-col overflow-hidden pl-2"
                    >
                      <PdfPreview
                        preview={preview}
                        paused={previewPaused}
                        onPausedChange={setPreviewPaused}
                        zoom={zoom}
                        expanded={previewExpanded}
                        onToggleExpand={toggleExpanded}
                        doc={doc}
                        source={text}
                        onJumpToSource={handleJumpToSource}
                      />
                    </div>
                  </ResizablePanel>
                </ResizablePanelGroup>
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
