// src/features/preview/Preview.tsx — hoja del guion (§5).
//
// Render memoizado sobre `doc` para no re-renderizar la hoja en cada
// tecla: el padre pasa el `Document` ya colapsado por rAF y aquí solo se
// deriva el JSX con `useMemo`. Márgenes carta USA según §8:
// izq 1.5in, der 1in, arriba/abajo 1in.

import { useMemo } from 'react'
import type { Document } from '@/vendor/fountain.mjs'
import { ElementView } from './ElementView'
import { TitlePageView } from './TitlePageView'

export function Preview({ doc }: { doc: Document | null }) {
  const body = useMemo(() => {
    if (!doc) return null
    const breaksBefore = (index: number) =>
      doc.elements.slice(0, index).filter((el) => el.type === 'pageBreak')
        .length
    return (
      <>
        <TitlePageView titlePage={doc.titlePage} />
        {doc.elements.map((el, i) => (
          <ElementView key={i} node={el} page={breaksBefore(i) + 1} />
        ))}
      </>
    )
  }, [doc])

  return (
    <section aria-label="Vista previa" className="flex h-full flex-col gap-2">
      <h2 className="text-[0.6875rem] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
        Vista previa
      </h2>
      <div className="min-h-0 flex-1 overflow-y-auto rounded-sm border border-border bg-muted/30 p-4 sm:p-6">
        <article
          role="document"
          aria-label="Guion formateado"
          className="mx-auto w-full max-w-[8.5in] rounded-[2px] bg-[var(--paper)] px-[1in] py-[1in] pl-[1.5in] shadow-[0_4px_20px_-2px_rgba(15,23,42,0.05),0_1px_3px_rgba(15,23,42,0.03)] dark:shadow-[0_2px_4px_rgba(0,0,0,0.2),0_16px_40px_rgba(0,0,0,0.4)]"
        >
          {body ?? (
            <p className="font-mono text-base text-[var(--paper-ink)] opacity-60">
              Cargando motor…
            </p>
          )}
        </article>
      </div>
    </section>
  )
}
