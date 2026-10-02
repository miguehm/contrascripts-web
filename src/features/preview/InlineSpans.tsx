// src/features/preview/InlineSpans.tsx — render de `**bold**`/`*italic*`.
//
// `inline` solo viene donde el PDF honra el formato; el llamante usa
// `text` como fallback cuando `inline` es `undefined` (ver PLAN §5).

import type { Span } from '@/vendor/fountain.mjs'

export function InlineSpans({ spans }: { spans: Span[] }) {
  return (
    <>
      {spans.map((span, i) => {
        if (span.type === 'bold') {
          return (
            <strong key={i}>
              {span.content ? <InlineSpans spans={span.content} /> : null}
            </strong>
          )
        }
        if (span.type === 'italic') {
          return (
            <em key={i}>
              {span.content ? <InlineSpans spans={span.content} /> : null}
            </em>
          )
        }
        return <span key={i}>{span.text ?? ''}</span>
      })}
    </>
  )
}
