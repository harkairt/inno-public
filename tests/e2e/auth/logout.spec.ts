/**
 * Logout Flow Tests
 * Tests for user logout functionality
 */

import { test, expect } from '../fixtures'
import { selectors } from '../selectors'
import { logout } from '../actions/auth.actions'

test.describe('Logout Flow', () => {
  test('should logout and redirect to login', async ({ authenticatedPage }) => {
    // Perform logout using action
    await logout(authenticatedPage)

    // Assert: Redirected to login page
    await expect(authenticatedPage).toHaveURL('/login')

    // Assert: Login form is visible
    await expect(authenticatedPage.locator(selectors.auth.emailInput)).toBeVisible()
    await expect(authenticatedPage.locator(selectors.auth.passwordInput)).toBeVisible()
  })

  test('should not be able to access protected routes after logout', async ({ authenticatedPage }) => {
    // Logout
    await logout(authenticatedPage)
    await expect(authenticatedPage).toHaveURL('/login')

    // Try to access protected route
    await authenticatedPage.goto('/chats')

    // Assert: Redirected back to login
    await expect(authenticatedPage).toHaveURL('/login')
  })

  test('should clear session data on logout', async ({ authenticatedPage }) => {
    // Verify we're authenticated
    await expect(authenticatedPage.getByRole('button', { name: /logout/i })).toBeVisible()

    // Logout
    await logout(authenticatedPage)

    // Verify we can't access authenticated-only content
    await authenticatedPage.goto('/users')
    await expect(authenticatedPage).toHaveURL('/login')
  })
})
