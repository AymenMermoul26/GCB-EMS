import { test, expect } from '../fixtures/test'
import { hasRoleCredentials } from '../fixtures/users'
import { loginAsRole, logout } from '../utils/auth'
import { E2E_ROUTES } from '../utils/routes'

test('allows an authenticated user to log out cleanly', async ({ page }) => {
  test.skip(!hasRoleCredentials('admin'), 'Missing E2E admin credentials.')

  await loginAsRole(page, 'admin')
  await expect(page).toHaveURL(new RegExp(`${E2E_ROUTES.adminEmployees}$`))

  await logout(page)
})
