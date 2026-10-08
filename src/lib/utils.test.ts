// src/lib/utils.test.ts — paridad `cn` como drop-in de `clsx + tailwind-merge` (§2b).

import { describe, expect, it } from 'vitest'
import { cn } from '@/lib/utils'

describe('cn', () => {
  it('resuelve conflictos tailwind (última clase gana)', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
  })

  it('une condicionales estilo clsx e ignora falsy', () => {
    const off: string | false = false
    expect(cn('a', off && 'b', 'c')).toBe('a c')
    expect(cn('a', { b: true, c: false })).toBe('a b')
  })

  it('no colapsa variantes distintas (hover intacto)', () => {
    expect(cn('text-red-500', 'hover:text-blue-500')).toBe(
      'text-red-500 hover:text-blue-500',
    )
  })
})
