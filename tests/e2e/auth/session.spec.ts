/**
 * Session Persistence Tests
 * Tests for session management and protected routes
 */

import { test, expect, mockAllApis } from '../fixtures'
import { selectors } from '../selectors'
import { navigateToChats, navigateToUsers, refreshPage } from '../actions/navigation.actions'

test.describe('Session Persistence', () => {
  test('should maintain session after page refresh', async ({ mockedAuthenticatedPage: page }) => {
    // User is already logged in via fixture
    const currentUrl = page.url()

    // Refresh the page
    await refreshPage(page)

    // Assert: Still on the same URL
    await expect(page).toHaveURL(currentUrl)

    // Assert: Still authenticated (logout button visible)
    await expect(page.locator(selectors.layout.appRail)).toBeVisible()
  })

  test('should maintain session when navigating between pages', async ({
    mockedAuthenticatedPage: page,
  }) => {
    // Navigate to chats page
    await navigateToChats(page)
    await expect(page.locator(selectors.layout.appRail)).toBeVisible()

    // Navigate to users page
    await navigateToUsers(page)
    await expect(page.locator(selectors.layout.appRail)).toBeVisible()

    // Navigate back to home
    await page.goto('/')
    await expect(page.locator(selectors.layout.appRail)).toBeVisible()
  })
})

test.describe('Protected Routes', () => {
  test('should redirect unauthenticated user from /chats to /login', async ({ page }) => {
    await mockAllApis(page)
    // Try to access /chats without authentication
    await page.goto('/chats')

    // Assert: Redirected to login (middleware appends ?redirect=/chats)
    await expect(page).toHaveURL(/\/login/)
  })

  test('should redirect unauthenticated user from /users to /login', async ({ page }) => {
    await mockAllApis(page)
    // Try to access /users without authentication
    await page.goto('/users')

    // Assert: Redirected to login (middleware appends ?redirect=/users)
    await expect(page).toHaveURL(/\/login/)
  })

  test('should redirect authenticated user away from login page', async ({
    mockedAuthenticatedPage: page,
  }) => {
    // Try to access login page while authenticated
    await page.goto('/login')

    // Assert: Redirected to chats (not login)
    await expect(page).toHaveURL('/chats')
  })

  test('should allow access to protected routes when authenticated', async ({
    mockedAuthenticatedPage: page,
  }) => {
    // Access /chats
    await navigateToChats(page)
    await expect(page).toHaveURL('/chats')

    // Access /users
    await navigateToUsers(page)
    await expect(page).toHaveURL('/users')
  })
})
