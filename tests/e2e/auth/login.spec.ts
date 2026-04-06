import { test, expect } from '../fixtures/test'
import { getRoleCredentials, hasRoleCredentials } from '../fixtures/users'
import { gotoLogin, loginAsRole } from '../utils/auth'
import { E2E_ROUTES } from '../utils/routes'

test('allows a valid admin user to sign in', async ({ page }) => {
  test.skip(!hasRoleCredentials('admin'), 'Missing E2E admin credentials.')

  await loginAsRole(page, 'admin')
  await expect(page).toHaveURL(new RegExp(`${E2E_ROUTES.adminEmployees}$`))
  await expect(page.getByRole('button', { name: /^logout$/i }).first()).toBeVisible()
})

test('shows an authentication error for invalid credentials', async ({ page }) => {
  test.skip(!hasRoleCredentials('admin'), 'Missing E2E admin credentials.')

  const { email } = getRoleCredentials('admin')

  await gotoLogin(page)
  await page.getByLabel(/^email$/i).fill(email)
  await page.getByLabel(/^password$/i).fill('definitely-wrong-password')
  await page.getByRole('button', { name: /^sign in$/i }).click()

  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`${E2E_ROUTES.login}$`))
})
