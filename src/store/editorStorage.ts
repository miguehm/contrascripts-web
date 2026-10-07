// src/store/editorStorage.ts — único acceso a localStorage de las
// preferencias del editor (REVIEW.md punto 9).
//
// Los componentes tienen prohibido tocar `localStorage` (AGENTS.md nº2);
// pasan por `useEditorPrefs` (vía `PreferencesProvider`) → este módulo.
// Guarda `fontSize` (px, escalones) y `lineHeight` (multiplicador sobre el
// tamaño de fuente). Un dato corrupto o ausente cae a los defaults sin
// tumbar el boot. Nunca lanza.

import { dropLegacyKey, readMigratedKey } from '@/store/keyMigration'

export const EDITOR_KEY = 'contrascripts.editor.v1'

/** Clave anterior (renombre de marca): se migra en lectura. */
export const LEGACY_EDITOR_KEY = 'guion.editor.v1'

/** Escalones de tamaño de fuente del editor (px). */
export const FONT_SIZE_STEPS = [14, 16, 18, 20]

/** Tamaño de fuente por defecto (equivale al `1rem` previo). */
export const DEFAULT_FONT_SIZE = 16

/** Opciones de interlineado (multiplicador sobre el tamaño de fuente). */
export const LINE_HEIGHT_STEPS = [1.4, 1.625, 1.9]

/** Interlineado por defecto (equivale al `1.625rem` previo). */
export const DEFAULT_LINE_HEIGHT = 1.625

export interface EditorPrefsData {
  fontSize: number
  lineHeight: number
}

const DEFAULTS: EditorPrefsData = {
  fontSize: DEFAULT_FONT_SIZE,
  lineHeight: DEFAULT_LINE_HEIGHT,
}

const FONT_MIN = FONT_SIZE_STEPS[0]
const FONT_MAX = FONT_SIZE_STEPS[FONT_SIZE_STEPS.length - 1]
const LINE_MIN = LINE_HEIGHT_STEPS[0]
const LINE_MAX = LINE_HEIGHT_STEPS[LINE_HEIGHT_STEPS.length - 1]

/** Sujeta el tamaño al rango de escalones. Pura para testear. */
export function clampFontSize(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_FONT_SIZE
  return Math.min(FONT_MAX, Math.max(FONT_MIN, value))
}

/** Sujeta el interlineado a su rango. Pura para testear. */
export function clampLineHeight(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_LINE_HEIGHT
  return Math.min(LINE_MAX, Math.max(LINE_MIN, value))
}

/** Escalón vecino en cualquier lista de pasos. Pura para testear. */
export function stepInList(
  steps: number[],
  current: number,
  dir: 1 | -1,
): number {
  let best = steps[0]
  for (const step of steps) {
    if (Math.abs(step - current) < Math.abs(best - current)) best = step
  }
  const idx = steps.indexOf(best)
  const next = Math.min(steps.length - 1, Math.max(0, idx + dir))
  return steps[next]
}

/** Siguiente tamaño de fuente por escalones. Pura para testear. */
export function stepFontSize(current: number, dir: 1 | -1): number {
  return stepInList(FONT_SIZE_STEPS, current, dir)
}

function isEditorPrefs(value: unknown): value is EditorPrefsData {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  // Estructural laxo: cada campo se valida aparte para no descartar el
  // otro ante un valor corrupto (compat con prefs parciales).
  return 'fontSize' in v || 'lineHeight' in v
}

/** Lee las prefs del editor. Nunca lanza: ante ausencia, JSON roto o forma
 * inesperada devuelve los defaults; cada campo inválido cae a su default
 * sin descartar el otro. */
export function loadEditorPrefs(): EditorPrefsData {
  try {
    const raw = readMigratedKey(EDITOR_KEY, LEGACY_EDITOR_KEY)
    if (raw == null || raw === '') return { ...DEFAULTS }
    const parsed: unknown = JSON.parse(raw)
    if (!isEditorPrefs(parsed)) return { ...DEFAULTS }
    const v = parsed as unknown as Record<string, unknown>
    return {
      fontSize:
        typeof v.fontSize === 'number' && Number.isFinite(v.fontSize)
          ? clampFontSize(v.fontSize)
          : DEFAULT_FONT_SIZE,
      lineHeight:
        typeof v.lineHeight === 'number' && Number.isFinite(v.lineHeight)
          ? clampLineHeight(v.lineHeight)
          : DEFAULT_LINE_HEIGHT,
    }
  } catch {
    return { ...DEFAULTS }
  }
}

/** Persiste las prefs del editor. Nunca lanza (cosmético). */
export function saveEditorPrefs(prefs: EditorPrefsData): void {
  try {
    globalThis.localStorage?.setItem(EDITOR_KEY, JSON.stringify(prefs))
    dropLegacyKey(LEGACY_EDITOR_KEY)
  } catch {
    // Intencionadamente silencioso: es preferencia cosmética.
  }
}
