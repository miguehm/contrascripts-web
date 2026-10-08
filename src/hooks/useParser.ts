// src/hooks/useParser.ts — boot del runtime + parse/lint reactivo (§5).
//
// - Boot: `loadFountain()` una vez, con flag `alive` para no setear estado
//   tras desmontar; `retry` reintenta tras un error.
// - Parse/lint: síncronos y bloquean el main thread, así que se colapsan
//   con rAF. Se guarda el id del frame y se cancela con él (el fixture
//   hacía `cancelAnimationFrame(0)`, que no cancela nada).
// - Tras el boot, precarga del PDF en idle para que el primer export no
//   cargue `fountain-pdf.wasm` (~6.5 MiB) en frío. El `.catch` evita un
//   unhandled rejection; el siguiente export reintenta igual.

import { useCallback, useEffect, useRef, useState } from 'react'
import { loadFountain, type Fountain } from '@/fountain'
import type { Document, Warning } from '@/vendor/fountain.mjs'
import type { BootStatus } from '@/types/ParseResult'

export interface ParserState {
  status: BootStatus
  fountain: Fountain | null
  doc: Document | null
  warnings: Warning[]
  bootError: string | null
  retry: () => void
}

function preloadPdfInIdle(fountain: Fountain): void {
  const idle = () => {
    if (!fountain.pdfLoaded()) fountain.preloadPDF().catch(() => {})
  }
  if (
    typeof window !== 'undefined' &&
    typeof window.requestIdleCallback === 'function'
  ) {
    window.requestIdleCallback(idle, { timeout: 3000 })
  } else {
    setTimeout(idle, 1500) // fallback Safari
  }
}

export function useParser(text: string): ParserState {
  const [status, setStatus] = useState<BootStatus>('booting')
  const [fountain, setFountain] = useState<Fountain | null>(null)
  const [doc, setDoc] = useState<Document | null>(null)
  const [warnings, setWarnings] = useState<Warning[]>([])
  const [bootError, setBootError] = useState<string | null>(null)
  const bootSeq = useRef(0)

  // Solo suscribe al boot (los setState viven en callbacks async).
  const startBoot = useCallback(() => {
    // Guardia WebView antiguo (Capacitor, minSdk 24): sin WebAssembly el
    // runtime Go no puede arrancar; mensaje explícito en vez de un fallo
    // críptico del fetch/instantiate. El preload de §5 queda intacto.
    // setState síncrono en el efecto de montaje a propósito: es el estado
    // inicial de error, no una sincronización derivada.
    if (typeof WebAssembly === 'undefined') {
      setBootError('Este WebView no soporta WebAssembly (se exige Chrome 80+)')
      setStatus('error')
      return () => {}
    }
    const seq = ++bootSeq.current
    let alive = true
    loadFountain().then(
      (f) => {
        if (!alive || seq !== bootSeq.current) return
        setFountain(f)
        setStatus('ready')
        preloadPdfInIdle(f)
      },
      (err: unknown) => {
        if (!alive || seq !== bootSeq.current) return
        setBootError(err instanceof Error ? err.message : String(err))
        setStatus('error')
      },
    )
    return () => {
      alive = false
    }
  }, [])

  // Reintento manual (event handler: setState síncrono permitido).
  const boot = useCallback(() => {
    setStatus('booting')
    setBootError(null)
    startBoot()
  }, [startBoot])

  // Boot en montaje. Incluye el setState síncrono de la guardia
  // WebAssembly (estado inicial de error, no sincronización derivada).
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => startBoot(), [startBoot])

  // Parse/lint reactivo colapsado con rAF.
  useEffect(() => {
    if (!fountain) return
    let queued = true
    const id = requestAnimationFrame(() => {
      queued = false
      try {
        setDoc(fountain.parse(text))
        setWarnings(fountain.lint(text))
      } catch {
        // Un texto roto no debe tumbar la UI: se conserva el doc anterior.
      }
    })
    return () => {
      if (queued) cancelAnimationFrame(id)
      queued = false
    }
  }, [fountain, text])

  return { status, fountain, doc, warnings, bootError, retry: boot }
}
