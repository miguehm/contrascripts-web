// src/features/scripts/ImportButton.tsx — importar `.fountain`/`.txt` (§6).
//
// `<input type="file">` oculto + botón shadcn. Al elegir archivo lo lee
// como texto y lo añade como guion nuevo con el nombre del archivo como
// título. Reutilizable en sidebar (desktop) y barra compacta (móvil).

import { useRef } from 'react'
import { toast } from 'sonner'
import { Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useScripts } from '@/hooks/useScripts'
import { IMPORT_ACCEPT, readImportFile } from './scriptFiles'

interface ImportButtonProps {
  variant?: 'default' | 'outline' | 'ghost' | 'secondary'
  size?: 'default' | 'xs' | 'sm' | 'icon-sm'
  className?: string
  label?: string
}

export function ImportButton({
  variant = 'outline',
  size = 'sm',
  className,
  label = 'Importar',
}: ImportButtonProps) {
  const { importScript } = useScripts()
  const fileRef = useRef<HTMLInputElement>(null)

  const onPick = async (files: FileList | null) => {
    const file = files?.[0]
    if (!file) return
    try {
      const { title, text } = await readImportFile(file)
      importScript(title, text)
      toast.success('Guion importado', { description: title })
    } catch (err) {
      toast.error('No se pudo importar el archivo', {
        description: err instanceof Error ? err.message : String(err),
      })
    } finally {
      // Permite reimportar el mismo archivo dos veces seguidas.
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept={IMPORT_ACCEPT}
        aria-label="Importar guion (.fountain, .txt)"
        className="hidden"
        onChange={(e) => void onPick(e.target.files)}
      />
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={() => fileRef.current?.click()}
        aria-label="Importar guion (.fountain, .txt)"
      >
        <Upload aria-hidden="true" />
        {size === 'icon-sm' ? null : label}
      </Button>
    </>
  )
}
