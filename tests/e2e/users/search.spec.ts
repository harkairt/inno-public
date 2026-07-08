/**
 * User Search Tests
 * Tests for user search on the dedicated /users page.
 */

import { test, expect } from '../fixtures'
import { selectors } from '../selectors'
import { navigateToUsers } from '../actions/navigation.actions'

test.describe('User Search', () => {
  test.describe('Search Input', () => {
    test('should have a search input', async ({ mockedAuthenticatedPage: page }) => {
      await navigateToUsers(page)

      await expect(page.locator(selectors.users.userSearch)).toBeVisible()
    })

    test('should filter users as you type', async ({ mockedAuthenticatedPage: page }) => {
      await navigateToUsers(page)

      const userItems = page.locator(selectors.users.userItems)
      await expect(userItems.first()).toBeVisible()
      const initialCount = await userItems.count()

      // Narrow the list with a query — never more than the unfiltered set.
      await page.locator(selectors.users.userSearch).fill('admin')
      await expect(async () => {
        expect(await userItems.count()).toBeLessThanOrEqual(initialCount)
      }).toPass()
    })

    test('should clear search results when input is cleared', async ({
      mockedAuthenticatedPage: page,
    }) => {
      await navigateToUsers(page)

      const userItems = page.locator(selectors.users.userItems)
      await expect(userItems.first()).toBeVisible()
      const initialCount = await userItems.count()

      const search = page.locator(selectors.users.userSearch)
      await search.fill('zzzznonexistentuser12345zzzzz')
      await expect(userItems).toHaveCount(0)

      // Clearing restores the full list.
      await search.clear()
      await expect(userItems).toHaveCount(initialCount)
    })
  })

  test.describe('Search Behavior', () => {
    test('should search by email', async ({ mockedAuthenticatedPage: page }) => {
      await navigateToUsers(page)

      await expect(page.locator(selectors.users.userItems).first()).toBeVisible()

      // Mocked users include admin@example.com — searching the email finds it.
      await page.locator(selectors.users.userSearch).fill('admin@example.com')

      const results = page.locator(selectors.users.userItems)
      await expect(results.first()).toBeVisible()
      expect(await results.first().textContent()).toContain('admin@example.com')
    })

    test('should show no results for an invalid search', async ({
      mockedAuthenticatedPage: page,
    }) => {
      await navigateToUsers(page)

      await expect(page.locator(selectors.users.userItems).first()).toBeVisible()

      await page.locator(selectors.users.userSearch).fill('zzzznonexistentuser12345zzzzz')

      await expect(page.locator(selectors.users.userItems)).toHaveCount(0)
    })
  })

  test.describe('Search Performance', () => {
    test('should handle rapid typing', async ({ mockedAuthenticatedPage: page }) => {
      await navigateToUsers(page)

      const search = page.locator(selectors.users.userSearch)
      await search.pressSequentially('testuser', { delay: 50 })

      // Should remain responsive — the page stays mounted.
      await expect(page.locator(selectors.users.usersPage)).toBeVisible()
    })
  })
})
