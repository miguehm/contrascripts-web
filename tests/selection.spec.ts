// Punto 5: la selección del editor usa el ámbar por tema (`--selection`), no
// el lila `#d7d4f0` por defecto de `drawSelection` en CodeMirror. Se verifica
// el fondo computado del `.cm-selectionBackground` visible con texto
// seleccionado, en dark y en light.
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

/** Fondo computado de la capa de selección del editor *visible*. */
async function selectionBackground(page: Page): Promise<string> {
  return page.evaluate(() => {
    const all = Array.from(
      document.querySelectorAll('.cm-selectionLayer .cm-selectionBackground'),
    )
    const visible = all.find(
      (el) =>
        el.getBoundingClientRect().width > 0 &&
        getComputedStyle(el as HTMLElement).backgroundColor !==
          'rgba(0, 0, 0, 0)',
    )
    return visible
      ? getComputedStyle(visible as HTMLElement).backgroundColor
      : ''
  })
}

async function selectAll(page: Page): Promise<void> {
  const editor = page.locator('.cm-content:visible')
  await editor.click()
  await page.keyboard.press('ControlOrMeta+a')
}

test('selección en dark usa el ámbar claro, no el lila de CM', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.locator('.cm-content:visible')).toBeVisible({
    timeout: 30_000,
  })
  await page.getByRole('button', { name: 'Cambiar a tema oscuro' }).click()
  await expect(page.locator('html.dark')).toBeAttached()
  await selectAll(page)
  await expect
    .poll(() => selectionBackground(page), { timeout: 10_000 })
    .toContain('251, 146, 60')
})

test('selección en light usa el ámbar quemado', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.cm-content:visible')).toBeVisible({
    timeout: 30_000,
  })
  await expect(page.locator('html.dark')).toHaveCount(0)
  await selectAll(page)
  await expect
    .poll(() => selectionBackground(page), { timeout: 10_000 })
    .toContain('217, 119, 6')
})
