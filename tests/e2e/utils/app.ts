import { expect, type Locator, type Page } from '@playwright/test'

export const LANGUAGE_STORAGE_KEY = 'gcb.app.language'
export const DEFAULT_E2E_LANGUAGE = 'en'

export async function seedPreferredLanguage(
  page: Page,
  language: string = DEFAULT_E2E_LANGUAGE,
) {
  await page.addInitScript(
    ({ key, value }) => {
      if (window.localStorage.getItem(key) === null) {
        window.localStorage.setItem(key, value)
      }
    },
    {
      key: LANGUAGE_STORAGE_KEY,
      value: language,
    },
  )
}

export async function selectRadixOption(
  page: Page,
  trigger: Locator | string,
  optionName?: string,
) {
  const triggerLocator = typeof trigger === 'string' ? page.locator(trigger) : trigger
  await triggerLocator.click()

  const option = optionName
    ? page.getByRole('option', { name: optionName }).first()
    : page.getByRole('option').first()

  await expect(option).toBeVisible()
  await option.click()
}

export function createUniqueSuffix() {
  const randomPart = Math.random().toString(36).slice(2, 8)
  return `${Date.now()}-${randomPart}`
}
