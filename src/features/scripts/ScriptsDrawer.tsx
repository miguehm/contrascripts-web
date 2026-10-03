// src/features/scripts/ScriptsDrawer.tsx — drawer lateral de guiones en móvil.
//
// Overlay desde la izquierda con backdrop. Efímero: nunca se persiste.
// Cierra con Escape, click en backdrop, botón X o al navegar (seleccionar /
// crear). Retorna el foco al disparador al cerrar.

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScriptsSidebar } from './ScriptsSidebar'

interface Props {
  open: boolean
  onClose: () => void
  returnRef?: React.RefObject<HTMLElement | null>
}

export function ScriptsDrawer({ open, onClose, returnRef }: Props) {
  const panelRef = useRef<HTMLElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    const returnEl = returnRef?.current ?? null
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      if (returnEl && typeof returnEl.focus === 'function') returnEl.focus()
    }
  }, [open, onClose, returnRef])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <button
        type="button"
        aria-label="Cerrar guiones"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/50"
      />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Guiones"
        className="absolute inset-y-0 left-0 flex w-[85vw] max-w-80 flex-col gap-2 bg-background p-4 shadow-xl transition-transform"
      >
        <div className="flex items-center justify-end">
          <Button
            ref={closeRef}
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Cerrar guiones"
          >
            <X aria-hidden="true" />
          </Button>
        </div>
        <div className="min-h-0 flex-1">
          <ScriptsSidebar onNavigate={onClose} />
        </div>
      </aside>
    </div>
  )
}
