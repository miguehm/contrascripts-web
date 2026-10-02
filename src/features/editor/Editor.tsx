// src/features/editor/Editor.tsx — editor Fountain v1 (§5).
//
// `<textarea>` controlado a propósito: CodeMirror 6 queda como evolución
// y el swap será local a este componente. Fuente mono (Courier Prime,
// token `--font-mono`) y caret ámbar según `design/design.dark.md`.

interface EditorProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

export function Editor({ value, onChange, disabled = false }: EditorProps) {
  return (
    <label htmlFor="fountain-editor" className="flex h-full flex-col gap-2">
      <span className="text-[0.6875rem] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
        Fountain
      </span>
      <textarea
        id="fountain-editor"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        spellCheck={false}
        placeholder="INT. CASA - DÍA&#10;&#10;Escribe tu guion en Fountain…"
        className="min-h-0 flex-1 resize-none rounded-sm border border-input bg-card p-4 font-mono text-base leading-[1.625rem] text-card-foreground outline-none placeholder:text-muted-foreground/60 focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50"
      />
    </label>
  )
}
