import { test, expect } from '../fixtures/test'
import { hasRoleCredentials } from '../fixtures/users'
import { loginAsRole } from '../utils/auth'
import { E2E_ROUTES } from '../utils/routes'

test.describe('role access control', () => {
  test.describe('payroll agent restrictions', () => {
    test('blocks payroll access to admin-only pages', async ({ page }) => {
      test.skip(!hasRoleCredentials('payroll'), 'Missing E2E payroll credentials.')

      await loginAsRole(page, 'payroll')
      await page.goto(E2E_ROUTES.adminEmployees)
      await expect(page).toHaveURL(new RegExp(`${E2E_ROUTES.forbidden}$`))
    })
  })

  test.describe('employee restrictions', () => {
    test('blocks employee access to payroll-only pages', async ({ page }) => {
      test.skip(!hasRoleCredentials('employee'), 'Missing E2E employee credentials.')

      await loginAsRole(page, 'employee')
      await page.goto(E2E_ROUTES.payrollDashboard)
      await expect(page).toHaveURL(new RegExp(`${E2E_ROUTES.forbidden}$`))
    })
  })
})
