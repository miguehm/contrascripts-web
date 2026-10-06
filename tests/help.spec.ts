// REVIEW.md punto 11: botón de Ayuda en la barra superior — abre el
// cheatsheet Fountain y Escape lo cierra; F1 también lo abre.
import { expect, test } from '@playwright/test'

test('ayuda: abre el cheatsheet desde la barra superior', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('[data-engine-status="ready"]')).toBeVisible({
    timeout: 30_000,
  })
  await page.getByRole('button', { name: 'Ayuda' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByText('Encabezado de escena')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toBeHidden()
})

test('ayuda: F1 abre el cheatsheet', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('[data-engine-status="ready"]')).toBeVisible({
    timeout: 30_000,
  })
  await page.keyboard.press('F1')
  await expect(page.getByRole('dialog')).toBeVisible()
})
