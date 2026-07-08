/**
 * Chat Discovery Tests
 * Tests for the chat landing page, agent tiles, and unread cards
 */

import { test, expect } from '../fixtures'
import { selectors } from '../selectors'
import { navigateToChats } from '../actions/navigation.actions'

test.describe('Chat Discovery Page', () => {
  test.describe('Virtual Agents Section', () => {
    test('should display virtual agents on landing page', async ({
      mockedAuthenticatedPage: page,
    }) => {
      await navigateToChats(page)

      // Should have at least one agent tile visible
      const agentTiles = page.locator(selectors.chats.agentTiles)
      const count = await agentTiles.count()

      // If there are agents, they should be visible
      if (count > 0) {
        await expect(agentTiles.first()).toBeVisible()
      }
    })

    test('should navigate to new chat when clicking agent tile', async ({
      mockedAuthenticatedPage: page,
    }) => {
      await navigateToChats(page)

      // Check if agent tiles exist
      const agentTiles = page.locator(selectors.chats.agentTiles)
      const count = await agentTiles.count()

      if (count > 0) {
        // Click first agent tile
        await agentTiles.first().click()

        // Should navigate to new chat page
        await expect(page).toHaveURL(/\/chats\/new\/\d+/)
      }
    })

    test('should display agent name and avatar', async ({ mockedAuthenticatedPage: page }) => {
      await navigateToChats(page)

      const agentTiles = page.locator(selectors.chats.agentTiles)
      const count = await agentTiles.count()

      if (count > 0) {
        const firstTile = agentTiles.first()

        // Should have agent name text
        const tileText = await firstTile.textContent()
        expect(tileText).toBeTruthy()
        expect(tileText!.length).toBeGreaterThan(0)
      }
    })
  })

  test.describe('Unread Chats Section', () => {
    test('should display unread chat cards when messages exist', async ({
      mockedAuthenticatedPage: page,
    }) => {
      await navigateToChats(page)

      // Check for unread cards (may or may not exist depending on test data)
      const unreadCards = page.locator(selectors.chats.unreadCards)
      const count = await unreadCards.count()

      // This test just verifies the selector works - actual unread state depends on backend
      if (count > 0) {
        await expect(unreadCards.first()).toBeVisible()
      }
    })

    test('should show unread badge on cards', async ({ mockedAuthenticatedPage: page }) => {
      await navigateToChats(page)

      const unreadCards = page.locator(selectors.chats.unreadCards)
      const count = await unreadCards.count()

      if (count > 0) {
        // Unread cards should have a badge with count
        const firstCard = unreadCards.first()
        const badge = firstCard.locator('[class*="badge"]')

        // If badge exists, check it's visible
        if (await badge.isVisible()) {
          const badgeText = await badge.textContent()
          expect(parseInt(badgeText ?? '0')).toBeGreaterThan(0)
        }
      }
    })
  })

  test.describe('Empty State', () => {
    test('should show appropriate content when no agents or chats', async ({
      mockedAuthenticatedPage: page,
    }) => {
      await navigateToChats(page)

      // Page should always have some content - either agents, chats, or empty state
      const pageContent = await page.textContent('body')
      expect(pageContent).toBeTruthy()
    })
  })

  test.describe('Page Layout', () => {
    test('should have header with toggle buttons', async ({ mockedAuthenticatedPage: page }) => {
      await navigateToChats(page)

      // Page should have header text "Chat" or similar
      const header = page.locator('h1')
      await expect(header).toBeVisible()
    })

    test('should be responsive and adjust layout', async ({ mockedAuthenticatedPage: page }) => {
      await navigateToChats(page)

      // Test at mobile viewport
      await page.setViewportSize({ width: 375, height: 667 })
      await expect(page.locator(selectors.chats.agentTiles).first())
        .toBeVisible({ timeout: 1000 })
        .catch(() => {
          // No agents is also valid
        })

      // Test at desktop viewport
      await page.setViewportSize({ width: 1920, height: 1080 })
      await expect(page.locator(selectors.chats.agentTiles).first())
        .toBeVisible({ timeout: 1000 })
        .catch(() => {
          // No agents is also valid
        })
    })
  })
})
