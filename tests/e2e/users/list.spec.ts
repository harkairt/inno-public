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
      await firstUser.click()

      // Clicking a user opens their primary session or a new-chat route.
      await expect(page).toHaveURL(/\/chats\//)
    })
  })
})
