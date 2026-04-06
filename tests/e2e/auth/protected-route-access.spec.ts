import { test, expect } from '../fixtures/test'
import { E2E_ROUTES } from '../utils/routes'

test('redirects unauthenticated users from protected routes to login', async ({ page }) => {
  await page.goto(E2E_ROUTES.adminDashboard)
  await expect(page).toHaveURL(new RegExp(`${E2E_ROUTES.login}$`))
  await expect(page.getByLabel(/^email$/i)).toBeVisible()
})
