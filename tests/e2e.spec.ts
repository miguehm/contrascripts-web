// Tests de integración §10 (preview PDF): boot único, render en worker +
// raster con pdf.js, exportar PDF desde el caché y persistencia.
// El contenido del guion vive en <canvas>: se aserta por páginas
// (aria-label "Página N de M"), no por texto.
//
// El editor es CodeMirror (contenteditable `.cm-content`, no `<textarea>`):
// para escribir se hace click + seleccionar todo + `insertText` (una sola
// transacción, dispara `onChange` una vez).
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

async function writeScript(page: Page, text: string): Promise<void> {
  const editor = page.locator('.cm-content:visible')
  await editor.click()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.insertText(text)
}

/**
 * Línea del cursor en el editor *visible*.
 *
 * Hay dos editores montados a la vez (el móvil se oculta por CSS en desktop y
 * al revés), así que se filtra por el que tiene tamaño: leer el primero
 * mediría el oculto y el test pasaría o fallaría por casualidad.
 */
async function readCaretLine(page: Page): Promise<string> {
  return page.evaluate(() => {
    const active = Array.from(document.querySelectorAll('.cm-activeLine'))
    const visible = active.find((el) => el.getBoundingClientRect().width > 0)
    return visible?.textContent ?? ''
  })
}

/**
 * Punto del viewport donde hacer doble clic para caer sobre la primera línea
 * del guion (la cabecera de escena).
 *
 * El renderer coloca el primer elemento en el margen de la página: 1.5" desde
 * la izquierda y un poco más de 1" desde arriba, en fracciones del ancho/alto
 * de la hoja. Usar fracciones (no píxeles) lo hace independiente de la escala
 * y del ajuste al ancho.
 */
async function findFirstLinePoint(
  page: Page,
): Promise<{ x: number; y: number } | null> {
  const rect = await page.locator('[data-page]').first().boundingBox()
  if (!rect) return null
  return { x: rect.x + rect.width * 0.18, y: rect.y + rect.height * 0.096 }
}

test('boot único + preview PDF del seed', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('[data-engine-status="ready"]')).toBeVisible({
    timeout: 30_000,
  })
  expect(
    await page.evaluate(
      () => (window as unknown as Record<string, unknown>).__fountainBoots,
    ),
  ).toBe(1)
  // El seed de ejemplo renderiza a 3 páginas (worker + pdf.js de punta a punta).
  await expect(
    page.getByRole('document', { name: 'Guion en PDF, 3 páginas' }),
  ).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('img', { name: 'Página 1 de 3' })).toBeVisible({
    timeout: 30_000,
  })
})

test('editar actualiza el preview PDF', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('[data-engine-status="ready"]')).toBeVisible({
    timeout: 30_000,
  })
  await expect(page.getByRole('img', { name: /Página 1 de/ })).toBeVisible({
    timeout: 30_000,
  })
  // Texto largo que fuerza una segunda página: si el canvas la muestra, el
  // debounce + worker + pdf.js reaccionaron al cambio.
  const longText =
    'INT. CASA - DÍA\n\n' +
    'Línea de acción para rellenar la página.\n\n'.repeat(60)
  await writeScript(page, longText)
  // El gutter de CodeMirror confirma que el editor nuevo montó.
  await expect(page.locator('.cm-lineNumbers:visible')).toBeVisible()
  await expect(page.getByRole('img', { name: /Página 2 de/ })).toBeVisible({
    timeout: 30_000,
  })
})

test('exportar PDF descarga un PDF válido', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('[data-engine-status="ready"]')).toBeVisible({
    timeout: 30_000,
  })
  // Bytes listos: el botón se habilita al completar el primer render.
  await expect(page.getByRole('img', { name: /Página 1 de/ })).toBeVisible({
    timeout: 30_000,
  })
  const download = page.waitForEvent('download', { timeout: 30_000 })
  await page.getByRole('button', { name: /exportar/i }).click()
  const path = await (await download).path()
  expect(path).toBeTruthy()
})

test('pausar detiene el auto-preview y reanudar lo devuelve', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.locator('[data-engine-status="ready"]')).toBeVisible({
    timeout: 30_000,
  })
  await expect(page.getByRole('img', { name: /Página 1 de/ })).toBeVisible({
    timeout: 30_000,
  })
  await page.getByRole('button', { name: 'Pausar vista previa' }).click()
  await expect(
    page.getByRole('button', { name: 'Reanudar vista previa' }),
  ).toBeVisible()
  await expect(page.getByText('Actualizar ahora')).toBeVisible()
  await page.getByRole('button', { name: 'Reanudar vista previa' }).click()
  await expect(
    page.getByRole('button', { name: 'Pausar vista previa' }),
  ).toBeVisible()
})

test('preview desplegable: ocultar persiste y reabre', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('[data-engine-status="ready"]')).toBeVisible({
    timeout: 30_000,
  })
  await expect(page.getByRole('img', { name: /Página 1 de/ })).toBeVisible({
    timeout: 30_000,
  })
  // Oculta (hay dos botones "Ocultar": header + cabecera del preview).
  await page
    .getByRole('button', { name: 'Ocultar vista previa' })
    .first()
    .click()
  await expect(
    page.getByRole('button', { name: 'Mostrar vista previa' }),
  ).toBeVisible()
  await expect(
    page.getByRole('document', { name: /Guion en PDF/ }),
  ).toBeHidden()
  // El estado colapsado persiste tras recarga (clave guion.preview.v1).
  await page.reload()
  await expect(page.locator('[data-engine-status="ready"]')).toBeVisible({
    timeout: 30_000,
  })
  await expect(
    page.getByRole('button', { name: 'Mostrar vista previa' }),
  ).toBeVisible()
  // Reabre y el PDF vuelve sin recargar la página.
  await page.getByRole('button', { name: 'Mostrar vista previa' }).click()
  await expect(page.getByRole('img', { name: /Página 1 de/ })).toBeVisible({
    timeout: 30_000,
  })
})

test('ambos plegados: el editor hace scroll interno y el header queda fijo', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.locator('[data-engine-status="ready"]')).toBeVisible({
    timeout: 30_000,
  })
  await expect(page.getByRole('img', { name: /Página 1 de/ })).toBeVisible({
    timeout: 30_000,
  })
  // Normaliza estado: sidebar colapsado + preview oculto (rama monopanel).
  const collapseSidebar = page.getByRole('button', {
    name: 'Colapsar guiones',
  })
  if (await collapseSidebar.isVisible()) await collapseSidebar.click()
  const hidePreview = page
    .getByRole('button', { name: 'Ocultar vista previa' })
    .first()
  if (await hidePreview.isVisible()) await hidePreview.click()
  await expect(
    page.getByRole('button', { name: 'Mostrar vista previa' }),
  ).toBeVisible()

  // Guion largo que desbordaría la página si el editor creciera en altura.
  const longText =
    'INT. CASA - DÍA\n\n' +
    'Línea de acción para rellenar la página.\n\n'.repeat(120)
  await writeScript(page, longText)
  await expect(page.locator('.cm-lineNumbers:visible')).toBeVisible()
  // Fuerza scroll al final del editor.
  await page.locator('.cm-content:visible').press('ControlOrMeta+End')

  // La página no debe scrollear: el scroll vive en .cm-scroller.
  expect(await page.evaluate(() => window.scrollY)).toBe(0)
  const overflows = await page.evaluate(
    () =>
      document.documentElement.scrollHeight <= window.innerHeight + 1 &&
      document.body.scrollHeight <= window.innerHeight + 1,
  )
  expect(overflows).toBe(true)
  const headerBox = await page.locator('header').first().boundingBox()
  expect(headerBox).not.toBeNull()
  expect(headerBox!.y).toBeGreaterThanOrEqual(0)
  const viewportH = await page.evaluate(() => window.innerHeight)
  expect(headerBox!.y).toBeLessThan(viewportH)
  // Hay dos editores montados (móvil oculto + desktop): medir el visible.
  const innerScroll = await page
    .locator('.cm-scroller:visible')
    .evaluate((el) => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    }))
  expect(innerScroll.scrollHeight).toBeGreaterThan(innerScroll.clientHeight)
})

test('vista en grande: amplía a todo el ancho, persiste y sale', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.locator('[data-engine-status="ready"]')).toBeVisible({
    timeout: 30_000,
  })
  await expect(page.getByRole('img', { name: /Página 1 de/ })).toBeVisible({
    timeout: 30_000,
  })
  // Amplía desde la cabecera del preview (solo desktop).
  await page
    .getByRole('button', { name: 'Ver vista previa en grande' })
    .first()
    .click()
  await expect(
    page.getByRole('button', { name: 'Salir de vista ampliada' }),
  ).toBeVisible()
  // El editor se oculta; el documento sigue visible a todo el ancho.
  await expect(page.locator('.cm-content:visible')).toBeHidden()
  await expect(
    page.getByRole('document', { name: /Guion en PDF/ }),
  ).toBeVisible()
  expect(await page.evaluate(() => window.scrollY)).toBe(0)
  // Persiste tras recarga (clave guion.preview.v1 con expanded).
  await page.reload()
  await expect(page.locator('[data-engine-status="ready"]')).toBeVisible({
    timeout: 30_000,
  })
  await expect(
    page.getByRole('button', { name: 'Salir de vista ampliada' }),
  ).toBeVisible()
  // Salir devuelve el split editor + preview.
  await page.getByRole('button', { name: 'Salir de vista ampliada' }).click()
  await expect(
    page.getByRole('button', { name: 'Ver vista previa en grande' }),
  ).toBeVisible()
  await expect(page.locator('.cm-content:visible')).toBeVisible()
  await expect(page.getByRole('img', { name: /Página 1 de/ })).toBeVisible({
    timeout: 30_000,
  })
})

test('doble clic en el documento lleva el cursor a esa línea', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.locator('[data-engine-status="ready"]')).toBeVisible({
    timeout: 30_000,
  })
  // La cabecera de escena es la primera línea y va en una posición fija de la
  // hoja, así que el clic se puede calcular. El marcador la hace única.
  const heading = `EXT. MARCADOR ${Date.now()} - DIA`
  await writeScript(page, `${heading}\n\nAcción.\n`)
  await expect(page.locator('.cm-lineNumbers:visible')).toBeVisible()
  await expect(page.getByRole('img', { name: /Página 1 de/ })).toBeVisible({
    timeout: 30_000,
  })

  const target = await findFirstLinePoint(page)
  expect(target).not.toBeNull()
  await page.mouse.dblclick(target!.x, target!.y)

  // El cursor quedó en la cabecera del editor *visible*, no en el oculto (el
  // móvil) ni en la acción de otra línea.
  await expect
    .poll(() => readCaretLine(page), { timeout: 10_000 })
    .toBe(heading)
  // El flash marca la línea destino y se retira solo (~2s): si el salto ya
  // resolvió hace más de eso, puede haberse ido antes del primer poll y la
  // última aserción pasa directa; en el caso típico se ve aparecer y salir.
  await expect(page.locator('.cm-jump-flash:visible')).toBeVisible({
    timeout: 5_000,
  })
  // La clase no basta: el fondo computado debe llevar el ámbar de marca. Esto
  // caza regresiones de pintado (p. ej. un `color-mix` contra transparente que
  // embarra los canales) que la aserción de arriba no ve.
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const el = document.querySelector('.cm-content .cm-jump-flash')
          if (!el) return ''
          return getComputedStyle(el as HTMLElement).backgroundColor
        }),
      { timeout: 5_000 },
    )
    .toContain('217, 119, 6')
  // El flash sobrevive al viaje de los ojos: 1s después del ámbar sigue vivo
  // (meseta de la animación) y luego se retira solo.
  await page.waitForTimeout(1000)
  await expect(page.locator('.cm-jump-flash:visible')).toHaveCount(1, {
    timeout: 5_000,
  })
  await expect(page.locator('.cm-jump-flash:visible')).toHaveCount(0, {
    timeout: 10_000,
  })
})

// Regresión del bug real: el offset de la palabra clicada casi siempre es una
// columna a MITAD de línea, y `Decoration.line` solo decora la línea que EMPIEZA
// en la posición dada. El test de arriba clica la primera letra del heading
// (inicio de línea), el único caso que funcionaba sin anclar.
test('doble clic a mitad de línea resalta la línea destino', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.locator('[data-engine-status="ready"]')).toBeVisible({
    timeout: 30_000,
  })
  const heading = `EXT. MARCADOR MITAD ${Date.now()} - DIA`
  await writeScript(page, `${heading}\n\nAcción.\n`)
  await expect(page.getByRole('img', { name: /Página 1 de/ })).toBeVisible({
    timeout: 30_000,
  })

  const rect = await page.locator('[data-page]').first().boundingBox()
  expect(rect).not.toBeNull()
  // x al ~40% del ancho de la hoja: cae en una palabra interior del heading, no
  // en su primer carácter. Es justo el caso que el snap a inicio de línea
  // arregla.
  await page.mouse.dblclick(
    rect!.x + rect!.width * 0.4,
    rect!.y + rect!.height * 0.096,
  )

  await expect
    .poll(() => readCaretLine(page), { timeout: 10_000 })
    .toBe(heading)
  await expect(page.locator('.cm-jump-flash:visible')).toBeVisible({
    timeout: 5_000,
  })
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const el = document.querySelector('.cm-content .cm-jump-flash')
          if (!el) return ''
          return getComputedStyle(el as HTMLElement).backgroundColor
        }),
      { timeout: 5_000 },
    )
    .toContain('217, 119, 6')
})

test('el doble clic ya no alterna el zoom', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('[data-engine-status="ready"]')).toBeVisible({
    timeout: 30_000,
  })
  await expect(page.getByRole('img', { name: /Página 1 de/ })).toBeVisible({
    timeout: 30_000,
  })
  const zoom = page.getByRole('button', { name: /Zoom \d+ por ciento/ })
  await expect(zoom).toBeVisible()
  // Amplía con el botón `+` de la cabecera del preview.
  await page.getByRole('button', { name: 'Ampliar zoom' }).click()
  await expect(zoom).toContainText('125 %')
  const afterZoom = await zoom.getAttribute('aria-label')
  // El doble clic ya no alterna el zoom: lleva al editor (punto 4).
  await page.mouse.dblclick(400, 400)
  await page.waitForTimeout(300)
  expect(await zoom.getAttribute('aria-label')).toBe(afterZoom)
})

test('persistencia tras recarga', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('[data-engine-status="ready"]')).toBeVisible({
    timeout: 30_000,
  })
  const marker = `PERSIST-${Date.now()}`
  await writeScript(page, `INT. CASA - DÍA\n\n${marker}\n`)
  await expect
    .poll(
      async () =>
        page.evaluate(
          (m) => localStorage.getItem('guion.scripts.v1')?.includes(m),
          marker,
        ),
      { timeout: 10_000 },
    )
    .toBe(true)
  await page.reload()
  await expect(page.locator('[data-engine-status="ready"]')).toBeVisible({
    timeout: 30_000,
  })
  await expect(page.locator('.cm-content:visible')).toContainText(marker)
})
