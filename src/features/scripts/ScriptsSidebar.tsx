// src/features/scripts/ScriptsSidebar.tsx — lista de guiones (§6).
//
// Crear, renombrar, borrar (con `dialog` de confirmación) y seleccionar el
// guion activo; importar/exportar `.fountain`. Todo el estado viene de
// `useScripts()` — aquí no hay `localStorage`.

import { useState } from 'react'
import { toast } from 'sonner'
import { Download, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { useScripts } from '@/hooks/useScripts'
import type { Script } from '@/types/Script'
import { AboutDialog } from './AboutDialog'
import { ImportButton } from './ImportButton'
import { exportScript } from './scriptFiles'

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function ScriptsSidebar({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean
  onNavigate?: () => void
}) {
  const {
    scripts,
    activeId,
    requestCreateScript,
    renameScript,
    removeScript,
    selectScript,
  } = useScripts()
  const [renameTarget, setRenameTarget] = useState<Script | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Script | null>(null)
  const [draft, setDraft] = useState('')

  const openRename = (s: Script) => {
    setDraft(s.title)
    setRenameTarget(s)
  }

  const commitRename = () => {
    if (!renameTarget) return
    const title = draft.trim()
    if (title === '') return
    renameScript(renameTarget.id, title)
    setRenameTarget(null)
  }

  const commitDelete = () => {
    if (!deleteTarget) return
    removeScript(deleteTarget.id)
    toast.success('Guion borrado', { description: deleteTarget.title })
    setDeleteTarget(null)
  }

  const handleSelect = (id: string) => {
    selectScript(id)
    onNavigate?.()
  }

  const handleCreate = () => {
    requestCreateScript()
    onNavigate?.()
  }

  if (collapsed) {
    return (
      <section
        aria-label="Guiones"
        className="flex h-full flex-col items-center gap-2 overflow-hidden"
      >
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleCreate}
          aria-label="Nuevo guion"
          title="Nuevo guion"
        >
          <Plus aria-hidden="true" />
        </Button>
        <ImportButton variant="ghost" size="icon-sm" />
        <AboutDialog variant="ghost" size="icon-sm" className="mt-auto" />
      </section>
    )
  }

  return (
    <section
      aria-label="Guiones"
      className="flex h-full flex-col gap-2 overflow-hidden"
    >
      <div className="flex items-center gap-2">
        <h2 className="text-[0.6875rem] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
          Guiones
          {scripts.length > 0 ? ` (${scripts.length})` : ''}
        </h2>
        <span className="ml-auto flex items-center gap-1">
          <ImportButton variant="ghost" size="icon-sm" />
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleCreate}
            aria-label="Nuevo guion"
          >
            <Plus aria-hidden="true" />
          </Button>
        </span>
      </div>

      {scripts.length === 0 ? (
        <p className="rounded-sm border border-border px-3 py-2 text-[0.8125rem] text-muted-foreground">
          Sin guiones. Crea uno o importa un `.fountain`.
        </p>
      ) : (
        <ScrollArea className="min-h-0 flex-1">
          <ul className="flex flex-col gap-1 pr-2">
            {scripts.map((s) => {
              const active = s.id === activeId
              return (
                <li key={s.id} className="flex items-stretch gap-1">
                  <button
                    type="button"
                    onClick={() => handleSelect(s.id)}
                    aria-current={active ? 'true' : undefined}
                    aria-label={`Abrir guion ${s.title}`}
                    className={`min-w-0 flex-1 rounded-sm border px-2 py-1.5 text-left outline-none transition-colors focus-visible:border-ring ${
                      active
                        ? 'border-border border-l-2 border-l-primary bg-accent'
                        : 'border-transparent hover:bg-accent/60'
                    }`}
                  >
                    <span className="block truncate text-[0.8125rem] font-medium">
                      {s.title}
                    </span>
                    <span className="block font-mono text-[10px] text-muted-foreground tabular-nums">
                      {formatDate(s.updatedAt)}
                    </span>
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Opciones del guion ${s.title}`}
                      >
                        <MoreHorizontal aria-hidden="true" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => openRename(s)}>
                        <Pencil aria-hidden="true" />
                        Renombrar
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => exportScript(s)}>
                        <Download aria-hidden="true" />
                        Exportar .fountain
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => setDeleteTarget(s)}
                      >
                        <Trash2 aria-hidden="true" />
                        Borrar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </li>
              )
            })}
          </ul>
        </ScrollArea>
      )}

      <Separator />
      <AboutDialog variant="outline" size="sm" className="w-full" />

      {/* Renombrar */}
      <Dialog
        open={renameTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renombrar guion</DialogTitle>
            <DialogDescription>
              El nombre también se usa para el archivo `.fountain` al exportar.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              commitRename()
            }}
            className="flex flex-col gap-4"
          >
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              aria-label="Título del guion"
              maxLength={120}
              autoFocus
            />
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setRenameTarget(null)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={draft.trim() === ''}>
                Guardar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmar borrado */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Borrar guion</DialogTitle>
            <DialogDescription>
              Se borrará “{deleteTarget?.title}” de este navegador. Esta acción
              no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={commitDelete}>
              <Trash2 aria-hidden="true" />
              Borrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
