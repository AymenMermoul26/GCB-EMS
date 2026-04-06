import { test, expect } from '../fixtures/test'
import { hasRoleCredentials } from '../fixtures/users'
import { buildEmployeeFixtureData } from '../utils/data'
import { selectRadixOption } from '../utils/app'
import { loginAsRole } from '../utils/auth'
import { E2E_ROUTES } from '../utils/routes'

test.describe('employee CRUD happy path', () => {
  test.describe.configure({ mode: 'serial' })

  test('creates and updates an employee record', async ({ page }) => {
    test.skip(!hasRoleCredentials('admin'), 'Missing E2E admin credentials.')

    const employeeData = buildEmployeeFixtureData()

    await loginAsRole(page, 'admin')
    await page.goto(E2E_ROUTES.adminEmployeesNew)
    await expect(page).toHaveURL(new RegExp(`${E2E_ROUTES.adminEmployeesNew}$`))

    await page.getByLabel(/^first name/i).fill(employeeData.firstName)
    await page.getByLabel(/^last name/i).fill(employeeData.lastName)
    await page.getByLabel(/^work email/i).fill(employeeData.workEmail)
    await selectRadixOption(page, '#departementId')

    const createButtons = page.getByRole('button', { name: /^create employee$/i })
    await expect(createButtons.first()).toBeEnabled()
    await createButtons.first().click()

    await page.waitForURL(/\/admin\/employees\/[^/]+$/)
    await expect(page.getByRole('button', { name: /edit employee/i }).first()).toBeVisible()

    await page.getByRole('button', { name: /edit employee/i }).first().click()
    await page.waitForURL(/\/admin\/employees\/[^/]+\/edit$/)

    await page.getByLabel(/^first name/i).fill(employeeData.updatedFirstName)
    await page.getByRole('button', { name: /^save changes$/i }).first().click()

    await page.waitForURL(/\/admin\/employees\/[^/]+$/)
    await page.getByRole('button', { name: /edit employee/i }).first().click()
    await page.waitForURL(/\/admin\/employees\/[^/]+\/edit$/)
    await expect(page.getByLabel(/^first name/i)).toHaveValue(employeeData.updatedFirstName)
  })
})
