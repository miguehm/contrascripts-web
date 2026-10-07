// src/features/settings/AboutContent.tsx — contenido de "Acerca de"
// (REVIEW.md punto 9).
//
// Extraído de `AboutDialog`: cuerpo puro sin trigger ni modal, para
// reutilizarlo como sección dentro de `SettingsDialog`. Sin store ni
// localStorage.

function getAppVersion(): string {
  try {
    if (typeof __APP_VERSION__ !== 'undefined' && __APP_VERSION__) {
      return __APP_VERSION__
    }
  } catch {
    // Sin define (p. ej. test sin vite): cae al valor por defecto.
  }
  return '0.0.0'
}

export function AboutContent() {
  const version = getAppVersion()

  return (
    <div className="flex flex-col gap-2 text-[0.8125rem] text-muted-foreground">
      <p className="text-[0.6875rem] font-semibold tracking-[0.06em] uppercase">
        Contrascripts
      </p>
      <p>Editor de guiones Fountain (Vite/React + TS + WASM).</p>
      <p className="font-mono text-xs tabular-nums">v{version}</p>
      <p>
        Motor fountain-parser (Go/WASM) en Web Worker + raster con pdf.js: lo
        que ves es lo que se exporta.
      </p>
      <p>
        Privacidad: nada se sube a ningún servidor. Todo —análisis, PDF y
        guardado— se procesa en este navegador.
      </p>
      <p>
        Atajo:{' '}
        <kbd className="rounded-sm border border-border px-1 font-mono text-[11px]">
          Ctrl
        </kbd>{' '}
        +{' '}
        <kbd className="rounded-sm border border-border px-1 font-mono text-[11px]">
          B
        </kbd>{' '}
        para colapsar el panel de guiones, y{' '}
        <kbd className="rounded-sm border border-border px-1 font-mono text-[11px]">
          F1
        </kbd>{' '}
        para abrir la ayuda de sintaxis Fountain.
      </p>
      <p>
        Licencia MIT — ver{' '}
        <a
          href="https://github.com/miguehm/contrascripts-web"
          target="_blank"
          rel="noreferrer"
        >
          repositorio
        </a>
        .
      </p>
    </div>
  )
}
