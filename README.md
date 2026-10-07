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

Deploy manual de `dist/` (decisión §7: sin CSP en el primer deploy,
sin `Cache-Control` en `/fountain/*` — ETag por defecto — y fuentes
bundleadas vía `@fontsource`, que ya satisfacen `font-src 'self'`):

```bash
npm run build                              # sync + tsc -b + vite build → dist/
npx wrangler pages deploy dist --project-name contrascripts
# o arrastra la carpeta dist/ en el dashboard de Pages
```

> Backlog: conectar git a Pages queda para después. El build de Pages
> desde git hoy fallaría porque `npm run sync` necesita el repo hermano
> `../2026-08-31-fountain-parser` + toolchain Go (`make dist`/`package`).
> Opciones: vendorizar el bundle, submodule con caché, o un job CI que
> publique `dist/` y Pages lo consuma.

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
