# AGENTS.md

Instrucciones para agentes/trabajo por fases (ver PLAN.md).

## Comandos

A partir de §2 (scaffold) y §3 (`sync`):

```bash
npm run dev           # sync + vite
npm run build         # sync + vite build
npm run preview       # servir dist/
npm run lint          # eslint .
npm run typecheck     # tsc --noEmit
npm run test          # vitest run
npm run test:watch    # vitest
npm run test:e2e       # playwright (boot, parse, PDF, persistencia)
npm run format        # prettier --write .
npm run format:check  # prettier --check .
npm run sync          # node scripts/sync.mjs (regenera public/fountain + src/vendor)
```

En CI: `npm ci` → `npm run sync` → `lint` → `typecheck` → `test` → `build`.
`sync` es obligatorio porque `src/vendor/` está gitignoreado; el runner
necesita Go para `make dist` (o bundle cacheado). Se documenta en el workflow (§10).

## Reglas

1. **Pinear versiones**: nada de `@latest` suelto salvo scaffold inicial;
   fijar `vite`, `react`, `react-dom` sin `^` tras el primer install.
2. **Persistencia centralizada**: solo `store/` toca `localStorage`
   (clave `contrascripts.scripts.v1`, tema `contrascripts.theme.v1`,
   legacy `guion.*.v1` migradas en lectura); componentes acceden vía hooks.
3. **`src/vendor/` es artefacto**: nunca editar a mano; regenerar con `npm run sync`.
4. **`base: './fountain'`** relativo desde §4; no usar `'/fountain'`.
5. **Commits**: convención `feat:`, `fix:`, `chore:`...
