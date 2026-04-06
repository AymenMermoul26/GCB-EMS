import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import type { PayrollFixtureData } from './data'
import { selectRadixOption } from './app'
import { E2E_ROUTES } from './routes'

export async function createPayrollPeriodAndRun(page: Page, payrollData: PayrollFixtureData) {
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

  const runRow = page
    .getByText(payrollData.runCode, { exact: true })
    .locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]')
  await expect(runRow).toBeVisible()
  await runRow.getByRole('link', { name: /^open run$/i }).click()
  await page.waitForURL(/\/payroll\/runs\//)
  await expect(page.getByRole('heading', { name: payrollData.runCode })).toBeVisible()
}

export async function advanceRunLifecycle(
  page: Page,
  actionLabel: RegExp,
  expectedNextActionLabel: RegExp,
  timeout = 120_000,
) {
  await page.getByRole('button', { name: actionLabel }).click()
  await expect(page.getByRole('button', { name: expectedNextActionLabel })).toBeVisible({
    timeout,
  })
}

export async function createAndPublishPayrollRun(page: Page, payrollData: PayrollFixtureData) {
  await createPayrollPeriodAndRun(page, payrollData)
  await advanceRunLifecycle(page, /^calculate run$/i, /^send to review$/i)
  await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 120_000 })
  await advanceRunLifecycle(page, /^send to review$/i, /^finalize run$/i)
  await advanceRunLifecycle(page, /^finalize run$/i, /^publish payslips$/i)
  await advanceRunLifecycle(page, /^publish payslips$/i, /^archive run$/i, 360_000)
}
