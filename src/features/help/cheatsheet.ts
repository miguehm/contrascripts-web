// src/features/help/cheatsheet.ts — contenido del cheatsheet Fountain
// (REVIEW.md punto 11).
//
// Datos puros y testeables: por cada elemento, cómo se escribe en texto
// plano y qué representa en el formato de cine original (el PDF). La fuente
// es la tabla "Supported Fountain Syntax" del README del parser
// (`~/Work/tries/2026-08-31-fountain-parser/README.md`) más sus notas de
// fidelidad (elementos que el PDF omite o dibuja distinto).
//
// Cada `sample` es un snippet en contexto (varias líneas) que `SampleSheet`
// maqueta con las columnas reales del PDF: Courier 12pt, bloque de texto de
// 60 caracteres, personaje a 22ch, diálogo a 10ch (ancho 35ch), paréntesis a
// 16ch (ancho 19ch), transición a la derecha, centrado. Solo los elementos
// con `rendersInPdf` llevan muestra: la previsualización se limita a lo que
// el PDF sí renderiza.

export interface SampleLine {
  /** Texto literal tal como se escribe (sin renderizar inline). */
  text: string
  /** Columna inicial en caracteres (ch) desde el margen izquierdo. */
  indent?: number
  /** Ancho máximo en caracteres (diálogo, paréntesis). */
  width?: number
  /** Alineación dentro del bloque de 60 caracteres. */
  align?: 'left' | 'right' | 'center'
  /** Negrita (formato inline renderizado). */
  bold?: boolean
  /** Cursiva (letra, formato inline renderizado). */
  italic?: boolean
  /** Renglón de aire entre bloques. */
  blank?: boolean
}

export interface CheatsheetEntry {
  id: string
  /** Nombre humano del elemento. */
  element: string
  /** Cómo se escribe en texto plano. */
  syntax: string
  /**
   * Si el PDF lo imprime. Sección, sinopsis, nota y comentario solo viven
   * en el manuscrito: no llevan muestra (`SampleSheet` solo maqueta lo
   * que sí se renderiza).
   */
  rendersInPdf: boolean
  /** Snippet en contexto, tal como lo maqueta `SampleSheet`. */
  sample?: SampleLine[]
  /** Qué representa en el formato de cine original (PDF). */
  screenplay: string
  /** Advertencia de fidelidad (omisiones del PDF, etc.). Opcional. */
  note?: string
}

/** Renglones de aire (uno y dos, según separación real del formato). */
const BLANK: SampleLine = { text: '', blank: true }

export const CHEATSHEET: CheatsheetEntry[] = [
  {
    id: 'sceneHeading',
    element: 'Encabezado de escena',
    syntax: 'INT. / EXT. / EST. — o prefijo `.`',
    rendersInPdf: true,
    sample: [
      { text: 'INT. LABORATORIO - NOCHE' },
      BLANK,
      { text: 'El zumbido de las máquinas no para.' },
    ],
    screenplay:
      'Lugar y momento de la escena; en mayúsculas a todo el ancho, separando escenas.',
  },
  {
    id: 'action',
    element: 'Acción',
    syntax: 'Texto plano (fallback)',
    rendersInPdf: true,
    sample: [
      { text: 'Mara cruza el pasillo a oscuras.' },
      { text: 'Cuenta las puertas: faltan dos.' },
    ],
    screenplay:
      'Descripción de lo que se ve y ocurre; párrafo a todo el ancho entre bloques de escena.',
  },
  {
    id: 'character',
    element: 'Personaje',
    syntax: 'MAYÚSCULAS tras línea en blanco — o `@` forzado',
    rendersInPdf: true,
    sample: [{ text: 'MARA', indent: 22 }],
    screenplay:
      'Nombre de quien habla; en mayúsculas y centrado sobre su diálogo.',
  },
  {
    id: 'dialogue',
    element: 'Diálogo',
    syntax: 'Línea(s) tras personaje o paréntesis',
    rendersInPdf: true,
    sample: [
      { text: 'MARA', indent: 22 },
      { text: 'No puede ser…', indent: 10, width: 35 },
    ],
    screenplay:
      'Lo que dice el personaje; bloque estrecho centrado bajo su nombre.',
  },
  {
    id: 'parenthetical',
    element: 'Paréntesis',
    syntax: '(...) tras el personaje',
    rendersInPdf: true,
    sample: [
      { text: 'MARA', indent: 22 },
      { text: '(sin apartar la vista)', indent: 16, width: 19 },
      { text: 'No puede ser…', indent: 10, width: 35 },
    ],
    screenplay:
      'Indicación breve de actuación; entre paréntesis dentro del bloque de diálogo.',
  },
  {
    id: 'transition',
    element: 'Transición',
    syntax: 'Termina en `TO:` o prefijo `>`',
    rendersInPdf: true,
    sample: [{ text: 'CORTE A:', align: 'right' }],
    screenplay:
      'Corte entre escenas; alineada a la derecha al pie de la escena que cierra.',
    note: '`> THE END <` es texto centrado, no transición.',
  },
  {
    id: 'centered',
    element: 'Centrado',
    syntax: '`>texto<`',
    rendersInPdf: true,
    sample: [{ text: '>EL ÚLTIMO TREN<', align: 'center' }],
    screenplay:
      'Rótulo o título en pantalla; centrado en la página (p. ej. time cards).',
  },
  {
    id: 'lyric',
    element: 'Letra',
    syntax: 'Prefijo `~`',
    rendersInPdf: true,
    sample: [{ text: '~Y el tren se llevó mi voz', italic: true }],
    screenplay: 'Letra cantada; normalmente en cursiva.',
  },
  {
    id: 'section',
    element: 'Sección',
    syntax: '`#`, `##`, `###`…',
    rendersInPdf: false,
    screenplay: 'Organización interna del guion (actos, partes).',
    note: 'No se imprime en el PDF.',
  },
  {
    id: 'synopsis',
    element: 'Sinopsis',
    syntax: 'Prefijo `= ` (con espacio)',
    rendersInPdf: false,
    screenplay: 'Resumen de la escena, para uso del autor.',
    note: 'No se imprime en el PDF.',
  },
  {
    id: 'note',
    element: 'Nota',
    syntax: '`[[…]]` (puede abarcar líneas)',
    rendersInPdf: false,
    screenplay: 'Comentario para colaboradores.',
    note: 'Invisible en el PDF.',
  },
  {
    id: 'boneyard',
    element: 'Comentario',
    syntax: '`/* … */` (puede abarcar líneas)',
    rendersInPdf: false,
    screenplay: 'Bloque comentado: texto descartado que se conserva.',
    note: 'Invisible en el PDF.',
  },
  {
    id: 'pageBreak',
    element: 'Salto de página',
    syntax: '`===` (línea de 3 o más `=`)',
    rendersInPdf: true,
    sample: [
      { text: 'El tren se aleja.' },
      BLANK,
      { text: '===' },
      BLANK,
      { text: 'INT. ANDÉN - AMANECER' },
    ],
    screenplay: 'Fuerza el fin de página en el PDF.',
  },
  {
    id: 'actionForced',
    element: 'Acción forzada',
    syntax: 'Prefijo `!`',
    rendersInPdf: true,
    sample: [{ text: '!TODO EL PISO ESTÁ VACÍO' }],
    screenplay:
      'Fuerza que la línea sea acción aunque por su forma parezca otro elemento.',
  },
  {
    id: 'dual',
    element: 'Diálogo dual',
    syntax: 'Caret `^` al final del segundo personaje',
    rendersInPdf: true,
    sample: [
      { text: 'MARA ^', indent: 22 },
      { text: 'No puede ser…', indent: 10, width: 35 },
    ],
    screenplay: 'Dos personajes hablan a la vez; dos columnas lado a lado.',
    note: 'El motor lo reconoce, pero el PDF aún no dibuja las dos columnas.',
  },
]

export interface TitlePageKey {
  key: string
  use: string
}

/** Portada clásica: pares `Clave: Valor` al inicio del documento. */
export const TITLE_PAGE_KEYS: TitlePageKey[] = [
  { key: 'Title:', use: 'Título del guion' },
  { key: 'Credit:', use: 'Crédito (p. ej. "Written by")' },
  { key: 'Author:', use: 'Autor' },
  { key: 'Draft date:', use: 'Fecha del borrador' },
  { key: 'Contact:', use: 'Datos de contacto' },
]

/** Muestra de portada: título y autor centrados, como en el PDF. */
export const TITLE_PAGE_SAMPLE: SampleLine[] = [
  { text: 'Title: EL ÚLTIMO TREN', align: 'center' },
  { text: 'Author: Ana Ruiz', align: 'center' },
  { text: 'Draft date: 12/03/2026', align: 'center' },
]

export interface InlineFormatting {
  markup: string
  use: string
}

/** Formato dentro de la línea (acción, diálogo y título de portada). */
export const INLINE_FORMATTING: InlineFormatting[] = [
  { markup: '**texto**', use: 'Negrita' },
  { markup: '*texto*', use: 'Cursiva' },
  { markup: '_texto_', use: 'Cursiva' },
  { markup: '***texto***', use: 'Negrita + cursiva' },
]

/**
 * El inline sí se renderiza: la muestra enseña el resultado, no el marcado,
 * en el mismo orden 1:1 que `INLINE_FORMATTING` (`*` y `_` dan la misma
 * cursiva).
 */
export const INLINE_RENDER_SAMPLE: SampleLine[] = [
  { text: 'Negrita', bold: true },
  { text: 'Cursiva', italic: true },
  { text: 'Cursiva', italic: true },
  { text: 'Negrita y cursiva', bold: true, italic: true },
]
