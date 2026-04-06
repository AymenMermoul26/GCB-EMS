import type { Locator, Page } from '@playwright/test'

import { test, expect } from '../fixtures/test'
import { hasRoleCredentials } from '../fixtures/users'
import { loginAsRole, loginWithCredentials, logout } from '../utils/auth'
import { buildPayrollFixtureData } from '../utils/data'
import { getPayslipEmployeeConfig } from '../utils/payslip'
import { createAndPublishPayrollRun } from '../utils/payroll'
import { E2E_ROUTES } from '../utils/routes'

function getPayrollRunEmployeeRow(page: Page, matricule: string) {
  return page.locator('tr', { hasText: matricule }).first()
}

function getPublishedPayslipRow(page: Page, runCode: string) {
  return page
    .getByText(runCode, { exact: true })
    .locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]')
}

async function expectPopupFrom(button: Locator, page: Page) {
  const [popup] = await Promise.all([page.waitForEvent('popup'), button.click()])
  await expect(popup).toBeTruthy()
  await popup.close()
}

test.describe('generated payslip access', () => {
  test.describe.configure({ mode: 'serial' })

  test('payroll and employee can open and download the same generated payslip', async ({ page }) => {
    const payslipEmployee = getPayslipEmployeeConfig()

    test.skip(
      !hasRoleCredentials('payroll') || !payslipEmployee,
      'Missing E2E payroll credentials or payslip employee credentials.',
    )
    test.setTimeout(600_000)

    const payrollData = buildPayrollFixtureData()

    await loginAsRole(page, 'payroll')
    await createAndPublishPayrollRun(page, payrollData)

    const payrollRow = getPayrollRunEmployeeRow(page, payslipEmployee.matricule)
    await expect(payrollRow).toBeVisible({ timeout: 120_000 })
    await expect(payrollRow.getByRole('button', { name: /^open$/i })).toBeVisible({
      timeout: 120_000,
    })
    await expect(payrollRow.getByRole('button', { name: /^download$/i })).toBeVisible()

    const payrollFileNameText = payrollRow.getByText(/\.pdf$/i).first()
    await expect(payrollFileNameText).toBeVisible()
    const payrollFileName = (await payrollFileNameText.textContent())?.trim() ?? ''
    expect(payrollFileName.toLowerCase()).toMatch(/\.pdf$/)

    await expectPopupFrom(
      payrollRow.getByRole('button', { name: /^open$/i }),
      page,
    )

    const [payrollDownload] = await Promise.all([
      page.waitForEvent('download'),
      payrollRow.getByRole('button', { name: /^download$/i }).click(),
    ])
    expect(payrollDownload.suggestedFilename()).toBe(payrollFileName)

    await logout(page)

    await loginWithCredentials(page, {
      email: payslipEmployee.email,
      password: payslipEmployee.password,
    })
    await page.goto(E2E_ROUTES.employeePayslips)
    await expect(page).toHaveURL(new RegExp(`${E2E_ROUTES.employeePayslips}$`))

    const employeePayslipRow = getPublishedPayslipRow(page, payrollData.runCode)
    await expect(employeePayslipRow).toBeVisible({ timeout: 120_000 })
    await expect(
      employeePayslipRow.getByRole('button', { name: /^open pdf$/i }),
    ).toBeVisible({ timeout: 120_000 })
    await expect(
      employeePayslipRow.getByRole('button', { name: /^download pdf$/i }),
    ).toBeVisible()

    const employeeFileNameText = employeePayslipRow.getByText(payrollFileName, {
      exact: true,
    })
    await expect(employeeFileNameText).toBeVisible()

    await expectPopupFrom(
      employeePayslipRow.getByRole('button', { name: /^open pdf$/i }),
      page,
    )

    const [employeeDownload] = await Promise.all([
      page.waitForEvent('download'),
      employeePayslipRow.getByRole('button', { name: /^download pdf$/i }).click(),
    ])
    expect(employeeDownload.suggestedFilename()).toBe(payrollFileName)
  })
})
