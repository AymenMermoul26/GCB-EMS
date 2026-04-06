import type { Locator, Page } from '@playwright/test'

import { test, expect } from '../fixtures/test'
import { hasRoleCredentials } from '../fixtures/users'
import { gotoLogin, loginAsRole } from '../utils/auth'
import { LANGUAGE_STORAGE_KEY } from '../utils/app'
import { E2E_ROUTES } from '../utils/routes'

type AppLanguage = 'en' | 'fr' | 'ar'
type AppDirection = 'ltr' | 'rtl'

async function expectLanguageState(
  page: Page,
  language: AppLanguage,
  direction: AppDirection,
) {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.lang))
    .toBe(language)
  await expect
    .poll(() => page.evaluate(() => document.documentElement.dir))
    .toBe(direction)
  await expect
    .poll(() =>
      page.evaluate(
        (storageKey) => window.localStorage.getItem(storageKey),
        LANGUAGE_STORAGE_KEY,
      ),
    )
    .toBe(language)
}

async function setPersistedLanguage(page: Page, language: AppLanguage) {
  await page.evaluate(
    ([storageKey, nextLanguage]) => {
      window.localStorage.setItem(storageKey, nextLanguage)
    },
    [LANGUAGE_STORAGE_KEY, language] as const,
  )
  await page.reload()
}

async function readTrimmedText(locator: Locator): Promise<string> {
  const text = (await locator.textContent())?.trim()
  if (!text) {
    throw new Error('Expected locator to contain non-empty text.')
  }

  return text
}

function getSidebarLanguageSwitcher(page: Page): Locator {
  return page.getByTestId('language-switcher-sidebar')
}

async function switchLanguage(
  switcher: Locator,
  language: AppLanguage,
) {
  const targetButton = switcher.getByTestId(`language-switcher-option-${language}`)
  await expect(targetButton).toBeVisible()
  await targetButton.evaluate((button: HTMLButtonElement) => {
    button.click()
  })
}

async function expectTextChange(locator: Locator, previousValue: string): Promise<string> {
  await expect
    .poll(async () => ((await locator.textContent()) ?? '').trim())
    .not.toBe(previousValue)

  return readTrimmedText(locator)
}

test.describe('language switching smoke', () => {
  test('login page honors persisted language and Arabic RTL on reload', async ({ page }) => {
    await gotoLogin(page)

    const submitButton = page.locator('form button[type="submit"]').first()
    await expect(submitButton).toBeVisible()
    const englishSubmitLabel = await readTrimmedText(submitButton)

    await setPersistedLanguage(page, 'fr')
    await expectLanguageState(page, 'fr', 'ltr')
    const frenchSubmitLabel = await expectTextChange(submitButton, englishSubmitLabel)

    await setPersistedLanguage(page, 'ar')
    await expectLanguageState(page, 'ar', 'rtl')
    await expect
      .poll(async () => ((await submitButton.textContent()) ?? '').trim())
      .not.toBe(frenchSubmitLabel)
  })

  test('admin pages honor persisted language on reload', async ({ page }) => {
    test.skip(!hasRoleCredentials('admin'), 'Missing E2E admin credentials.')

    await loginAsRole(page, 'admin')
    await expect(page).toHaveURL(new RegExp(`${E2E_ROUTES.adminEmployees}`))

    const employeesNavLink = page.locator('aside nav a').nth(2)
    await expect(employeesNavLink).toBeVisible()
    const englishEmployeesLabel = await readTrimmedText(employeesNavLink)

    await setPersistedLanguage(page, 'fr')
    await expectLanguageState(page, 'fr', 'ltr')
    const frenchEmployeesLabel = await expectTextChange(
      employeesNavLink,
      englishEmployeesLabel,
    )

    await expect(employeesNavLink).toHaveText(frenchEmployeesLabel)
  })

  test('employee pages honor persisted language on reload', async ({ page }) => {
    test.skip(!hasRoleCredentials('employee'), 'Missing E2E employee credentials.')

    await loginAsRole(page, 'employee')
    await expect(page).toHaveURL(new RegExp(`${E2E_ROUTES.employeeProfile}`))

    const pageHeading = page.getByRole('heading', { level: 1 }).first()
    await expect(pageHeading).toBeVisible()
    const englishHeading = await readTrimmedText(pageHeading)

    await setPersistedLanguage(page, 'fr')
    await expectLanguageState(page, 'fr', 'ltr')
    const frenchHeading = await expectTextChange(pageHeading, englishHeading)

    await expect(pageHeading).toHaveText(frenchHeading)
  })

  test('payroll sidebar language switch can move from English to French and back', async ({ page }) => {
    test.skip(!hasRoleCredentials('payroll'), 'Missing E2E payroll credentials.')

    await loginAsRole(page, 'payroll')
    await expect(page).toHaveURL(new RegExp(`${E2E_ROUTES.payrollDashboard}`))

    const dashboardNavLink = page.locator('aside nav a').first()
    await expect(dashboardNavLink).toBeVisible()
    const englishDashboardLabel = await readTrimmedText(dashboardNavLink)

    await switchLanguage(getSidebarLanguageSwitcher(page), 'fr')
    await expectLanguageState(page, 'fr', 'ltr')
    await expectTextChange(dashboardNavLink, englishDashboardLabel)

    await switchLanguage(getSidebarLanguageSwitcher(page), 'en')
    await expectLanguageState(page, 'en', 'ltr')
    await expect(dashboardNavLink).toHaveText(englishDashboardLabel)
  })
})
