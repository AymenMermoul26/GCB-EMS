import { test, expect } from '../fixtures/test'
import { hasRoleCredentials } from '../fixtures/users'
import { buildPayrollFixtureData } from '../utils/data'
import { selectRadixOption } from '../utils/app'
import { loginAsRole } from '../utils/auth'
import { E2E_ROUTES } from '../utils/routes'

test.describe('payroll processing happy path', () => {
  test.describe.configure({ mode: 'serial' })

  test('creates a payroll period and a payroll run', async ({ page }) => {
    test.skip(!hasRoleCredentials('payroll'), 'Missing E2E payroll credentials.')

    const payrollData = buildPayrollFixtureData()

    await loginAsRole(page, 'payroll')
    await page.goto(E2E_ROUTES.payrollProcessing)
    await expect(page).toHaveURL(new RegExp(`${E2E_ROUTES.payrollProcessing}$`))

    await page.getByRole('button', { name: /^new period$/i }).click()
    await page.getByLabel(/^code$/i).fill(payrollData.periodCode)
    await page.getByLabel(/^label$/i).fill(payrollData.periodLabel)
    await page.locator('#payroll-period-start').fill(payrollData.periodStart)
    await page.locator('#payroll-period-end').fill(payrollData.periodEnd)
    await page.getByRole('button', { name: /^create period$/i }).click()

    await expect(page.getByText(payrollData.periodLabel).first()).toBeVisible()
    await expect(page.getByText(payrollData.periodCode).first()).toBeVisible()

    await page.getByRole('button', { name: /^new run$/i }).click()
    await selectRadixOption(page, '#payroll-run-period', payrollData.periodLabel)
    await page.getByLabel(/^run code$/i).fill(payrollData.runCode)
    await page.getByLabel(/^notes$/i).fill(payrollData.runNotes)
    await page.getByRole('button', { name: /^create run$/i }).click()

    await expect(page.getByText(payrollData.runCode).first()).toBeVisible()
  })
})
