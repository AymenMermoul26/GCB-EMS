import { type Page } from '@playwright/test'

import { test, expect } from '../fixtures/test'
import { hasRoleCredentials } from '../fixtures/users'
import { createUniqueSuffix } from '../utils/app'
import { loginAsRole, logout } from '../utils/auth'
import { E2E_ROUTES } from '../utils/routes'

const EMPLOYEE_MATRICULE = 'GCB-000008'

function getOpenVisibilityRow(page: Page) {
  return page
    .locator('tr', { hasText: EMPLOYEE_MATRICULE })
    .filter({ hasText: /pending|in review/i })
    .first()
}

test.describe('employee visibility request flow', () => {
  test.describe.configure({ mode: 'serial' })

  test('employee submits a public visibility request and admin can review it', async ({ page }) => {
    test.skip(
      !hasRoleCredentials('admin') || !hasRoleCredentials('employee'),
      'Missing E2E admin or employee credentials.',
    )
    test.setTimeout(150_000)

    const requestNote = `Playwright visibility request ${createUniqueSuffix()}`
    let activeRequestNote: string | null = null

    await loginAsRole(page, 'employee')
    await page.goto(E2E_ROUTES.employeeMyQr)
    await expect(page).toHaveURL(new RegExp(`${E2E_ROUTES.employeeMyQr}$`))

    const firstSwitch = page.getByRole('switch').first()
    if ((await firstSwitch.count()) === 0) {
      await expect(page.getByText(/review in progress/i)).toBeVisible()
    } else {
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
      await expect(page.getByText(/review in progress/i)).toBeVisible()
      await expect(page.getByText(requestNote).first()).toBeVisible()
      activeRequestNote = requestNote
    }

    await logout(page)

    await loginAsRole(page, 'admin')
    await page.goto(E2E_ROUTES.adminRequests)
    await expect(page).toHaveURL(new RegExp(`${E2E_ROUTES.adminRequests}$`))

    const row = getOpenVisibilityRow(page)
    await expect(row).toBeVisible({ timeout: 45_000 })

    await expect(row.getByText(/^pending$/i)).toBeVisible()
    await row.click()

    const detailsDialog = page.getByRole('dialog').first()
    await expect(detailsDialog).toBeVisible()
    await expect(detailsDialog.getByRole('button', { name: /^approve$/i })).toBeVisible()
    await expect(detailsDialog.getByRole('button', { name: /^reject$/i })).toBeVisible()
    if (activeRequestNote) {
      await expect(detailsDialog.getByText(activeRequestNote).first()).toBeVisible()
    }

    await detailsDialog.getByRole('button', { name: /^reject$/i }).click()

    const rejectionDialog = page
      .getByRole('dialog')
      .filter({ has: page.getByRole('heading', { name: /reject visibility request/i }) })
      .last()

    await expect(rejectionDialog).toBeVisible()

    const reviewNote = rejectionDialog.locator('#visibility-review-note')
    await expect(reviewNote).toBeVisible()
    await reviewNote.fill('Playwright rejected request after admin verification.')

    await rejectionDialog.getByRole('button', { name: /^reject request$/i }).click()

    await expect(row).not.toBeVisible({ timeout: 45_000 })
  })
})
