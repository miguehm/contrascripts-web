import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ThemeProvider } from './hooks/useTheme.tsx'
import { ScriptsProvider } from './store/ScriptsProvider.tsx'
import { PreferencesProvider } from './store/preferences.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <ScriptsProvider>
        <PreferencesProvider>
          <App />
        </PreferencesProvider>
      </ScriptsProvider>
    </ThemeProvider>
  </StrictMode>,
)
