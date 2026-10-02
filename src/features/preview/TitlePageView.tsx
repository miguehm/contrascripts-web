// src/features/preview/TitlePageView.tsx — portada del guion (§5).
//
// Todos los campos siempre vienen presentes (string vacío = ausente).
// Solo se renderizan los no vacíos; `custom` recoge claves no reconocidas.

import type { TitlePage } from '@/vendor/fountain.mjs'

const META_FIELDS = [
  'credit',
  'author',
  'draftDate',
  'contact',
  'source',
  'revision',
] as const

export function TitlePageView({ titlePage }: { titlePage: TitlePage }) {
  const meta = META_FIELDS.map((k) => titlePage[k]).filter(Boolean)
  const custom = Object.entries(titlePage.custom ?? {}).filter(([, v]) => v)
  const empty = !titlePage.title && meta.length === 0 && custom.length === 0

  if (empty) return null

  return (
    <section aria-label="Portada" className="mb-10 text-center">
      {titlePage.title ? (
        <h2 className="font-mono text-xl font-bold tracking-[0.05em] text-[var(--paper-ink)] uppercase">
          {titlePage.title}
        </h2>
      ) : null}
      {meta.map((v, i) => (
        <p key={i} className="mt-2 font-mono text-base text-[var(--paper-ink)]">
          {v}
        </p>
      ))}
      {custom.map(([k, v]) => (
        <p key={k} className="mt-2 font-mono text-base text-[var(--paper-ink)]">
          {k}: {v}
        </p>
      ))}
    </section>
  )
}
