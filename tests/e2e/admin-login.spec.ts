import { expect, test } from '@playwright/test'

test('redirige a /ingresar cuando no hay sesión', async ({ page }) => {
  await page.goto('/admin')
  await expect(page).toHaveURL(/\/ingresar/)
})

test('rechaza credenciales inválidas', async ({ page }) => {
  await page.goto('/ingresar')
  await page.getByLabel('Email').fill('nadie@ejemplo.com')
  await page.getByLabel('Contraseña').fill('clave-incorrecta')
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page.getByText('Email o contraseña incorrectos.')).toBeVisible()
})

test('permite ingresar con el administrador de prueba', async ({ page }) => {
  test.skip(!process.env.ADMIN_EMAIL_PRUEBA, 'Falta ADMIN_EMAIL_PRUEBA en .env.local')

  await page.goto('/ingresar')
  await page.getByLabel('Email').fill(process.env.ADMIN_EMAIL_PRUEBA!)
  await page.getByLabel('Contraseña').fill(process.env.ADMIN_CLAVE_PRUEBA!)
  await page.getByRole('button', { name: 'Ingresar' }).click()
  // La primera visita a /admin compila la ruta en el dev server (varios
  // segundos con Turbopack en frío), así que se da un margen amplio.
  await expect(page).toHaveURL(/\/admin/, { timeout: 20_000 })
})
