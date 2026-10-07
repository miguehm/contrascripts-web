// scripts/sync.mjs — regenera artefactos del parser (fase §3 del PLAN.md).
//
// 1. ejecuta `make -C ../2026-08-31-fountain-parser package DIR=<abs>/public/fountain`
//    (assets servidos tal cual: 2 .wasm + wasm_exec.js + manifest.json)
// 2. copia dist/fountain.mjs y dist/fountain.d.ts a src/vendor/
//    (código que el bundler compila, no un asset de public/)
//
// Portable: solo Node stdlib, sin `cp` de shell. `DIR` es absoluta porque
// `make -C` cambia de cwd y una relativa se resolvería mal.

import { execFile } from 'node:child_process'
import { copyFile, mkdir, readdir, rm, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const PARSER_DIR = path.resolve(ROOT, '../2026-08-31-fountain-parser')
const DIST_DIR = path.join(PARSER_DIR, 'dist')
const PUBLIC_DIR = path.join(ROOT, 'public', 'fountain')
const VENDOR_DIR = path.join(ROOT, 'src', 'vendor')

// Debe coincidir con ASSETS del Makefile del parser.
const ASSETS = [
  'fountain-parser.wasm',
  'fountain-pdf.wasm',
  'wasm_exec.js',
  'manifest.json',
]
// El wrapper se importa como `./vendor/fountain.mjs`; TypeScript solo lo
// empareja con sus tipos si la declaración vecina es `fountain.d.mts`
// (mapeo .mjs ↔ .d.mts con moduleResolution bundler + gotcha §3 del plan:
// un `fountain.d.ts` vecino no se resuelve y `tsc -b` falla con TS7016).
const WRAPPER = [
  { from: 'fountain.mjs', to: 'fountain.mjs' },
  { from: 'fountain.d.ts', to: 'fountain.d.mts' },
]
// Resto de una época anterior del sync (cuando se copiaba `fountain.d.ts`).
const STALE_WRAPPER = ['fountain.d.ts']

async function main() {
  // 1. make package → public/fountain (crea el dir, copia ASSETS, borra
  // cualquier fountain.mjs residual por diseño del Makefile).
  await new Promise((resolve, reject) => {
    stat(PARSER_DIR)
      .then((st) => {
        if (!st.isDirectory())
          reject(new Error(`parser no encontrado: ${PARSER_DIR}`))
        else resolve()
      })
      .catch(() => reject(new Error(`parser no encontrado: ${PARSER_DIR}`)))
  })
  await mkdir(PUBLIC_DIR, { recursive: true })
  // `dist` es .PHONY en el Makefile (siempre reconstruye) y su `cp` del
  // `wasm_exec.js` de GOROOT preserva el modo solo-lectura del origen: sin
  // esto, un segundo `sync` en el mismo workspace (p.ej. el encadenado en
  // `npm run build`/`dev`) falla con EACCES al sobrescribirlo, tanto en el
  // `dist/` del parser (target `dist`) como en el destino de este repo
  // (target `package`, que copia a `public/fountain/` preservando el 444).
  // Best-effort: si `chmod` no existe, se ignora y `make` decide.
  await execFileAsync('chmod', ['-R', 'u+w', DIST_DIR]).catch(() => {})
  await execFileAsync('chmod', ['-R', 'u+w', PUBLIC_DIR]).catch(() => {})
  await execFileAsync(
    'make',
    ['-C', PARSER_DIR, 'package', `DIR=${PUBLIC_DIR}`],
    {
      stdio: 'inherit',
    },
  )

  // 2. Verificar assets en public/ (+ ausencia deliberada del wrapper).
  const entries = new Set(await readdir(PUBLIC_DIR))
  for (const name of ASSETS) {
    if (!entries.has(name)) {
      throw new Error(`sync incompleto: falta public/fountain/${name}`)
    }
  }
  if (entries.has('fountain.mjs')) {
    throw new Error(
      'sync inválido: public/fountain/fountain.mjs no debe existir (ver Makefile)',
    )
  }

  // 3. Copiar wrapper + tipos a src/vendor/.
  await mkdir(VENDOR_DIR, { recursive: true })
  for (const { from, to } of WRAPPER) {
    await copyFile(path.join(DIST_DIR, from), path.join(VENDOR_DIR, to))
  }
  for (const name of STALE_WRAPPER) {
    await rm(path.join(VENDOR_DIR, name), { force: true })
  }

  // 4. Log mínimo con tamaños.
  for (const name of [
    ...ASSETS.map((n) => path.join(PUBLIC_DIR, n)),
    ...WRAPPER.map(({ to }) => path.join(VENDOR_DIR, to)),
  ]) {
    const { size } = await stat(name)
    console.log(`sync: ${path.relative(ROOT, name)} (${size} bytes)`)
  }
}

try {
  await main()
} catch (err) {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
}
