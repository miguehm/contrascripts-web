// src/hooks/useParser.test.ts — guardia WebAssembly (Capacitor, minSdk 24).
// @vitest-environment jsdom
import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useParser } from './useParser'

vi.mock('@/fountain', () => ({
  loadFountain: vi.fn(),
}))

import { loadFountain } from '@/fountain'

const loadFountainMock = vi.mocked(loadFountain)

beforeEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('useParser sin WebAssembly', () => {
  it('entra en error con mensaje explícito y no arranca el runtime', () => {
    vi.stubGlobal('WebAssembly', undefined)
    const { result } = renderHook(() => useParser('INT. CASA - DÍA'))
    expect(result.current.status).toBe('error')
    expect(result.current.bootError).toMatch(/WebAssembly/)
    expect(result.current.fountain).toBeNull()
    expect(loadFountainMock).not.toHaveBeenCalled()
  })
})
