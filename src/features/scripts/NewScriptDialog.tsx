// src/features/scripts/NewScriptDialog.tsx — modal "Nuevo guion" (§REVIEW-1).
//
// Vacío → usa la sugerencia aleatoria (`AdjetivoAnimal123`).
// Cancelar / X / Escape / overlay → no crea nada.

import { useState } from 'react'
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

interface Props {
  open: boolean
  suggestion: string
  onConfirm: (title: string) => void
  onOpenChange: (open: boolean) => void
}

export function NewScriptDialog({
  open,
  suggestion,
  onConfirm,
  onOpenChange,
}: Props) {
  const [draft, setDraft] = useState('')

  const confirm = () => {
    const title = draft.trim()
    onConfirm(title === '' ? suggestion : title)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo guion</DialogTitle>
          <DialogDescription>
            Si lo dejas vacío usaremos “{suggestion}”.
          </DialogDescription>
        </DialogHeader>
        <form
          // Remonta por sugerencia/apertura: draft limpio sin setState en efecto.
          key={`${suggestion}:${open}`}
          onSubmit={(e) => {
            e.preventDefault()
            confirm()
          }}
          className="flex flex-col gap-4"
        >
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={suggestion}
            aria-label="Nombre del guion"
            maxLength={120}
            autoFocus
          />
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit">Crear</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
