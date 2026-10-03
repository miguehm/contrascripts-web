// src/features/preview/Warnings.tsx — marginalia en la capitular (§5,
// REVIEW.md punto 4).
//
// El trigger vive en la fila de capitular del `Editor` (slot
// `headerAction`, coste 0px en reposo) y solo se monta si hay avisos; la
// región viva `sr-only` anuncia el recuento siempre. El panel cae como hoja
// desde la capitular sobre el manuscrito: nunca empuja el layout.
// Estado controlado por el padre (`App` → `useWarningsOpen`): persiste en
// `guion.warnings.v1`.

import { useEffect, useRef } from 'react'
import { ChevronDown } from 'lucide-react'
import type { Warning } from '@/vendor/fountain.mjs'
import { cn } from '@/lib/utils'

function formatCount(count: number): string {
  return count === 1 ? '1 aviso' : `${count} avisos`
}

interface TriggerProps {
  warnings: Warning[]
  open: boolean
  onOpenChange: (open: boolean) => void
  panelId: string
  ref?: React.Ref<HTMLButtonElement>
}

/** Anotación compacta en la capitular. `null` sin avisos: cero ruido. */
export function WarningsTrigger({
  warnings,
  open,
  onOpenChange,
  panelId,
  ref,
}: TriggerProps) {
  const count = warnings.length
  if (count === 0) return null
  return (
    <button
      ref={ref}
      type="button"
      onClick={() => onOpenChange(!open)}
      aria-expanded={open}
      aria-controls={panelId}
      aria-label={`Avisos, ${formatCount(count)}. ${open ? 'Ocultar' : 'Mostrar'}`}
      className="flex h-6 shrink-0 items-center gap-1.5 rounded-sm px-2 text-[0.6875rem] font-semibold tracking-[0.06em] text-muted-foreground uppercase transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:ring-1 focus-visible:ring-[var(--ring)] focus-visible:outline-none"
    >
      <span
        aria-hidden="true"
        className="size-1.5 rounded-full bg-[var(--primary)]"
      />
      <span>
        Avisos <span className="font-mono tabular-nums">({count})</span>
      </span>
      <ChevronDown
        aria-hidden="true"
        className={cn(
          'size-3.5 transition-transform duration-150 ease-out',
          open && 'rotate-180',
        )}
      />
    </button>
  )
}

interface LiveProps {
  warnings: Warning[]
}

/** Anuncio para lector de pantalla, siempre montado aunque el trigger no. */
export function WarningsLive({ warnings }: LiveProps) {
  const count = warnings.length
  return (
    <span role="status" aria-live="polite" className="sr-only">
      {count === 0
        ? 'Sin avisos. El formato es válido.'
        : `Avisos: ${formatCount(count)}.`}
    </span>
  )
}

interface PanelProps {
  warnings: Warning[]
  open: boolean
  onClose: () => void
  panelId: string
  triggerRef: React.RefObject<HTMLButtonElement | null>
}

/** Hoja flotante con la lista. El padre la posiciona (anclada a la capitular). */
export function WarningsPanel({
  warnings,
  open,
  onClose,
  panelId,
  triggerRef,
}: PanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  // `Escape` cierra y devuelve el foco al trigger; clic fuera cierra.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        triggerRef.current?.focus()
      }
    }
    const onPointer = (e: PointerEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        !(e.target as HTMLElement).closest(`[aria-controls="${panelId}"]`)
      ) {
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
    }
  }, [open, onClose, panelId, triggerRef])

  if (!open) return null
  return (
    <div
      ref={panelRef}
      id={panelId}
      role="region"
      aria-label="Lista de avisos"
      data-testid="warnings-panel"
      className="absolute inset-x-2 top-8 z-10 rounded-lg border border-border bg-popover p-2 shadow-lg ring-1 ring-foreground/10 sm:right-2 sm:left-auto sm:w-96"
    >
      {warnings.length > 0 ? (
        <ul className="flex max-h-60 flex-col gap-1 overflow-y-auto">
          {warnings.map((w, i) => (
            <li
              key={`${w.line}-${w.code}-${i}`}
              className="flex items-baseline gap-2 rounded-sm border border-border bg-card px-3 py-1.5 text-[0.8125rem]"
            >
              <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
                L{w.line}
              </span>
              <code className="shrink-0 rounded-sm border border-[var(--syntax)] px-1 font-mono text-[10px] text-[var(--syntax)] uppercase">
                {w.code}
              </code>
              <span className="text-foreground">{w.message}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-sm px-3 py-2 text-[0.8125rem] text-muted-foreground">
          Sin avisos. El formato es válido.
        </p>
      )}
    </div>
  )
}
