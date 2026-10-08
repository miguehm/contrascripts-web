// src/features/settings/sections/BackupSection.tsx — sección Copias de
// seguridad (REVIEW.md punto 12).
//
// Copia única `.json` + papelera 30 días. Patrón visual de `AppearanceSection`:
// título, descripción y acciones. El estado viene de `useScripts()`; la fecha
// de última copia de `store/backupStorage.ts` (solo `store/` toca
// `localStorage`, AGENTS.md nº2).

import { useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Download, Trash2, Undo2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { useScripts } from '@/hooks/useScripts'
import { getPlatformFiles, isTauri } from '@/platform/files'
import { loadLastBackup, saveLastBackup } from '@/store/backupStorage'
import type { Script } from '@/types/Script'
import {
  dedupeIds,
  downloadBackup,
  parseBackup,
} from '@/features/scripts/backup'

const REMINDER_MS = 14 * 24 * 60 * 60 * 1000

/** Palabra de confirmación del borrado definitivo (mayúsculas, exacta). */
export const PURGE_CONFIRM_WORD = 'BORRAR'

function formatKB(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`
}

export function BackupSection() {
  const { scripts, trash, restoreScript, purgeScript, importManyScripts } =
    useScripts()
  const [lastBackup, setLastBackup] = useState<number | null>(() =>
    loadLastBackup(),
  )
  // Foto del "ahora" al abrir la sección (los hooks/componentes deben ser
  // puros: nada de `Date.now()` durante el render).
  const [now] = useState(() => Date.now())
  const fileRef = useRef<HTMLInputElement>(null)
  // `busy` cubre el diálogo nativo (Tauri); en web el input es síncrono.
  const [busy, setBusy] = useState(false)
  const isTauriNative = isTauri()
  // Borrado definitivo con confirmación: objetivo + texto escrito.
  const [purgeTarget, setPurgeTarget] = useState<Script | null>(null)
  const [confirmText, setConfirmText] = useState('')
  const purgeMatches =
    purgeTarget !== null && confirmText.trim() === PURGE_CONFIRM_WORD

  const openPurge = (script: Script) => {
    setConfirmText('')
    setPurgeTarget(script)
  }

  const closePurge = () => {
    setPurgeTarget(null)
    setConfirmText('')
  }

  const commitPurge = () => {
    if (!purgeMatches || !purgeTarget) return
    const { id, title } = purgeTarget
    purgeScript(id)
    toast.success('Eliminado definitivo', { description: title })
    closePurge()
  }

  const size = useMemo(
    () => new Blob([JSON.stringify(scripts)]).size,
    [scripts],
  )
  const daysSince = useMemo(() => {
    if (lastBackup === null) return null
    return Math.floor((now - lastBackup) / (24 * 60 * 60 * 1000))
  }, [lastBackup, now])

  const handleExport = async () => {
    if (scripts.length === 0) {
      toast.info('Sin guiones que copiar')
      return
    }
    try {
      await downloadBackup(scripts)
      const now = Date.now()
      saveLastBackup(now)
      setLastBackup(now)
      toast.success('Copia exportada', {
        description: `${scripts.length} guion(es) en un .json.`,
      })
    } catch (err) {
      toast.error('No se pudo exportar la copia', {
        description: err instanceof Error ? err.message : String(err),
      })
    }
  }

  const importBackupText = (raw: string) => {
    const { scripts: parsed, dropped } = parseBackup(raw)
    if (parsed.length === 0) {
      toast.error('La copia no contiene guiones válidos', {
        description:
          dropped > 0 ? `${dropped} elemento(s) descartados.` : undefined,
      })
      return
    }
    const existing = new Set(scripts.map((s) => s.id))
    importManyScripts(dedupeIds(parsed, existing))
    toast.success('Copia importada', {
      description:
        `${parsed.length} guion(es).` +
        (dropped > 0 ? ` ${dropped} descartado(s).` : ''),
    })
  }

  const handleImportFile = async (files: FileList | null) => {
    const file = files?.[0]
    if (!file) return
    try {
      importBackupText(await file.text())
    } catch (err) {
      toast.error('No se pudo importar la copia', {
        description: err instanceof Error ? err.message : String(err),
      })
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  /** Importar copia: diálogo nativo en Tauri, input oculto en web. */
  const handleImportClick = async () => {
    if (busy) return
    if (!isTauriNative) {
      fileRef.current?.click()
      return
    }
    setBusy(true)
    try {
      const picked = await getPlatformFiles().pickTextFile({
        title: 'Importar copia',
        filters: [{ name: 'JSON', extensions: ['json'] }],
      })
      if (picked) importBackupText(picked.text)
    } catch (err) {
      toast.error('No se pudo importar la copia', {
        description: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-[0.8125rem] font-semibold">Copias de seguridad</h3>
        <p className="text-[0.8125rem] text-muted-foreground">
          Tus guiones viven en este navegador. Exporta una copia `.json` de vez
          en cuando para no perderlos al limpiar datos o cambiar de equipo.
        </p>
      </div>

      <p
        aria-live="polite"
        className="font-mono text-[11px] text-muted-foreground tabular-nums"
      >
        {scripts.length} guion(es) · {formatKB(size)}
        {lastBackup === null
          ? ' · aún sin copias'
          : ` · última copia hace ${daysSince === 0 ? 'menos de un día' : `${daysSince} día(s)`}`}
      </p>
      {lastBackup !== null && now - lastBackup > REMINDER_MS && (
        <p className="rounded-sm border border-border px-3 py-2 text-[0.8125rem] text-muted-foreground">
          Hace más de 14 días sin copia. Exporta una para estar cubierto.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={() => void handleExport()}
          disabled={scripts.length === 0}
        >
          <Download aria-hidden="true" />
          Exportar copia (.json)
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void handleImportClick()}
          disabled={busy}
        >
          <Upload aria-hidden="true" />
          Importar copia
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          aria-label="Importar copia (.json)"
          className="hidden"
          tabIndex={-1}
          onChange={(e) => void handleImportFile(e.target.files)}
        />
      </div>

      <Separator />

      <div className="flex flex-col gap-2">
        <h4 className="text-[0.8125rem] font-semibold">
          Papelera {trash.length > 0 ? `(${trash.length})` : ''}
        </h4>
        <p className="text-[0.8125rem] text-muted-foreground">
          Los guiones borrados se conservan 30 días.
        </p>
        {trash.length === 0 ? (
          <p className="text-[0.8125rem] text-muted-foreground">
            Papelera vacía.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {trash.map(({ script, deletedAt }) => (
              <li
                key={script.id}
                className="flex items-center gap-2 rounded-sm border border-transparent px-2 py-1.5 hover:bg-accent/60"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.8125rem] font-medium">
                    {script.title}
                  </span>
                  <span className="block font-mono text-[10px] text-muted-foreground tabular-nums">
                    borrado el{' '}
                    {new Date(deletedAt).toLocaleDateString(undefined, {
                      day: '2-digit',
                      month: 'short',
                    })}
                  </span>
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    restoreScript(script.id)
                    toast.success('Guion restaurado', {
                      description: script.title,
                    })
                  }}
                  aria-label={`Restaurar ${script.title}`}
                >
                  <Undo2 aria-hidden="true" />
                  Restaurar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openPurge(script)}
                  aria-label={`Borrar definitivamente ${script.title}`}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 aria-hidden="true" />
                  Borrar definitivamente
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Borrado definitivo con palabra de confirmación (punto 12) */}
      <Dialog
        open={purgeTarget !== null}
        onOpenChange={(open) => {
          if (!open) closePurge()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Borrar definitivamente</DialogTitle>
            <DialogDescription>
              “{purgeTarget?.title}” se eliminará para siempre y no se podrá
              recuperar. Escribe {PURGE_CONFIRM_WORD} para confirmar.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              commitPurge()
            }}
            className="flex flex-col gap-4"
          >
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              aria-label="Escribe BORRAR para confirmar"
              placeholder={PURGE_CONFIRM_WORD}
              maxLength={120}
              autoComplete="off"
              autoFocus
            />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={closePurge}>
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={!purgeMatches}
              >
                <Trash2 aria-hidden="true" />
                Borrar definitivamente
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
