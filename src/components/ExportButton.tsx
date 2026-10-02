// src/components/ExportButton.tsx — exportar PDF (§5).
//
// `renderPDF(text)` → `Uint8Array` → Blob `application/pdf` → descarga.
// Estado `busy` durante la renderización y errores por `sonner`.

import { useState } from 'react'
import { toast } from 'sonner'
import type { Fountain } from '@/vendor/fountain.mjs'
import { Button } from '@/components/ui/button'

interface ExportButtonProps {
  fountain: Fountain | null
  text: string
  filename?: string
}

export function ExportButton({
  fountain,
  text,
  filename = 'guion.pdf',
}: ExportButtonProps) {
  const [busy, setBusy] = useState(false)

  const handleExport = async () => {
    if (!fountain || busy) return
    setBusy(true)
    try {
      const bytes = await fountain.renderPDF(text)
      const blob = new Blob([bytes as unknown as BlobPart], {
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
      disabled={!fountain || busy}
      aria-label="Exportar PDF"
      className="h-8"
    >
      {busy ? 'Exportando…' : 'Exportar PDF'}
    </Button>
  )
}
