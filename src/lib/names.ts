// src/lib/names.ts — nombres aleatorios con sentido para nuevos guiones.
//
// Estilo Facebook anon (`IncredibleCaiman121`): Adjetivo + Animal + Número.
// Español, CamelCase. Sin dependencias: dos listas locales.
// `rng` inyectable para tests deterministas.

const ADJECTIVES = [
  'Veloz',
  'Increíble',
  'Valiente',
  'Curioso',
  'Audaz',
  'Brillante',
  'Sereno',
  'Feroz',
  'Noble',
  'Ágil',
  'Sabio',
  'Osado',
  'Luminoso',
  'Sigiloso',
  'Tenaz',
  'Vibrante',
  'Mágico',
  'Épico',
  'Fugaz',
  'Eterno',
  'Bravo',
  'Leal',
  'Libre',
  'Firme',
  'Genial',
  'Hábil',
  'Íntegro',
  'Jovial',
  'Lúcido',
  'Manso',
  'Nítido',
  'Oportuno',
  'Profundo',
  'Radiante',
  'Sutil',
  'Tierno',
  'Único',
  'Vasto',
  'Vivaz',
  'Zen',
]

const ANIMALS = [
  'Caimán',
  'Zorro',
  'Búho',
  'Pulpo',
  'Lince',
  'Cóndor',
  'Jaguar',
  'Tiburón',
  'Lobo',
  'Águila',
  'Tigre',
  'Puma',
  'Colibrí',
  'Delfín',
  'Halcón',
  'Jirafa',
  'Koala',
  'León',
  'Mono',
  'Oso',
  'Panda',
  'Tortuga',
  'Ciervo',
  'Cuervo',
  'Dragón',
  'Erizo',
  'Flamenco',
  'Gacela',
  'Hipopótamo',
  'Iguana',
  'Jabalí',
  'Canguro',
  'Leopardo',
  'Mapache',
  'Nutria',
  'Pantera',
  'Quetzal',
  'Rinoceronte',
  'Serpiente',
  'Venado',
]

function pick<T>(list: readonly T[], rng: () => number): T {
  const i = Math.floor(rng() * list.length)
  return list[Math.min(i, list.length - 1)] as T
}

/**
 * Genera `AdjetivoAnimal123` (número 1–999, sin padding).
 * Ej: `VelozCaimán482`, `IncreíbleZorro121`.
 */
export function randomScriptName(rng: () => number = Math.random): string {
  const adj = pick(ADJECTIVES, rng)
  const animal = pick(ANIMALS, rng)
  const num = 1 + Math.floor(rng() * 999)
  return `${adj}${animal}${num}`
}

const MAX_ATTEMPTS = 20

/**
 * Variante que evita colisiones contra títulos existentes.
 * Reintenta y, si todo colisiona, añade sufijo `-2`, `-3`, …
 */
export function uniqueScriptName(
  existing: Iterable<string> | undefined,
  rng: () => number = Math.random,
): string {
  const taken = new Set(existing ?? [])
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const candidate = randomScriptName(rng)
    if (!taken.has(candidate)) return candidate
  }
  const base = randomScriptName(rng)
  let n = 2
  while (taken.has(`${base}-${n}`)) n++
  return `${base}-${n}`
}
