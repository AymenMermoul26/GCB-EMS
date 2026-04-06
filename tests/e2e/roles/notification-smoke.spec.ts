import type { Page } from '@playwright/test'

import { test, expect } from '../fixtures/test'
import { hasRoleCredentials } from '../fixtures/users'
import { createUniqueSuffix, selectRadixOption } from '../utils/app'
import { loginAsRole, logout } from '../utils/auth'
import { buildEmployeeFixtureData } from '../utils/data'
import { E2E_ROUTES } from '../utils/routes'

const EMPLOYEE_MATRICULE = 'GCB-000008'

function getNearestNotificationCardByText(page: Page, text: string | RegExp) {
  const title = typeof text === 'string' ? page.getByText(text, { exact: true }).first() : page.getByText(text).first()
  return title.locator('xpath=ancestor::div[contains(@class,"rounded-xl") or contains(@class,"rounded-2xl")]').first()
}

function getOpenVisibilityRequestRow(page: Page) {
  return page
    .locator('tr', { hasText: EMPLOYEE_MATRICULE })
    .filter({ hasText: /pending|in review/i })
    .first()
}

test.describe('notification smoke tests by role', () => {
  test.describe.configure({ mode: 'serial' })

  test('admin-created employee appears in payroll notifications and can be marked read', async ({ page }) => {
    test.skip(
      !hasRoleCredentials('admin') || !hasRoleCredentials('payroll'),
      'Missing E2E admin or payroll credentials.',
    )
    test.setTimeout(150_000)

    const employeeData = buildEmployeeFixtureData()
    const fullName = `${employeeData.firstName} ${employeeData.lastName}`

    await loginAsRole(page, 'admin')
    await page.goto(E2E_ROUTES.adminEmployeesNew)
    await expect(page).toHaveURL(new RegExp(`${E2E_ROUTES.adminEmployeesNew}$`))

    await page.getByLabel(/^first name/i).fill(employeeData.firstName)
    await page.getByLabel(/^last name/i).fill(employeeData.lastName)
    await page.getByLabel(/^work email/i).fill(employeeData.workEmail)
    await selectRadixOption(page, '#departementId')

    const createButton = page.getByRole('button', { name: /^create employee$/i }).first()
    await expect(createButton).toBeEnabled()
    await createButton.click()

    await page.waitForURL(/\/admin\/employees\/[^/]+$/)
    await expect(page.locator('main').getByRole('heading', { name: /employee profile/i }).first()).toBeVisible()

    await logout(page)

    await loginAsRole(page, 'payroll')
    await page.goto(E2E_ROUTES.payrollNotifications)
    await expect(page).toHaveURL(new RegExp(`${E2E_ROUTES.payrollNotifications}$`))

    const notificationCard = getNearestNotificationCardByText(page, fullName)

    await expect(notificationCard).toBeVisible({ timeout: 45_000 })
    await expect(page.getByText(fullName, { exact: true })).toBeVisible()

    await notificationCard.getByRole('button', { name: /^inspect$/i }).click()

    const detailsDialog = page.getByRole('dialog').last()
    await expect(detailsDialog).toBeVisible()
    await expect(detailsDialog.getByRole('heading', { name: fullName })).toBeVisible()
    await expect(detailsDialog.getByText(/^new employee$/i)).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(detailsDialog).not.toBeVisible({ timeout: 15_000 })
    await expect(notificationCard.getByText(/^read$/i)).toBeVisible({ timeout: 45_000 })
  })

  test('admin rejection of a visibility request notifies the employee without leaking into payroll notifications', async ({ page }) => {
    test.skip(
      !hasRoleCredentials('admin') ||
        !hasRoleCredentials('employee') ||
        !hasRoleCredentials('payroll'),
      'Missing E2E admin, employee, or payroll credentials.',
    )
    test.setTimeout(150_000)

    const requestNote = `Playwright notification visibility request ${createUniqueSuffix()}`
    const reviewNote = `Playwright visibility rejection ${createUniqueSuffix()}`
    await loginAsRole(page, 'employee')
    await page.goto(E2E_ROUTES.notifications)
    await expect(page).toHaveURL(new RegExp(`${E2E_ROUTES.notifications}$`))

    const markAllReadButton = page.getByRole('button', { name: /^mark all as read$/i })
    if (await markAllReadButton.isEnabled()) {
      await markAllReadButton.click()
      await expect(page.getByText(/unread 0/i)).toBeVisible({ timeout: 45_000 })
    }

    await page.goto(E2E_ROUTES.employeeMyQr)
    await expect(page).toHaveURL(new RegExp(`${E2E_ROUTES.employeeMyQr}$`))

    await page.waitForFunction(() => {
      const hasSwitches = document.querySelectorAll('[role="switch"]').length > 0
      const hasReviewState = document.body.innerText.toLowerCase().includes('review in progress')
      return hasSwitches || hasReviewState
    })

    const switchLocator = page.locator('[role="switch"]')
    const hasEditableVisibilityForm = (await switchLocator.count()) > 0

    if (hasEditableVisibilityForm) {
      const firstSwitch = switchLocator.first()
      await expect(firstSwitch).toBeVisible()
      const submitButton = page.getByRole('button', { name: /^submit for approval$/i }).last()
      await expect(submitButton).toBeDisabled()
      await firstSwitch.click()

      const requestNoteField = page.locator('#public-visibility-request-note')
      await expect(requestNoteField).toBeVisible()
      await requestNoteField.fill(requestNote)

      await expect(submitButton).toBeEnabled()
      await submitButton.click()

      await expect(
        page.getByRole('heading', { name: /submit public visibility request\?/i }),
      ).toBeVisible()
      await page.getByRole('button', { name: /^confirm request$/i }).click()

      await expect(page.getByText(/public profile visibility request submitted\./i)).toBeVisible({
        timeout: 45_000,
      })
    } else {
      await expect(page.getByText(/review in progress/i)).toBeVisible()
    }

    await logout(page)

    await loginAsRole(page, 'admin')
    await page.goto(E2E_ROUTES.adminRequests)
    await expect(page).toHaveURL(new RegExp(`${E2E_ROUTES.adminRequests}$`))

    const requestRow = getOpenVisibilityRequestRow(page)
    await expect(requestRow).toBeVisible({ timeout: 45_000 })
    await requestRow.click()

    const detailsDialog = page.getByRole('dialog').first()
    await expect(detailsDialog).toBeVisible()
    await detailsDialog.getByRole('button', { name: /^reject$/i }).click()

    const rejectionDialog = page
      .getByRole('dialog')
      .filter({ has: page.getByRole('heading', { name: /reject visibility request/i }) })
      .last()

    await expect(rejectionDialog).toBeVisible()

    const reviewNoteField = rejectionDialog.locator('#visibility-review-note')
    await expect(reviewNoteField).toBeVisible()
    await reviewNoteField.fill(reviewNote)
    await rejectionDialog.getByRole('button', { name: /^reject request$/i }).click()
    await expect(rejectionDialog).not.toBeVisible({ timeout: 45_000 })
    await page.keyboard.press('Escape')
    await expect(detailsDialog).not.toBeVisible({ timeout: 15_000 })

    await logout(page)

    await loginAsRole(page, 'employee')
    await page.goto(E2E_ROUTES.notifications)
    await expect(page).toHaveURL(new RegExp(`${E2E_ROUTES.notifications}$`))

    await page.getByRole('tab', { name: /^unread$/i }).click()

    const searchInput = page.getByRole('textbox', { name: /search notifications/i })
    await expect(searchInput).toBeVisible()
    await searchInput.fill('Public profile request rejected')

    await expect(page.getByText(/^public profile request rejected$/i).first()).toBeVisible({
      timeout: 45_000,
    })

    const markReadButtons = page.getByRole('button', {
      name: /^mark as read$/i,
    })
    const unreadRejectedCountBefore = await markReadButtons.count()
    const markReadButton = markReadButtons.first()
    await expect(markReadButton).toBeVisible()
    await markReadButton.click()
    await expect
      .poll(async () => page.getByRole('button', { name: /^mark as read$/i }).count(), {
        timeout: 45_000,
      })
      .toBe(unreadRejectedCountBefore - 1)

    await logout(page)

    await loginAsRole(page, 'payroll')
    await page.goto(E2E_ROUTES.payrollNotifications)
    await expect(page).toHaveURL(new RegExp(`${E2E_ROUTES.payrollNotifications}$`))

    await expect(page.getByText(/public profile request (submitted|rejected)/i)).toHaveCount(0)
  })
})
