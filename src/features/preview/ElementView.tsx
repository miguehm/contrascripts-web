// src/features/preview/ElementView.tsx — un elemento del guion (§5).
//
// Respeta los hints del parser: `uppercase`, `baseItalic`, `dual`, `level`
// (sections) e `inline` con fallback a `text`. `boneyard` (comentario) no
// se renderiza; `note` ([[...]]) va como callout tenue.

import type { Node } from '@/vendor/fountain.mjs'
import { InlineSpans } from './InlineSpans'

function Body({ node }: { node: Node }) {
  if (node.inline) return <InlineSpans spans={node.inline} />
  return <>{node.text ?? ''}</>
}

const upper = (on: boolean | undefined) => (on ? ' uppercase' : '')
const italic = (on: boolean | undefined) => (on ? ' italic' : '')

export function ElementView({ node, page }: { node: Node; page: number }) {
  switch (node.type) {
    case 'sceneHeading':
      return (
        <p
          className={`mt-6 font-mono text-base font-bold tracking-[0.05em] text-[var(--paper-ink)]${upper(node.uppercase ?? true)}`}
        >
          <Body node={node} />
        </p>
      )
    case 'character':
      return (
        <p
          className={`mt-4 ml-[32%] font-mono text-base text-[var(--paper-ink)]${upper(node.uppercase ?? true)}`}
        >
          <Body node={node} />
          {node.dual ? (
            <span className="ml-2 rounded-sm border border-[var(--syntax)] px-1 font-mono text-[10px] text-[var(--syntax)]">
              dual
            </span>
          ) : null}
        </p>
      )
    case 'dialogue':
      return (
        <p className="mx-[18%] mt-0 font-mono text-base text-[var(--paper-ink)]">
          <Body node={node} />
        </p>
      )
    case 'parenthetical':
      return (
        <p className="mt-0 ml-[26%] font-mono text-base text-[var(--paper-ink)]">
          <Body node={node} />
        </p>
      )
    case 'transition':
      return (
        <p
          className={`mt-4 text-right font-mono text-base text-[var(--paper-ink)]${upper(node.uppercase ?? true)}`}
        >
          <Body node={node} />
        </p>
      )
    case 'centered':
      return (
        <p
          className={`mt-4 text-center font-mono text-base text-[var(--paper-ink)]${upper(node.uppercase)}${italic(node.baseItalic)}`}
        >
          <Body node={node} />
        </p>
      )
    case 'lyric':
      return (
        <p className="mt-0 ml-[12%] font-mono text-base text-[var(--paper-ink)] italic">
          <Body node={node} />
        </p>
      )
    case 'section': {
      const Tag = node.level === 1 ? 'h3' : node.level === 2 ? 'h4' : 'h5'
      return (
        <Tag className="mt-8 font-mono text-base font-bold text-[var(--paper-ink)]">
          <Body node={node} />
        </Tag>
      )
    }
    case 'synopsis':
      return (
        <p className="mt-2 font-mono text-base text-[var(--paper-ink)] opacity-70 italic">
          <Body node={node} />
        </p>
      )
    case 'pageBreak':
      return (
        <div
          aria-hidden="true"
          className="my-8 flex items-center gap-3 text-[var(--paper-ink)] opacity-50"
        >
          <span className="h-px flex-1 bg-current" />
          <span className="font-mono text-xs">-- Page {page + 1} --</span>
          <span className="h-px flex-1 bg-current" />
        </div>
      )
    case 'note':
      return (
        <aside className="mt-2 rounded-sm border-l-2 border-[var(--syntax)] bg-muted/40 px-3 py-1 font-mono text-sm text-muted-foreground">
          <Body node={node} />
        </aside>
      )
    case 'boneyard':
      return null
    case 'action':
    default:
      return (
        <p
          className={`mt-4 font-mono text-base text-[var(--paper-ink)]${upper(node.uppercase)}${italic(node.baseItalic)}`}
        >
          <Body node={node} />
        </p>
      )
  }
}
