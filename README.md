# Contrascripts — Editor de guiones Fountain (Vite/React + TS + WASM)

Editor web de guiones en formato Fountain. Frontend Vite + React + TypeScript
que usa el parser Go compilado a WASM
(`../2026-08-31-fountain-parser`) para parse/lint en vivo y exportar PDF.

Plan de trabajo por fases: ver [PLAN.md](./PLAN.md).
Diseño (fuente de verdad de §8): [design/design.md](./design/design.md) (light)
y [design/design.dark.md](./design/design.dark.md) (dark).

## Requisitos

- Node 20+ y npm.
- Go toolchain (solo para regenerar el parser; ver §1 del plan).
- El repo hermano `../2026-08-31-fountain-parser` con `Makefile` (`dist`, `package`).

## Cómo correr

```bash
npm run dev     # sync de artefactos + vite (a partir de §2/§3)
npm run build   # sync + vite build → dist/
npm run preview # servir dist/ para verificar como en producción
```

> En fase 0 aún no hay `package.json`: estos scripts se crean en §2 (scaffold)
> y §3 (`sync`).

## Deploy (Cloudflare Pages, §7)

Deploy automático con GitHub Actions (`.github/workflows/deploy-pages.yml`):
push a `main` (o `workflow_dispatch`) → clona el parser del mirror
`github.com/miguehm/contrascripts` (`main`), Go 1.24 + Node 20,
`sync → typecheck → test → build` y `wrangler pages deploy dist`
(proyecto `contrascripts`; el primer deploy lo crea). En PRs solo
compila sin publicar. Requiere los secrets `CLOUDFLARE_API_TOKEN`
(Account → Cloudflare Pages → Edit) y `CLOUDFLARE_ACCOUNT_ID`.

Decisión §7: sin CSP en el primer deploy, sin `Cache-Control` en
`/fountain/*` — ETag por defecto — y fuentes bundleadas vía
`@fontsource`, que ya satisfacen `font-src 'self'`):

```bash
npm run build                              # sync + tsc -b + vite build → dist/
npx wrangler@4.148.0 pages deploy dist --project-name contrascripts
# o arrastra la carpeta dist/ en el dashboard de Pages
```

> Backlog: la Git-integration de Cloudflare (compilar desde git al hacer
> push) queda descartada por ahora: el build de Pages desde git fallaría
> porque `npm run sync` necesita el repo hermano del parser + toolchain
> Go (`make dist`/`package`). El workflow de Actions ya cubre ese hueco
> clonando el mirror y construyendo `dist/` antes del deploy.

## Nativo (Tauri v2, Linux)

El mismo `dist/` web empaquetado como app de escritorio (WebView del
sistema). Sin duplicar código: la E/S pasa por `src/platform/files.ts`
(web: Blob/download; Tauri: `plugin-dialog` + `plugin-fs` con diálogos
nativos) y los plugins solo se importan con `import()` dinámico, así que
el bundle web no los incluye.

```bash
npm run tauri dev    # devUrl http://localhost:5173, ventana 1280×800
npm run tauri build  # .deb + .AppImage en src-tauri/target/release/bundle/
```

Requisitos extra (Arch/Debian): toolchain Rust estable + WebKitGTK 4.1
(p.ej. `libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev
libssl-dev libayatana-appindicator3-dev librsvg2-dev` en Ubuntu).
Capacidades mínimas en `src-tauri/capabilities/default.json` (dialog
abrir/guardar + FS acotado a `$HOME`). CI: `.github/workflows/tauri.yml`
(compila el bundle en Ubuntu; Windows/macOS fuera de v1).

Verificado local 2026-10-08: `tauri build` genera `.deb` (6,7 MiB) +
`.AppImage`, el binario arranca en Wayland con boot/parser/preview-PDF
funcionales y `web: 36f/392t unit + 35/35 e2e` en verde. Pendiente manual:
guardar PDF y abrir `.fountain` con los diálogos nativos (clicar Exportar
PDF / Importar y confirmar el archivo).

## De dónde salen los binarios

Los artefactos WASM **no** se versionan aquí; se regeneran desde el parser:

```bash
# 1. Generar el paquete del parser (una vez)
make -C ../2026-08-31-fountain-parser dist

# 2. Sincronizar en cada dev/build (a partir de §3: npm run sync)
make -C ../2026-08-31-fountain-parser package DIR=$PWD/public/fountain
mkdir -p src/vendor
cp ../2026-08-31-fountain-parser/dist/fountain.mjs src/vendor/
cp ../2026-08-31-fountain-parser/dist/fountain.d.ts src/vendor/fountain.d.mts
# (los tipos se renombran a .d.mts: es el emparejamiento que tsc resuelve
# para un import de ./vendor/fountain.mjs; ver gotcha §3 del PLAN.md)
```

- `public/fountain/`: `.wasm` + `wasm_exec.js` + `manifest.json` (assets servidos tal cual).
- `src/vendor/`: `fountain.mjs` + `fountain.d.mts` (código que el bundler compila).
  Está en `.gitignore` porque es un artefacto regenerable; un clon limpio
  debe correr `npm run sync` antes de compilar.

## Nota sobre `base` relativa (§4)

El singleton `src/fountain.ts` (fase §4) usará `createFountain({ base: './fountain' })`
con ruta **relativa**. La raíz absoluta (`'/fountain'`) funciona en web pero no
en `tauri://localhost` ni `https://localhost` (Capacitor, Fase 2), y cambiarlo
tarde obligaría a re-verificar §9.1/§9.2. Se fija relativa desde el inicio.

## Política de versiones (§0/§2)

- Nada de `@latest` suelto en installs definitivos: deriva y rompe reproducibilidad
  (el parser fija su toolchain por `manifest.json`; el front sigue el mismo criterio).
- `@latest` solo aceptable como punto de partida del scaffold; tras el primer
  install se anotan las versiones resueltas y se fijan (sin `^`) las piezas
  críticas: `vite`, `react`, `react-dom`.
- Misma disciplina para shadcn (`npx shadcn@latest ...` solo al añadir componentes).

## Layout

```
src/
  components/     UI propia
  components/ui/  shadcn (copiados, nuestros)
  features/       editor/ preview/ navigator/ scripts/
  hooks/          useScripts, useTheme, useParser
  lib/            utils.ts (cn), format, id
  store/          ScriptsProvider (context + reducer)
  types/          Script, Theme, ParseResult
  vendor/         fountain.mjs + fountain.d.ts (copiados, gitignoreado)
public/
  fountain/       .wasm + wasm_exec.js + manifest.json
  fonts/          Plus Jakarta Sans, Courier Prime (self-host)
design/           design.md (light) + design.dark.md (dark)
scripts/          sync.mjs (a partir de §3)
```

Regla: la persistencia vive en `store/` y se accede por hooks; los componentes
no leen `localStorage` directamente.

## Licencia

MIT — ver [LICENSE](./LICENSE), coherente con el parser.
