# Plan: Editor de guiones Vite/React + TS con el parser WASM

## Contexto y decisiones
- Editor v1: `<textarea>`; CodeMirror 6 como evolución (aislar en un componente
  `Editor` para que el swap sea local).
- Persistencia: localStorage con múltiples guiones (lista de proyectos) +
  importar/exportar `.fountain`.
- Estado: React Context + `useReducer` (ver §0). No se decide Zustand hasta que
  el estado lo justifique.
- Diseño: los `design.md` (Warm Screenplay Minimal / Cinematic Script Minimal)
  son la fuente de verdad de §8; **ya existen en el repo**
  (`design/design.md` + `design/design.dark.md`, verificado 2026-10-02),
  o §8 queda sin referencia verificable.

Las fases 0–10 del MVP son secuenciales; la "Fase 2" (post-MVP) es opcional.
Cada fase declara sus dependencias.

## 0. Fundamento del repo (antes de tocar código)

Depende de: —

- `git init` en esta carpeta; `.gitignore` con `node_modules/`, `dist/`,
  `**/*.tsbuildinfo`, `.env*`, `.DS_Store`, `*.local` y **`src/vendor/`**
  (el wrapper es un artefacto regenerable de `make dist`, no fuente).
- `README.md` mínimo: qué es, cómo correr `npm run dev`, de dónde salen los
  binarios (`make package`) y la nota de `base` relativa (§4).
- Licencia coherente con el parser (MIT).
- **Pinear versiones** en lugar de `@latest` (ver §2): `@latest` deriva y rompe
  la reproducibilidad; el parser fija su toolchain por `manifest.json` y el
  front debería seguir el mismo criterio.
- Layout de carpetas que el resto del plan asume:
  ```
  src/
    components/     UI propia
    components/ui/  shadcn (copiados)
    features/       editor/ preview/ navigator/ scripts/
    hooks/          useScripts, useTheme, useParser
    lib/            utils.ts (cn), format, id
    store/          ScriptsProvider (context + reducer)
    types/          Script, Theme, ParseResult
    vendor/         fountain.mjs + fountain.d.mts (copiados, ver gotcha §3)
  public/
    fountain/       .wasm + wasm_exec.js + manifest.json
    fonts/          Plus Jakarta Sans, Courier Prime (self-host)
  ```
- Persistencia centralizada en `store/` y accedida por hooks; los componentes no
  leen `localStorage` directamente (evita claves dispersas y facilita tests).

## 1. Generar el paquete WASM (ya existente)

Depende de: —

```bash
cd ~/Work/tries/2026-08-31-fountain-parser && make dist
```

Verificar `dist/`: `fountain.mjs`, `fountain.d.ts`, `fountain-parser.wasm`,
`fountain-pdf.wasm`, `wasm_exec.js`, `manifest.json`.

## 2. Scaffold

Depende de: §1

```bash
npm create vite@latest guion -- --template react-ts   # deja Vite 7 / React 19
cd guion && npm install
npm install tailwindcss@^4 @tailwindcss/vite@^4
npm install -D @types/node typescript@^5
npm install -D eslint @eslint/js typescript-eslint \
  eslint-plugin-react-hooks eslint-plugin-react-refresh \
  prettier eslint-config-prettier
```

- Anotar las versiones resueltas en `package.json` (sin `^` suelto para las
  piezas críticas: `vite`, `react`, `react-dom`). `@latest` en el scaffold es
  aceptable solo como punto de partida; fijar tras el primer install.
- Los comandos de lint/format/test se definen aquí y se reutilizan en §10.

- `vite.config.ts`: plugin `@tailwindcss/vite` + alias `@ → ./src`
  (`resolve.alias`).
- `tsconfig.json` y `tsconfig.app.json`: `baseUrl: "."` y
  `paths: { "@/*": ["./src/*"] }` (shadcn lo requiere).
- `src/index.css`: primera línea `@import "tailwindcss";` (Tailwind v4,
  sin `tailwind.config.js`).

## 2b. shadcn/ui

Depende de: §2

```bash
npx shadcn@latest init
npx shadcn@latest add button input dialog dropdown-menu tooltip \
  scroll-area separator sonner resizable
```

`init` genera `components.json` + `src/lib/utils.ts` (helper `cn`).
Mapeo con la UI de este plan: `button`/`input` (toolbar, búsqueda,
renombrar), `dialog` (confirmar borrado, importar), `dropdown-menu`
(menú de guion, export), `tooltip`, `scroll-area` (navigator de
escenas), `separator`, `resizable` (dual-pane editor/preview),
`sonner` (toast al exportar PDF / errores de parse).

## 3. Integrar artefactos (wrapper → src, binarios → public)

Depende de: §1, §2

```bash
make -C ../2026-08-31-fountain-parser package DIR=$PWD/public/fountain
mkdir -p src/vendor
cp ../2026-08-31-fountain-parser/dist/fountain.mjs \
   ../2026-08-31-fountain-parser/dist/fountain.d.ts src/vendor/
```

Script en `package.json`, encadenado a `dev` y `build`. `src/vendor/` está en
`.gitignore` (§0), así que el `sync` debe regenerar **ambos** (assets en
`public/` + wrapper en `src/vendor/`) o un clon limpio no compilará. Un
`scripts/sync.mjs` es más portable que encadenar `make` + `cp` en `npm` (no
todos los shells tienen `cp`):

```json
"sync": "node scripts/sync.mjs",
"dev": "npm run sync && vite",
"build": "npm run sync && vite build"
```

```js
// scripts/sync.mjs (esbozo)
// 1. ejecuta `make -C ../2026-08-31-fountain-parser package DIR=<abs>/public/fountain`
// 2. copia dist/fountain.mjs y dist/fountain.d.ts a src/vendor/
```

Nota: `DIR` expandido por el shell como absoluta, por lo que `make -C` no lo
rompe.

`make package` copia solo `ASSETS` (los dos `.wasm`, `wasm_exec.js` y
`manifest.json`) y **borra a propósito cualquier `fountain.mjs` en `DIR`**
(comentario en `Makefile`: no dejar una segunda copia del wrapper junto a la del
bundle). Por eso el wrapper y sus tipos se copian aparte a `src/vendor/`: son
código que el bundler compila, no un asset de `public/`.

**Gotcha TS (resuelto 2026-10-02, verificado con `tsc -b`)**: importar
`./vendor/fountain.mjs` con un `fountain.d.ts` vecino falla con TS7016
(`implicitly has an 'any' type`); el emparejamiento correcto es
`.mjs` ↔ `.d.mts`. `scripts/sync.mjs` copia
`dist/fountain.d.ts` → `src/vendor/fountain.d.mts` y borra el
`fountain.d.ts` de sincronizaciones anteriores. La alternativa del
`exports`+`types` de `dist/package.json` queda como plan B si el copy
manual da guerra.

## 4. Singleton del runtime — `src/fountain.ts`

Depende de: §3

Copia de `web/vite/src/fountain.js:19-35`:

```ts
import { createFountain, type Fountain } from './vendor/fountain.mjs'
const INSTANCE = Symbol.for('fountain.instance')
export function loadFountain(): Promise<Fountain> {
  const g = globalThis as any
  g[INSTANCE] ??= createFountain({ base: './fountain' })
  return g[INSTANCE]
}
```

`base` es obligatorio bajo bundler (el `import.meta.url` del wrapper se pierde
en el chunk). Usar `'./fountain'` (relativo) **desde el inicio**, no
`'/fountain'`: la raíz absoluta funciona en web pero no en `tauri://localhost`
ni `https://localhost` (Capacitor), y cambiarlo luego obliga a re-verificar
§9.1/§9.2 (ver Fase 2). Mantener el contador `window.__fountainBoots` del
fixture para la aserción de StrictMode (§9.5).

> Estado 2026-10-02: implementado en `src/fountain.ts` (verificado
> `tsc -b` + `lint` + `build` limpios; dev sirve
> `./fountain/fountain-parser.wasm` 200 como `application/wasm` y no hay
> copia del wrapper en `public/`). El fixture usa `base: '/fountain'`;
> aquí es `'./fountain'` a propósito (ver párrafo anterior). La aserción
> `window.__fountainBoots === 1` (§9.5) se verifica en §5, cuando la UI
> monte `loadFountain()` (aún nadie lo llama).

## Deuda / desvíos registrados (2026-10-02)

Verificados §0–§4 sin bloqueantes; pendientes que no impiden §4 pero hay
que saldar antes o durante las fases indicadas:

- §2 `tsconfig.app.json`: el plan pide `baseUrl: "."` (shadcn lo requería),
  pero con TypeScript 6 `baseUrl` está deprecado (`tsc -b` falla con
  TS5101; dejará de funcionar en TS 7). **Saldado de otro modo**: solo
  `paths: { "@/*" }`, que TS ≥4.1 resuelve relativo al tsconfig y Vite
  cubre con su alias; verificado `tsc -b` + `build` limpios con un
  import `@/` real (`ui/dialog.tsx`). No reintroducir `baseUrl` salvo
  que el CLI de shadcn lo exija de nuevo.
- §2 scaffold: `typescript: ~6.0.2` y `vite: 8.3.0` frente a `typescript@^5` /
  Vite 7 del plan. Deriva aceptable: lo que importa (pineado exacto de
  `vite`, `react`, `react-dom`) se cumple; no reaccionar salvo que §9.4
  dé guerra.
- §2b `src/lib/utils.ts`: es `export { cn } from 'cn'` (artefacto del estilo
  `radix-nova` de `shadcn init`), no el helper `clsx + tailwind-merge` que
  el plan asume. Revisar en §8 si `cn` cubre `tailwind-merge`; si no,
  volver al helper manual.
- §2/§8 fuentes: instalado `@fontsource-variable/geist`; `public/fonts/`
  sigue vacío (Plus Jakarta Sans + Courier Prime self-host pendientes
  de §8). `src/index.css` trae además `tw-animate-css` y
  `shadcn/tailwind.css` del init, fuera del esbozo del plan.
- §8 tokens: `src/index.css` usa la paleta `oklch` neutra por defecto de
  shadcn, no los tokens Warm/Cinematic de este plan. Esperado (se
  implementa en §8); no usar los colores actuales como referencia.

## 5. UI

Depende de: §4

- **Boot**: `useEffect` con flag `alive` + `loadFountain()` →
  `ready | booting | error`.
- **Editor**: `<textarea>` controlado.
- **Parse/lint reactivo**: síncronos y bloquean el main thread → colapsar con
  rAF (patrón `App.jsx:33-54`). **Corregir el bug del fixture**: guardar el id
  del frame (`const id = requestAnimationFrame(...)`) y cancelar con él; el
  fixture hace `cancelAnimationFrame(0)` que no cancela nada. El cleanup del
  effect debe cancelar el frame pendiente y poner `queued = false`.
- **Preview**: render de `doc.elements` respetando `uppercase`, `baseItalic`,
  `dual`, `level` (sections) y `inline`. Ojo: `inline` solo viene donde el PDF
  honra `**bold**`/`*italic*` → fallback siempre a `text`. Incluir también
  `titlePage`. Memoizar el render (`useMemo` sobre `doc`) para no re-renderizar
  la hoja en cada tecla.
- **Warnings**: `lint()` → lista con `line`, `code`, `message`. Mostrar los
  `Warning` con `aria-live="polite"` para que un lector de pantalla anuncie el
  recuento al cambiar.
- **Exportar PDF**: `renderPDF(text)` → `Uint8Array` → Blob
  `application/pdf` → descarga, con estado `busy` y `try/catch` que reporte por
  `sonner`. Tras el boot, precargar en idle para que el primer export no cargue
  el wasm (~6.5 MiB) en frío:

  ```ts
  const idle = () => { if (!fountain.pdfLoaded()) fountain.preloadPDF().catch(() => {}) }
  if ('requestIdleCallback' in window) requestIdleCallback(idle, { timeout: 3000 })
  else setTimeout(idle, 1500) // fallback Safari
  ```

  El `.catch` evita un unhandled rejection si el preload falla (p.ej. red
  caída); el siguiente export reintenta igual. Tamaño exacto según
  `manifest.json`: `fountain-pdf.wasm` = 6.810.538 bytes (~6.5 MiB).

## 6. Persistencia y archivos

Depende de: §5

- Modelo: `{ id, title, text, updatedAt }[]` en localStorage (clave propia,
  p.ej. `guion.scripts.v1`), tipado en `src/types/Script.ts` y gestionado por
  `store/` (no por los componentes).
- Sidebar/lista para crear, renombrar, borrar, seleccionar guion activo;
  debounce al guardar (~400–600ms).
- **Guardarraíles de persistencia**:
  - `flush()` del write pendiente en `beforeunload` y al cambiar de guion; un
    debounce sin flush pierde las últimas teclas si el usuario cierra.
  - Capturar `QuotaExceededError` en `setItem` y avisar por `sonner` (los
    guiones son texto, pero varias copias + autosave pueden acercarse al límite
    de ~5MB del origen).
  - Un dato corrupto/`JSON.parse` fallido no debe tumbar el boot: validar y caer
    a lista vacía.
- Importar: `<input type="file" accept=".fountain,.txt">` → texto. Exportar:
  Blob `text/plain` con extensión `.fountain`; nombre derivado de `title`
  saneado (sin `/`, `\`, `:`).

## 7. Build y deploy (Cloudflare Pages)

Depende de: §2–§6

- `npm run build` → `dist/`; Pages sirve `.wasm` como `application/wasm` por
  defecto → `instantiateStreaming` OK.
- Deploy automático (2026-10-07): `.github/workflows/deploy-pages.yml`
  (push a `main` / `workflow_dispatch` → build + `wrangler pages deploy`;
  en PR solo build sin publicar). El workflow clona el parser del mirror
  `github.com/miguehm/contrascripts` (rama `main`) como hermano para
  `npm run sync` (Go 1.24 + Node 20) y despliega con los secrets
  `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID`; wrangler pineado
  exacto en `WRANGLER_VERSION`. Se descarta la Git-integration de
  Cloudflare (su entorno de build no tiene el repo hermano + Go).
  Primer destino: `*.pages.dev`; sin CSP inicial (ver punto siguiente);
  el custom domain (`contrascripts.miguehm.com`) queda para después.
- `public/_headers` solo si usas CSP. Una CSP incompleta (solo `script-src`)
  es peor que ninguna: el runtime de Go necesita `'wasm-unsafe-eval'`, Radix y
  React emiten estilos inline, y `_headers` no se aplica en `vite preview`
  (los checks de §9 deben correr también sin CSP):

  ```
  /*
    Content-Security-Policy: default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'
    X-Content-Type-Options: nosniff
    Referrer-Policy: strict-origin-when-cross-origin
  ```

- Cache: los assets de `/fountain/` **no llevan hash en el nombre**, así que
  `immutable`/`max-age=31536000` serviría wasm viejo tras un redeploy. Opciones:
  (a) dejar que el ETag por defecto haga la revalidación (más simple y seguro),
  o (b) content-hashear los `.wasm` al copiarlos y reescribir `base`/`manifest`.
  Si se elige (a), no declarar `Cache-Control` para `/fountain/*`; la detección
  de cambio ya la da el pairing `sha256` de `manifest.json`.
- Nota UI: shadcn/Radix es DOM puro; sin impacto en Tauri/Capacitor. Las
  fuentes (Plus Jakarta Sans, Courier Prime) se self-hostean en
  `public/fonts` para los empaquetados nativos (en web, `font-src 'self'`
  obliga a self-host o a añadir el origen de Google Fonts).

## 8. Sistema de diseño (dark/light)

Depende de: §2

Dos temas derivados de los `design.md` que se crean en §0
(`design/design.md` light, `design/design.dark.md` dark); esos archivos son la
fuente de verdad y este bloque es su implementación. UI construida con
**shadcn/ui (Radix + Tailwind v4)**: los componentes se copian a
`src/components/ui` (no son dependencia, el código es nuestro) y se
customizan vía tokens. El tema activo se persiste en localStorage
(`guion.theme.v1`, valores `dark | light`) y se aplica con la clase
`.dark` en `<html>` (convención shadcn). Los tokens se definen como CSS
custom properties en `src/index.css` con la nomenclatura shadcn
(`--background`, `--foreground`, `--primary`, `--muted`, `--border`,
`--ring`, `--accent`, ...) expuestas a Tailwind vía `@theme inline`;
los componentes los consumen con clases (`bg-background`,
`text-foreground`) o `var(--*)` para casos propios (paper, canvas).

### Tokens (CSS variables)

Misma paleta de los `design.md`, renombrada a la convención shadcn. El bloque
declara **el juego completo de tokens que los componentes shadcn generan por
defecto** (`card`, `popover`, `secondary`, `accent-foreground`, `input`,
`destructive-foreground`, `--radius`): omitir cualquiera deja `var()` sin
resolver en `dialog`, `dropdown-menu` o `sonner` y rompe el toggle de tema
(§9.7). El color de sintaxis Fountain va en un token propio `--syntax`, **no**
en `--accent`: en shadcn `--accent` es la superficie sutil de hover de menús e
items, y reutilizarlo para el indigo teñiría todos los hovers.

```css
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-paper: var(--paper);
  --color-paper-ink: var(--paper-ink);
  --color-syntax: var(--syntax);
  --radius-sm: calc(var(--radius) - 2px);
  --radius-md: var(--radius);
  --radius-lg: calc(var(--radius) + 2px);
  --font-sans: "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "Courier Prime", ui-monospace, monospace;
}
:root { /* light = Warm Screenplay Minimal */
  --radius: 0.25rem;
  --background: #f8fafc;          /* canvas */
  --foreground: #0f172a;
  --card: #f1f5f9;                /* canvas elevado */
  --card-foreground: #0f172a;
  --popover: #ffffff;             /* overlay Level 2 */
  --popover-foreground: #0f172a;
  --primary: #b45309;
  --primary-foreground: #ffffff;
  --secondary: #eaedff;
  --secondary-foreground: #0f172a;
  --muted: #eaedff;               /* surface-container */
  --muted-foreground: #64748b;
  --accent: #e2e8f0;              /* hover sutil (shadcn), no marca */
  --accent-foreground: #0f172a;
  --border: #e2e8f0;              /* border-hairline */
  --input: #cbd5e1;
  --ring: rgba(217, 119, 6, 0.4); /* border-focus */
  --destructive: #ba1a1a;
  --destructive-foreground: #ffffff;
  --paper: #ffffff;
  --paper-ink: #0f172a;
  --syntax: #904d00;              /* acento editorial Fountain */
}
.dark { /* dark = Cinematic Script Minimal */
  --radius: 0.25rem;
  --background: #0d0d11;          /* canvas, Level 0 app void */
  --foreground: #e4e1e7;
  --card: #131317;                /* paneles */
  --card-foreground: #e4e1e7;
  --popover: #18181b;             /* overlays, Level 2 */
  --popover-foreground: #e4e1e7;
  --primary: #d97706;
  --primary-foreground: #0d0d11;
  --secondary: #1f1f23;
  --secondary-foreground: #e4e1e7;
  --muted: #1f1f23;               /* surface-container */
  --muted-foreground: #a38c7c;
  --accent: #26262c;              /* hover sutil (shadcn), no marca */
  --accent-foreground: #e4e1e7;
  --border: rgba(255, 255, 255, 0.08);
  --input: rgba(255, 255, 255, 0.14);
  --ring: rgba(217, 119, 6, 0.4);
  --destructive: #ffb4ab;
  --destructive-foreground: #0d0d11;
  --paper: #fbfbf9;
  --paper-ink: #121214;
  --syntax: #4f46e5;              /* indigo editorial, solo sintaxis Fountain */
}
```

- **Dark** (`Cinematic Script Minimal`): canvas `#0D0D11`, paneles `#131317`,
  overlays `#18181B`, acento amber `#D97706` (cursor, wordcount, estado
  unsaved, escena activa), sintaxis Fountain en `--syntax` `#4F46E5`.
- **Light** (`Warm Screenplay Minimal`): canvas `#f8fafc → #f1f5f9`, hoja
  `#ffffff`, texto `#0f172a`, secundario `#64748b`, borde `#e2e8f0`, acento
  `#b45309` (hover `#92400e`, activo `#78350f`), foco `#d97706`, sintaxis
  `--syntax` `#904d00`.
- Los hovers de menús/items (`hover:bg-accent`) usan `--accent`, un gris
  apenas elevado; no confundir con el amber de marca (`--primary`) ni con
  `--syntax`.
- `paper-shadow`: dark `0 2px 4px rgba(0,0,0,.2), 0 16px 40px rgba(0,0,0,.4)`;
  light `0 4px 20px -2px rgba(15,23,42,.05), 0 1px 3px rgba(15,23,42,.03)`.
- Elevación por tonos y hairlines, nunca sombras saturadas grandes.
  Overlays/menús (Level 2): dark `0 12px 32px rgba(0,0,0,.6)`; light
  `0 10px 25px -5px rgba(15,23,42,.08), 0 8px 10px -6px rgba(15,23,42,.04)`.

### Tipografía

- Cargar vía Google Fonts (o self-hosted en `public/fonts` para Tauri/
  Capacitor): **Plus Jakarta Sans** (chrome UI) y **Courier Prime** (editor y
  canvas del guion). Registradas en `@theme` como `--font-sans` y
  `--font-mono` (ver bloque de tokens).
- Roles: `display-lg` 2.25rem/600, `headline-md` 1.25rem/600,
  `headline-sm` 1rem/500, `body-fountain-editor` Courier Prime 1rem/1.625rem,
  `code-slugline` Courier Prime 1rem/700 con letter-spacing 0.05em,
  `label-ui` 0.8125rem/500, `label-meta` 0.6875rem/600 ls 0.06em.
- Reglas de industria: editor y preview a 12pt Courier, 10 chars/pulgada y
  6 líneas/pulgada (1 página ≈ 1 minuto). Márgenes preview: izq 1.5in,
  der 1in, arriba/abajo 1in.
- En modo Fountain crudo, sangrías por columna: slugline/acción col 0,
  diálogo col ~10, paréntesis col ~15, personaje col ~20.

### Layout y radios

- Breakpoints: móvil <768px (una sola vista con tabs Editor/Preview,
  navegador como bottom-sheet), tablet 768–1024 (stacked/toggle),
  desktop >1024 (dual-pane 50/50, colapsando a 45/55 en pantallas anchas).
- Modo foco: columna única centrada, max-width `820px`.
- Navigator: 240–280px fijo en desktop (colapsable a 56px icono-only).
- Radios: elementos interactivos `0.25rem` (4px), flotantes/modales
  `0.5rem`, hoja del preview `0`–`2px`. Chips de sintaxis: uppercase
  monospace 10px, borde hairline.
- Espaciado: base 4px (`space-xs` 0.25rem … `space-xl` 2.5rem), gutter
  1rem móvil / 1.5rem desktop, márgenes 1rem / 2rem.

### Componentes (customización de shadcn)

Las siguientes specs se aplican como overrides de clases/vars sobre los
componentes shadcn (radios 4px por defecto en el tema, alto 32px en
toolbar, etc.), no como CSS desde cero.

- **Toolbar buttons**: alto 32px, `label-ui`, transparente; hover
  `rgba(255,255,255,.05)` (dark) / `#f1f5f9` (light); activo con outline
  amber `rgba(217,119,6,.3)` y glifo amber.
- **Botón primario**: dark `#D97706` (o blanco con texto oscuro para
  exportación); light `#b45309`, hover `#92400e`, activo `#78350f`.
- **Navigator de escenas**: encabezados truncados `INT. … - DAY`, indicador
  izquierdo 2px (amber en escena activa / 3px en light), drag handle solo
  al pasar el cursor.
- **Chips de sintaxis** (`SCENE`, `CHAR`, `PAREN`, `DIALOGUE`, `ACTION`,
  `TRANS`): pills monospace uppercase 10px.
- **Inputs/búsqueda**: hairline o píldora sin elevación; caret `#D97706`;
  focus ring `border-focus` + anillo 1px.
- **Toggle/checkbox**: micro-toggle 16×28px; checkbox 4px radius, checked
  amber (dark) / `#b45309` (light).
- **Preview del guion**: hoja 8.5×11in sobre canvas, saltos de página como
  hairline con token `-- Page N --`, guías de margen opcionales, brads de
  latón en modo táctil (dark).
- **Foco/Zen**: en modo foco el chrome baja a `rgba(255,255,255,.35)`
  (dark) / 40% opacidad (light) hasta hover.

### Dónde vive en el código

- `design/design.md` (light) y `design/design.dark.md` (dark): fuente de verdad
  de la paleta y roles; este §8 es su traducción a tokens.
- `src/index.css`: `@import "tailwindcss"`, bloque `@theme inline`, tokens
  `:root`/`.dark` y utilidades base.
- `src/components/ui/*`: componentes shadcn (copiados, no dependencia).
- `src/lib/utils.ts`: helper `cn` (clsx + tailwind-merge).
- `src/store/`: `ScriptsProvider` (context + reducer), persistencia y tema.
- `src/hooks/`: `useScripts`, `useTheme`, `useParser`.
- `src/types/`: `Script`, `Theme`, `ParseResult`.
- `src/App.tsx` y componentes: clases Tailwind (`bg-background`,
  `text-muted-foreground`...) y `var(--paper)`/`var(--paper-ink)` para la
  hoja del preview.
- Toggle de tema en header: clase `.dark` en `<html>` + localStorage
  (`guion.theme.v1`), aplicado por `useTheme`.

## 9. Verificación

Depende de: §1–§8

1. `npm run dev`: boot OK, parse funciona, red muestra
   `./fountain/fountain-parser.wasm` 200 y ningún request al wrapper con ruta
   `public/`.
2. `npm run build && npm run preview`: repetir — dev y build son caminos
   distintos; el wrapper solo pierde `import.meta.url` en build (por eso
   `base` importa).
3. "Download PDF" descarga un PDF válido (carga `fountain-pdf.wasm` on-demand;
   con preload, ya estará). Probar también con red lenta/offline: el preload
   fallido no debe romper la UI.
4. `npm run typecheck` (`tsc --noEmit`) y `npm run build` limpios con el vendor
   (verificar el gotcha de §3).
5. StrictMode: `window.__fountainBoots === 1` en consola.
6. Recargar la página y comprobar que los guiones persisten; importar/exportar
   un `.fountain` y re-parsear. Cerrar la pestaña inmediatamente tras escribir
   y confirmar que el `flush` no perdió texto.
7. Toggle de tema: persiste tras recarga y los componentes shadcn (dialog,
   dropdown, sonner) respetan ambos temas. Inspeccionar que ningún `var()` de
   shadcn queda sin resolver.
8. **a11y**: navegación por teclado (Tab/Shift+Tab) por toolbar y navigator,
   `aria-label` en botones-icono, foco visible con `--ring`, y que los
   diálogos de Radix atrapen/restauren el foco.
9. `npm run lint` y `npm run format:check` limpios (§10).

## 10. Calidad (lint, formato, tests, CI)

Depende de: §2; sus comandos (`lint`, `typecheck`, `test`, `format:check`) se
usan en §9 y en la verificación de cada fase.

- Scripts en `package.json`:
  ```json
  {
    "lint": "eslint .",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  }
  ```
- **ESLint** (flat config `eslint.config.js`) con `typescript-eslint` +
  `react-hooks` + `react-refresh`; `eslint-config-prettier` al final para no
  pelear con el formateador. `prettier` sin config salvo `semi`/`singleQuote`
  si se quiere fijar.
- **Tests unitarios (Vitest)** de la lógica pura, que es donde está el riesgo:
  - `store/` (reducer: crear/renombrar/borrar/seleccionar, migración de clave
    `v1`, `QuotaExceededError` y `JSON.parse` corrupto con un mock de
    `localStorage`).
  - helpers de export/import (saneado de nombre, mime, extensión).
  - render del preview a partir de un `Document` de fixture (usa los
    `testdata/` del parser como referencia).
- **Tests de integración (Playwright)**, heredando el patrón de
  `web/vite/tests` + `playwright.config.mjs`: boot único, parse, exportar PDF
  y persistencia. En CI corren headless.
- **CI** (GitHub Actions) para el MVP web, antes de considerar Fase 2:
  `npm ci` → `npm run sync` → `npm run lint` → `npm run typecheck` →
  `npm run test` → `npm run build`. `sync` es obligatorio porque `src/vendor/`
  está gitignoreado; el runner necesita Go para `make dist` (o cachear/descargar
  el bundle del parser). Documentar esa dependencia en el workflow.
- **Convención de commits** (`feat:`, `fix:`, `chore:`...) y un `AGENTS.md`
  con los comandos de §10 para que las siguientes fases los reutilicen.

## Riesgos ya cubiertos por el repo

- Importar el `.mjs` desde `public/` → Vite lo rechaza; de ahí wrapper en
  `src/vendor/`.
- `wasm_exec.js` debe coincidir con la toolchain → siempre vía `make
  package`, nunca a mano.
- Una sola instancia por documento (sin `dispose()`); `Symbol.for` lo
  garantiza.

## Verificación §9 — ejecutada 2026-10-02 (resultado: PASS)

Entorno: `npm run dev` (:5173) + `vite preview` (:4173 tras `npm run build`),
Chrome headless 153 por CDP. En Brave visible con la ventana ocluida el
`requestAnimationFrame` no dispara nunca (pestaña "visible" pero sin frames
del compositor) y el preview queda en "Cargando motor…": artefacto del
entorno, no bug — con rAF activo todo renderiza.

- 9.0 `npm run sync` OK (2 wasm + `wasm_exec.js` + `manifest.json`, tamaños
  según §5); `public/fountain` sin `fountain.mjs`; `src/vendor/*.mjs/.d.mts`.
- 9.1 dev: boot a `ready` (sin chip; ver REVIEW punto 1), `./fountain/fountain-parser.wasm` 200
  `application/wasm`, wrapper desde el bundle (nunca `public/`), preload
  `fountain-pdf.wasm` en idle verificado en red.
- 9.2 build+preview: idéntico a dev (`boots===1`, 18 elementos, 2 pág.,
  rutas relativas).
- 9.3 `Brick & Steel.pdf` 37 KB `%PDF-1.3`; con `fountain-pdf.wasm`
  bloqueado la UI no rompe (reintentos, sin crash).
- 9.4 `tsc --noEmit` + `build` limpios. 9.5 `__fountainBoots === 1`.
- 9.6 debounce guarda (`guion.scripts.v1`), reload persiste, JSON corrupto
  → boot sano con seed. 9.7 toggle persiste (`guion.theme.v1`) tras reload.
- 9.8 0 botones-icono sin `aria-label`, `tablist` + `aria-live="polite"` OK,
  `--ring` ámbar; trap de foco = default Radix (sin override propio).
- 9.9 `lint` + `format:check` limpios (se ignoran `.agents/`,
  `test-results/`, `playwright-report/` por ser artefactos externos).

## Calidad §10 — implementada 2026-10-02

- Unit (36 tests): `store/` + `lib/scripts` (existentes) + nuevo
  `src/features/preview/Preview.test.tsx` (fixture `Document`: portada,
  slugline, inline/fallback, dual, note, boneyard omitido, `-- Page 2 --`).
  `vite.config.ts` excluye `tests/**` de vitest (los e2e son de playwright).
- E2E (`tests/e2e.spec.ts`, `test:e2e`): boot único, edición→preview,
  descarga PDF, persistencia tras reload — 4/4 en Chromium headless.
  Ojo: usar `textarea:visible` / `article` (el layout móvil oculto rompe
  `.first()` en viewport desktop).
- CI (`.github/workflows/ci.yml`): clona el parser
  (`PARSER_REPO`/`PARSER_REF`) al path hermano que `sync` espera, Go 1.24 +
  Node 20 con caché, `ci → sync → lint → typecheck → test → playwright
  install → test:e2e → build`.

## Fase 2 — Post-MVP (opcional): empaquetado nativo (Tauri + Capacitor)

No forma parte del flujo MVP; se aborda una vez verificado §9.

El build web (`npm run build` → `dist/`) se empaqueta dos veces más sin
duplicar código:

- **Desktop (Windows/Linux/macOS)**: Tauri v2. WebView del sistema
  (WebView2 / WebKitGTK / WKWebView) → el Go WASM corre igual que en
  Chrome. Binario ~5-10 MB + instalador.
- **Android**: Capacitor. WebView de Android soporta WASM; genera APK/AAB
  con `cap sync android` + gradle.

### Cambios requeridos en el plan web

1. **`base` del runtime**: ya es relativa (`'./fountain'`) desde §4, así que no
   hay cambio pendiente; solo **verificar** que sigue en pie en
   dev + `vite preview` + `tauri dev` + Android (la raíz absoluta `'/fountain'`
   no existe en `tauri://localhost` ni `https://localhost`).
2. **Abstracción de archivos** (`src/platform/files.ts`):
   - Web: exportar = Blob + `a[download]`; importar = `<input type=file>`.
   - Tauri: plugins `@tauri-apps/plugin-dialog` + `plugin-fs`
     (`save`/`open` nativos).
   - Android: Capacitor `Filesystem` + `Share` (guardar PDF en
     Documents/Descargas o compartir hoja nativa).
   - Detectar plataforma una vez (`isTauri()`, `Capacitor.isNativePlatform()`)
     y elegir implementación detrás de una interfaz que no mezcle ruta con
     contenido (en web no hay ruta, en nativo sí):
     ```ts
     interface PlatformFiles {
       saveFile(bytes: Uint8Array, name: string, mime: string): Promise<void>
       pickFile(): Promise<{ name: string; text: string } | null>
     }
     ```
3. **Persistencia**: localStorage ya funciona en ambos webviews; sin cambios.
   Opcional: migrar a `tauri-plugin-store`/Filesystem si se quieren
   backups de guiones fuera del webview. El `QuotaExceededError` de §6 aplica
   igual en webviews.
4. **PDF en frío**: mantener el preload en idle con el fallback de §5; en móvil
   medir antes de precargar el `fountain-pdf.wasm` (~6.5 MiB, ver §5) por
   data entry / batería.

### Scaffold

```bash
npm i -D @tauri-apps/cli @capacitor/core
npx tauri init            # src-tauri/, apunta a dist/
npx cap init && npx cap add android
```

- `tauri.conf.json`: `frontendDist: "../dist"`, `devUrl: http://localhost:5173`.
- `capacitor.config.ts`: `webDir: 'dist'`.
- Scripts: `"tauri": "tauri"`, `"android": "cap sync android && cap open android"`.

### Builds y CI

- `npm run tauri build` → instaladores `.msi`/`.deb`/`.AppImage`.
- `cd android && ./gradlew bundleRelease` → AAB para Play Store.
- CI: job Tauri (matrix windows/ubuntu) + job Android (gradle) que reutilizan
  el `dist/` del job web. Requiere Rust toolchain + Android SDK en runners.

### Riesgos

- WebKitGTK en Linux: verificar soporte WASM/`Symbol.for`/`wasm-unsafe-eval`
  (equivale a CSP; en Tauri no hay CSP por defecto en dev).
- Android WebView antiguo (<Chrome 80): exigible `minSdkVersion` 24+ y
  degradar con mensaje si `WebAssembly` no existe.
- Tamaño: `fountain-pdf.wasm` (~6.5 MiB) infla APK/instalador; aceptable,
  pero considerar comprimir (brotli ya lo hace el servidor en web).

