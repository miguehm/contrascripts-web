// src/components/SplitWorkspace.tsx — dual-pane editor + preview (desktop).
//
// Extraído de `App` para que el `ResizablePanelGroup` remonte limpio al
// volver de la vista en grande: el `defaultLayout` se lee del store al
// montar (sesión y recargas vía `guion.split.v1`), así el divisor
// personalizado sobrevive a expandir/colapsar. Sin esto remontaba a 50/50
// y con otro ancho cambiaba el wrapping → la posición del editor derivaba
// (REVIEW.md 6).
//
// Tamaños (verificados contra `react-resizable-panels@4`: número = px,
// string = %): `defaultSize="50"` (50%, como el PLAN §8), `minSize` en px
// para una medida de lectura estable sea cual sea el viewport — editor 400
// (~40ch Courier) y preview 300 — en vez del `minSize={30}` previo (30px,
// sin suelo real).

import { useCallback, useState } from 'react'
import type { EditorView } from '@codemirror/view'
import type { Layout, LayoutChangedMeta } from 'react-resizable-panels'
import { EditorColumn } from '@/components/EditorColumn'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import type { EditorPositionStore } from '@/hooks/useEditorPosition'
import type { PreviewZoom } from '@/hooks/usePreviewZoom'
import type { PreviewScrollStore } from '@/hooks/usePreviewScroll'
import { PdfPreview } from '@/features/preview/PdfPreview'
import type { PdfPreviewState } from '@/features/preview/usePdfPreview'
import {
  loadSplitLayout,
  saveSplitLayout,
  splitLayoutFromGroup,
} from '@/store/splitStorage'
import type { Warning } from '@/vendor/fountain.mjs'
import type { Document } from '@/vendor/fountain.mjs'

interface SplitWorkspaceProps {
  scriptId: string | null
  text: string
  disabled: boolean
  onChange: (value: string) => void
  warnings: Warning[]
  warningsOpen: boolean
  onWarningsOpenChange: (open: boolean) => void
  onViewReady: (view: EditorView | null, container: HTMLElement | null) => void
  editorPosition: EditorPositionStore
  preview: PdfPreviewState
  previewPaused: boolean
  onPausedChange: (paused: boolean) => void
  zoom: PreviewZoom
  previewExpanded: boolean
  onToggleExpand: () => void
  previewScroll: PreviewScrollStore
  doc: Document | null
  onJumpToSource: (offset: number) => void
  /** Salto a la línea de un aviso del panel (punto 7). */
  onJumpToLine?: (line: number) => void
}

export function SplitWorkspace({
  scriptId,
  text,
  disabled,
  onChange,
  warnings,
  warningsOpen,
  onWarningsOpenChange,
  onViewReady,
  editorPosition,
  preview,
  previewPaused,
  onPausedChange,
  zoom,
  previewExpanded,
  onToggleExpand,
  previewScroll,
  doc,
  onJumpToSource,
  onJumpToLine,
}: SplitWorkspaceProps) {
  // Leído una vez al montar: este componente solo vive en la rama split,
  // así que cada vuelta de expandir/colapsar relee el último divisor.
  // Identidad estable en vida → la librería no lo reaplica al escribir.
  const [defaultLayout] = useState<Layout | undefined>(
    () => loadSplitLayout() ?? undefined,
  )
  const handleLayoutChanged = useCallback(
    (layout: Layout, meta: LayoutChangedMeta) => {
      // `requestedLayout` preserva la intención ante constraints
      // temporales (p. ej. sidebar colapsada que luego se expande).
      const split = splitLayoutFromGroup(meta.requestedLayout ?? layout)
      if (split) saveSplitLayout(split)
    },
    [],
  )

  return (
    <ResizablePanelGroup
      orientation="horizontal"
      className="min-h-0 overflow-hidden p-4"
      defaultLayout={defaultLayout}
      onLayoutChanged={handleLayoutChanged}
    >
      <ResizablePanel
        id="editor"
        defaultSize="50"
        minSize={400}
        className="min-h-0 overflow-hidden"
      >
        <div className="flex h-full min-h-0 flex-col overflow-hidden pr-2">
          <EditorColumn
            text={text}
            disabled={disabled}
            onChange={onChange}
            warnings={warnings}
            warningsOpen={warningsOpen}
            onWarningsOpenChange={onWarningsOpenChange}
            onViewReady={onViewReady}
            persistKey={scriptId}
            persistStore={editorPosition}
            onJumpToLine={onJumpToLine}
          />
        </div>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel
        id="preview"
        defaultSize="50"
        minSize={300}
        className="min-h-0 overflow-hidden"
      >
        <div
          id="preview-pane"
          className="flex h-full min-h-0 flex-col overflow-hidden pl-2"
        >
          <PdfPreview
            preview={preview}
            paused={previewPaused}
            onPausedChange={onPausedChange}
            zoom={zoom}
            expanded={previewExpanded}
            onToggleExpand={onToggleExpand}
            doc={doc}
            source={text}
            onJumpToSource={onJumpToSource}
            scrollKey={scriptId}
            scrollStore={previewScroll}
          />
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}
