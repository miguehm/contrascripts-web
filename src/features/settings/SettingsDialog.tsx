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
import { Separator } from '@/components/ui/separator'
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
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Ajustes</DialogTitle>
          <DialogDescription>
            Preferencias de apariencia, editor y vista previa. Se guardan en
            este navegador.
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-col gap-4 sm:flex-row">
          <nav
            aria-label="Secciones de ajustes"
            className="flex shrink-0 gap-1 overflow-x-auto sm:w-40 sm:flex-col sm:overflow-visible"
          >
            {SECTIONS.map(({ id, label, Icon }) => {
              const active = section === id
              return (
                <Button
                  key={id}
                  type="button"
                  variant={active ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setSection(id)}
                  aria-current={active ? 'true' : undefined}
                  className="justify-start"
                >
                  <Icon aria-hidden="true" />
                  {label}
                </Button>
              )
            })}
          </nav>
          <Separator
            orientation="vertical"
            className="hidden self-stretch sm:block"
          />
          <Separator className="sm:hidden" />
          <ScrollArea className="max-h-[50vh] min-h-0 flex-1 pr-4 sm:max-h-[380px]">
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
