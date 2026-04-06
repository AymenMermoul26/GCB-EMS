import { test, expect } from '../fixtures/test'
import { hasRoleCredentials } from '../fixtures/users'
import { buildEmployeeFixtureData } from '../utils/data'
import { selectRadixOption } from '../utils/app'
import { loginAsRole } from '../utils/auth'
import { E2E_ROUTES } from '../utils/routes'

test.describe('employee invite flow', () => {
  test.describe.configure({ mode: 'serial' })

  test('creates an employee and triggers the initial account invite workflow', async ({ page }) => {
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

    const invitationEmailInput = page.locator('#account-email-input')
    await expect(invitationEmailInput).toHaveValue(employeeData.workEmail)

    const sendInvitationButton = page.getByRole('button', { name: /send invitation/i }).first()
    await expect(sendInvitationButton).toBeVisible()
    await expect(sendInvitationButton).toBeEnabled()

    const responsePromise = page.waitForResponse(
      (response) => response.url().includes('/functions/v1/invite-employee'),
      { timeout: 60_000 },
    )

    await sendInvitationButton.click()
    const response = await responsePromise
    const responseBody = JSON.parse(await response.text()) as {
      error?: string
      email?: string
      email_sent?: boolean
    }

    if (response.ok()) {
      await expect(
        page.getByText(
          /invitation sent to|access email sent to|account is linked for .* but no invitation email was sent\./i,
        ).first(),
      ).toBeVisible({ timeout: 60_000 })

      await expect(page.getByText(/linked account/i)).toBeVisible({ timeout: 60_000 })
      await expect(page.getByText(employeeData.workEmail)).toBeVisible()
      await expect(page.getByRole('button', { name: /resend invitation/i }).first()).toBeVisible()
      return
    }

    expect(response.status()).toBe(400)
    expect((responseBody.error ?? '').toLowerCase()).toContain('email rate limit exceeded')
    await expect(page.getByText(/email rate limit exceeded/i).first()).toBeVisible()
    await expect(page.getByText(/no authentication account linked yet\./i)).toBeVisible()
    await expect(page.getByRole('button', { name: /send invitation/i }).first()).toBeVisible()
  })
})
