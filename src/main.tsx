import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ScriptsProvider } from './store/ScriptsProvider.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ScriptsProvider>
      <App />
    </ScriptsProvider>
  </StrictMode>,
)
