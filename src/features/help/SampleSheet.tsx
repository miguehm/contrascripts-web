// src/features/help/SampleSheet.tsx — mini-hoja fiel al PDF
// (REVIEW.md punto 11).
//
// Maqueta un snippet de `cheatsheet.ts` con las columnas reales del
// renderer: Courier 12pt → 10 chars/pulgada, bloque de texto de 60
// caracteres. Como Courier Prime es monoespaciada, `1ch = 1 columna` y la
// indentación por `indent`/`width` reproduce el layout del PDF (recortado al
// bloque de texto, sin el margen de 1.5" para caber en la card).

import { cn } from 'cn'
import type { SampleLine } from './cheatsheet'

export function SampleSheet({ lines }: { lines: SampleLine[] }) {
  return (
    <div
      role="img"
      aria-label="Muestra del elemento en formato de cine"
      className="scroll-slim w-[60ch] max-w-full overflow-x-auto rounded-sm border border-border bg-[var(--paper)] px-2 py-1.5 font-mono text-[10px] leading-[1.7] text-[var(--paper-ink)]"
    >
      {lines.map((line, i) =>
        line.blank ? (
          <div key={i} aria-hidden="true" className="h-[1.7em]" />
        ) : (
          <div
            key={i}
            style={{
              // `marginLeft`, no `paddingLeft`: con `border-box` el
              // `maxWidth` incluye el padding y recortaría el ancho útil
              // del bloque (diálogo/paréntesis) en `indent` caracteres.
              marginLeft: line.indent ? `${line.indent}ch` : undefined,
              maxWidth: line.width ? `${line.width}ch` : undefined,
            }}
            className={cn(
              line.align === 'right' && 'text-right',
              line.align === 'center' && 'text-center',
              line.bold && 'font-bold',
              line.italic && 'italic',
            )}
          >
            {line.text}
          </div>
        ),
      )}
    </div>
  )
}
