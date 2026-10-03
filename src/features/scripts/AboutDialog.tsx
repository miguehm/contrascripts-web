// src/features/scripts/AboutDialog.tsx — "Acerca de" (§REVIEW-3).
//
// Sustituye al botón grande inferior duplicado de Importar: mismo
// `variant/size/className` para encajar en el pie del sidebar (w-full) y en
// el rail colapsado (icon-sm). Modal efímero con shadcn Dialog (trap de
// foco nativo Radix); sin store ni localStorage.

import { useState } from 'react'
import { Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

function getAppVersion(): string {
  try {
    if (typeof __APP_VERSION__ !== 'undefined' && __APP_VERSION__) {
      return __APP_VERSION__
    }
  } catch {
    // Sin define (p. ej. test sin vite): cae al valor por defecto.
  }
  return '0.0.0'
}

interface AboutDialogProps {
  variant?: 'outline' | 'ghost'
  size?: 'sm' | 'icon-sm'
  className?: string
}

export function AboutDialog({
  variant = 'outline',
  size = 'sm',
  className,
}: AboutDialogProps) {
  const [open, setOpen] = useState(false)
  const version = getAppVersion()

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant={variant}
          size={size}
          className={className}
          aria-label="Acerca de Guion"
          title="Acerca de"
        >
          <Info aria-hidden="true" />
          {size === 'icon-sm' ? null : 'Acerca de'}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Guion</DialogTitle>
          <DialogDescription>
            Editor de guiones Fountain (Vite/React + TS + WASM).
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 text-[0.8125rem] text-muted-foreground">
          <p className="font-mono text-xs tabular-nums">v{version}</p>
          <p>
            Motor fountain-parser (Go/WASM) en Web Worker + raster con pdf.js:
            lo que ves es lo que se exporta.
          </p>
          <p>
            Atajo:{' '}
            <kbd className="rounded-sm border border-border px-1 font-mono text-[11px]">
              Ctrl
            </kbd>{' '}
            +{' '}
            <kbd className="rounded-sm border border-border px-1 font-mono text-[11px]">
              B
            </kbd>{' '}
            para colapsar el panel de guiones.
          </p>
          <p>
            Licencia MIT — ver{' '}
            <a
              href="https://github.com/anomalyco/opencode"
              target="_blank"
              rel="noreferrer"
            >
              repositorio
            </a>
            .
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
