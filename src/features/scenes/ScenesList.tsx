// src/features/scenes/ScenesList.tsx — listado de escenas (REVIEW.md 13).
//
// Presentacional: recibe escenas ya derivadas y emite la línea elegida.
// El salto (editor + PDF) lo orquesta `App` con el camino de los puntos 4/7.
//
// La preview ocupa dos renglones (`line-clamp-2`) y el título uno
// (`truncate`); cuando el texto queda recortado se funde con una máscara
// (fundido de cine: la escena "continúa") en vez del "…" que cortaba a
// mitad de palabra. La máscara —y no un overlay con color— es agnóstica al
// fondo: sobrevive al `hover` y a ambos temas sin mantenimiento. El texto
// completo queda en el DOM, así que los lectores de pantalla lo leen entero.

import { ScrollArea } from '@/components/ui/scroll-area'
import type { SceneItem } from '@/lib/scenes'
import { useIsClamped } from './useIsClamped'

/** Fundido horizontal (títulos de una línea que continúan a la derecha). */
const TITLE_FADE =
  '[mask-image:linear-gradient(to_right,black_78%,transparent)] [-webkit-mask-image:linear-gradient(to_right,black_78%,transparent)]'

/** Fundido vertical (previews de dos líneas que continúan abajo). */
const PREVIEW_FADE =
  '[mask-image:linear-gradient(to_bottom,black_55%,transparent)] [-webkit-mask-image:linear-gradient(to_bottom,black_55%,transparent)]'

interface Props {
  scenes: SceneItem[]
  onJumpToScene?: (line: number) => void
  onNavigate?: () => void
}

function SceneRow({
  scene,
  onJumpToScene,
  onNavigate,
}: {
  scene: SceneItem
  onJumpToScene?: (line: number) => void
  onNavigate?: () => void
}) {
  const [titleRef, titleClamped] = useIsClamped<HTMLSpanElement>()
  const [previewRef, previewClamped] = useIsClamped<HTMLSpanElement>()

  return (
    <li>
      <button
        type="button"
        onClick={() => {
          onJumpToScene?.(scene.line)
          onNavigate?.()
        }}
        aria-label={`Ir a la escena ${scene.index}: ${scene.title}`}
        title={`Línea ${scene.line}`}
        className="min-w-0 w-full rounded-sm border border-transparent px-2 py-1.5 text-left outline-none transition-colors hover:bg-accent/60 focus-visible:border-ring"
      >
        <span className="flex items-baseline gap-2">
          <span className="shrink-0 font-mono text-[10px] text-muted-foreground tabular-nums">
            {scene.index}
          </span>
          <span
            ref={titleRef}
            className={`block min-w-0 flex-1 overflow-hidden font-mono text-[0.8125rem] font-bold tracking-[0.02em] whitespace-nowrap ${titleClamped ? TITLE_FADE : ''}`}
          >
            {scene.title || '(sin título)'}
          </span>
        </span>
        {scene.preview ? (
          <span
            ref={previewRef}
            className={`mt-0.5 pl-6 text-[0.75rem] text-muted-foreground line-clamp-2 ${previewClamped ? PREVIEW_FADE : ''}`}
          >
            {scene.preview}
          </span>
        ) : null}
      </button>
    </li>
  )
}

export function ScenesList({ scenes, onJumpToScene, onNavigate }: Props) {
  if (scenes.length === 0) {
    return (
      <p
        aria-live="polite"
        className="rounded-sm border border-border px-3 py-2 text-[0.8125rem] text-muted-foreground"
      >
        Sin escenas. Añade un slugline como `INT. CASA - DÍA` para verlo aquí.
      </p>
    )
  }

  return (
    <ScrollArea className="min-h-0 flex-1">
      <ul aria-label="Escenas del guion" className="flex flex-col gap-1 pr-4">
        {scenes.map((scene) => (
          <SceneRow
            key={scene.id}
            scene={scene}
            onJumpToScene={onJumpToScene}
            onNavigate={onNavigate}
          />
        ))}
      </ul>
    </ScrollArea>
  )
}
