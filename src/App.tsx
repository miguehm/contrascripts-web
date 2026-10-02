// src/App.tsx — shell §5 + multi-guion §6: boot + editor + preview +
// warnings + export.
//
// El texto editable ya no es un `useState` local: viene del guion activo
// del store (`useScripts()`); cada tecla hace `updateText()` y el provider
// persiste con debounce (~500ms) + flush al salir/cambiar (§6).
// Desktop (>md): sidebar de guiones + dual-pane con `ResizablePanelGroup`.
// Móvil: selector compacto en header + tabs Editor/Preview. Los tokens
// Warm/Cinematic (§8) quedan fuera.

import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
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
import { Preview } from '@/features/preview/Preview'
import { Warnings } from '@/features/preview/Warnings'
import { ImportButton } from '@/features/scripts/ImportButton'
import { ScriptSwitcher } from '@/features/scripts/ScriptSwitcher'
import { ScriptsSidebar } from '@/features/scripts/ScriptsSidebar'
import { ExportButton } from '@/components/ExportButton'
import { useParser } from '@/hooks/useParser'
import { useScripts } from '@/hooks/useScripts'
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
  const { activeScript, updateText, createScript } = useScripts()
  const [tab, setTab] = useState<Tab>('editor')
  const text = activeScript?.text ?? ''
  const { status, fountain, doc, warnings, retry } = useParser(text)

  const stats = useMemo(() => {
    if (!doc) return { elements: 0, pages: 1 }
    const breaks = doc.elements.filter((el) => el.type === 'pageBreak').length
    return { elements: doc.elements.length, pages: breaks + 1 }
  }, [doc])

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
        <h1 className="hidden text-[0.8125rem] font-medium md:inline">Guion</h1>
        <span className="min-w-0 md:hidden">
          <ScriptSwitcher />
        </span>
        <StatusBadge status={status} onRetry={retry} />
        <span className="ml-auto flex items-center gap-3">
          <span className="hidden font-mono text-xs text-muted-foreground tabular-nums sm:inline">
            {stats.elements} elementos · ~{stats.pages} pág.
          </span>
          <ExportButton fountain={fountain} text={text} filename={pdfName} />
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
            <Button onClick={() => createScript()} className="h-8">
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
              <div className="flex min-h-0 flex-1 flex-col gap-3">
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
                <Preview doc={doc} />
              </div>
            )}
          </main>

          {/* Desktop: sidebar + dual-pane */}
          <main className="hidden min-h-0 flex-1 md:flex">
            <aside className="w-60 shrink-0 border-r border-border p-4">
              <ScriptsSidebar />
            </aside>
            <div className="min-w-0 flex-1">
              <ResizablePanelGroup orientation="horizontal" className="p-4">
                <ResizablePanel defaultSize={50} minSize={30}>
                  <div className="flex h-full flex-col gap-3 pr-2">
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
                </ResizablePanel>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize={50} minSize={30}>
                  <div className="h-full pl-2">
                    <Preview doc={doc} />
                  </div>
                </ResizablePanel>
              </ResizablePanelGroup>
            </div>
          </main>
        </>
      )}

      <Toaster />
    </div>
  )
}
