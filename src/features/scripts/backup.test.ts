// src/features/scripts/backup.test.ts — copia `.json` del punto 12.

import { describe, expect, it } from 'vitest'
import type { Script } from '@/types/Script'
import {
  BACKUP_VERSION,
  backupFilename,
  buildBackup,
  dedupeIds,
  isBackupFilename,
  parseBackup,
} from '@/features/scripts/backup'

function script(over: Partial<Script> = {}): Script {
  return { id: 's1', title: 'T', text: 'x', updatedAt: 1000, ...over }
}

describe('buildBackup / backupFilename', () => {
  it('payload versionado con fecha', () => {
    const b = buildBackup([script()], 1_700_000_000_000)
    expect(b.version).toBe(BACKUP_VERSION)
    expect(b.app).toBe('contrascripts')
    expect(b.exportedAt).toBe(1_700_000_000_000)
    expect(b.scripts).toHaveLength(1)
  })

  it('nombre contrascripts-AAAA-MM-DD.json', () => {
    expect(backupFilename(new Date(2026, 9, 6, 12).getTime())).toBe(
      'contrascripts-2026-10-06.json',
    )
  })
})

describe('parseBackup', () => {
  it('round-trip de una copia propia', () => {
    const payload = buildBackup([script(), script({ id: 's2' })])
    const { scripts, dropped } = parseBackup(JSON.stringify(payload))
    expect(dropped).toBe(0)
    expect(scripts.map((s) => s.id).sort()).toEqual(['s1', 's2'])
  })

  it('tolera items ajenos y cuenta descartados', () => {
    const { scripts, dropped } = parseBackup(
      JSON.stringify({
        scripts: [{ title: 'Sin id', text: 'hola' }, null, { id: 'x' }],
      }),
    )
    expect(dropped).toBe(2)
    expect(scripts).toHaveLength(1)
    expect(scripts[0]?.text).toBe('hola')
    expect(scripts[0]?.id).not.toBe('')
  })

  it('JSON roto → vacío sin lanzar', () => {
    expect(parseBackup('{no-json')).toEqual({ scripts: [], dropped: 0 })
    expect(parseBackup(JSON.stringify({ app: 'contrascripts' }))).toEqual({
      scripts: [],
      dropped: 0,
    })
  })
})

describe('dedupeIds', () => {
  it('reasigna choques sin pisar vivos', () => {
    const out = dedupeIds(
      [script({ id: 's1' }), script({ id: 's1' })],
      new Set(['s1']),
    )
    const ids = out.map((s) => s.id)
    expect(new Set(ids).size).toBe(2)
    expect(ids).not.toContain('s1')
  })
})

describe('isBackupFilename', () => {
  it('acepta .json en cualquier caja', () => {
    expect(isBackupFilename('contrascripts-2026-10-08.json')).toBe(true)
    expect(isBackupFilename('COPIA.JSON')).toBe(true)
  })

  it('rechaza el resto', () => {
    expect(isBackupFilename('guion.fountain')).toBe(false)
    expect(isBackupFilename('notas.txt')).toBe(false)
    expect(isBackupFilename('sin-extension')).toBe(false)
  })
})
