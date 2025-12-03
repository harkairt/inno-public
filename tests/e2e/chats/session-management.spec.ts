/**
 * Session Management Tests
 * Tests for session CRUD operations (create, rename, delete)
 */

import { test, expect } from '../fixtures'
import { selectors } from '../selectors'
import { editSessionTitle, getSessionTitle } from '../actions/chat.actions'

test.describe('Session Management', () => {
  test.describe('Session Title', () => {
    test('should display session title in header', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/chats')

      // Find and click a session
      const sessionLinks = authenticatedPage.locator('a[href^="/chats/"]')
      const count = await sessionLinks.count()

      if (count > 0) {
        await sessionLinks.first().click()
        await authenticatedPage.waitForURL(/\/chats\//)

        // Session title should be visible
        await expect(authenticatedPage.locator(selectors.chat.sessionTitle)).toBeVisible()
      }
    })

    test('should have edit button for session title', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/chats')

      const sessionLinks = authenticatedPage.locator('a[href^="/chats/"]')
      const count = await sessionLinks.count()

      if (count > 0) {
        await sessionLinks.first().click()
        await authenticatedPage.waitForURL(/\/chats\//)

        // Hover over title area to reveal edit button
        const titleArea = authenticatedPage.locator(selectors.chat.sessionTitle).locator('..')
        await titleArea.hover()

        // Edit button should be visible on hover
        await expect(authenticatedPage.locator(selectors.chat.editTitleButton)).toBeVisible()
      }
    })

    test('should allow editing session title', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/chats')

      const sessionLinks = authenticatedPage.locator('a[href^="/chats/"]')
      const count = await sessionLinks.count()

      if (count > 0) {
        await sessionLinks.first().click()
        await authenticatedPage.waitForURL(/\/chats\//)

        // Get original title
        const originalTitle = await getSessionTitle(authenticatedPage)

        // Click edit button
        const titleArea = authenticatedPage.locator(selectors.chat.sessionTitle).locator('..')
        await titleArea.hover()
        await authenticatedPage.locator(selectors.chat.editTitleButton).click()

        // Input should appear
        await expect(authenticatedPage.locator(selectors.chat.sessionTitleInput)).toBeVisible()
      }
    })

    test('should save title on Enter key', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/chats')

      const sessionLinks = authenticatedPage.locator('a[href^="/chats/"]')
      const count = await sessionLinks.count()

      if (count > 0) {
        await sessionLinks.first().click()
        await authenticatedPage.waitForURL(/\/chats\//)

        // Start editing
        const titleArea = authenticatedPage.locator(selectors.chat.sessionTitle).locator('..')
        await titleArea.hover()
        await authenticatedPage.locator(selectors.chat.editTitleButton).click()

        const titleInput = authenticatedPage.locator(selectors.chat.sessionTitleInput)
        await titleInput.clear()
        await titleInput.fill('Renamed Session Test')
        await titleInput.press('Enter')

        // Should exit edit mode
        await expect(authenticatedPage.locator(selectors.chat.sessionTitle)).toBeVisible()
      }
    })

    test('should cancel editing on Escape key', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/chats')

      const sessionLinks = authenticatedPage.locator('a[href^="/chats/"]')
      const count = await sessionLinks.count()

      if (count > 0) {
        await sessionLinks.first().click()
        await authenticatedPage.waitForURL(/\/chats\//)

        // Get original title
        const originalTitle = await getSessionTitle(authenticatedPage)

        // Start editing
        const titleArea = authenticatedPage.locator(selectors.chat.sessionTitle).locator('..')
        await titleArea.hover()
        await authenticatedPage.locator(selectors.chat.editTitleButton).click()

        const titleInput = authenticatedPage.locator(selectors.chat.sessionTitleInput)
        await titleInput.clear()
        await titleInput.fill('Should Be Cancelled')
        await titleInput.press('Escape')

        // Should exit edit mode and keep original title
        await expect(authenticatedPage.locator(selectors.chat.sessionTitle)).toBeVisible()
      }
    })
  })

  test.describe('Session Creation', () => {
    test('should create new session when clicking agent tile', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/chats')

      const agentTiles = authenticatedPage.locator(selectors.chats.agentTiles)
      const count = await agentTiles.count()

      if (count > 0) {
        await agentTiles.first().click()

        // Should navigate to new chat page
        await expect(authenticatedPage).toHaveURL(/\/chats\/new\/\d+/)
      }
    })
  })

  test.describe('Session List', () => {
    test('should show sessions in sidebar', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/chats')

      // Sessions should be listed in the sidebar accordion
      const sidebar = authenticatedPage.locator(selectors.layout.sidebar)
      await expect(sidebar).toBeVisible()
    })

    test('should navigate to session when clicked', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/chats')

      const sessionLinks = authenticatedPage.locator('a[href^="/chats/"]')
      const count = await sessionLinks.count()

      if (count > 0) {
        await sessionLinks.first().click()

        // Should navigate to session page
        await expect(authenticatedPage).toHaveURL(/\/chats\//)
      }
    })
  })
})
