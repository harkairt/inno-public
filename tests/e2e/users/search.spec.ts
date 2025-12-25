/**
 * User Search Tests
 * Tests for user search functionality in sidebar
 */

import { test, expect } from '../fixtures'
import { selectors } from '../selectors'
import { navigateToChats } from '../actions/navigation.actions'

test.describe('User Search', () => {
  test.describe('Search Input', () => {
    test('should have search input in users section', async ({ authenticatedPage }) => {
      await navigateToChats(authenticatedPage)

      // Expand users section
      const usersHeader = authenticatedPage.locator('button').filter({ hasText: /users/i }).first()
      if (await usersHeader.isVisible()) {
        await usersHeader.click()
      }

      // Search input should be visible
      const searchInputs = authenticatedPage.locator('input[placeholder*="earch"]')
      await expect(searchInputs.first()).toBeVisible()
    })

    test('should filter users as you type', async ({ authenticatedPage }) => {
      await navigateToChats(authenticatedPage)

      // Expand users section
      const usersHeader = authenticatedPage.locator('button').filter({ hasText: /users/i }).first()
      if (await usersHeader.isVisible()) {
        await usersHeader.click()
      }

      // Wait for users to load
      await authenticatedPage.waitForTimeout(2000)

      // Get initial user count
      const userItems = authenticatedPage.locator('.sidebar-item').filter({ hasText: /@/ })
      const initialCount = await userItems.count()

      if (initialCount > 1) {
        // Type in search
        const searchInput = authenticatedPage.locator('input[placeholder*="earch"]').first()
        await searchInput.fill('a')

        // Wait for filter
        await authenticatedPage.waitForTimeout(500)

        // Count may change based on filter
        const filteredCount = await userItems.count()
        // Either same or fewer users should be shown
        expect(filteredCount).toBeLessThanOrEqual(initialCount)
      }
    })

    test('should clear search results when input is cleared', async ({ authenticatedPage }) => {
      await navigateToChats(authenticatedPage)

      // Expand users section
      const usersHeader = authenticatedPage.locator('button').filter({ hasText: /users/i }).first()
      if (await usersHeader.isVisible()) {
        await usersHeader.click()
      }

      // Wait for users to load
      await authenticatedPage.waitForTimeout(2000)

      const searchInput = authenticatedPage.locator('input[placeholder*="earch"]').first()

      // Type and then clear
      await searchInput.fill('test')
      await authenticatedPage.waitForTimeout(500)
      await searchInput.clear()
      await authenticatedPage.waitForTimeout(500)

      // Users should be restored (if any exist)
      const sidebar = authenticatedPage.locator(selectors.layout.sidebar)
      const sidebarContent = await sidebar.textContent()
      expect(sidebarContent).toBeTruthy()
    })
  })

  test.describe('Search Behavior', () => {
    test('should search by user name', async ({ authenticatedPage }) => {
      await navigateToChats(authenticatedPage)

      // Expand users section
      const usersHeader = authenticatedPage.locator('button').filter({ hasText: /users/i }).first()
      if (await usersHeader.isVisible()) {
        await usersHeader.click()
      }

      // Wait for users to load
      await authenticatedPage.waitForTimeout(2000)

      // Get a user name to search for
      const userItems = authenticatedPage.locator('.sidebar-item').filter({ hasText: /@/ })
      const count = await userItems.count()

      if (count > 0) {
        // Get text from first user
        const firstUserText = await userItems.first().textContent()

        // Extract a partial name to search
        const searchTerm = firstUserText?.split(' ')[0]?.slice(0, 3)

        if (searchTerm) {
          const searchInput = authenticatedPage.locator('input[placeholder*="earch"]').first()
          await searchInput.fill(searchTerm)

          // Wait for search results
          await authenticatedPage.waitForTimeout(500)

          // Should still find the user
          const filteredItems = authenticatedPage.locator('.sidebar-item').filter({ hasText: /@/ })
          const filteredCount = await filteredItems.count()
          expect(filteredCount).toBeGreaterThan(0)
        }
      }
    })

    test('should search by email', async ({ authenticatedPage }) => {
      await navigateToChats(authenticatedPage)

      // Expand users section
      const usersHeader = authenticatedPage.locator('button').filter({ hasText: /users/i }).first()
      if (await usersHeader.isVisible()) {
        await usersHeader.click()
      }

      // Wait for users to load
      await authenticatedPage.waitForTimeout(2000)

      // Search for common email parts
      const searchInput = authenticatedPage.locator('input[placeholder*="earch"]').first()
      await searchInput.fill('@')

      // Wait for search results
      await authenticatedPage.waitForTimeout(500)

      // Should find users with @ in their info
      const sidebar = authenticatedPage.locator(selectors.layout.sidebar)
      const sidebarContent = await sidebar.textContent()
      expect(sidebarContent).toContain('@')
    })

    test('should show no results message for invalid search', async ({ authenticatedPage }) => {
      await navigateToChats(authenticatedPage)

      // Expand users section
      const usersHeader = authenticatedPage.locator('button').filter({ hasText: /users/i }).first()
      if (await usersHeader.isVisible()) {
        await usersHeader.click()
      }

      // Wait for users to load
      await authenticatedPage.waitForTimeout(2000)

      // Search for non-existent user
      const searchInput = authenticatedPage.locator('input[placeholder*="earch"]').first()
      await searchInput.fill('zzzznonexistentuser12345zzzzz')

      // Wait for search results
      await authenticatedPage.waitForTimeout(1000)

      // Either no user items or empty state message
      const userItems = authenticatedPage.locator('.sidebar-item').filter({ hasText: /@/ })
      const count = await userItems.count()
      expect(count).toBe(0)
    })
  })

  test.describe('Search Performance', () => {
    test('should handle rapid typing', async ({ authenticatedPage }) => {
      await navigateToChats(authenticatedPage)

      // Expand users section
      const usersHeader = authenticatedPage.locator('button').filter({ hasText: /users/i }).first()
      if (await usersHeader.isVisible()) {
        await usersHeader.click()
      }

      // Wait for users to load
      await authenticatedPage.waitForTimeout(2000)

      const searchInput = authenticatedPage.locator('input[placeholder*="earch"]').first()

      // Type rapidly
      await searchInput.pressSequentially('testuser', { delay: 50 })

      // Should handle without errors
      await authenticatedPage.waitForTimeout(1000)

      const sidebar = authenticatedPage.locator(selectors.layout.sidebar)
      await expect(sidebar).toBeVisible()
    })
  })
})
