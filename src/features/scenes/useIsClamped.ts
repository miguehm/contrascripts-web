// src/features/scenes/useIsClamped.ts — ¿el texto desborda su caja?
//
// El fundido de continuación solo se muestra cuando el contenido realmente
// queda recortado (por `line-clamp-2` o `truncate`): medir evita el fundido
// falso que daría cualquier heurística de caracteres ante cambios de ancho
// (sidebar colapsable) o de fuente. Sin `ResizeObserver` (jsdom) se mide una
// vez y nunca se marca recorte.

import { useLayoutEffect, useRef, useState } from 'react'

/** `true` cuando `el` recorta contenido en cualquier eje. */
export function useIsClamped<T extends HTMLElement>(): [
  React.RefObject<T | null>,
  boolean,
] {
  const ref = useRef<T | null>(null)
  const [clamped, setClamped] = useState(false)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const check = () => {
      setClamped(
        el.scrollHeight > el.clientHeight + 1 ||
          el.scrollWidth > el.clientWidth + 1,
      )
    }
    check()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => ro.disconnect()
  })

  return [ref, clamped]
}
