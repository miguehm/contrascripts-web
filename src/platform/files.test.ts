// @vitest-environment jsdom
// src/platform/files.test.ts — capa de archivos web/Tauri/Capacitor.
//
// - `isTauri()` alterna según `window.__TAURI_INTERNALS__`;
//   `isCapacitorNative()` según `window.Capacitor.isNativePlatform()`.
// - Web: `saveFile` descarga Blob (mismo UX que antes), `saveTextFile`
//   codifica UTF-8, `pickTextFile` resuelve/cancela vía input programático.
// - Tauri (plugins mockeados): guardar/abrir delegan en dialog+fs y el
//   cancel (`null`) resuelve en silencio sin tocar el FS.
// - Capacitor (plugins mockeados): guardar escribe base64/UTF-8 en
//   Documents y abre la hoja `Share`; importar reutiliza el input web.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getPlatformFiles, isCapacitorNative, isTauri } from './files'

vi.mock('@tauri-apps/plugin-dialog', () => ({
  save: vi.fn(),
  open: vi.fn(),
}))

vi.mock('@tauri-apps/plugin-fs', () => ({
  writeFile: vi.fn(),
  writeTextFile: vi.fn(),
  readTextFile: vi.fn(),
}))

vi.mock('@capacitor/filesystem', () => ({
  Filesystem: { writeFile: vi.fn() },
  Directory: { Documents: 'DOCUMENTS' },
  Encoding: { UTF8: 'utf8' },
}))

vi.mock('@capacitor/share', () => ({
  Share: { share: vi.fn() },
}))

import { open, save } from '@tauri-apps/plugin-dialog'
import { readTextFile, writeFile, writeTextFile } from '@tauri-apps/plugin-fs'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

const saveMock = vi.mocked(save)
const openMock = vi.mocked(open)
const writeFileMock = vi.mocked(writeFile)
const writeTextFileMock = vi.mocked(writeTextFile)
const readTextFileMock = vi.mocked(readTextFile)
const fsWriteMock = vi.mocked(Filesystem.writeFile)
const shareMock = vi.mocked(Share.share)

function setTauri(on: boolean) {
  const w = window as unknown as Record<string, unknown>
  if (on) w.__TAURI_INTERNALS__ = {}
  else delete w.__TAURI_INTERNALS__
}

function setCapacitorNative(on: boolean) {
  const w = window as unknown as Record<string, unknown>
  if (on) w.Capacitor = { isNativePlatform: () => true }
  else delete w.Capacitor
}

beforeEach(() => {
  setTauri(false)
  setCapacitorNative(false)
  vi.clearAllMocks()
})

afterEach(() => {
  setTauri(false)
  setCapacitorNative(false)
  vi.restoreAllMocks()
})

describe('isTauri', () => {
  it('false en web', () => {
    expect(isTauri()).toBe(false)
  })

  it('true con __TAURI_INTERNALS__', () => {
    setTauri(true)
    expect(isTauri()).toBe(true)
  })
})

describe('web', () => {
  /** Captura el Blob descargado y el nombre del anchor. */
  function captureDownload() {
    const seen: { blob: Blob; download: string }[] = []
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      seen.push({ blob: blob as Blob, download: '' })
      return `blob:${seen.length}`
    })
    const revokeObjectURL = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => {})
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      const last = seen[seen.length - 1]
      if (last) last.download = this.download
    })
    return { seen, revokeObjectURL }
  }

  it('saveFile descarga un Blob con el nombre, mime y bytes', async () => {
    const { seen, revokeObjectURL } = captureDownload()
    await getPlatformFiles().saveFile(
      new Uint8Array([37, 80, 68, 70]),
      'guion.pdf',
      'application/pdf',
    )
    expect(seen).toHaveLength(1)
    expect(seen[0]?.download).toBe('guion.pdf')
    expect(seen[0]?.blob.type).toBe('application/pdf')
    expect(new Uint8Array(await seen[0]!.blob.arrayBuffer())).toEqual(
      new Uint8Array([37, 80, 68, 70]),
    )
    expect(revokeObjectURL).toHaveBeenCalledTimes(1)
    expect(saveMock).not.toHaveBeenCalled()
    expect(writeFileMock).not.toHaveBeenCalled()
  })

  it('saveTextFile codifica el texto en UTF-8', async () => {
    const { seen } = captureDownload()
    await getPlatformFiles().saveTextFile(
      'Canción ñ',
      'g.fountain',
      'text/plain;charset=utf-8',
    )
    expect(seen).toHaveLength(1)
    expect(seen[0]?.download).toBe('g.fountain')
    expect(seen[0]?.blob.type).toBe('text/plain;charset=utf-8')
    expect(await seen[0]?.blob.text()).toBe('Canción ñ')
  })

  it('pickTextFile resuelve con nombre+texto al elegir', async () => {
    const createElement = vi.spyOn(document, 'createElement')
    const files = getPlatformFiles()
    const pending = files.pickTextFile({
      filters: [{ name: 'Fountain', extensions: ['fountain', 'txt'] }],
    })
    const input = createElement.mock.results
      .map((r) => r.value as Element)
      .find(
        (el): el is HTMLInputElement =>
          el instanceof HTMLInputElement && el.type === 'file',
      )
    expect(input).not.toBeUndefined()
    expect(input?.accept).toBe('.fountain,.txt')
    const file = new File(['INT. CASA - DÍA'], 'guion.fountain', {
      type: 'text/plain',
    })
    Object.defineProperty(input, 'files', { value: [file] })
    input?.dispatchEvent(new Event('change'))
    await expect(pending).resolves.toEqual({
      name: 'guion.fountain',
      text: 'INT. CASA - DÍA',
    })
  })

  it('pickTextFile resuelve null al cancelar', async () => {
    const createElement = vi.spyOn(document, 'createElement')
    const files = getPlatformFiles()
    const pending = files.pickTextFile()
    const input = createElement.mock.results
      .map((r) => r.value as Element)
      .find(
        (el): el is HTMLInputElement =>
          el instanceof HTMLInputElement && el.type === 'file',
      )
    input?.dispatchEvent(new Event('cancel'))
    await expect(pending).resolves.toBeNull()
  })
})

describe('tauri', () => {
  beforeEach(() => {
    setTauri(true)
  })

  it('saveFile usa diálogo nativo + writeFile', async () => {
    saveMock.mockResolvedValue('/home/u/Docs/guion.pdf')
    writeFileMock.mockResolvedValue(undefined)
    const bytes = new Uint8Array([37, 80, 68, 70])
    await getPlatformFiles().saveFile(bytes, 'guion.pdf', 'application/pdf')
    expect(saveMock).toHaveBeenCalledWith({
      defaultPath: 'guion.pdf',
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    })
    expect(writeFileMock).toHaveBeenCalledWith('/home/u/Docs/guion.pdf', bytes)
  })

  it('saveFile cancelado no escribe', async () => {
    saveMock.mockResolvedValue(null)
    await getPlatformFiles().saveFile(
      new Uint8Array([1]),
      'g.pdf',
      'application/pdf',
    )
    expect(writeFileMock).not.toHaveBeenCalled()
  })

  it('saveTextFile usa writeTextFile con el texto intacto', async () => {
    saveMock.mockResolvedValue('/home/u/g.fountain')
    writeTextFileMock.mockResolvedValue(undefined)
    await getPlatformFiles().saveTextFile('Título\n\nAcción.', 'g.fountain')
    expect(saveMock).toHaveBeenCalledWith({
      defaultPath: 'g.fountain',
      filters: [{ name: 'Fountain', extensions: ['fountain', 'txt'] }],
    })
    expect(writeTextFileMock).toHaveBeenCalledWith(
      '/home/u/g.fountain',
      'Título\n\nAcción.',
    )
  })

  it('pickTextFile abre diálogo y lee el texto', async () => {
    openMock.mockResolvedValue('C:\\Docs\\mi guion.fountain')
    readTextFileMock.mockResolvedValue('FADE IN.')
    await expect(
      getPlatformFiles().pickTextFile({
        title: 'Importar guion',
        filters: [{ name: 'Fountain', extensions: ['fountain', 'txt'] }],
      }),
    ).resolves.toEqual({ name: 'mi guion.fountain', text: 'FADE IN.' })
    expect(openMock).toHaveBeenCalledWith({
      multiple: false,
      title: 'Importar guion',
      filters: [{ name: 'Fountain', extensions: ['fountain', 'txt'] }],
    })
    expect(readTextFileMock).toHaveBeenCalledWith('C:\\Docs\\mi guion.fountain')
  })

  it('pickTextFile cancelado resuelve null sin leer', async () => {
    openMock.mockResolvedValue(null)
    await expect(getPlatformFiles().pickTextFile()).resolves.toBeNull()
    expect(readTextFileMock).not.toHaveBeenCalled()
  })
})

describe('isCapacitorNative', () => {
  it('false en web', () => {
    expect(isCapacitorNative()).toBe(false)
  })

  it('true con window.Capacitor nativo', () => {
    setCapacitorNative(true)
    expect(isCapacitorNative()).toBe(true)
  })

  it('Tauri gana si ambos flags están activos', () => {
    setTauri(true)
    setCapacitorNative(true)
    expect(isTauri()).toBe(true)
    expect(isCapacitorNative()).toBe(true)
    // La resolución elige Tauri: no debe tocar Filesystem.
    void getPlatformFiles()
    expect(fsWriteMock).not.toHaveBeenCalled()
  })
})

describe('capacitor', () => {
  beforeEach(() => {
    setCapacitorNative(true)
    fsWriteMock.mockResolvedValue({ uri: 'file:///docs/guion.pdf' })
    shareMock.mockResolvedValue({ activityType: undefined })
  })

  it('saveFile escribe base64 en Documents y comparte la uri', async () => {
    const bytes = new Uint8Array([37, 80, 68, 70]) // %PDF
    await getPlatformFiles().saveFile(bytes, 'guion.pdf', 'application/pdf')
    expect(fsWriteMock).toHaveBeenCalledWith({
      path: 'guion.pdf',
      data: 'JVBERg==',
      directory: Directory.Documents,
    })
    expect(shareMock).toHaveBeenCalledWith({
      title: 'guion.pdf',
      url: 'file:///docs/guion.pdf',
      dialogTitle: 'Compartir guion.pdf',
    })
    expect(saveMock).not.toHaveBeenCalled()
    expect(writeFileMock).not.toHaveBeenCalled()
  })

  it('saveTextFile escribe UTF-8 intacto y lo comparte', async () => {
    fsWriteMock.mockResolvedValue({ uri: 'file:///docs/g.fountain' })
    await getPlatformFiles().saveTextFile('Título\n\nAcción.', 'g.fountain')
    expect(fsWriteMock).toHaveBeenCalledWith({
      path: 'g.fountain',
      data: 'Título\n\nAcción.',
      directory: Directory.Documents,
      encoding: 'utf8',
    })
    expect(shareMock).toHaveBeenCalledWith({
      title: 'g.fountain',
      url: 'file:///docs/g.fountain',
      dialogTitle: 'Compartir g.fountain',
    })
  })

  it('pickTextFile reutiliza el input web en el WebView', async () => {
    const createElement = vi.spyOn(document, 'createElement')
    const pending = getPlatformFiles().pickTextFile({
      filters: [{ name: 'Fountain', extensions: ['fountain', 'txt'] }],
    })
    const input = createElement.mock.results
      .map((r) => r.value as Element)
      .find(
        (el): el is HTMLInputElement =>
          el instanceof HTMLInputElement && el.type === 'file',
      )
    expect(input).not.toBeUndefined()
    const file = new File(['INT. CASA - DÍA'], 'guion.fountain', {
      type: 'text/plain',
    })
    Object.defineProperty(input, 'files', { value: [file] })
    input?.dispatchEvent(new Event('change'))
    await expect(pending).resolves.toEqual({
      name: 'guion.fountain',
      text: 'INT. CASA - DÍA',
    })
    expect(openMock).not.toHaveBeenCalled()
  })

  it('pickTextFile ignora los filtros: sin accept todo es seleccionable', async () => {
    const createElement = vi.spyOn(document, 'createElement')
    const pending = getPlatformFiles().pickTextFile({
      title: 'Importar guion',
      filters: [{ name: 'Fountain', extensions: ['fountain', 'txt'] }],
    })
    const input = createElement.mock.results
      .map((r) => r.value as Element)
      .find(
        (el): el is HTMLInputElement =>
          el instanceof HTMLInputElement && el.type === 'file',
      )
    // Android no conoce `.fountain` en su MimeTypeMap: un `accept`
    // estricto lo dejaría no seleccionable, así que no se filtra y la
    // puerta es `isImportableName` en quien llama.
    expect(input?.accept).toBe('')
    input?.dispatchEvent(new Event('cancel'))
    await expect(pending).resolves.toBeNull()
  })
})
