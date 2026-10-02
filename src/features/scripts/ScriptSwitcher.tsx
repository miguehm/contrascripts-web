// src/features/scripts/ScriptSwitcher.tsx — selector compacto para móvil (§6).
//
// En desktop la sidebar cubre crear/seleccionar; en móvil (<md) no cabe,
// así que el header usa este dropdown + botones de nuevo e importar.

import { useState } from 'react'
import { Check, ChevronDown, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useScripts } from '@/hooks/useScripts'
import { ImportButton } from './ImportButton'

export function ScriptSwitcher() {
  const { scripts, activeId, activeScript, createScript, selectScript } =
    useScripts()
  const [open, setOpen] = useState(false)

  return (
    <span className="flex min-w-0 items-center gap-1">
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Cambiar de guion"
            className="min-w-0 max-w-36"
          >
            <span className="truncate">
              {activeScript?.title ?? 'Sin guiones'}
            </span>
            <ChevronDown aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-w-64">
          {scripts.map((s) => (
            <DropdownMenuItem
              key={s.id}
              onSelect={() => selectScript(s.id)}
              aria-current={s.id === activeId ? 'true' : undefined}
            >
              <span className="min-w-0 flex-1 truncate">{s.title}</span>
              {s.id === activeId ? <Check aria-hidden="true" /> : null}
            </DropdownMenuItem>
          ))}
          {scripts.length > 0 ? <DropdownMenuSeparator /> : null}
          <DropdownMenuItem
            onSelect={() => {
              createScript()
              setOpen(false)
            }}
          >
            <Plus aria-hidden="true" />
            Nuevo guion
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => createScript()}
        aria-label="Nuevo guion"
      >
        <Plus aria-hidden="true" />
      </Button>
      <ImportButton variant="ghost" size="icon-sm" />
    </span>
  )
}
