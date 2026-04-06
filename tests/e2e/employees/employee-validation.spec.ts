import { test, expect } from '../fixtures/test'
import { hasRoleCredentials } from '../fixtures/users'
import { selectRadixOption } from '../utils/app'
import { loginAsRole } from '../utils/auth'
import { E2E_ROUTES } from '../utils/routes'

test.describe('employee form validation', () => {
  test('shows a validation error for an invalid work email', async ({ page }) => {
    test.skip(!hasRoleCredentials('admin'), 'Missing E2E admin credentials.')

    await loginAsRole(page, 'admin')
    await page.goto(E2E_ROUTES.adminEmployeesNew)
    await expect(page).toHaveURL(new RegExp(`${E2E_ROUTES.adminEmployeesNew}$`))

    await page.getByLabel(/^first name/i).fill('Validation')
    await page.getByLabel(/^last name/i).fill('Check')
    await selectRadixOption(page, '#departementId')
    await page.getByLabel(/^work email/i).fill('not-an-email')
    await page.getByLabel(/^work email/i).blur()

    await expect(page.getByText('Please enter a valid email address')).toBeVisible()
    await expect(page.getByRole('button', { name: /^create employee$/i }).first()).toBeDisabled()
  })
})
