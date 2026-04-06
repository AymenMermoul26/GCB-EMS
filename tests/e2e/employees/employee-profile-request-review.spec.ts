import { test, expect } from '../fixtures/test'
import { hasRoleCredentials } from '../fixtures/users'
import { createUniqueSuffix, selectRadixOption } from '../utils/app'
import { loginAsRole, logout } from '../utils/auth'
import { E2E_ROUTES } from '../utils/routes'

test.describe('employee profile modification request review flow', () => {
  test.describe.configure({ mode: 'serial' })

  test('employee submits a profile change request and admin rejects it with a visible reason', async ({ page }) => {
    test.skip(
      !hasRoleCredentials('admin') || !hasRoleCredentials('employee'),
      'Missing E2E admin or employee credentials.',
    )
    test.setTimeout(150_000)

    const suffix = createUniqueSuffix()
    const requestNote = `Playwright profile request ${suffix}`
    const requestedAddress = `E2E Address ${suffix}`
    const rejectionReason = `Playwright rejection reason ${suffix}`

    await loginAsRole(page, 'employee')
    await page.goto(E2E_ROUTES.employeeProfileManage)
    await expect(page).toHaveURL(new RegExp(`${E2E_ROUTES.employeeProfileManage}$`))

    const requestSection = page.locator('#requests')
    await expect(requestSection).toBeVisible()

    const fieldSelect = requestSection.getByRole('combobox').first()
    await selectRadixOption(page, fieldSelect, 'Address')

    const requestedValueInput = requestSection.locator('input:not([disabled])').last()
    await expect(requestedValueInput).toBeVisible()
    await requestedValueInput.fill(requestedAddress)

    const requestNoteField = requestSection.locator('textarea').last()
    await expect(requestNoteField).toBeVisible()
    await requestNoteField.fill(requestNote)

    const submitForApprovalButton = page.getByRole('button', { name: /^submit for approval$/i }).last()
    await expect(submitForApprovalButton).toBeEnabled()
    await submitForApprovalButton.click()

    await expect(page.getByRole('heading', { name: /submit changes for approval\?/i })).toBeVisible()
    await page.getByRole('button', { name: /^send$/i }).click()

    await expect(page.getByText(/request submitted successfully\./i)).toBeVisible({ timeout: 45_000 })

    await page.goto(E2E_ROUTES.employeeRequests)
    await expect(page).toHaveURL(new RegExp(`${E2E_ROUTES.employeeRequests}$`))

    const employeeSearchInput = page.getByRole('textbox', { name: /search requests/i })
    await employeeSearchInput.fill(requestNote)

    const employeeRequestRow = page.locator('tr', { hasText: /address/i }).first()
    await expect(employeeRequestRow).toBeVisible({ timeout: 45_000 })
    await expect(employeeRequestRow.getByText(/^pending$/i)).toBeVisible()
    await employeeRequestRow.click()

    const employeeDetailsDialog = page.getByRole('dialog').first()
    await expect(employeeDetailsDialog).toBeVisible()
    await expect(employeeDetailsDialog.getByText(requestNote)).toBeVisible()
    await expect(employeeDetailsDialog.getByText(requestedAddress).first()).toBeVisible()
    await employeeDetailsDialog.getByRole('button', { name: /^close$/i }).first().click()

    await logout(page)

    await loginAsRole(page, 'admin')
    await page.goto(E2E_ROUTES.adminRequests)
    await expect(page).toHaveURL(new RegExp(`${E2E_ROUTES.adminRequests}$`))

    const adminRequestRow = page.locator('tr', { hasText: requestNote }).first()
    await expect(adminRequestRow).toBeVisible({ timeout: 45_000 })
    await expect(adminRequestRow.getByText(/^pending$/i)).toBeVisible()
    await adminRequestRow.click()

    const adminDetailsDialog = page.getByRole('dialog').first()
    await expect(adminDetailsDialog).toBeVisible()
    await expect(adminDetailsDialog.getByText(requestNote)).toBeVisible()
    await expect(adminDetailsDialog.getByRole('button', { name: /^reject$/i })).toBeVisible()

    await adminDetailsDialog.getByRole('button', { name: /^reject$/i }).click()

    const rejectDialog = page
      .getByRole('dialog')
      .filter({ has: page.getByRole('heading', { name: /reject request/i }) })
      .last()
    await expect(rejectDialog).toBeVisible()

    const rejectCommentField = rejectDialog.locator('#reject-comment')
    await expect(rejectCommentField).toBeVisible()
    await rejectCommentField.fill(rejectionReason)

    await rejectDialog.getByRole('button', { name: /^reject request$/i }).click()
    await expect(adminRequestRow).not.toBeVisible({ timeout: 45_000 })
    await page.keyboard.press('Escape')
    await expect(adminDetailsDialog).not.toBeVisible({ timeout: 15_000 })

    await logout(page)

    await loginAsRole(page, 'employee')
    await page.goto(E2E_ROUTES.employeeRequests)
    await expect(page).toHaveURL(new RegExp(`${E2E_ROUTES.employeeRequests}$`))

    await employeeSearchInput.fill(requestNote)
    const rejectedRequestRow = page.locator('tr', { hasText: /address/i }).first()
    await expect(rejectedRequestRow).toBeVisible({ timeout: 45_000 })
    await expect(rejectedRequestRow.getByText(/^rejected$/i)).toBeVisible()
    await rejectedRequestRow.click()

    const rejectedDetailsDialog = page.getByRole('dialog').first()
    await expect(rejectedDetailsDialog).toBeVisible()
    await expect(rejectedDetailsDialog.getByText(requestNote)).toBeVisible()
    await expect(rejectedDetailsDialog.getByText(rejectionReason).first()).toBeVisible()
  })
})
