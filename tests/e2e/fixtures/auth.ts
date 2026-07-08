import { test as base } from '@playwright/test'
import type { Page } from '@playwright/test'
import { mockAllApis } from './api-mocks'
import { selectors } from '../selectors'

export type AuthFixtures = {
  authenticatedPage: Page
  adminPage: Page
  mockedAuthenticatedPage: Page
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

  // Hermetic (backend-free) authentication fixture.
  // Installs the full mocked API set (mockAllApis), then drives the REAL login
  // UI against the MOCKED /api/authentication/login route — exercising the real
  // form + token-storage code paths with zero backend. The mocked login accepts
  // any credentials, so placeholder creds are fine here.
  //
  // Use THIS fixture when the login flow (or the post-login authenticated boot)
  // is the subject under test. When login is NOT the subject, prefer the faster
  // seedAuthLocalStorage() helper (in ./api-mocks) which skips the login UI.
  mockedAuthenticatedPage: async ({ page }, use) => {
    await mockAllApis(page)

    await page.goto('/login')

    // Fill in credentials using exact selectors from login.vue
    await page.locator(selectors.auth.emailInput).fill('test@example.com')
    await page.locator(selectors.auth.passwordInput).fill('password')

    // Submit login form against the MOCKED login route
    await page
      .getByRole(selectors.auth.submitButton.role, { name: selectors.auth.submitButton.name })
      .click()

    // Wait for redirect to chats page (/ redirects to /chats)
    await page.waitForURL('/chats')

    // Use the mock-authenticated page in tests
    await use(page)
  },
})

export { expect } from '@playwright/test'
