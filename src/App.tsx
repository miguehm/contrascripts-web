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

import { useEffect, useMemo, useRef, useState } from 'react'
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
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import { Separator } from '@/components/ui/separator'
import { Editor } from '@/features/editor/Editor'
import { PdfPreview } from '@/features/preview/PdfPreview'
import { usePdfPreview } from '@/features/preview/usePdfPreview'
import { Warnings } from '@/features/preview/Warnings'
import { ImportButton } from '@/features/scripts/ImportButton'
import { NewScriptDialog } from '@/features/scripts/NewScriptDialog'
import { ScriptsDrawer } from '@/features/scripts/ScriptsDrawer'
import { ScriptsSidebar } from '@/features/scripts/ScriptsSidebar'
import { ExportButton } from '@/components/ExportButton'
import { useParser } from '@/hooks/useParser'
import { usePreviewOpen } from '@/hooks/usePreviewOpen'
import { useScripts } from '@/hooks/useScripts'
import { useSidebarCollapsed } from '@/hooks/useSidebarCollapsed'
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
      <span
        role="status"
        className="rounded-sm border border-border px-2 py-0.5 font-mono text-[10px] text-muted-foreground uppercase"
      >
        Listo
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
      className="rounded-sm border border-border px-2 py-0.5 font-mono text-[10px] text-muted-foreground uppercase"
    >
      Iniciando…
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
  const { collapsed, toggle } = useSidebarCollapsed()
  const { open: previewOpen, toggle: togglePreview } = usePreviewOpen()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const text = activeScript?.text ?? ''
  const { status, doc, warnings, retry } = useParser(text)

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
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggle, togglePreview])
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
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border px-4">
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
              <div className="mx-auto flex min-h-0 w-full max-w-[70ch] flex-1 flex-col gap-3">
                <div className="min-h-0 flex-1">
                  <Editor
                    value={text}
                    onChange={handleChange}
                    disabled={booting}
                  />
                </div>
                <Warnings warnings={warnings} />
              </div>
            ) : (
              <div className="min-h-0 flex-1">
                <PdfPreview
                  preview={preview}
                  paused={previewPaused}
                  onPausedChange={setPreviewPaused}
                />
              </div>
            )}
          </main>

          {/* Desktop: sidebar + dual-pane */}
          <main className="hidden min-h-0 flex-1 md:flex">
            <aside
              id="scripts-sidebar"
              className={`shrink-0 border-r border-border p-4 ${
                collapsed ? 'w-14 px-2' : 'w-60'
              }`}
            >
              <ScriptsSidebar collapsed={collapsed} />
            </aside>
            <div className="min-w-0 flex-1">
              {previewOpen ? (
                <ResizablePanelGroup orientation="horizontal" className="p-4">
                  <ResizablePanel defaultSize={50} minSize={30}>
                    <div className="flex h-full flex-col gap-3 pr-2">
                      <div className="mx-auto flex min-h-0 w-full max-w-[70ch] flex-1 flex-col gap-3 xl:max-w-[820px]">
                        <div className="min-h-0 flex-1">
                          <Editor
                            value={text}
                            onChange={handleChange}
                            disabled={booting}
                          />
                        </div>
                        <Separator />
                        <Warnings warnings={warnings} />
                      </div>
                    </div>
                  </ResizablePanel>
                  <ResizableHandle withHandle />
                  <ResizablePanel defaultSize={50} minSize={30}>
                    <div id="preview-pane" className="h-full pl-2">
                      <PdfPreview
                        preview={preview}
                        paused={previewPaused}
                        onPausedChange={setPreviewPaused}
                      />
                    </div>
                  </ResizablePanel>
                </ResizablePanelGroup>
              ) : (
                <div className="h-full p-4">
                  <div className="mx-auto flex h-full w-full max-w-[70ch] flex-col gap-3 xl:max-w-[820px]">
                    <div className="min-h-0 flex-1">
                      <Editor
                        value={text}
                        onChange={handleChange}
                        disabled={booting}
                      />
                    </div>
                    <Separator />
                    <Warnings warnings={warnings} />
                  </div>
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
