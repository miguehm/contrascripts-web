import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.miguehm.contrascripts',
  appName: 'Contrascripts',
  webDir: 'dist',
  // Servido en https://localhost en Android: los assets absolutos de Vite
  // (sin `base`) resuelven contra la raíz igual que en Tauri, y el runtime
  // WASM ya usa base relativa './fountain' (§4 del PLAN.md). Se declara
  // explícito para que un cambio de default no rompa el boot.
  server: {
    androidScheme: 'https',
  },
}

export default config
