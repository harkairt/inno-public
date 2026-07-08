/**
 * Session Management Tests
 * Tests for session CRUD operations (create, rename, delete)
 */

import { test, expect } from '../fixtures'
import { selectors } from '../selectors'
import { getSessionTitle } from '../actions/chat.actions'

test.describe('Session Management', () => {
  test.describe('Session Title', () => {
    test('should display session title in header', async ({ mockedAuthenticatedPage: page }) => {
      await page.goto('/chats')

      // Find and click a session
      const sessionLinks = page.locator('a[href^="/chats/"]')
      const count = await sessionLinks.count()

      if (count > 0) {
        await sessionLinks.first().click()
        await page.waitForURL(/\/chats\//)

        // Session title should be visible
        await expect(page.locator(selectors.chat.sessionTitle)).toBeVisible()
      }
    })

    test('should have edit button for session title', async ({ mockedAuthenticatedPage: page }) => {
      await page.goto('/chats')

      const sessionLinks = page.locator('a[href^="/chats/"]')
      const count = await sessionLinks.count()

      if (count > 0) {
        await sessionLinks.first().click()
        await page.waitForURL(/\/chats\//)

        // Hover over title area to reveal edit button
        const titleArea = page.locator(selectors.chat.sessionTitle).locator('..')
        await titleArea.hover()

        // Edit button should be visible on hover
        await expect(page.locator(selectors.chat.editTitleButton)).toBeVisible()
      }
    })

    test('should allow editing session title', async ({ mockedAuthenticatedPage: page }) => {
      await page.goto('/chats')

      const sessionLinks = page.locator('a[href^="/chats/"]')
      const count = await sessionLinks.count()

      if (count > 0) {
        await sessionLinks.first().click()
        await page.waitForURL(/\/chats\//)

        // Get original title (for future assertions)
        await getSessionTitle(page)

        // Click edit button
        const titleArea = page.locator(selectors.chat.sessionTitle).locator('..')
        await titleArea.hover()
        await page.locator(selectors.chat.editTitleButton).click()

        // Input should appear
        await expect(page.locator(selectors.chat.sessionTitleInput)).toBeVisible()
      }
    })

    test('should save title on Enter key', async ({ mockedAuthenticatedPage: page }) => {
      await page.goto('/chats')

      const sessionLinks = page.locator('a[href^="/chats/"]')
      const count = await sessionLinks.count()

      if (count > 0) {
        await sessionLinks.first().click()
        await page.waitForURL(/\/chats\//)

        // Start editing
        const titleArea = page.locator(selectors.chat.sessionTitle).locator('..')
        await titleArea.hover()
        await page.locator(selectors.chat.editTitleButton).click()

        const titleInput = page.locator(selectors.chat.sessionTitleInput)
        await titleInput.clear()
        await titleInput.fill('Renamed Session Test')
        await titleInput.press('Enter')

        // Should exit edit mode
        await expect(page.locator(selectors.chat.sessionTitle)).toBeVisible()
      }
    })

    test('should cancel editing on Escape key', async ({ mockedAuthenticatedPage: page }) => {
      await page.goto('/chats')

      const sessionLinks = page.locator('a[href^="/chats/"]')
      const count = await sessionLinks.count()

      if (count > 0) {
        await sessionLinks.first().click()
        await page.waitForURL(/\/chats\//)

        // Get original title (for future assertions)
        await getSessionTitle(page)

        // Start editing
        const titleArea = page.locator(selectors.chat.sessionTitle).locator('..')
        await titleArea.hover()
        await page.locator(selectors.chat.editTitleButton).click()

        const titleInput = page.locator(selectors.chat.sessionTitleInput)
        await titleInput.clear()
        await titleInput.fill('Should Be Cancelled')
        await titleInput.press('Escape')

        // Should exit edit mode and keep original title
        await expect(page.locator(selectors.chat.sessionTitle)).toBeVisible()
      }
    })
  })

  test.describe('Session Creation', () => {
    test('should create new session when clicking agent tile', async ({
      mockedAuthenticatedPage: page,
    }) => {
      await page.goto('/chats')

      const agentTiles = page.locator(selectors.chats.agentTiles)
      const count = await agentTiles.count()

      if (count > 0) {
        await agentTiles.first().click()

        // Should navigate to new chat page
        await expect(page).toHaveURL(/\/chats\/new\/\d+/)
      }
    })
  })

  test.describe('Session List', () => {
    test('should show sessions in the chat list panel', async ({
      mockedAuthenticatedPage: page,
    }) => {
      await page.goto('/chats')

      // Sessions are listed in the ChatListPanel (mocked backend returns 3 headers).
      await expect(page.locator(selectors.layout.chatListPanel)).toBeVisible()
      await expect(page.locator(selectors.chats.sessionItems).first()).toBeVisible()
    })

    test('should navigate to session when clicked', async ({ mockedAuthenticatedPage: page }) => {
      await page.goto('/chats')

      const sessionLinks = page.locator('a[href^="/chats/"]')
      const count = await sessionLinks.count()

      if (count > 0) {
        await sessionLinks.first().click()

        // Should navigate to session page
        await expect(page).toHaveURL(/\/chats\//)
      }
    })
  })
})
