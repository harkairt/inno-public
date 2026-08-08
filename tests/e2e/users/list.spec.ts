/**
 * User List Tests
 * Tests for the dedicated /users page (user listing).
 */

import { test, expect } from '../fixtures'
import { selectors } from '../selectors'
import { navigateToUsers } from '../actions/navigation.actions'

test.describe('User List', () => {
  test.describe('Users Page', () => {
    test('should display the users page', async ({ mockedAuthenticatedPage: page }) => {
      await navigateToUsers(page)

      await expect(page.locator(selectors.users.usersPage)).toBeVisible()
    })

    test('should show the user search input', async ({ mockedAuthenticatedPage: page }) => {
      await navigateToUsers(page)

      await expect(page.locator(selectors.users.userSearch)).toBeVisible()
    })

    test('should display user list after loading', async ({ mockedAuthenticatedPage: page }) => {
      await navigateToUsers(page)

      // Mocked get-selectable-users returns users → items render.
      await expect(page.locator(selectors.users.userItems).first()).toBeVisible()
    })

    test('should render the page shell while data loads', async ({
      mockedAuthenticatedPage: page,
    }) => {
      await navigateToUsers(page)

      // Skeletons are transient; assert the page container is present regardless.
      await expect(page.locator(selectors.users.usersPage)).toBeVisible()
    })
  })

  test.describe('User Cards', () => {
    test('should display user information', async ({ mockedAuthenticatedPage: page }) => {
      await navigateToUsers(page)

      const firstUser = page.locator(selectors.users.userItems).first()
      await expect(firstUser).toBeVisible()

      // Each card shows a name and either an email or an "AI agent" label.
      const text = await firstUser.textContent()
      expect(text?.trim()).toBeTruthy()
    })

    test('should navigate to a chat when clicking a user', async ({
      mockedAuthenticatedPage: page,
    }) => {
      await navigateToUsers(page)

      const firstUser = page.locator(selectors.users.userItems).first()
      await expect(firstUser).toBeVisible()
      await firstUser.locator('[data-testid^="open-conversation-"]').click()

      // The explicit card action opens the primary session or a new-chat route.
      await expect(page).toHaveURL(/\/chats\//)
    })
  })

  test.describe('Favorites', () => {
    test('should persist a favorite across reloads', async ({ mockedAuthenticatedPage: page }) => {
      await navigateToUsers(page)

      const favorite = page.locator(selectors.users.favoriteButton(1))
      await expect(favorite).toBeVisible()
      await favorite.click()
      await expect(favorite).toHaveAttribute('aria-pressed', 'true')

      await page.reload()

      await expect(page.locator(selectors.users.favoriteButton(1))).toHaveAttribute(
        'aria-pressed',
        'true',
      )
      await page.locator(selectors.users.filter('favorites')).click()
      await expect(page.locator(selectors.users.userItem(1))).toBeVisible()
    })
  })

  test.describe('Responsive grid', () => {
    test('should flow from one to two to three columns based on available width', async ({
      mockedAuthenticatedPage: page,
    }) => {
      const getColumnCount = async () => {
        const boxes = await page
          .locator(selectors.users.userItems)
          .evaluateAll((cards) => cards.map((card) => Math.round(card.getBoundingClientRect().x)))
        return new Set(boxes).size
      }

      await page.setViewportSize({ width: 390, height: 844 })
      await navigateToUsers(page)
      await expect(page.locator(selectors.users.userItems).first()).toBeVisible()
      expect(await getColumnCount()).toBe(1)

      await page.setViewportSize({ width: 900, height: 900 })
      await expect.poll(getColumnCount).toBe(2)

      await page.setViewportSize({ width: 1280, height: 900 })
      await expect.poll(getColumnCount).toBe(3)
    })
  })
})
