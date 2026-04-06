import { test as base, expect } from '@playwright/test'

import { seedPreferredLanguage } from '../utils/app'

export const test = base.extend({
  page: async ({ page }, runFixture) => {
    await seedPreferredLanguage(page)
    await runFixture(page)
  },
})

export { expect }
