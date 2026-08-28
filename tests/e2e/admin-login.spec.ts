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
  await expect(page.getByRole('alert')).toHaveText('Email o contraseña incorrectos.')
})

test('permite ingresar con el administrador de prueba', async ({ page }) => {
  test.skip(!process.env.ADMIN_EMAIL_PRUEBA, 'Falta ADMIN_EMAIL_PRUEBA en .env.local')

  await page.goto('/ingresar')
  await page.getByLabel('Email').fill(process.env.ADMIN_EMAIL_PRUEBA!)
  await page.getByLabel('Contraseña').fill(process.env.ADMIN_CLAVE_PRUEBA!)
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await expect(page).toHaveURL(/\/admin/)
})
