// src/features/editor/fountain.ts — lenguaje Fountain para CodeMirror 6
// (REVIEW.md punto 2: números de línea + highlighting).
//
// Heurístico por línea con `StreamLanguage`: el `Document` del parser WASM no
// expone línea/offset (`src/vendor/fountain.d.mts`), así que la paridad exacta
// con el PDF exigiría cambiar el formato Go. v1 clasifica por regex —
// suficiente para orientar al guionista — y `lint()` (que sí da `line`) queda
// como futura decoración de warnings sin tocar Go.
//
// `classifyFountainLine` es pura y unit-testeable; el `StreamParser` mantiene
// el contexto entre líneas (boneyard multi-línea, bloque title-page inicial,
// cadena character → parenthetical → dialogue).

import { StreamLanguage } from '@codemirror/language'
import type { Extension } from '@codemirror/state'
import { Tag, tags } from '@lezer/highlight'

/** Elementos Fountain que el editor distingue por línea. */
export type FountainToken =
  | 'sceneHeading'
  | 'action'
  | 'character'
  | 'dialogue'
  | 'parenthetical'
  | 'transition'
  | 'centered'
  | 'lyric'
  | 'section'
  | 'synopsis'
  | 'pageBreak'
  | 'note'
  | 'boneyard'
  | 'titlePage'

/** Contexto de las líneas previas necesario para clasificar la actual. */
export interface FountainLineContext {
  /** Dentro de un bloque `/* ... *\/` abierto en una línea anterior. */
  inBoneyard: boolean
  /** Aún en el bloque `Clave: Valor` inicial (antes de la primera vacía). */
  inTitlePage: boolean
  /** La línea previa era vacía (o es inicio de documento). */
  prevBlank: boolean
  /** Elemento de la línea previa no vacía (para la cadena de diálogo). */
  prevElement: 'character' | 'parenthetical' | 'dialogue' | 'other'
}

const SCENE_RE = /^(INT|EXT|EST|INT\.?\/EXT\.?|I\/E)[. ]/i
const SECTION_RE = /^#{1,6}\s+\S/
const SYNOPSIS_RE = /^=\s+\S/
const PAGE_BREAK_RE = /^={3,}\s*$/
const LYRIC_RE = /^~.+/
const PAREN_RE = /^\(.*\)$/
const NOTE_LINE_RE = /^\[\[.*\]\]$/
const TITLE_RE = /^([A-Za-z][A-Za-z0-9 _\-/]*):\s*\S/
const KNOWN_TRANSITIONS_RE =
  /^(FADE IN|FADE OUT|DISSOLVE TO|SMASH CUT|MATCH CUT):?$/
const TRANSITION_SUFFIX_RE = / TO:$/

/** Límite heurístico: un cue de personaje real no grita un párrafo entero. */
const MAX_CHARACTER_LENGTH = 60

function hasLetter(s: string): boolean {
  return /[A-ZÁÉÍÓÚÑÜ]/i.test(s)
}

function looksLikeCharacter(line: string): boolean {
  const t = line.trim()
  if (t.length === 0 || t.length > MAX_CHARACTER_LENGTH) return false
  if (TRANSITION_SUFFIX_RE.test(t)) return false
  // Un cue nunca lleva dos puntos (`Clave: valor` es title page y `CORTE A:`
  // transición); sin esto `DRAFT DATE: 2026` colaría como personaje.
  if (t.includes(':')) return false
  if (/[:;]$/.test(t)) return false
  if (!hasLetter(t)) return false
  if (t !== t.toUpperCase()) return false
  if (/^[.!@#~=>/*]/.test(t)) return false
  return true
}

function looksLikeTransition(t: string): boolean {
  if (KNOWN_TRANSITIONS_RE.test(t)) return true
  if (TRANSITION_SUFFIX_RE.test(t) && t === t.toUpperCase() && hasLetter(t)) {
    return true
  }
  // Convención ES/industria: `CORTE A:`, `FUNDIDO A NEGRO:` — mayúsculas
  // terminadas en dos puntos (los cues nunca los llevan, ver arriba).
  return /[A-ZÁÉÍÓÚÑÜ]:$/.test(t) && t === t.toUpperCase() && hasLetter(t)
}

/**
 * Clasifica una línea. El orden importa: los marcadores forzados y de bloque
 * (`#`, `=`, `===`, `~`, `>`, `.`, `!`, `@`, `[[`, `/*`) ganan a las
 * detecciones por forma (escena, transición, personaje).
 */
export function classifyFountainLine(
  line: string,
  ctx: FountainLineContext,
): FountainToken {
  const t = line.trim()
  if (t === '') return 'action'

  // Boneyard: línea dentro del bloque, o que abre uno (aunque sea a mitad).
  if (ctx.inBoneyard || t.includes('/*')) return 'boneyard'

  // Title page: solo `Clave: Valor` al inicio, clave no toda en mayúsculas
  // (eso sería transición/personaje, p.ej. `CUT TO:`).
  if (ctx.inTitlePage) {
    const m = TITLE_RE.exec(t)
    if (m && m[1] !== m[1].toUpperCase()) return 'titlePage'
  }

  if (NOTE_LINE_RE.test(t)) return 'note'
  if (PAGE_BREAK_RE.test(t)) return 'pageBreak'
  if (SECTION_RE.test(t)) return 'section'
  if (SYNOPSIS_RE.test(t)) return 'synopsis'
  if (LYRIC_RE.test(t)) return 'lyric'

  // Forzados de una letra.
  if (t.startsWith('.') && t.length > 1) return 'sceneHeading'
  if (t.startsWith('!')) return 'action'
  if (t.startsWith('@') && t.length > 1) return 'character'
  if (t.startsWith('>')) {
    return t.endsWith('<') && t.length > 2 ? 'centered' : 'transition'
  }

  if (SCENE_RE.test(t)) return 'sceneHeading'
  if (looksLikeTransition(t)) return 'transition'
  if (ctx.prevBlank && looksLikeCharacter(t)) return 'character'

  const inDialogue =
    ctx.prevElement === 'character' ||
    ctx.prevElement === 'parenthetical' ||
    ctx.prevElement === 'dialogue'
  if (PAREN_RE.test(t)) return inDialogue ? 'parenthetical' : 'action'
  if (inDialogue) return 'dialogue'

  return 'action'
}

/** Tags propios: evitan pelear con el `defaultHighlightStyle` de CM. */
export const fountainTags = {
  sceneHeading: Tag.define(tags.heading),
  character: Tag.define(tags.variableName),
  dialogue: Tag.define(tags.string),
  parenthetical: Tag.define(tags.paren),
  transition: Tag.define(tags.labelName),
  centered: Tag.define(tags.emphasis),
  lyric: Tag.define(tags.quote),
  section: Tag.define(tags.heading),
  synopsis: Tag.define(tags.comment),
  pageBreak: Tag.define(tags.separator),
  note: Tag.define(tags.comment),
  boneyard: Tag.define(tags.comment),
  titlePage: Tag.define(tags.meta),
} as const

interface FountainStreamState extends FountainLineContext {
  /** Token base de la línea en curso (para los tramos de texto plano). */
  lineToken: FountainToken
}

function nextPrevElement(
  token: FountainToken,
): FountainStreamState['prevElement'] {
  if (token === 'character') return 'character'
  if (token === 'parenthetical') return 'parenthetical'
  if (token === 'dialogue') return 'dialogue'
  return 'other'
}

/** Inline `**bold**`, `*italic*`, `_underline_` y `[[nota]]` a mitad de línea. */
const INLINE_PATTERNS: Array<{ regex: RegExp; token: string }> = [
  { regex: /^\[\[.*?\]\]/, token: 'note' },
  { regex: /^\*\*\*.+?\*\*\*/, token: 'strong emphasis' },
  { regex: /^\*\*.+?\*\*/, token: 'strong' },
  { regex: /^\*[^*\n]+?\*/, token: 'emphasis' },
  { regex: /^_[^_\n]+?_/, token: 'monospace' },
]

/** Próximo carácter que puede abrir inline o boneyard. */
const MARKER_RE = /[*_[/]/

export function fountain(): Extension {
  return StreamLanguage.define<FountainStreamState>({
    name: 'fountain',
    startState: () => ({
      inBoneyard: false,
      inTitlePage: true,
      prevBlank: true,
      prevElement: 'other',
      lineToken: 'action',
    }),
    copyState: (s) => ({ ...s }),
    blankLine: (state) => {
      state.prevBlank = true
      state.inTitlePage = false
      // Las vacías no rompen la cadena de diálogo: el guionista las usa
      // como aire entre cue y texto (el PDF las colapsa igual).
    },
    token: (stream, state) => {
      // 1. Continuación de boneyard abierto en otra línea.
      if (state.inBoneyard) {
        const end = stream.string.indexOf('*/', stream.pos)
        if (end === -1) {
          stream.skipToEnd()
          return 'boneyard'
        }
        stream.pos = end + 2
        state.inBoneyard = false
        return 'boneyard'
      }

      // 2. Una vez por línea: clasificar y avanzar el contexto.
      if (stream.sol()) {
        const line = stream.string
        if (/^\s*$/.test(line)) {
          stream.skipToEnd()
          return null
        }
        const token = classifyFountainLine(line, state)
        state.lineToken = token
        state.prevBlank = false
        if (token !== 'titlePage') state.inTitlePage = false
        state.prevElement = nextPrevElement(token)
      }

      // 3. Apertura de boneyard en la posición actual.
      if (stream.match('/*', false)) {
        const end = stream.string.indexOf('*/', stream.pos + 2)
        if (end === -1) {
          stream.skipToEnd()
          state.inBoneyard = true
          return 'boneyard'
        }
        stream.pos = end + 2
        return 'boneyard'
      }

      // 4. Inline en la posición actual.
      for (const { regex, token } of INLINE_PATTERNS) {
        if (stream.match(regex)) return token
      }

      // 5. Texto plano hasta el próximo marcador o fin de línea.
      const rest = stream.string.slice(stream.pos)
      const idx = rest.search(MARKER_RE)
      if (idx === -1) {
        stream.skipToEnd()
      } else if (idx === 0) {
        // Marcador suelto sin cierre (`*`, `_`, `/`): consumir para no
        // atascar el stream con un token de longitud cero.
        stream.next()
      } else {
        stream.pos += idx
      }
      return state.lineToken === 'action' ? null : state.lineToken
    },
    tokenTable: {
      sceneHeading: fountainTags.sceneHeading,
      character: fountainTags.character,
      dialogue: fountainTags.dialogue,
      parenthetical: fountainTags.parenthetical,
      transition: fountainTags.transition,
      centered: fountainTags.centered,
      lyric: fountainTags.lyric,
      section: fountainTags.section,
      synopsis: fountainTags.synopsis,
      pageBreak: fountainTags.pageBreak,
      note: fountainTags.note,
      boneyard: fountainTags.boneyard,
      titlePage: fountainTags.titlePage,
    },
    languageData: {
      commentTokens: { block: { open: '/*', close: '*/' } },
    },
  })
}
