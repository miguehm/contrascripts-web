// REVIEW.md punto 9: menú de Ajustes — abre desde el sidebar, cambia tema
// y tamaño de fuente del editor, y ambos persisten tras recargar.
import { expect, test } from '@playwright/test'

test('ajustes: tema oscuro persiste tras recargar', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('[data-engine-status="ready"]')).toBeVisible({
    timeout: 30_000,
  })
  await page.getByRole('button', { name: 'Ajustes' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByText('Oscuro').click()
  await expect(page.locator('html.dark')).toBeAttached()
  await page.reload()
  await expect(page.locator('[data-engine-status="ready"]')).toBeVisible({
    timeout: 30_000,
  })
  await expect(page.locator('html.dark')).toBeAttached()
})

test('ajustes: tamaño de fuente del editor se aplica y persiste', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.locator('[data-engine-status="ready"]')).toBeVisible({
    timeout: 30_000,
  })
  await page.getByRole('button', { name: 'Ajustes' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Editor' }).click()
  await page.getByRole('button', { name: 'Aumentar tamaño de fuente' }).click()
  await expect(page.getByText('18px')).toBeVisible()
  const size = await page
    .locator('.cm-content:visible')
    .evaluate((el) => getComputedStyle(el).fontSize)
  expect(size).toBe('18px')
  await page.reload()
  await expect(page.locator('[data-engine-status="ready"]')).toBeVisible({
    timeout: 30_000,
  })
  const persisted = await page
    .locator('.cm-content:visible')
    .evaluate((el) => getComputedStyle(el).fontSize)
  expect(persisted).toBe('18px')
})
