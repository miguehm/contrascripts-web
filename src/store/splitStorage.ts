// src/store/splitStorage.ts — único acceso al layout del split (AGENTS.md nº2).
//
// Guarda el ancho relativo editor/preview del dual-pane de desktop
// (REVIEW.md 6): al entrar en la vista en grande el `ResizablePanelGroup`
// se desmonta, y sin esto al volver remontaba a 50/50 perdiendo el divisor
// del usuario (y con otro ancho cambia el wrapping → la posición del
import { dropLegacyKey, readMigratedKey } from '@/store/keyMigration'

// editor ya no cuadra). Clave `contrascripts.split.v1`, porcentajes 0..100 por id
// de panel (`editor`/`preview`, los que `SplitWorkspace` declara).
// Un dato corrupto o ausente devuelve `undefined` (50/50 por defecto).
// Nunca lanza.

export const SPLIT_KEY = 'contrascripts.split.v1'

/** Clave anterior (renombre de marca): se migra en lectura. */
export const LEGACY_SPLIT_KEY = 'guion.split.v1'

export const SPLIT_PANEL_IDS = ['editor', 'preview'] as const

export type SplitPanelId = (typeof SPLIT_PANEL_IDS)[number]

/** Layout como lo entrega `onLayoutChanged`: id de panel → porcentaje. */
export type SplitLayout = Record<SplitPanelId, number>

function isValidShare(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value > 0 &&
    value < 100
  )
}

/** Valida `{editor, preview}` con suma ≈ 100 (redondeos de la librería). */
export function isSplitLayout(value: unknown): value is SplitLayout {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  if (!isValidShare(v.editor) || !isValidShare(v.preview)) return false
  const sum = (v.editor as number) + (v.preview as number)
  return sum > 99 && sum < 101
}

/**
 * Extrae `{editor, preview}` del layout de la librería (`{[id]: %}`),
 * ignorando claves extra. `undefined` si no hay par válido.
 */
export function splitLayoutFromGroup(
  layout: Record<string, number>,
): SplitLayout | undefined {
  if (typeof layout !== 'object' || layout === null) return undefined
  const candidate = { editor: layout.editor, preview: layout.preview }
  return isSplitLayout(candidate) ? candidate : undefined
}

/** Lee el layout guardado. `undefined` = sin dato (50/50 por defecto). */
export function loadSplitLayout(): SplitLayout | undefined {
  try {
    const raw = readMigratedKey(SPLIT_KEY, LEGACY_SPLIT_KEY)
    if (raw == null || raw === '') return undefined
    const parsed: unknown = JSON.parse(raw)
    return isSplitLayout(parsed) ? parsed : undefined
  } catch {
    return undefined
  }
}

/** Persiste el layout. Ignora valores inválidos; nunca lanza. */
export function saveSplitLayout(layout: SplitLayout): void {
  try {
    if (!isSplitLayout(layout)) return
    globalThis.localStorage?.setItem(SPLIT_KEY, JSON.stringify(layout))
    dropLegacyKey(LEGACY_SPLIT_KEY)
  } catch {
    // Intencionadamente silencioso: es preferencia cosmética.
  }
}
