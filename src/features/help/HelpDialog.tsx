// src/features/help/HelpDialog.tsx — botón de Ayuda (REVIEW.md 11).
//
// En la barra superior: abre un modal con el cheatsheet Fountain (cómo se
// escribe cada elemento en texto plano y qué representa en el formato de
// cine). Estado efímero; el contenido vive en `cheatsheet.ts` y cada muestra
// la maqueta `SampleSheet` con las columnas reales del PDF. Atajo: solo
// `F1` (a propósito nada de `?`: colisionaría al teclearlo en el editor).
//
// La previsualización se limita a lo que el PDF sí renderiza: sección,
// sinopsis, nota y comentario viven en su propia sección sin muestra.

import { useEffect, useState } from 'react'
import { CircleHelp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  CHEATSHEET,
  INLINE_FORMATTING,
  INLINE_RENDER_SAMPLE,
  TITLE_PAGE_KEYS,
  TITLE_PAGE_SAMPLE,
  type CheatsheetEntry,
} from './cheatsheet'
import { SampleSheet } from './SampleSheet'

function EntryCard({ entry }: { entry: CheatsheetEntry }) {
  return (
    <article className="flex min-w-0 flex-col gap-2 rounded-sm border border-border px-3 py-2">
      <header className="flex flex-col gap-0.5">
        <h3 className="text-[0.8125rem] font-semibold">{entry.element}</h3>
        <code className="font-mono text-xs text-muted-foreground">
          {entry.syntax}
        </code>
      </header>
      <p className="text-[0.8125rem] text-muted-foreground">
        {entry.screenplay}
      </p>
      {entry.sample && <SampleSheet lines={entry.sample} />}
      {entry.note && (
        <p className="text-xs text-muted-foreground italic">{entry.note}</p>
      )}
    </article>
  )
}

export function HelpDialog() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const rendered = CHEATSHEET.filter((entry) => entry.rendersInPdf)
  const manuscriptOnly = CHEATSHEET.filter((entry) => !entry.rendersInPdf)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Ayuda"
          title="Ayuda (F1)"
        >
          <CircleHelp aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent className="h-[min(44rem,88dvh)] grid-rows-[auto_minmax(0,1fr)] sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="font-semibold">
            Ayuda — Sintaxis Fountain
          </DialogTitle>
          <DialogDescription>
            Cómo se escribe cada elemento en texto plano y qué representa en el
            formato de cine.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="min-h-0 flex-1 pr-3">
          <div className="flex flex-col gap-5">
            <section aria-labelledby="help-rendered">
              <h2
                id="help-rendered"
                className="mb-2 text-[0.6875rem] font-semibold tracking-[0.06em] text-muted-foreground uppercase"
              >
                Se imprimen en el PDF
              </h2>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {rendered.map((entry) => (
                  <EntryCard key={entry.id} entry={entry} />
                ))}

                <article className="flex min-w-0 flex-col gap-2 rounded-sm border border-border px-3 py-2">
                  <h3 className="text-[0.8125rem] font-semibold">Portada</h3>
                  <p className="text-[0.8125rem] text-muted-foreground">
                    Pares{' '}
                    <code className="font-mono text-xs">Clave: Valor</code> al
                    inicio del documento; producen la portada profesional de 3
                    zonas del PDF.
                  </p>
                  <SampleSheet lines={TITLE_PAGE_SAMPLE} />
                  <ul className="flex flex-col gap-0.5">
                    {TITLE_PAGE_KEYS.map(({ key, use }) => (
                      <li key={key} className="text-[0.8125rem]">
                        <code className="font-mono text-xs">{key}</code>{' '}
                        <span className="text-muted-foreground">— {use}</span>
                      </li>
                    ))}
                  </ul>
                </article>

                <article className="flex min-w-0 flex-col gap-2 rounded-sm border border-border px-3 py-2">
                  <h3 className="text-[0.8125rem] font-semibold">
                    Formato inline
                  </h3>
                  <p className="text-[0.8125rem] text-muted-foreground">
                    Dentro de acción, diálogo y título de portada.
                  </p>
                  <SampleSheet lines={INLINE_RENDER_SAMPLE} />
                  <ul className="flex flex-col gap-0.5">
                    {INLINE_FORMATTING.map(({ markup, use }) => (
                      <li key={markup} className="text-[0.8125rem]">
                        <code className="font-mono text-xs">{markup}</code>{' '}
                        <span className="text-muted-foreground">— {use}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              </div>
            </section>

            <section aria-labelledby="help-manuscript">
              <h2
                id="help-manuscript"
                className="mb-2 text-[0.6875rem] font-semibold tracking-[0.06em] text-muted-foreground uppercase"
              >
                No se imprimen en el PDF
              </h2>
              <p className="mb-2 text-[0.8125rem] text-muted-foreground">
                Viven solo en el manuscrito: organización y notas de trabajo.
              </p>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {manuscriptOnly.map((entry) => (
                  <EntryCard key={entry.id} entry={entry} />
                ))}
              </div>
            </section>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
