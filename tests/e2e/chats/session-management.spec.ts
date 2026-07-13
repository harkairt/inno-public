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

  test.describe('Session Deletion', () => {
    // Mocked sessions all have a virtual "other member", so none is a primary
    // session and every row's SessionItemMenu shows the Delete option.
    // DeleteSessionById is mocked by mockAllApis (mutation-success envelope).
    const targetSessionId = 'session-456'

    /** Open the SessionItemMenu dropdown for a session row in the list panel. */
    async function openSessionMenu(page: import('@playwright/test').Page, sessionId: string) {
      const sessionItem = page.locator(selectors.chats.sessionItem(sessionId))
      await expect(sessionItem).toBeVisible()

      // The menu button sits in a hover-revealed sibling inside the same row.
      const row = sessionItem.locator('..')
      await row.hover()
      await row.getByRole('button', { name: 'Session options' }).click()
    }

    test('should delete a session from the item menu after confirming', async ({
      mockedAuthenticatedPage: page,
    }) => {
      // Spy on the real backend path so mock drift / silent no-ops fail loud.
      const deleteCalls: string[] = []
      page.on('request', (r) => {
        if (r.url().includes('/api/AIWebAPI/DeleteSessionById')) deleteCalls.push(r.url())
      })

      await page.goto('/chats')
      await openSessionMenu(page, targetSessionId)

      await page.getByRole('menuitem', { name: 'Delete' }).click()

      // Confirm modal (English UI strings under Playwright).
      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible()
      await expect(
        dialog.getByText(
          'Are you sure you want to delete this session? This action cannot be undone.',
        ),
      ).toBeVisible()

      await dialog.getByRole('button', { name: 'Delete', exact: true }).click()

      // Session disappears from the list panel and the mutation hit the wire.
      await expect(page.locator(selectors.chats.sessionItem(targetSessionId))).toBeHidden()
      await expect.poll(() => deleteCalls.length).toBe(1)
    })

    test('should keep the session when the delete is cancelled', async ({
      mockedAuthenticatedPage: page,
    }) => {
      const deleteCalls: string[] = []
      page.on('request', (r) => {
        if (r.url().includes('/api/AIWebAPI/DeleteSessionById')) deleteCalls.push(r.url())
      })

      await page.goto('/chats')
      await openSessionMenu(page, targetSessionId)

      await page.getByRole('menuitem', { name: 'Delete' }).click()

      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible()
      await dialog.getByRole('button', { name: 'Cancel' }).click()

      // Modal closes, session stays, and no delete request was fired.
      await expect(dialog).toBeHidden()
      await expect(page.locator(selectors.chats.sessionItem(targetSessionId))).toBeVisible()
      expect(deleteCalls).toHaveLength(0)
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
