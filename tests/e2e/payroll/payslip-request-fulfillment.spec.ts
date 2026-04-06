import type { Locator, Page } from '@playwright/test'

import { test, expect } from '../fixtures/test'
import { hasRoleCredentials } from '../fixtures/users'
import { createUniqueSuffix } from '../utils/app'
import { loginAsRole, loginWithCredentials, logout } from '../utils/auth'
import { buildPayrollFixtureData } from '../utils/data'
import { getPayslipEmployeeConfig } from '../utils/payslip'
import {
  advanceRunLifecycle,
  createPayrollPeriodAndRun,
} from '../utils/payroll'
import { E2E_ROUTES } from '../utils/routes'

function getEmployeeRequestCard(page: Page, requestNote: string) {
  return page
    .getByText(requestNote, { exact: true })
    .locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]')
}

function getPayrollRequestCard(page: Page, requestNote: string) {
  return page
    .getByText(requestNote, { exact: true })
    .locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]')
}

function getPeriodRow(page: Page, periodCode: string) {
  return page
    .getByText(periodCode, { exact: true })
    .locator('xpath=ancestor::div[contains(@class,"rounded-2xl") and .//button][1]')
    .first()
}

function getRunRow(page: Page, runCode: string) {
  return page
    .getByText(runCode, { exact: true })
    .locator('xpath=ancestor::div[contains(@class,"rounded-2xl") and .//a[@href] and .//button][1]')
    .first()
}

function getPayrollRunEmployeeRow(page: Page, matricule: string) {
  return page.locator('tr', { hasText: matricule }).first()
}

async function expectPopupFrom(button: Locator, page: Page) {
  const [popup] = await Promise.all([page.waitForEvent('popup'), button.click()])
  await expect(popup).toBeTruthy()
  await popup.close()
}

test.describe('payslip request fulfillment', () => {
  test.describe.configure({ mode: 'serial' })

  test('employee requests a payslip before publication and payroll fulfills it after publication', async ({
    page,
  }) => {
    const payslipEmployee = getPayslipEmployeeConfig()

    test.skip(
      !hasRoleCredentials('payroll') || !payslipEmployee,
      'Missing E2E payroll credentials or payslip employee credentials.',
    )
    test.setTimeout(600_000)

    const payrollData = buildPayrollFixtureData()
    const requestNote = `Playwright payslip request ${createUniqueSuffix()}`
    const payrollReviewNote = `Playwright payroll review ${createUniqueSuffix()}`

    await loginAsRole(page, 'payroll')
    await createPayrollPeriodAndRun(page, payrollData)

    await page.goto(E2E_ROUTES.payrollProcessing)
    await expect(page).toHaveURL(new RegExp(`${E2E_ROUTES.payrollProcessing}$`))

    const periodRow = getPeriodRow(page, payrollData.periodCode)
    await expect(periodRow).toBeVisible({ timeout: 45_000 })
    await periodRow.getByRole('button', { name: /^open period$/i }).click()
    await expect(periodRow.getByText(/^open$/i).first()).toBeVisible({ timeout: 45_000 })
    await expect(periodRow.getByRole('button', { name: /^close period$/i })).toBeVisible({
      timeout: 45_000,
    })
    await logout(page)

    await loginWithCredentials(page, {
      email: payslipEmployee.email,
      password: payslipEmployee.password,
    })
    await page.goto(E2E_ROUTES.employeePayslips)
    await expect(page).toHaveURL(new RegExp(`${E2E_ROUTES.employeePayslips}$`))

    const requestPayslipButton = page.getByRole('button', { name: /^request payslip$/i })
    await expect(requestPayslipButton).toBeVisible()
    await requestPayslipButton.click()

    const requestDialog = page
      .getByRole('dialog')
      .filter({ has: page.getByRole('heading', { name: /^request payslip$/i }) })
      .last()
    await expect(requestDialog).toBeVisible()

    const payrollPeriodTrigger = requestDialog.locator('#payslipRequestPeriod')
    await expect(payrollPeriodTrigger).toBeVisible()
    await payrollPeriodTrigger.click()
    await page.getByRole('option', { name: new RegExp(payrollData.periodLabel, 'i') }).click({
      timeout: 120_000,
    })

    await requestDialog.locator('#payslipRequestNote').fill(requestNote)
    await requestDialog.getByRole('button', { name: /^submit$/i }).click()

    await expect(page.getByText(/^payslip request submitted\.$/i)).toBeVisible({
      timeout: 45_000,
    })

    const employeePendingRequestCard = getEmployeeRequestCard(page, requestNote)
    await expect(employeePendingRequestCard).toBeVisible({ timeout: 45_000 })
    await expect(employeePendingRequestCard.getByText(/^pending$/i)).toBeVisible()
    await logout(page)

    await loginAsRole(page, 'payroll')
    await page.goto(E2E_ROUTES.payrollProcessing)
    await expect(page).toHaveURL(new RegExp(`${E2E_ROUTES.payrollProcessing}$`))

    const runRow = getRunRow(page, payrollData.runCode)
    await expect(runRow).toBeVisible({ timeout: 45_000 })
    await runRow.getByRole('link', { name: /^open run$/i }).click()
    await page.waitForURL(/\/payroll\/runs\//)
    await expect(page.getByRole('heading', { name: payrollData.runCode })).toBeVisible()

    await advanceRunLifecycle(page, /^calculate run$/i, /^send to review$/i)
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 120_000 })
    await advanceRunLifecycle(page, /^send to review$/i, /^finalize run$/i)
    await advanceRunLifecycle(page, /^finalize run$/i, /^publish payslips$/i)
    await advanceRunLifecycle(page, /^publish payslips$/i, /^archive run$/i, 360_000)

    const payrollRunEmployeeRow = getPayrollRunEmployeeRow(page, payslipEmployee.matricule)
    await expect(payrollRunEmployeeRow).toBeVisible({ timeout: 120_000 })
    await expect(payrollRunEmployeeRow.getByRole('button', { name: /^open$/i })).toBeVisible({
      timeout: 120_000,
    })

    await page.goto(E2E_ROUTES.payrollPayslipRequests)
    await expect(page).toHaveURL(new RegExp(`${E2E_ROUTES.payrollPayslipRequests}$`))

    const payrollSearchInput = page.getByPlaceholder(/search by employee or period/i)
    await expect(payrollSearchInput).toBeVisible()
    await payrollSearchInput.fill(payrollData.periodCode)

    const payrollRequestCard = getPayrollRequestCard(page, requestNote)
    await expect(payrollRequestCard).toBeVisible({ timeout: 45_000 })
    await payrollRequestCard.getByRole('button', { name: /^review$/i }).click()

    const reviewDialog = page
      .getByRole('dialog')
      .filter({ has: page.getByRole('heading', { name: /^review payslip request$/i }) })
      .last()
    await expect(reviewDialog).toBeVisible()
    await expect(reviewDialog.getByText(payrollData.periodLabel)).toBeVisible()
    await expect(reviewDialog.getByText(requestNote, { exact: true })).toBeVisible()

    await reviewDialog.getByRole('button', { name: /^in review$/i }).click()
    await expect(page.getByText(/^payslip request status updated\.$/i)).toBeVisible({
      timeout: 45_000,
    })
    await expect(reviewDialog.getByText(/^in review$/i).first()).toBeVisible({
      timeout: 45_000,
    })

    const reviewNoteField = reviewDialog.locator('#payslipRequestReviewNote')
    await expect(reviewNoteField).toBeVisible()
    await reviewNoteField.fill(payrollReviewNote)

    const canonicalOpenButton = reviewDialog.getByRole('button', { name: /^open$/i }).first()
    const canonicalDownloadButton = reviewDialog.getByRole('button', {
      name: /^download$/i,
    }).first()
    await expect(canonicalOpenButton).toBeVisible({ timeout: 45_000 })
    await expect(canonicalDownloadButton).toBeVisible()

    await reviewDialog.getByRole('button', { name: /^deliver available payslip$/i }).click()
    await expect(
      page.getByText(
        /^payslip request fulfilled and linked to the available payslip document\.$/i,
      ),
    ).toBeVisible({ timeout: 45_000 })
    await expect(reviewDialog).not.toBeVisible({ timeout: 45_000 })
    await logout(page)

    await loginWithCredentials(page, {
      email: payslipEmployee.email,
      password: payslipEmployee.password,
    })
    await page.goto(E2E_ROUTES.employeePayslips)
    await expect(page).toHaveURL(new RegExp(`${E2E_ROUTES.employeePayslips}$`))

    const employeeFulfilledRequestCard = getEmployeeRequestCard(page, requestNote)
    await expect(employeeFulfilledRequestCard).toBeVisible({ timeout: 45_000 })
    await expect(employeeFulfilledRequestCard.getByText(/^fulfilled$/i)).toBeVisible()
    await expect(
      employeeFulfilledRequestCard.getByText(payrollReviewNote, { exact: true }),
    ).toBeVisible()

    const openPdfButton = employeeFulfilledRequestCard.getByRole('button', {
      name: /^open pdf$/i,
    })
    const downloadPdfButton = employeeFulfilledRequestCard.getByRole('button', {
      name: /^download pdf$/i,
    })
    await expect(openPdfButton).toBeVisible()
    await expect(downloadPdfButton).toBeVisible()

    await expectPopupFrom(openPdfButton, page)

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      downloadPdfButton.click(),
    ])
    expect(download.suggestedFilename().toLowerCase()).toMatch(/\.pdf$/)
  })
})
