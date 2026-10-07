// REVIEW.md punto 12: los guiones no se pierden — boot corrupto con
// cuarentena (sin seed encima), borrado a papelera con deshacer persistente
// y sección Copias con export `.json`.
import { expect, test } from '@playwright/test'

test('boot corrupto: cuarentena sin sembrar ejemplo encima', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem('contrascripts.scripts.v1', '{no-json')
  })
  await page.goto('/')
  await expect(page.locator('[data-engine-status="ready"]')).toBeVisible({
    timeout: 30_000,
  })
  // Sin guiones recuperables no hay seed que tape el daño: estado vacío.
  await expect(
    page.getByText('Sin guiones. Crea uno nuevo o importa un archivo'),
  ).toBeVisible()
  const quarantine = await page.evaluate(() => {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k?.startsWith('contrascripts.scripts.corrupt.')) keys.push(k)
    }
    return keys.map((k) => localStorage.getItem(k))
  })
  expect(quarantine).toEqual(['{no-json'])
  const current = await page.evaluate(() =>
    localStorage.getItem('contrascripts.scripts.v1'),
  )
  expect(current).not.toContain('Brick')
})

test('migración legacy: claves guion.*.v1 se mudan a contrascripts.*.v1', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'guion.scripts.v1',
      JSON.stringify([
        {
          id: 'legacy-1',
          title: 'Legado',
          text: 'INT. CASA - DÍA',
          updatedAt: 1,
        },
      ]),
    )
    localStorage.setItem(
      'guion.ui.v1',
      JSON.stringify({ collapsed: false, zoom: 1 }),
    )
  })
  await page.goto('/')
  await expect(page.locator('[data-engine-status="ready"]')).toBeVisible({
    timeout: 30_000,
  })
  // El guion legacy sigue ahí (punto 12: nada se pierde en el renombre).
  await expect(
    page.getByRole('button', { name: 'Abrir guion Legado' }),
  ).toBeVisible()
  const keys = await page.evaluate(() => {
    const out: Record<string, string | null> = {}
    for (const k of [
      'contrascripts.scripts.v1',
      'contrascripts.ui.v1',
      'guion.scripts.v1',
      'guion.ui.v1',
    ]) {
      out[k] = localStorage.getItem(k)
    }
    return out
  })
  expect(keys['contrascripts.scripts.v1']).toContain('Legado')
  expect(keys['contrascripts.ui.v1']).toContain('collapsed')
  expect(keys['guion.scripts.v1']).toBeNull()
  expect(keys['guion.ui.v1']).toBeNull()
})

test('borrar mueve a papelera y Deshacer lo restaura tras recarga', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.locator('[data-engine-status="ready"]')).toBeVisible({
    timeout: 30_000,
  })
  await expect(
    page.getByRole('button', { name: 'Abrir guion Brick & Steel' }),
  ).toBeVisible()

  await page
    .getByRole('button', { name: 'Opciones del guion Brick & Steel' })
    .click()
  await page.getByRole('menuitem', { name: 'Borrar' }).click()
  await expect(page.getByRole('dialog')).toContainText('Mover a la papelera')
  await page.getByRole('button', { name: 'Mover', exact: true }).click()
  await expect(page.getByText('Guion movido a la papelera')).toBeVisible()

  await page.getByRole('button', { name: 'Deshacer' }).click()
  await expect(
    page.getByRole('button', { name: 'Abrir guion Brick & Steel' }),
  ).toBeVisible()

  await page.reload()
  await expect(page.locator('[data-engine-status="ready"]')).toBeVisible({
    timeout: 30_000,
  })
  await expect(
    page.getByRole('button', { name: 'Abrir guion Brick & Steel' }),
  ).toBeVisible()
})

test('borrado definitivo exige escribir BORRAR y persiste tras recarga', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.locator('[data-engine-status="ready"]')).toBeVisible({
    timeout: 30_000,
  })

  // Segundo guion para que el sidebar (y Ajustes) siga visible tras borrar.
  await page.getByRole('button', { name: 'Nuevo guion' }).first().click()
  await page.getByLabel('Nombre del guion').fill('Keeper')
  await page.getByRole('button', { name: 'Crear', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Abrir guion Keeper' }),
  ).toBeVisible()

  // Mover el seed a la papelera.
  await page
    .getByRole('button', { name: 'Opciones del guion Brick & Steel' })
    .click()
  await page.getByRole('menuitem', { name: 'Borrar' }).click()
  await expect(page.getByRole('dialog')).toContainText('Mover a la papelera')
  await page.getByRole('button', { name: 'Mover', exact: true }).click()
  await expect(page.getByText('Guion movido a la papelera')).toBeVisible()

  // Papelera en Ajustes → Copias.
  await page.getByRole('button', { name: 'Ajustes' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Copias' }).click()
  await page
    .getByRole('button', { name: 'Borrar definitivamente Brick & Steel' })
    .click()
  const dialog = page.getByRole('dialog', {
    name: 'Borrar definitivamente',
  })
  await expect(dialog).toBeVisible()
  const confirm = dialog.getByRole('button', {
    name: 'Borrar definitivamente',
  })
  await expect(confirm).toBeDisabled()

  // Minúsculas no valen: sigue deshabilitado.
  await dialog.getByLabel('Escribe BORRAR para confirmar').fill('borrar')
  await expect(confirm).toBeDisabled()

  await dialog.getByLabel('Escribe BORRAR para confirmar').fill('BORRAR')
  await expect(confirm).toBeEnabled()
  await confirm.click()
  await expect(page.getByText('Eliminado definitivo')).toBeVisible()
  await expect(page.getByText('Papelera vacía.')).toBeVisible()

  await page.reload()
  await expect(page.locator('[data-engine-status="ready"]')).toBeVisible({
    timeout: 30_000,
  })
  await page.getByRole('button', { name: 'Ajustes' }).click()
  await page.getByRole('button', { name: 'Copias' }).click()
  await expect(page.getByText('Papelera vacía.')).toBeVisible()
})

test('ajustes: sección Copias exporta un .json válido', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('[data-engine-status="ready"]')).toBeVisible({
    timeout: 30_000,
  })
  await page.getByRole('button', { name: 'Ajustes' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Copias' }).click()
  await expect(page.getByText('Copias de seguridad')).toBeVisible()
  await expect(page.getByRole('heading', { name: /Papelera/ })).toBeVisible()

  const download = page.waitForEvent('download', { timeout: 30_000 })
  await page.getByRole('button', { name: 'Exportar copia (.json)' }).click()
  const dl = await download
  expect(dl.suggestedFilename()).toMatch(
    /^contrascripts-\d{4}-\d{2}-\d{2}\.json$/,
  )
})
