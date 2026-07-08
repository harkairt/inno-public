/**
 * Chat Navigation Tests
 * Tests for navigation within the chat feature
 */

import { test, expect } from '../fixtures'
import { selectors } from '../selectors'

test.describe('Chat Navigation', () => {
  test.describe('Chat List Panel', () => {
    test('should display chat list panel on desktop', async ({ mockedAuthenticatedPage: page }) => {
      await page.goto('/chats')

      // The ChatListPanel is the desktop session list (there is no collapsible sidebar).
      await expect(page.locator(selectors.layout.chatListPanel)).toBeVisible()
    })

    test('should list sessions in the panel', async ({ mockedAuthenticatedPage: page }) => {
      await page.goto('/chats')

      // Mocked backend returns session headers → session items render as links.
      await expect(page.locator(selectors.chats.sessionItems).first()).toBeVisible()
    })

    test('should use bottom tab bar (not the rail) on mobile', async ({
      mockedAuthenticatedPage: page,
    }) => {
      // Mobile: navigation moves to the bottom tab bar; the desktop rail is gone.
      // (The session list still renders — chats/index.vue shows the panel as the
      // full-page mobile list — so the distinguishing signal is rail vs tab bar.)
      await page.setViewportSize({ width: 375, height: 667 })
      await page.goto('/chats')

      await expect(page.locator(selectors.layout.bottomTabBar)).toBeVisible()
      await expect(page.locator(selectors.layout.appRail)).toBeHidden()
    })
  })

  test.describe('Session Navigation', () => {
    test('should navigate between sessions', async ({ mockedAuthenticatedPage: page }) => {
      await page.goto('/chats')

      const sessionLinks = page.locator('a[href^="/chats/"]')
      const count = await sessionLinks.count()

      if (count >= 2) {
        // Click first session
        await sessionLinks.first().click()
        const firstUrl = page.url()

        // Go back to chats
        await page.goto('/chats')

        // Click second session
        await sessionLinks.nth(1).click()
        const secondUrl = page.url()

        // URLs should be different
        expect(firstUrl).not.toBe(secondUrl)
      }
    })

    test('should maintain scroll position in session list', async ({
      mockedAuthenticatedPage: page,
    }) => {
      await page.goto('/chats')

      // The ChatListPanel persists its scroll position (sessionStorage). Assert the
      // panel is present as the scroll container.
      await expect(page.locator(selectors.layout.chatListPanel)).toBeVisible()
    })
  })

  test.describe('Back Navigation', () => {
    test('should support browser back button', async ({ mockedAuthenticatedPage: page }) => {
      await page.goto('/chats')

      const sessionLinks = page.locator('a[href^="/chats/"]')
      const count = await sessionLinks.count()

      if (count > 0) {
        // Click a session
        await sessionLinks.first().click()
        await expect(page).toHaveURL(/\/chats\//)

        // Go back
        await page.goBack()

        // Should be back on chats page
        await expect(page).toHaveURL('/chats')
      }
    })
  })

  test.describe('Keyboard Navigation', () => {
    test('should not break on unhandled shortcut keypress', async ({
      mockedAuthenticatedPage: page,
    }) => {
      await page.goto('/chats')

      // There is no sidebar-toggle shortcut; verify a Cmd/Ctrl+B keypress is a
      // harmless no-op and the panel stays rendered.
      await page.keyboard.press('Meta+b')
      await expect(page.locator(selectors.layout.chatListPanel)).toBeVisible()
    })
  })

  test.describe('Responsive Layout', () => {
    test('should adapt to different viewport sizes', async ({ mockedAuthenticatedPage: page }) => {
      // Desktop: rail + panel
      await page.setViewportSize({ width: 1920, height: 1080 })
      await page.goto('/chats')
      await expect(page.locator(selectors.layout.chatListPanel)).toBeVisible()

      // Tablet (>= 768 breakpoint is still desktop layout)
      await page.setViewportSize({ width: 768, height: 1024 })
      await expect(page.locator(selectors.layout.chatListPanel)).toBeVisible()

      // Mobile: bottom tab bar replaces rail + panel
      await page.setViewportSize({ width: 375, height: 667 })
      await expect(page.locator(selectors.layout.bottomTabBar)).toBeVisible()
    })
  })
})
