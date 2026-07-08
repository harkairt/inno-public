/**
 * Logout Flow Tests
 * Tests for user logout functionality
 */

import { test, expect } from '../fixtures'
import { selectors } from '../selectors'
import { logout } from '../actions/auth.actions'

test.describe('Logout Flow', () => {
  // @real smoke: exercises logout against the real backend.
  test('@real should logout and redirect to login', async ({ authenticatedPage }) => {
    // Perform logout using action
    await logout(authenticatedPage)

    // Assert: Redirected to login page
    await expect(authenticatedPage).toHaveURL('/login')

    // Assert: Login form is visible
    await expect(authenticatedPage.locator(selectors.auth.emailInput)).toBeVisible()
    await expect(authenticatedPage.locator(selectors.auth.passwordInput)).toBeVisible()
  })

  test('should not be able to access protected routes after logout', async ({
    mockedAuthenticatedPage: page,
  }) => {
    // Logout
    await logout(page)
    await expect(page).toHaveURL('/login')

    // Try to access protected route
    await page.goto('/chats')

    // Assert: Redirected back to login (middleware appends ?redirect=/chats)
    await expect(page).toHaveURL(/\/login/)
  })

  test('should clear session data on logout', async ({ mockedAuthenticatedPage: page }) => {
    // Verify we're authenticated (the app shell renders the rail)
    await expect(page.locator(selectors.layout.appRail)).toBeVisible()

    // Logout
    await logout(page)

    // Verify we can't access authenticated-only content
    await page.goto('/users')
    await expect(page).toHaveURL(/\/login/)
  })
})
