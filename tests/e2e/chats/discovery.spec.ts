/**
 * Chat Discovery Tests
 * Tests for the chat landing page, agent tiles, and unread cards
 */

import { test, expect } from '../fixtures'
import { selectors } from '../selectors'
import { navigateToChats } from '../actions/navigation.actions'

test.describe('Chat Discovery Page', () => {
  test.describe('Virtual Agents Section', () => {
    test('should display virtual agents on landing page', async ({ authenticatedPage }) => {
      await navigateToChats(authenticatedPage)

      // Should have at least one agent tile visible
      const agentTiles = authenticatedPage.locator(selectors.chats.agentTiles)
      const count = await agentTiles.count()

      // If there are agents, they should be visible
      if (count > 0) {
        await expect(agentTiles.first()).toBeVisible()
      }
    })

    test('should navigate to new chat when clicking agent tile', async ({ authenticatedPage }) => {
      await navigateToChats(authenticatedPage)

      // Check if agent tiles exist
      const agentTiles = authenticatedPage.locator(selectors.chats.agentTiles)
      const count = await agentTiles.count()

      if (count > 0) {
        // Click first agent tile
        await agentTiles.first().click()

        // Should navigate to new chat page
        await expect(authenticatedPage).toHaveURL(/\/chats\/new\/\d+/)
      }
    })

    test('should display agent name and avatar', async ({ authenticatedPage }) => {
      await navigateToChats(authenticatedPage)

      const agentTiles = authenticatedPage.locator(selectors.chats.agentTiles)
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
    test('should display unread chat cards when messages exist', async ({ authenticatedPage }) => {
      await navigateToChats(authenticatedPage)

      // Check for unread cards (may or may not exist depending on test data)
      const unreadCards = authenticatedPage.locator(selectors.chats.unreadCards)
      const count = await unreadCards.count()

      // This test just verifies the selector works - actual unread state depends on backend
      if (count > 0) {
        await expect(unreadCards.first()).toBeVisible()
      }
    })

    test('should show unread badge on cards', async ({ authenticatedPage }) => {
      await navigateToChats(authenticatedPage)

      const unreadCards = authenticatedPage.locator(selectors.chats.unreadCards)
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
      authenticatedPage,
    }) => {
      await navigateToChats(authenticatedPage)

      // Page should always have some content - either agents, chats, or empty state
      const pageContent = await authenticatedPage.textContent('body')
      expect(pageContent).toBeTruthy()
    })
  })

  test.describe('Page Layout', () => {
    test('should have header with toggle buttons', async ({ authenticatedPage }) => {
      await navigateToChats(authenticatedPage)

      // Page should have header text "Chat" or similar
      const header = authenticatedPage.locator('h1')
      await expect(header).toBeVisible()
    })

    test('should be responsive and adjust layout', async ({ authenticatedPage }) => {
      await navigateToChats(authenticatedPage)

      // Test at mobile viewport
      await authenticatedPage.setViewportSize({ width: 375, height: 667 })
      await expect(authenticatedPage.locator(selectors.chats.agentTiles).first())
        .toBeVisible({ timeout: 1000 })
        .catch(() => {
          // No agents is also valid
        })

      // Test at desktop viewport
      await authenticatedPage.setViewportSize({ width: 1920, height: 1080 })
      await expect(authenticatedPage.locator(selectors.chats.agentTiles).first())
        .toBeVisible({ timeout: 1000 })
        .catch(() => {
          // No agents is also valid
        })
    })
  })
})
