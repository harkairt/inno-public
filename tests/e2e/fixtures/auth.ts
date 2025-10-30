import { test as base } from '@playwright/test'
import type { Page } from '@playwright/test'

export type AuthFixtures = {
  authenticatedPage: Page
  adminPage: Page
}

export const test = base.extend<AuthFixtures>({
  // Regular user authentication fixture
  authenticatedPage: async ({ page }, use) => {
    await page.goto('/login')

    // Fill in credentials using exact selectors from login.vue
    await page.locator('#email').fill(process.env.TEST_USER_EMAIL!)
    await page.locator('#password').fill(process.env.TEST_USER_PASSWORD!)

    // Submit login form
    await page.getByRole('button', { name: /sign in/i }).click()

    // Wait for redirect to chats page (/ redirects to /chats)
    await page.waitForURL('/chats')

    // Use the authenticated page in tests
    await use(page)
  },

  // Admin user authentication fixture
  adminPage: async ({ page }, use) => {
    await page.goto('/login')

    // Fill in admin credentials
    await page.locator('#email').fill(process.env.TEST_ADMIN_EMAIL!)
    await page.locator('#password').fill(process.env.TEST_ADMIN_PASSWORD!)

    // Submit login form
    await page.getByRole('button', { name: /sign in/i }).click()

    // Wait for redirect to chats page (/ redirects to /chats)
    await page.waitForURL('/chats')

    // Use the authenticated admin page in tests
    await use(page)
  },
})

export { expect } from '@playwright/test'
