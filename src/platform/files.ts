// src/platform/files.ts — abstracción de archivos web/Tauri/Capacitor.
//
// La UI (ExportButton, ImportButton, BackupSection, sidebar) solo habla con
// `PlatformFiles`: en web se conserva el comportamiento actual (Blob +
// `a[download]`, `<input type=file>` programático), en Tauri se usan los
// diálogos nativos (`plugin-dialog`) + `plugin-fs`, y en Capacitor
// (`Filesystem` + `Share`: guardar en Documents + hoja nativa de compartir).
// Los plugins Tauri y Capacitor se importan con `import()` dinámico dentro
// de cada función: nunca hay un `import` estático de `@tauri-apps/*` ni de
// `@capacitor/*`, así que el bundle web (Pages) no los incluye ni se rompe
// si no existen.
//
// La interfaz no mezcla ruta con contenido (en web no hay ruta, en nativo
// sí).

/** Archivo de texto elegido por el usuario (contenido + nombre). */
export interface PickedTextFile {
  name: string
  text: string
}

/** Filtro de extensiones para el diálogo (formato plugin-dialog). */
export interface FileFilter {
  name: string
  extensions: string[]
}

export interface PickTextFileOptions {
  title?: string
  filters?: FileFilter[]
}

export interface PlatformFiles {
  /** Guarda bytes (PDF, …). Cancelar el diálogo resuelve en silencio. */
  saveFile(
    bytes: Uint8Array,
    suggestedName: string,
    mime: string,
  ): Promise<void>
  /** Guarda texto (`.fountain`, `.json`, …). */
  saveTextFile(
    text: string,
    suggestedName: string,
    mime?: string,
  ): Promise<void>
  /** Elige un archivo de texto. `null` si el usuario cancela. */
  pickTextFile(options?: PickTextFileOptions): Promise<PickedTextFile | null>
}

/**
 * Detecta el runtime Tauri (v2 expone `__TAURI_INTERNALS__`; se acepta
 * también `__TAURI__` por compatibilidad). Se evalúa en cada llamada para
 * que los tests puedan alternar sin recargar módulos.
 */
export function isTauri(): boolean {
  if (typeof window === 'undefined') return false
  const w = window as unknown as Record<string, unknown>
  return '__TAURI_INTERNALS__' in w || '__TAURI__' in w
}

/**
 * Detecta el WebView nativo de Capacitor sin importar `@capacitor/core`
 * (el bridge inyecta `window.Capacitor` solo en nativo; en web no existe).
 * No es un `import` estático a propósito: el bundle web no debe incluirlo.
 * Si Tauri y Capacitor coexistieran, Tauri gana (ver `getPlatformFiles`).
 */
export function isCapacitorNative(): boolean {
  if (typeof window === 'undefined') return false
  const w = window as unknown as {
    Capacitor?: { isNativePlatform?: () => boolean }
  }
  try {
    return w.Capacitor?.isNativePlatform?.() === true
  } catch {
    return false
  }
}

/** Filtro deducido de la extensión del nombre sugerido (o ninguno). */
function filtersFor(suggestedName: string): FileFilter[] | undefined {
  const ext = suggestedName.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'pdf':
      return [{ name: 'PDF', extensions: ['pdf'] }]
    case 'fountain':
      return [{ name: 'Fountain', extensions: ['fountain', 'txt'] }]
    case 'json':
      return [{ name: 'JSON', extensions: ['json'] }]
    case 'txt':
      return [{ name: 'Texto', extensions: ['txt'] }]
    default:
      return undefined
  }
}

function basename(path: string): string {
  return path.split(/[\\/]/).pop() ?? path
}

// --- Implementación web (comportamiento actual, sin cambios de UX) ---

const webFiles: PlatformFiles = {
  saveFile(bytes, suggestedName, mime) {
    // Copia defensiva: `bytes` puede ser vista de un buffer transferido.
    const blob = new Blob([bytes.slice().buffer as ArrayBuffer], {
      type: mime,
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = suggestedName
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    return Promise.resolve()
  },

  saveTextFile(text, suggestedName, mime = 'text/plain;charset=utf-8') {
    return webFiles.saveFile(
      new TextEncoder().encode(text),
      suggestedName,
      mime,
    )
  },

  pickTextFile(options) {
    const accept =
      options?.filters
        ?.flatMap((f) => f.extensions.map((e) => `.${e}`))
        .join(',') ?? ''
    return new Promise((resolve, reject) => {
      const input = document.createElement('input')
      input.type = 'file'
      if (accept !== '') input.accept = accept
      let settled = false
      const done = (value: PickedTextFile | null, err?: unknown) => {
        if (settled) return
        settled = true
        input.remove()
        if (err !== undefined) reject(err as Error)
        else resolve(value)
      }
      input.addEventListener('change', () => {
        const file = input.files?.[0]
        if (!file) {
          done(null)
          return
        }
        file
          .text()
          .then((text) => done({ name: file.name, text }))
          .catch((err: unknown) => done(null, err))
      })
      // `cancel` se dispara al cerrar el diálogo sin elegir (navegadores
      // modernos); el fallback de `focus` cubre los que no lo emiten.
      input.addEventListener('cancel', () => done(null))
      window.addEventListener('focus', () => done(null), { once: true })
      input.click()
    })
  },
}

// --- Implementación Tauri (diálogos nativos + FS) ---

const tauriFiles: PlatformFiles = {
  async saveFile(bytes, suggestedName) {
    const { save } = await import('@tauri-apps/plugin-dialog')
    const { writeFile } = await import('@tauri-apps/plugin-fs')
    const path = await save({
      defaultPath: suggestedName,
      filters: filtersFor(suggestedName),
    })
    if (path === null) return // cancelado: silencio, no error
    await writeFile(path, bytes)
  },

  async saveTextFile(text, suggestedName, mime = 'text/plain;charset=utf-8') {
    // El diálogo no distingue texto/binario; se reutiliza el binario para
    // no duplicar la llamada al plugin (`mime` queda en la firma por
    // paridad con web/Capacitor, que sí lo usan o documentan).
    void mime
    const { save } = await import('@tauri-apps/plugin-dialog')
    const { writeTextFile } = await import('@tauri-apps/plugin-fs')
    const path = await save({
      defaultPath: suggestedName,
      filters: filtersFor(suggestedName),
    })
    if (path === null) return
    await writeTextFile(path, text)
  },

  async pickTextFile(options) {
    const { open } = await import('@tauri-apps/plugin-dialog')
    const { readTextFile } = await import('@tauri-apps/plugin-fs')
    const path = await open({
      multiple: false,
      title: options?.title,
      filters: options?.filters,
    })
    // Con `multiple: false` el plugin devuelve `string | null`, pero el
    // tipo es unión: se estrecha en runtime por si acaso.
    const picked = Array.isArray(path) ? (path[0] ?? null) : path
    if (picked === null) return null
    const text = await readTextFile(picked)
    return { name: basename(picked), text }
  },
}

/** Implementación vigente según el runtime (se elige en cada llamada). */
export function getPlatformFiles(): PlatformFiles {
  if (isTauri()) return tauriFiles
  if (isCapacitorNative()) return capacitorFiles
  return webFiles
}

// --- Implementación Capacitor (Filesystem + Share, Android) ---

/**
 * Uint8Array → base64 por tramos: `Filesystem.writeFile` espera los bytes
 * como base64 y un `String.fromCharCode(...bytes)` entero revienta la pila
 * en PDFs de varios MB.
 */
function uint8ToBase64(bytes: Uint8Array): string {
  let out = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    out += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(out)
}

const capacitorFiles: PlatformFiles = {
  async saveFile(bytes, suggestedName, mime) {
    // `Share` infiere el tipo por la extensión del nombre; `mime` se
    // conserva en la firma por paridad con web (ver `tauriFiles`).
    void mime
    const { Filesystem, Directory } = await import('@capacitor/filesystem')
    const { Share } = await import('@capacitor/share')
    // Copia defensiva como en web: `bytes` puede ser vista transferida.
    const data = uint8ToBase64(bytes.slice())
    const saved = await Filesystem.writeFile({
      path: suggestedName,
      data,
      directory: Directory.Documents,
    })
    await Share.share({
      title: suggestedName,
      url: saved.uri,
      dialogTitle: `Compartir ${suggestedName}`,
    })
  },

  async saveTextFile(text, suggestedName, mime = 'text/plain;charset=utf-8') {
    void mime
    const { Filesystem, Directory, Encoding } =
      await import('@capacitor/filesystem')
    const { Share } = await import('@capacitor/share')
    const saved = await Filesystem.writeFile({
      path: suggestedName,
      data: text,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
    })
    await Share.share({
      title: suggestedName,
      url: saved.uri,
      dialogTitle: `Compartir ${suggestedName}`,
    })
  },

  pickTextFile() {
    // Sin `accept` a propósito: Android no conoce `.fountain` en su
    // MimeTypeMap y un filtro estricto por extensión deja esos archivos
    // no seleccionables (aparecen como "BIN file"). Se lista todo y la
    // validación de extensión la hace quien llama (ImportButton,
    // BackupSection) con toast si no vale.
    return webFiles.pickTextFile()
  },
}
