import { test, expect } from '@playwright/test'

// Prueba de humo contra el sitio real — solo lectura/navegación, nunca
// crea, edita ni borra datos. Credenciales vienen de variables de entorno
// (ver .env.test.example), nunca hardcodeadas.
const EMAIL = process.env.ROBSEN_TEST_EMAIL
const PASS = process.env.ROBSEN_TEST_PASSWORD

test.skip(!EMAIL || !PASS, 'Faltan ROBSEN_TEST_EMAIL / ROBSEN_TEST_PASSWORD en el entorno')

test('iniciar sesión y llegar al panel principal', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('¿Quién eres?')).toBeVisible()

  await page.getByPlaceholder('Buscar por correo o teléfono…').fill(EMAIL!)
  await page.getByRole('button', { name: 'Buscar' }).click()

  await page.locator('#rb_pass').fill(PASS!)
  await page.getByRole('button', { name: 'Entrar' }).click()

  await expect(page.getByText('Cerrar sesión')).toBeVisible({ timeout: 15_000 })
})

test('la pantalla de Ventas carga el listado y los KPIs', async ({ page }) => {
  await page.goto('/')
  await page.getByPlaceholder('Buscar por correo o teléfono…').fill(EMAIL!)
  await page.getByRole('button', { name: 'Buscar' }).click()
  await page.locator('#rb_pass').fill(PASS!)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByText('Cerrar sesión')).toBeVisible({ timeout: 15_000 })

  await page.getByText('Ventas', { exact: true }).first().click()
  await expect(page.getByText('Ventas de hoy')).toBeVisible({ timeout: 10_000 })
  // La columna Hora del listado principal debe estar visible (verificación
  // del cambio más reciente en Ventas.tsx).
  await expect(page.getByRole('columnheader', { name: 'Hora' }).first()).toBeVisible()
})
