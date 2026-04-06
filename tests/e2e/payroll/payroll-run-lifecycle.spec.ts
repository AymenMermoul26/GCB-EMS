import { test, expect } from '../fixtures/test'
import { hasRoleCredentials } from '../fixtures/users'
import { loginAsRole } from '../utils/auth'
import { buildPayrollFixtureData } from '../utils/data'
import { advanceRunLifecycle, createPayrollPeriodAndRun } from '../utils/payroll'

test.describe('payroll run lifecycle', () => {
  test.describe.configure({ mode: 'serial' })

  test('creates, calculates, reviews, finalizes, and publishes a payroll run', async ({ page }) => {
    test.skip(!hasRoleCredentials('payroll'), 'Missing E2E payroll credentials.')
    test.setTimeout(600_000)

    const payrollData = buildPayrollFixtureData()

    await loginAsRole(page, 'payroll')
    await createPayrollPeriodAndRun(page, payrollData)

    await advanceRunLifecycle(page, /^calculate run$/i, /^send to review$/i)

    await expect(page.getByRole('button', { name: /^recalculate$/i })).toBeVisible({
      timeout: 120_000,
    })
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 120_000 })

    await advanceRunLifecycle(page, /^send to review$/i, /^finalize run$/i)
    await expect(page.getByText(/^under review$/i).first()).toBeVisible()

    await advanceRunLifecycle(page, /^finalize run$/i, /^publish payslips$/i)
    await expect(page.getByText(/^finalized$/i).first()).toBeVisible()

    await advanceRunLifecycle(page, /^publish payslips$/i, /^archive run$/i, 360_000)
    await expect(page.getByText(/^published$/i).first()).toBeVisible()
    await expect(
      page.getByText(/document generated|document generation pending|document generation failed/i).first(),
    ).toBeVisible({ timeout: 120_000 })
  })
})
