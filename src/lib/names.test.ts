// src/lib/names.test.ts — generador de nombres con sentido (puro, sin React).

import { describe, expect, it } from 'vitest'
import { randomScriptName, uniqueScriptName } from '@/lib/names'

function seq(values: number[]): () => number {
  let i = 0
  return () => values[Math.min(i++, values.length - 1)] ?? 0
}

describe('randomScriptName', () => {
  it('formato AdjetivoAnimalNúmero (ej. IncreíbleZorro121)', () => {
    const name = randomScriptName(seq([0, 0, 0.12]))
    expect(name).toMatch(
      /^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+[1-9][0-9]{0,2}$/u,
    )
  })

  it('número en rango 1–999 sin ceros a la izquierda', () => {
    expect(randomScriptName(seq([0, 0, 0]))).toMatch(/1$/)
    expect(randomScriptName(seq([0, 0, 0.999]))).toMatch(/999$/)
    for (let i = 0; i < 50; i++) {
      const n = Number(randomScriptName().match(/(\d+)$/)?.[1])
      expect(n).toBeGreaterThanOrEqual(1)
      expect(n).toBeLessThanOrEqual(999)
    }
  })

  it('rng inyectable → determinista', () => {
    const a = randomScriptName(seq([0.1, 0.2, 0.3]))
    const b = randomScriptName(seq([0.1, 0.2, 0.3]))
    expect(a).toBe(b)
  })
})

describe('uniqueScriptName', () => {
  it('evita colisiones regenerando', () => {
    const taken = new Set([randomScriptName(seq([0, 0, 0]))])
    const name = uniqueScriptName(taken, seq([0, 0, 0, 0.5, 0.5, 0.5]))
    expect(taken.has(name)).toBe(false)
  })

  it('con todo colisionado añade sufijo -N', () => {
    // rng constante → mismo base siempre → cae al sufijo
    const base = randomScriptName(seq([0, 0, 0]))
    const taken = new Set([base, `${base}-2`])
    const name = uniqueScriptName(taken, seq([0, 0, 0]))
    expect(name).toBe(`${base}-3`)
  })
})
