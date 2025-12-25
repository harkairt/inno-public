/**
 * Session Persistence Tests
 * Tests for session management and protected routes
 */

import { test, expect } from '../fixtures'
import { navigateToChats, navigateToUsers, refreshPage } from '../actions/navigation.actions'

test.describe('Session Persistence', () => {
  test('should maintain session after page refresh', async ({ authenticatedPage }) => {
    // User is already logged in via fixture
    const currentUrl = authenticatedPage.url()

    // Refresh the page
    await refreshPage(authenticatedPage)

    // Assert: Still on the same URL
    await expect(authenticatedPage).toHaveURL(currentUrl)

    // Assert: Still authenticated (logout button visible)
    await expect(authenticatedPage.getByRole('button', { name: /logout/i })).toBeVisible()
  })

  test('should maintain session when navigating between pages', async ({ authenticatedPage }) => {
    // Navigate to chats page
    await navigateToChats(authenticatedPage)
    await expect(authenticatedPage.getByRole('button', { name: /logout/i })).toBeVisible()

    // Navigate to users page
    await navigateToUsers(authenticatedPage)
    await expect(authenticatedPage.getByRole('button', { name: /logout/i })).toBeVisible()

    // Navigate back to home
    await authenticatedPage.goto('/')
    await expect(authenticatedPage.getByRole('button', { name: /logout/i })).toBeVisible()
  })
})

test.describe('Protected Routes', () => {
  test('should redirect unauthenticated user from /chats to /login', async ({ page }) => {
    // Try to access /chats without authentication
    await page.goto('/chats')

    // Assert: Redirected to login
    await expect(page).toHaveURL('/login')
  })

  test('should redirect unauthenticated user from /users to /login', async ({ page }) => {
    // Try to access /users without authentication
    await page.goto('/users')

    // Assert: Redirected to login
    await expect(page).toHaveURL('/login')
  })

  test('should redirect authenticated user away from login page', async ({ authenticatedPage }) => {
    // Try to access login page while authenticated
    await authenticatedPage.goto('/login')

    // Assert: Redirected to chats (not login)
    await expect(authenticatedPage).toHaveURL('/chats')
  })

  test('should allow access to protected routes when authenticated', async ({ authenticatedPage }) => {
    // Access /chats
    await navigateToChats(authenticatedPage)
    await expect(authenticatedPage).toHaveURL('/chats')

    // Access /users
    await navigateToUsers(authenticatedPage)
    await expect(authenticatedPage).toHaveURL('/users')
  })
})
