import { expect, type Page } from '@playwright/test'

import {
  getRoleCredentials,
  type RoleCredentials,
  type TestRole,
} from '../fixtures/users'
import { seedPreferredLanguage } from './app'
import { E2E_ROUTES } from './routes'

export async function gotoLogin(page: Page) {
  await seedPreferredLanguage(page)
  await page.goto(E2E_ROUTES.login)
  await expect(page.getByLabel(/^email$/i)).toBeVisible()
  await expect(page.getByLabel(/^password$/i)).toBeVisible()
}

export async function loginWithCredentials(page: Page, credentials: RoleCredentials) {
  await gotoLogin(page)
  await page.getByLabel(/^email$/i).fill(credentials.email)
  await page.getByLabel(/^password$/i).fill(credentials.password)
  await page.getByRole('button', { name: /^sign in$/i }).click()
  await page.waitForURL((url) => !url.pathname.endsWith(E2E_ROUTES.login), {
    timeout: 45_000,
  })
}

export async function loginAsRole(page: Page, role: TestRole) {
  await loginWithCredentials(page, getRoleCredentials(role))
}

export async function logout(page: Page) {
  const logoutButton = page.getByRole('button', { name: /^logout$/i }).first()
  await expect(logoutButton).toBeVisible()
  await logoutButton.click()
  await expect(page).toHaveURL(new RegExp(`${E2E_ROUTES.login}$`))
  await expect(page.getByLabel(/^email$/i)).toBeVisible()
}
