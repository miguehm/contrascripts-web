// src/features/settings/SettingsDialog.tsx — menú de Ajustes (REVIEW.md 9).
//
// Sustituye a `AboutDialog` al pie del sidebar (mismo `variant/size` para
// encajar en el pie expandido `w-full` y en el rail `icon-sm`). Modal con
// navegación lateral por secciones (Apariencia / Editor / Vista previa /
// Acerca de); el propio About vive como sección. Estado efímero (sección
// activa); las prefs llegan por contexto (`useTheme`, `usePreferences`).

import { useState } from 'react'
import {
  FileText,
  Info,
  Palette,
  Settings as SettingsIcon,
  Type,
} from 'lucide-react'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { AboutContent } from './AboutContent'
import { AppearanceSection } from './sections/AppearanceSection'
import { EditorSection } from './sections/EditorSection'
import { PreviewSection } from './sections/PreviewSection'

type SectionId = 'appearance' | 'editor' | 'preview' | 'about'

const SECTIONS: { id: SectionId; label: string; Icon: typeof Info }[] = [
  { id: 'appearance', label: 'Apariencia', Icon: Palette },
  { id: 'editor', label: 'Editor', Icon: Type },
  { id: 'preview', label: 'Vista previa', Icon: FileText },
  { id: 'about', label: 'Acerca de', Icon: Info },
]

interface SettingsDialogProps {
  variant?: 'outline' | 'ghost'
  size?: 'sm' | 'icon-sm'
  className?: string
}

export function SettingsDialog({
  variant = 'outline',
  size = 'sm',
  className,
}: SettingsDialogProps) {
  const [open, setOpen] = useState(false)
  const [section, setSection] = useState<SectionId>('appearance')

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant={variant}
          size={size}
          className={className}
          aria-label="Ajustes"
          title="Ajustes"
        >
          <SettingsIcon aria-hidden="true" />
          {size === 'icon-sm' ? null : 'Ajustes'}
        </Button>
      </DialogTrigger>
      <DialogContent className="h-[min(34rem,85dvh)] grid-rows-[auto_minmax(0,1fr)] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-semibold">Ajustes</DialogTitle>
          <DialogDescription>
            Apariencia, editor, vista previa y más. Se guardan en este
            navegador.
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-col gap-4 overflow-hidden sm:flex-row">
          <nav
            aria-label="Secciones de ajustes"
            className="-mx-1 flex shrink-0 gap-1 overflow-x-auto rounded-md bg-muted/40 p-1 px-1 sm:mx-0 sm:w-44 sm:flex-col sm:overflow-visible"
          >
            {SECTIONS.map(({ id, label, Icon }) => {
              const active = section === id
              return (
                <Button
                  key={id}
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSection(id)}
                  aria-current={active ? 'true' : undefined}
                  className={cn(
                    'justify-start border-l-2 shrink-0',
                    active
                      ? 'border-l-primary bg-accent text-accent-foreground'
                      : 'border-l-transparent',
                  )}
                >
                  <Icon aria-hidden="true" />
                  {label}
                </Button>
              )
            })}
          </nav>
          <ScrollArea className="min-h-0 flex-1 pr-3">
            {section === 'appearance' && <AppearanceSection />}
            {section === 'editor' && <EditorSection />}
            {section === 'preview' && <PreviewSection />}
            {section === 'about' && <AboutContent />}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  )
}
