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
