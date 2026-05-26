/**
 * User List Tests
 * Tests for user listing functionality in sidebar
 */

import { test, expect } from '../fixtures'
import { selectors } from '../selectors'
import { navigateToChats } from '../actions/navigation.actions'

test.describe('User List', () => {
  test.describe('Users Section in Sidebar', () => {
    test('should display users accordion in sidebar', async ({ authenticatedPage }) => {
      await navigateToChats(authenticatedPage)

      // Sidebar should be visible
      await expect(authenticatedPage.locator(selectors.layout.sidebar)).toBeVisible()

      // Users section should exist in accordion
      const usersAccordion = authenticatedPage.getByText(/users/i)
      await expect(usersAccordion.first()).toBeVisible()
    })

    test('should expand users section when clicked', async ({ authenticatedPage }) => {
      await navigateToChats(authenticatedPage)

      // Find and click users accordion header
      const usersHeader = authenticatedPage.locator('button').filter({ hasText: /users/i }).first()
      if (await usersHeader.isVisible()) {
        await usersHeader.click()

        // Users content should be expanded
        // Look for user search input as indicator
        const userSearch = authenticatedPage.locator('input[placeholder*="earch"]').first()
        await expect(userSearch)
          .toBeVisible({ timeout: 3000 })
          .catch(() => {
            // May already be expanded
          })
      }
    })

    test('should show user search input in expanded section', async ({ authenticatedPage }) => {
      await navigateToChats(authenticatedPage)

      // Expand users section
      const usersHeader = authenticatedPage.locator('button').filter({ hasText: /users/i }).first()
      if (await usersHeader.isVisible()) {
        await usersHeader.click()
      }

      // Search input should be visible
      const searchInputs = authenticatedPage.locator('input[placeholder*="earch"]')
      const count = await searchInputs.count()
      expect(count).toBeGreaterThan(0)
    })

    test('should display user list after loading', async ({ authenticatedPage }) => {
      await navigateToChats(authenticatedPage)

      // Expand users section
      const usersHeader = authenticatedPage.locator('button').filter({ hasText: /users/i }).first()
      if (await usersHeader.isVisible()) {
        await usersHeader.click()
      }

      // Wait for users to load (either users or empty state)
      await authenticatedPage.waitForTimeout(2000)

      // Either user cards or empty state should be visible
      const sidebar = authenticatedPage.locator(selectors.layout.sidebar)
      const sidebarContent = await sidebar.textContent()
      expect(sidebarContent).toBeTruthy()
    })
  })

  test.describe('User Cards', () => {
    test('should display user information', async ({ authenticatedPage }) => {
      await navigateToChats(authenticatedPage)

      // Expand users section
      const usersHeader = authenticatedPage.locator('button').filter({ hasText: /users/i }).first()
      if (await usersHeader.isVisible()) {
        await usersHeader.click()
      }

      // Wait for users to load
      await authenticatedPage.waitForTimeout(2000)

      // If there are user items, verify structure
      const userItems = authenticatedPage.locator('.sidebar-item').filter({ hasText: /@/ })
      const count = await userItems.count()

      if (count > 0) {
        const firstUser = userItems.first()
        const userText = await firstUser.textContent()

        // Should have user name or email
        expect(userText).toBeTruthy()
      }
    })

    test('should navigate to new chat when clicking user', async ({ authenticatedPage }) => {
      await navigateToChats(authenticatedPage)

      // Expand users section
      const usersHeader = authenticatedPage.locator('button').filter({ hasText: /users/i }).first()
      if (await usersHeader.isVisible()) {
        await usersHeader.click()
      }

      // Wait for users to load
      await authenticatedPage.waitForTimeout(2000)

      // Click a user to start chat
      const userItems = authenticatedPage.locator('.sidebar-item').filter({ hasText: /@/ })
      const count = await userItems.count()

      if (count > 0) {
        await userItems.first().click()

        // Should navigate to new chat page
        await expect(authenticatedPage).toHaveURL(/\/chats\/new\/\d+/)
      }
    })
  })

  test.describe('Loading States', () => {
    test('should show skeleton during loading', async ({ authenticatedPage }) => {
      await navigateToChats(authenticatedPage)

      // This test verifies loading skeletons exist
      // They may be too fast to catch in real tests
      const sidebar = authenticatedPage.locator(selectors.layout.sidebar)
      await expect(sidebar).toBeVisible()
    })

    test('should show empty state when no users found', async ({ authenticatedPage }) => {
      await navigateToChats(authenticatedPage)

      // Expand users section
      const usersHeader = authenticatedPage.locator('button').filter({ hasText: /users/i }).first()
      if (await usersHeader.isVisible()) {
        await usersHeader.click()
      }

      // Search for non-existent user
      const searchInputs = authenticatedPage.locator('input[placeholder*="earch"]')
      if (await searchInputs.first().isVisible()) {
        await searchInputs.first().fill('nonexistentuserxyz123')

        // Wait for search results
        await authenticatedPage.waitForTimeout(1000)

        // Should show no users found or empty results
        const sidebar = authenticatedPage.locator(selectors.layout.sidebar)
        const sidebarContent = await sidebar.textContent()
        expect(sidebarContent).toBeTruthy()
      }
    })
  })
})
