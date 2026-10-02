// src/components/ExportButton.tsx — exportar PDF.
//
// Descarga los últimos bytes generados por el worker del preview (caché del
// hook `usePdfPreview`): preview y descarga son el mismo PDF, sin un segundo
// render. Si aún no hay bytes (primer render en curso), el botón espera.

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

interface ExportButtonProps {
  bytes: Uint8Array | null
  filename?: string
}

export function ExportButton({
  bytes,
  filename = 'guion.pdf',
}: ExportButtonProps) {
  const [busy, setBusy] = useState(false)

  const handleExport = async () => {
    if (!bytes || busy) return
    setBusy(true)
    try {
      // Copia: el caché del hook sigue vivo para el siguiente preview.
      const blob = new Blob([bytes.slice().buffer as ArrayBuffer], {
        type: 'application/pdf',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success('PDF exportado')
    } catch (err) {
      toast.error('No se pudo exportar el PDF', {
        description: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button
      onClick={handleExport}
      disabled={!bytes || busy}
      aria-label="Exportar PDF"
      className="h-8"
    >
      {busy ? 'Exportando…' : 'Exportar PDF'}
    </Button>
  )
}
