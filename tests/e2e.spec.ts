// Tests de integración §10: boot único, parse, exportar PDF y persistencia.
// Heredan el patrón de web/vite/tests del parser. Corren headless en CI.
import { expect, test } from '@playwright/test'

test('boot único + parse reactivo', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Listo')).toBeVisible({ timeout: 30_000 })
  expect(
    await page.evaluate(
      () => (window as unknown as Record<string, unknown>).__fountainBoots,
    ),
  ).toBe(1)
  // El seed de ejemplo ya parsea al arrancar (acotado a la hoja visible).
  await expect(page.locator('article').getByText('BRICK & STEEL')).toBeVisible()
})

test('editar actualiza el preview', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Listo')).toBeVisible({ timeout: 30_000 })
  const marker = `EVALUACION-${Date.now()}`
  await page.locator('textarea:visible').fill(`INT. CASA - DÍA\n\n${marker}\n`)
  await expect(page.locator('article').getByText(marker)).toBeVisible({
    timeout: 10_000,
  })
})

test('exportar PDF descarga un PDF válido', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Listo')).toBeVisible({ timeout: 30_000 })
  const download = page.waitForEvent('download', { timeout: 30_000 })
  await page.getByRole('button', { name: /exportar/i }).click()
  const path = await (await download).path()
  expect(path).toBeTruthy()
})

test('persistencia tras recarga', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Listo')).toBeVisible({ timeout: 30_000 })
  const marker = `PERSIST-${Date.now()}`
  await page.locator('textarea:visible').fill(`INT. CASA - DÍA\n\n${marker}\n`)
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
  await expect(page.getByText('Listo')).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('textarea:visible')).toContainText(marker)
})
