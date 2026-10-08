// src/features/scripts/ImportButton.tsx — importar `.fountain`/`.txt` (§6).
//
// Detrás del mismo botón shadcn: en Tauri diálogo nativo con filtros, en
// Capacitor picker sin filtro (Android no conoce `.fountain`; la puerta es
// `isImportableName` con toast), en web `<input type="file">` oculto (vía
// `src/platform/files.ts`). Al elegir archivo lo añade como guion nuevo
// con el nombre del archivo como título. Reutilizable en sidebar (desktop)
// y barra compacta (móvil).

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useScripts } from '@/hooks/useScripts'
import { getPlatformFiles, isCapacitorNative, isTauri } from '@/platform/files'
import { IMPORT_FILTERS, isImportableName, titleForImport } from './scriptFiles'

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
  const [busy, setBusy] = useState(false)

  const importPicked = (name: string, text: string) => {
    const { title } = titleForImport(name, text)
    importScript(title, text)
    toast.success('Guion importado', { description: title })
  }

  const onPickWeb = async (files: FileList | null) => {
    const file = files?.[0]
    if (!file) return
    try {
      if (!isImportableName(file.name)) {
        toast.error('Tipo de archivo no soportado', {
          description: 'Solo se aceptan .fountain y .txt',
        })
        return
      }
      importPicked(file.name, await file.text())
    } catch (err) {
      toast.error('No se pudo importar el archivo', {
        description: err instanceof Error ? err.message : String(err),
      })
    } finally {
      // Permite reimportar el mismo archivo dos veces seguidas.
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  /** Importar vía `PlatformFiles` (Tauri y Capacitor nativo). */
  const onPickNative = async () => {
    setBusy(true)
    try {
      // En Capacitor sin `filters`: el WebView no puede filtrar por
      // `.fountain` (MIME desconocido en Android) y la puerta es
      // `isImportableName`; en Tauri los filtros sí aplican al diálogo.
      const picked = await getPlatformFiles().pickTextFile(
        isCapacitorNative()
          ? { title: 'Importar guion' }
          : { title: 'Importar guion', filters: IMPORT_FILTERS },
      )
      if (!picked) return
      if (!isImportableName(picked.name)) {
        toast.error('Tipo de archivo no soportado', {
          description: 'Solo se aceptan .fountain y .txt',
        })
        return
      }
      importPicked(picked.name, picked.text)
    } catch (err) {
      toast.error('No se pudo importar el archivo', {
        description: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setBusy(false)
    }
  }

  const onClick = async () => {
    if (busy) return
    // Nativo (Tauri o Capacitor): diálogo/picker de la plataforma.
    // Web: el input oculto conserva el flujo actual (chooser del navegador).
    if (isTauri() || isCapacitorNative()) {
      await onPickNative()
      return
    }
    fileRef.current?.click()
  }

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept=".fountain,.txt"
        aria-label="Importar guion (.fountain, .txt)"
        className="hidden"
        tabIndex={-1}
        onChange={(e) => void onPickWeb(e.target.files)}
      />
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={() => void onClick()}
        disabled={busy}
        aria-label="Importar guion (.fountain, .txt)"
      >
        <Upload aria-hidden="true" />
        {size === 'icon-sm' ? null : label}
      </Button>
    </>
  )
}
