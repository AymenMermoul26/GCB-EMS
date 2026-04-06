import { test, expect } from '../fixtures/test'
import { hasRoleCredentials } from '../fixtures/users'
import { buildEmployeeFixtureData } from '../utils/data'
import { selectRadixOption } from '../utils/app'
import { loginAsRole } from '../utils/auth'
import { E2E_ROUTES } from '../utils/routes'

test.describe('employee lifecycle happy path', () => {
  test.describe.configure({ mode: 'serial' })

  test('creates, deactivates, and reactivates an employee record', async ({ page }) => {
    test.skip(!hasRoleCredentials('admin'), 'Missing E2E admin credentials.')
    test.setTimeout(120_000)

    const employeeData = buildEmployeeFixtureData()

    await loginAsRole(page, 'admin')
    await page.goto(E2E_ROUTES.adminEmployeesNew)
    await expect(page).toHaveURL(new RegExp(`${E2E_ROUTES.adminEmployeesNew}$`))

    await page.getByLabel(/^first name/i).fill(employeeData.firstName)
    await page.getByLabel(/^last name/i).fill(employeeData.lastName)
    await page.getByLabel(/^work email/i).fill(employeeData.workEmail)
    await selectRadixOption(page, '#departementId')

    await page.getByRole('button', { name: /^create employee$/i }).first().click()
    await page.waitForURL(/\/admin\/employees\/[^/]+$/)

    const deactivateButton = page.getByRole('button', { name: /deactivate employee/i }).first()
    await expect(deactivateButton).toBeVisible()
    await deactivateButton.click()

    await expect(page.getByRole('heading', { name: /deactivate employee\?/i })).toBeVisible()
    await page.getByRole('button', { name: /^confirm$/i }).click()
    await expect(page.getByText(/employee deactivated\./i)).toBeVisible({ timeout: 60_000 })

    await page.reload()
    await expect(page.getByText(/^inactive$/i).first()).toBeVisible()

    const activateButton = page.getByRole('button', { name: /activate employee/i }).first()
    await expect(activateButton).toBeVisible()
    await activateButton.click()

    await expect(page.getByRole('heading', { name: /activate employee\?/i })).toBeVisible()
    await page.getByRole('button', { name: /^confirm$/i }).click()
    await expect(page.getByText(/employee activated\./i)).toBeVisible({ timeout: 60_000 })

    await page.reload()
    await expect(page.getByText(/^active$/i).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /deactivate employee/i }).first()).toBeVisible()
  })
})
