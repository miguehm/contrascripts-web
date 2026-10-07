// src/store/keyMigration.ts — migración de claves `guion.*.v1` a
// `contrascripts.*.v1` (renombre de marca, sin pérdida de datos).
//
// Lectura perezosa por módulo: el primer `readMigratedKey` con la clave
// nueva vacía copia el valor legacy a la nueva y borra la vieja. Los
// guardados siempre escriben la clave nueva y borran la vieja
// (best-effort). Nunca lanza: `''` cuenta como ausente, como en el resto
// de `store/`.
//
// TODO migración: retirar las constantes `LEGACY_*` de cada módulo tras
// unas releases (instalaciones que nunca abrieron la app migrada
// perderían prefs viejísimas, pero no guiones: esos viajan por
// exportación `.json`/`.fountain`).

/** Lee la clave nueva y, en su defecto, migra desde la legacy. */
export function readMigratedKey(key: string, legacyKey: string): string | null {
  try {
    const ls = globalThis.localStorage
    const raw = ls?.getItem(key)
    if (raw != null && raw !== '') return raw
    const legacy = ls?.getItem(legacyKey)
    if (legacy == null || legacy === '') return null
    try {
      ls?.setItem(key, legacy)
      ls?.removeItem(legacyKey)
    } catch {
      // Best-effort: si no se puede copiar, se devuelve el valor
      // legacy igual (el próximo guardado lo asentará en la nueva).
    }
    return legacy
  } catch {
    return null
  }
}

/** Borra la clave legacy tras guardar en la nueva (best-effort). */
export function dropLegacyKey(legacyKey: string): void {
  try {
    globalThis.localStorage?.removeItem(legacyKey)
  } catch {
    // Intencionadamente silencioso.
  }
}
