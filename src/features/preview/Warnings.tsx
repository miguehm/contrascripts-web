// src/features/preview/Warnings.tsx — avisos de `lint()` (§5).
//
// El recuento vive en `aria-live="polite"` para que un lector de pantalla
// anuncie los cambios sin leer la lista entera en cada tecla.

import type { Warning } from '@/vendor/fountain.mjs'

export function Warnings({ warnings }: { warnings: Warning[] }) {
  return (
    <section aria-label="Avisos de formato" className="flex flex-col gap-2">
      <h2
        aria-live="polite"
        className="text-[0.6875rem] font-semibold tracking-[0.06em] text-muted-foreground uppercase"
      >
        Avisos
        {warnings.length > 0 ? ` (${warnings.length})` : ' (0)'}
      </h2>
      {warnings.length === 0 ? (
        <p className="rounded-sm border border-border px-3 py-2 text-[0.8125rem] text-muted-foreground">
          Sin avisos. El formato es válido.
        </p>
      ) : (
        <ul className="flex max-h-40 flex-col gap-1 overflow-y-auto">
          {warnings.map((w, i) => (
            <li
              key={`${w.line}-${w.code}-${i}`}
              className="flex items-baseline gap-2 rounded-sm border border-border px-3 py-1.5 text-[0.8125rem]"
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
      )}
    </section>
  )
}
