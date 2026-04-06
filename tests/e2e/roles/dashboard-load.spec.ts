import { test, expect } from '../fixtures/test'
import { hasRoleCredentials } from '../fixtures/users'
import { loginAsRole } from '../utils/auth'
import { E2E_ROUTES } from '../utils/routes'

test.describe('dashboard and landing pages', () => {
  test.describe('admin', () => {
    test('loads the admin dashboard', async ({ page }) => {
      test.skip(!hasRoleCredentials('admin'), 'Missing E2E admin credentials.')

      await loginAsRole(page, 'admin')
      await page.goto(E2E_ROUTES.adminDashboard)
      await expect(page).toHaveURL(new RegExp(`${E2E_ROUTES.adminDashboard}$`))
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
    })
  })

  test.describe('payroll', () => {
    test('loads the payroll dashboard', async ({ page }) => {
      test.skip(!hasRoleCredentials('payroll'), 'Missing E2E payroll credentials.')

      await loginAsRole(page, 'payroll')
      await page.goto(E2E_ROUTES.payrollDashboard)
      await expect(page).toHaveURL(new RegExp(`${E2E_ROUTES.payrollDashboard}$`))
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
      await expect(page.getByRole('link', { name: /open processing/i }).first()).toBeVisible()
    })
  })

  test.describe('employee', () => {
    test('loads the employee profile page', async ({ page }) => {
      test.skip(!hasRoleCredentials('employee'), 'Missing E2E employee credentials.')

      await loginAsRole(page, 'employee')
      await page.goto(E2E_ROUTES.employeeProfile)
      await expect(page).toHaveURL(new RegExp(`${E2E_ROUTES.employeeProfile}$`))
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
    })
  })
})
