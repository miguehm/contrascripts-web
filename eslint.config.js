import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig } from 'eslint/config'
import prettier from 'eslint-config-prettier'
import tseslint from 'typescript-eslint'

export default defineConfig(
  { ignores: ['dist', 'src/vendor', 'public/fountain', 'src-tauri/target'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  reactHooks.configs.flat.recommended,
  reactRefresh.configs.vite,
  prettier,
  // shadcn/ui exporta variants (cva) junto a componentes; es código generado.
  {
    files: ['src/components/ui/**'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
  // scripts/sync.mjs corre en Node (fase §3); sin el paquete `globals`,
  // declarar las dos globales que usa.
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: { console: 'readonly', process: 'readonly' },
    },
  },
)
