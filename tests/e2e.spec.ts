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
    page.getByRole('document', { name: 'Contrascripts en PDF, 3 páginas' }),
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
    page.getByRole('document', { name: /Contrascripts en PDF/ }),
  ).toBeHidden()
  // El estado colapsado persiste tras recarga (clave contrascripts.preview.v1).
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

// REVIEW.md 14: plegado sin pestañas Guiones/Escenas — solo acciones.
test('sidebar plegado: oculta las pestañas Guiones y Escenas', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.locator('[data-engine-status="ready"]')).toBeVisible({
    timeout: 30_000,
  })
  const sidebar = page.locator('#scripts-sidebar')
  await expect(sidebar).toBeVisible()
  // Estado base: expandido muestra las dos pestañas.
  const expandSidebar = page.getByRole('button', { name: 'Expandir guiones' })
  if (await expandSidebar.isVisible()) await expandSidebar.click()
  await expect(sidebar.getByRole('tab', { name: 'Guiones' })).toBeVisible()
  // Al plegar desaparecen las tabs, pero siguen Nuevo/Importar/Ajustes.
  await page.getByRole('button', { name: 'Colapsar guiones' }).click()
  await expect(sidebar.getByRole('tab')).toHaveCount(0)
  await expect(
    sidebar.getByRole('button', { name: 'Nuevo guion' }),
  ).toBeVisible()
  // Al expandir vuelven las pestañas.
  await page.getByRole('button', { name: 'Expandir guiones' }).click()
  await expect(sidebar.getByRole('tab', { name: 'Guiones' })).toBeVisible()
  await expect(sidebar.getByRole('tab', { name: /Escenas/ })).toBeVisible()
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
    page.getByRole('document', { name: /Contrascripts en PDF/ }),
  ).toBeVisible()
  expect(await page.evaluate(() => window.scrollY)).toBe(0)
  // Persiste tras recarga (clave contrascripts.preview.v1 con expanded).
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

// REVIEW.md 10: el doble clic en la vista en grande sale del modo grande y
// lleva el cursor al texto clicado en el editor (la misma lógica del punto 4,
// incluido el desplazamiento del editor hacia la línea destino).
test('doble clic en la vista en grande sale y lleva al editor', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.locator('[data-engine-status="ready"]')).toBeVisible({
    timeout: 30_000,
  })
  // Guion largo: el objetivo queda lejos del inicio y el salto debe scrollear
  // el editor (clicar la primera línea pasaría sin desplazar).
  const filler = 'Línea de relleno para llenar página.'
  await writeScript(page, 'INT. CASA - DÍA\n\n' + `${filler}\n\n`.repeat(120))
  await expect(page.getByRole('img', { name: /Página 1 de/ })).toBeVisible({
    timeout: 30_000,
  })
  // Entrar en grande: el editor se desmonta y el salto queda pendiente.
  await page
    .getByRole('button', { name: 'Ver vista previa en grande' })
    .first()
    .click()
  await expect(
    page.getByRole('button', { name: 'Salir de vista ampliada' }),
  ).toBeVisible()
  await expect(page.locator('.cm-content:visible')).toBeHidden()
  // La vista en grande remonta el preview: esperar la segunda hoja y centrar
  // su primera línea en el contenedor antes de clicar. El scroll y la medida
  // van en una sola operación síncrona: con hojas más altas que el contenedor,
  // `scrollIntoViewIfNeeded` + `boundingBox` en pasos separados deja el punto
  // fuera del viewport (el clic caería al aire).
  await expect(page.getByRole('img', { name: /Página 2 de/ })).toBeVisible({
    timeout: 30_000,
  })
  const vh = await page.evaluate(() => window.innerHeight)
  const pt = await page.getByTestId('preview-pages').evaluate((el) => {
    const target = el.querySelector('[data-page="2"]') as HTMLElement | null
    if (!target) return null
    const sr = el.getBoundingClientRect()
    const pr = target.getBoundingClientRect()
    // Punto de clic: margen 1.5" / algo más de 1" desde arriba, como en
    // `findFirstLinePoint`, centrado verticalmente en el contenedor.
    el.scrollTop =
      pr.top - sr.top + el.scrollTop + pr.height * 0.096 - el.clientHeight / 2
    const after = target.getBoundingClientRect()
    return {
      x: after.left + after.width * 0.18,
      y: after.top + after.height * 0.096,
    }
  })
  expect(pt).not.toBeNull()
  // Sanity: el punto debe estar en pantalla antes de clicar.
  expect(pt!.y).toBeGreaterThan(0)
  expect(pt!.y).toBeLessThan(vh)
  expect(pt!.x).toBeGreaterThan(0)
  await page.mouse.dblclick(pt!.x, pt!.y)

  // Sale del modo grande y el cursor cae en la línea clicada, con flash.
  await expect(
    page.getByRole('button', { name: 'Ver vista previa en grande' }),
  ).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('.cm-content:visible')).toBeVisible()
  await expect.poll(() => readCaretLine(page), { timeout: 10_000 }).toBe(filler)
  await expect(page.locator('.cm-jump-flash:visible')).toBeVisible({
    timeout: 5_000,
  })
  // Y el editor se desplaza: la línea activa queda dentro de su viewport
  // (el bug era que el cursor llegaba pero el editor se quedaba arriba).
  const editorScroller = page.locator('.cm-scroller:visible')
  await expect
    .poll(() => editorScroller.evaluate((el) => el.scrollTop), {
      timeout: 10_000,
    })
    .toBeGreaterThan(0)
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const scroller = Array.from(
            document.querySelectorAll('.cm-scroller'),
          ).find((el) => el.getBoundingClientRect().width > 0)
          const active = Array.from(
            document.querySelectorAll('.cm-activeLine'),
          ).find((el) => el.getBoundingClientRect().width > 0)
          if (!scroller || !active) return false
          const sr = scroller.getBoundingClientRect()
          const ar = active.getBoundingClientRect()
          return ar.top >= sr.top - 1 && ar.bottom <= sr.bottom + 1
        }),
      { timeout: 10_000 },
    )
    .toBe(true)
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
  const before = await zoom.getAttribute('aria-label')
  // Sale del fit inicial con el botón `+` de la cabecera del preview.
  await page.getByRole('button', { name: 'Ampliar zoom' }).click()
  const afterZoom = await zoom.getAttribute('aria-label')
  expect(afterZoom).not.toBe(before)
  // El doble clic ya no alterna el zoom: lleva al editor (punto 4).
  await page.mouse.dblclick(400, 400)
  await page.waitForTimeout(300)
  expect(await zoom.getAttribute('aria-label')).toBe(afterZoom)
})

// REVIEW.md 8: en primera carga el preview ajusta al ancho disponible,
// sin necesidad de tocar el porcentaje.
test('en primera carga el preview ajusta al ancho', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('[data-engine-status="ready"]')).toBeVisible({
    timeout: 30_000,
  })
  await expect(page.getByRole('img', { name: /Página 1 de/ })).toBeVisible({
    timeout: 30_000,
  })
  const zoom = page.getByRole('button', { name: /Zoom \d+ por ciento/ })
  await expect(zoom).toBeVisible()
  await expect(zoom).toHaveAttribute('aria-label', /ajustado al ancho/)
})

// REVIEW.md 7: clic en un aviso lleva el cursor a su línea con el flash del
// punto 4. Cabecera de escena sin hora → `SCENE_NO_TIME` (verificado contra
// `lint.go` del parser: toda cabecera no forzada sin " - " avisa).
test('clic en un aviso salta a su línea con highlight', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('[data-engine-status="ready"]')).toBeVisible({
    timeout: 30_000,
  })
  const target = 'EXT. CALLE SIN HORA'
  await writeScript(
    page,
    `INT. CASA - DÍA\n\nAcción.\n\n${target}\n\nOtra acción.\n`,
  )
  // El trigger solo existe con avisos: abre la hoja y se clica el de L5.
  await page.getByRole('button', { name: /avisos, \d+ avisos?/i }).click()
  await page.getByRole('button', { name: /aviso línea 5/i }).click()
  // El panel se cierra en el mismo gesto y el cursor cae en la línea del
  // aviso con el flash ámbar de marca.
  await expect(page.getByTestId('warnings-panel')).toHaveCount(0)
  await expect.poll(() => readCaretLine(page), { timeout: 10_000 }).toBe(target)
  await expect(page.locator('.cm-jump-flash:visible')).toBeVisible({
    timeout: 5_000,
  })
})

// REVIEW.md 6: cerrar y abrir el panel del preview conserva el scroll
// exacto (mismo doc y zoom). Doc largo a propósito: muchas páginas miden su
// tamaño async y el restore debe converger, no asentarse a medias.
test('cerrar y abrir el preview conserva el scroll exacto', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.locator('[data-engine-status="ready"]')).toBeVisible({
    timeout: 30_000,
  })
  const longText =
    'INT. CASA - DÍA\n\n' +
    'Línea de acción para rellenar la página.\n\n'.repeat(120)
  await writeScript(page, longText)
  await expect(page.getByRole('img', { name: /Página 2 de/ })).toBeVisible({
    timeout: 30_000,
  })

  // Hay dos contenedores montados (móvil oculto + desktop): medir el visible.
  const scroller = page.locator('[data-testid="preview-pages"]:visible')
  await expect(scroller).toBeVisible()
  // Valor no redondo a mitad del documento: varias páginas por encima
  // cambian de placeholder a altura real al reabrir; el restore debe seguir
  // el ancla, no un px contra alturas parciales.
  const target = await scroller.evaluate((el) => {
    el.scrollTop = Math.min(1234, el.scrollHeight - el.clientHeight)
    return el.scrollTop
  })
  expect(target).toBeGreaterThan(500)

  await page
    .getByRole('button', { name: 'Ocultar vista previa' })
    .first()
    .click()
  await expect(
    page.getByRole('button', { name: 'Mostrar vista previa' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Mostrar vista previa' }).click()
  await expect(page.getByRole('img', { name: /Página 2 de/ })).toBeVisible({
    timeout: 30_000,
  })

  // El re-render tras reabrir es async (worker + raster): se espera a que el
  // scroll vuelva exactamente donde estaba, no solo "lejos de arriba".
  await expect
    .poll(() => scroller.evaluate((el) => el.scrollTop), { timeout: 20_000 })
    .toBeGreaterThan(500)
  const restored = await scroller.evaluate((el) => el.scrollTop)
  expect(Math.abs(restored - target)).toBeLessThanOrEqual(2)
})

// REVIEW.md 6: entrar y salir de la vista en grande conserva cursor y
// scroll exactos (mismo doc). El cursor se lee de `data-cursor-offset`
// (atributo solo para tests, sin efecto visual).
test('salir de la vista en grande conserva el editor exacto', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.locator('[data-engine-status="ready"]')).toBeVisible({
    timeout: 30_000,
  })
  const longText =
    'INT. CASA - DÍA\n\n' +
    'Línea de acción para rellenar la página.\n\n'.repeat(120)
  await writeScript(page, longText)
  await expect(page.locator('.cm-lineNumbers:visible')).toBeVisible()

  // Hay dos editores montados (móvil oculto + desktop): medir el visible.
  const editorScroller = page.locator('.cm-scroller:visible')
  const editorWrap = page.locator('div[data-cursor-offset]:visible')
  await page.locator('.cm-content:visible').press('ControlOrMeta+End')
  const top = await editorScroller.evaluate((el) => el.scrollTop)
  expect(top).toBeGreaterThan(100)
  const cursor = await editorWrap.getAttribute('data-cursor-offset')
  expect(cursor).toBe(String(longText.length))

  await page
    .getByRole('button', { name: 'Ver vista previa en grande' })
    .first()
    .click()
  await expect(page.locator('.cm-content:visible')).toBeHidden()
  await page.getByRole('button', { name: 'Salir de vista ampliada' }).click()
  await expect(page.locator('.cm-content:visible')).toBeVisible()

  // Scroll exacto (±1px por redondeos de subpíxel) y mismo cursor (el
  // navegador ya no lo arrastra).
  await expect
    .poll(
      async () =>
        Math.abs((await editorScroller.evaluate((el) => el.scrollTop)) - top) <=
        1,
      { timeout: 10_000 },
    )
    .toBe(true)
  expect(await editorWrap.getAttribute('data-cursor-offset')).toBe(cursor)
})

// REVIEW.md 6: aunque el cursor quede fuera del viewport guardado, al
// volver se conserva todo exacto (sin arrastrar la vista al cursor).
test('volver con el cursor fuera de vista conserva todo exacto', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.locator('[data-engine-status="ready"]')).toBeVisible({
    timeout: 30_000,
  })
  const longText =
    'INT. CASA - DÍA\n\n' +
    'Línea de acción para rellenar la página.\n\n'.repeat(120)
  await writeScript(page, longText)
  await expect(page.locator('.cm-lineNumbers:visible')).toBeVisible()

  const editorScroller = page.locator('.cm-scroller:visible')
  const editorWrap = page.locator('div[data-cursor-offset]:visible')
  // Cursor al final y luego scroll arriba: el cursor queda fuera de vista.
  await page.locator('.cm-content:visible').press('ControlOrMeta+End')
  const cursor = await editorWrap.getAttribute('data-cursor-offset')
  expect(cursor).toBe(String(longText.length))
  await editorScroller.evaluate((el) => {
    el.scrollTop = 0
  })
  expect(await editorScroller.evaluate((el) => el.scrollTop)).toBe(0)

  await page
    .getByRole('button', { name: 'Ver vista previa en grande' })
    .first()
    .click()
  await expect(page.locator('.cm-content:visible')).toBeHidden()
  await page.getByRole('button', { name: 'Salir de vista ampliada' }).click()
  await expect(page.locator('.cm-content:visible')).toBeVisible()

  // Ni el scroll se mueve ni el cursor cambia: exactitud total.
  await page.waitForTimeout(500)
  expect(await editorScroller.evaluate((el) => el.scrollTop)).toBe(0)
  expect(await editorWrap.getAttribute('data-cursor-offset')).toBe(cursor)
})

// REVIEW.md 6 (caso real): leer con la rueda sin mover el cursor —el cursor
// queda arriba y el viewport abajo— y al volver de pantalla completa todo
// sigue donde estaba, sin saltar al cursor.
test('leer con rueda sin mover el cursor conserva todo exacto', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.locator('[data-engine-status="ready"]')).toBeVisible({
    timeout: 30_000,
  })
  const longText =
    'INT. CASA - DÍA\n\n' +
    'Línea de acción para rellenar la página.\n\n'.repeat(120)
  await writeScript(page, longText)
  await expect(page.locator('.cm-lineNumbers:visible')).toBeVisible()

  const editorScroller = page.locator('.cm-scroller:visible')
  const editorWrap = page.locator('div[data-cursor-offset]:visible')
  // Cursor al inicio (tras escribir queda al final: se lleva arriba con
  // el teclado, como haría el usuario tras releer desde el principio).
  await page.locator('.cm-content:visible').press('ControlOrMeta+Home')
  const cursor = await editorWrap.getAttribute('data-cursor-offset')
  // Rueda real sobre el editor (scroll nativo, el cursor no se mueve).
  await editorScroller.hover()
  await page.mouse.wheel(0, 800)
  const top = await editorScroller.evaluate((el) => el.scrollTop)
  expect(top).toBeGreaterThan(100)
  expect(await editorWrap.getAttribute('data-cursor-offset')).toBe(cursor)

  await page
    .getByRole('button', { name: 'Ver vista previa en grande' })
    .first()
    .click()
  await expect(page.locator('.cm-content:visible')).toBeHidden()
  await page.getByRole('button', { name: 'Salir de vista ampliada' }).click()
  await expect(page.locator('.cm-content:visible')).toBeVisible()

  // Mismo scroll (±1px) y mismo cursor: nada salta hacia arriba.
  await expect
    .poll(
      async () =>
        Math.abs((await editorScroller.evaluate((el) => el.scrollTop)) - top) <=
        1,
      { timeout: 10_000 },
    )
    .toBe(true)
  expect(await editorWrap.getAttribute('data-cursor-offset')).toBe(cursor)
})

// REVIEW.md 6: la primera línea visible es la que manda (no solo el px).
async function firstVisibleEditorLine(page: Page): Promise<string | null> {
  return page.locator('.cm-scroller:visible').evaluate((scroller) => {
    const sr = scroller.getBoundingClientRect()
    const gutters = Array.from(scroller.querySelectorAll('.cm-gutterElement'))
    for (const g of gutters) {
      const r = (g as HTMLElement).getBoundingClientRect()
      if (r.bottom > sr.top + 1) return (g.textContent ?? '').trim()
    }
    return null
  })
}

// REVIEW.md 6 (caso del reporte): línea 49 al borde superior → expandir →
// colapsar → sigue la 49 al borde, no la 50-52.
test('volver conserva la primera línea visible exacta', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('[data-engine-status="ready"]')).toBeVisible({
    timeout: 30_000,
  })
  const longText =
    'INT. CASA - DÍA\n\n' +
    'Línea de acción para rellenar la página.\n\n'.repeat(120)
  await writeScript(page, longText)
  await expect(page.locator('.cm-lineNumbers:visible')).toBeVisible()

  // Hay dos editores montados (móvil oculto + desktop): medir el visible.
  const editorScroller = page.locator('.cm-scroller:visible')
  // El gutter virtualiza: primero se baja cerca para que la 49 se renderice
  // y luego se deja justo al borde superior del viewport.
  await editorScroller.evaluate((el) => {
    el.scrollTop = 800
  })
  await expect
    .poll(() => firstVisibleEditorLine(page), { timeout: 10_000 })
    .not.toBeNull()
  await editorScroller.evaluate((el) => {
    const sr = el.getBoundingClientRect()
    const gutters = Array.from(el.querySelectorAll('.cm-gutterElement'))
    const g49 = gutters.find((g) => (g.textContent ?? '').trim() === '49')
    if (!g49) throw new Error('sin línea 49')
    el.scrollTop += (g49 as HTMLElement).getBoundingClientRect().top - sr.top
  })
  expect(await firstVisibleEditorLine(page)).toBe('49')
  const top = await editorScroller.evaluate((el) => el.scrollTop)

  await page
    .getByRole('button', { name: 'Ver vista previa en grande' })
    .first()
    .click()
  await expect(page.locator('.cm-content:visible')).toBeHidden()
  await page.getByRole('button', { name: 'Salir de vista ampliada' }).click()
  await expect(page.locator('.cm-content:visible')).toBeVisible()

  await expect
    .poll(() => firstVisibleEditorLine(page), { timeout: 10_000 })
    .toBe('49')
  const restored = await editorScroller.evaluate((el) => el.scrollTop)
  expect(Math.abs(restored - top)).toBeLessThanOrEqual(1)
})

// REVIEW.md 6 (ruta que fallaba a la primera): salto único y lejano de un
// tirón (como arrastrar la scrollbar, sin medir la zona intermedia) e
// inmediatamente expandir → colapsar. El snapshot de CodeMirror ancla a la
// línea realmente visible, así que no deriva aunque la zona no estuviera
// medida al guardar.
test('salto único lejano conserva la primera línea visible', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.locator('[data-engine-status="ready"]')).toBeVisible({
    timeout: 30_000,
  })
  const longText =
    'INT. CASA - DÍA\n\n' +
    'Línea de acción para rellenar la página.\n\n'.repeat(120)
  await writeScript(page, longText)
  await expect(page.locator('.cm-lineNumbers:visible')).toBeVisible()

  const editorScroller = page.locator('.cm-scroller:visible')
  // Un solo salto al 80% del documento, sin paradas intermedias.
  await editorScroller.evaluate((el) => {
    el.scrollTop = (el.scrollHeight - el.clientHeight) * 0.8
  })
  await expect
    .poll(() => firstVisibleEditorLine(page), { timeout: 10_000 })
    .not.toBeNull()
  const firstLine = await firstVisibleEditorLine(page)
  expect(firstLine).not.toBeNull()

  await page
    .getByRole('button', { name: 'Ver vista previa en grande' })
    .first()
    .click()
  await expect(page.locator('.cm-content:visible')).toBeHidden()
  await page.getByRole('button', { name: 'Salir de vista ampliada' }).click()
  await expect(page.locator('.cm-content:visible')).toBeVisible()

  await expect
    .poll(() => firstVisibleEditorLine(page), { timeout: 10_000 })
    .toBe(firstLine)
})

/** Arrastra el divisor del split (desktop) los píxeles indicados. */
async function dragSplit(page: Page, dx: number): Promise<void> {
  const handle = page.locator('[data-slot="resizable-handle"]:visible')
  const box = await handle.boundingBox()
  expect(box).not.toBeNull()
  const x = box!.x + box!.width / 2
  const y = box!.y + box!.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + dx, y, { steps: 12 })
  await page.mouse.up()
}

async function editorPanelWidth(page: Page): Promise<number> {
  const box = await page.locator('#editor:visible').boundingBox()
  expect(box).not.toBeNull()
  return box!.width
}

// REVIEW.md 6: el divisor personalizado sobrevive a expandir/colapsar (y
// con el mismo ancho, el wrapping no cambia y la posición cuadra).
test('el divisor personalizado sobrevive a la vista en grande', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.locator('[data-engine-status="ready"]')).toBeVisible({
    timeout: 30_000,
  })
  const longText =
    'INT. CASA - DÍA\n\n' +
    'Línea de acción para rellenar la página.\n\n'.repeat(120)
  await writeScript(page, longText)
  await expect(page.locator('.cm-lineNumbers:visible')).toBeVisible()

  const before = await editorPanelWidth(page)
  await dragSplit(page, 150)
  const dragged = await editorPanelWidth(page)
  expect(dragged - before).toBeGreaterThan(80)

  // Posición de referencia tras el arrastre (el reflow ya asentó).
  const editorScroller = page.locator('.cm-scroller:visible')
  await page.locator('.cm-content:visible').press('ControlOrMeta+End')
  const top = await editorScroller.evaluate((el) => el.scrollTop)

  await page
    .getByRole('button', { name: 'Ver vista previa en grande' })
    .first()
    .click()
  await expect(page.locator('.cm-content:visible')).toBeHidden()
  await page.getByRole('button', { name: 'Salir de vista ampliada' }).click()
  await expect(page.locator('.cm-content:visible')).toBeVisible()

  const restoredWidth = await editorPanelWidth(page)
  expect(Math.abs(restoredWidth - dragged)).toBeLessThanOrEqual(12)
  await expect
    .poll(
      async () =>
        Math.abs((await editorScroller.evaluate((el) => el.scrollTop)) - top) <=
        1,
      { timeout: 10_000 },
    )
    .toBe(true)
})

// REVIEW.md 6: el divisor persiste tras recarga (clave contrascripts.split.v1).
test('el divisor persiste tras recarga', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('[data-engine-status="ready"]')).toBeVisible({
    timeout: 30_000,
  })
  await expect(page.locator('.cm-lineNumbers:visible')).toBeVisible()

  const before = await editorPanelWidth(page)
  await dragSplit(page, 150)
  const dragged = await editorPanelWidth(page)
  expect(dragged - before).toBeGreaterThan(80)

  await page.reload()
  await expect(page.locator('[data-engine-status="ready"]')).toBeVisible({
    timeout: 30_000,
  })
  await expect(page.locator('#editor:visible')).toBeVisible()
  const restored = await editorPanelWidth(page)
  expect(Math.abs(restored - dragged)).toBeLessThanOrEqual(12)
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
          (m) => localStorage.getItem('contrascripts.scripts.v1')?.includes(m),
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

test('pestaña Escenas: lista, salto al editor y persiste tras recarga', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.locator('[data-engine-status="ready"]')).toBeVisible({
    timeout: 30_000,
  })
  // Relleno para que la 2ª escena caiga en la página 2 del PDF.
  const filler = 'Línea de acción para rellenar la página.\n\n'.repeat(60)
  await writeScript(
    page,
    `EXT. PATIO - DÍA\n\nUn día precioso.\n\n${filler}INT. CASA - NOCHE\n\nBrick entra.\n`,
  )
  // Esperar al PDF de 2+ páginas antes de clicar (si no, el salto a
  // página exacta se resolvería contra el render anterior). Los wrappers
  // `[data-page]` montan con `numPages`, sin depender del raster lazy.
  await expect
    .poll(() => page.locator('[data-page]').count(), { timeout: 30_000 })
    .toBeGreaterThan(1)
  // Abrir la pestaña de escenas del sidebar (desktop).
  await page
    .getByRole('tab', { name: /Escenas/ })
    .first()
    .click()
  await expect(
    page.getByRole('button', { name: /Ir a la escena 2/ }),
  ).toBeVisible()
  // La preview de acción da contexto (dentro del listado de escenas).
  await expect(
    page
      .getByRole('list', { name: 'Escenas del guion' })
      .getByText('Brick entra.'),
  ).toBeVisible()
  // Clic en la 2ª escena → el cursor del editor cae en su línea…
  await page.getByRole('button', { name: /Ir a la escena 2/ }).click()
  await expect
    .poll(() => readCaretLine(page), { timeout: 10_000 })
    .toContain('INT. CASA - NOCHE')
  // …y el previewer scrollea a su página exacta (paginación Go, no
  // substring). Un solo clic basta: el bucle de asentamiento lleva la
  // página destino al borde superior aunque el layout crezca tras el
  // primer scroll. Se aserta el error de control (scroll real vs top
  // medido, con tope físico de scroll: la última página no siempre puede
  // alinearse al borde), no el flash (2s). La escena 2 es la última del
  // guion: su página es la última.
  const controlErrorOfLastPage = () =>
    page.evaluate(() => {
      const scroller = document.querySelector(
        '[data-testid="preview-pages"]',
      ) as HTMLElement | null
      const pages = [...document.querySelectorAll('[data-page]')]
      const last = pages[pages.length - 1] as HTMLElement | undefined
      if (!scroller || !last) return Number.POSITIVE_INFINITY
      const top =
        last.getBoundingClientRect().top -
        scroller.getBoundingClientRect().top +
        scroller.scrollTop
      const max = Math.max(scroller.scrollHeight - scroller.clientHeight, 0)
      return Math.abs(scroller.scrollTop - Math.min(top, max))
    })
  await expect.poll(controlErrorOfLastPage, { timeout: 20_000 }).toBeLessThan(3)
  // Estable: sigue ahí 1.2s después sin segundo clic (sin deriva).
  await page.waitForTimeout(1200)
  await expect.poll(controlErrorOfLastPage, { timeout: 5_000 }).toBeLessThan(3)
  // La pestaña activa se recuerda tras recarga.
  await expect
    .poll(
      async () =>
        page.evaluate(() => localStorage.getItem('contrascripts.ui.v1')),
      { timeout: 10_000 },
    )
    .toContain('scenes')
  await page.reload()
  await expect(page.locator('[data-engine-status="ready"]')).toBeVisible({
    timeout: 30_000,
  })
  await expect(
    page.getByRole('button', { name: /Ir a la escena 2/ }),
  ).toBeVisible()
})
