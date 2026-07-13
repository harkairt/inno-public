/**
 * Chat Messaging Tests
 * Tests for sending and receiving messages in chat sessions
 */

import { test, expect } from '../fixtures'
import { selectors } from '../selectors'

// `mockedAuthenticatedPage` installs mockAllApis, which seeds a deterministic
// session list + GetSessionById response. `session-123` (mockSessions.basicHeader)
// always resolves to a session whose messages are `mockConversation`, so tests
// can navigate straight to it and assert unconditionally — no count guard.
const SESSION_ID = 'session-123'

test.describe('Chat Messaging', () => {
  test.describe('Message Input', () => {
    test('should display message input area @mobile', async ({ mockedAuthenticatedPage: page }) => {
      await page.goto(`/chats/${SESSION_ID}`)

      await expect(page.locator(selectors.chat.messageInput)).toBeVisible()
      await expect(page.locator(selectors.chat.sendButton)).toBeVisible()
    })

    test('should enable send button when message has content', async ({
      mockedAuthenticatedPage: page,
    }) => {
      await page.goto(`/chats/${SESSION_ID}`)

      const sendButton = page.locator(selectors.chat.sendButton)
      const messageInput = page.locator(selectors.chat.messageInput)

      // Empty input → disabled (canSend === false).
      await expect(sendButton).toBeDisabled()

      // Content → enabled.
      await messageInput.fill('Test message')
      await expect(sendButton).not.toBeDisabled()

      // Whitespace-only stays disabled (canSend trims).
      await messageInput.fill('   ')
      await expect(sendButton).toBeDisabled()
    })

    test('@real should clear input after sending message', async ({ authenticatedPage: page }) => {
      // Real backend: session ids are not known ahead of time, so discover one.
      // waitFor() fails loud if the seeded account has no sessions (a real
      // regression) instead of silently skipping the assertions.
      await page.goto('/chats')

      const sessionItems = page.locator(selectors.chats.sessionItems)
      await sessionItems.first().waitFor()
      await sessionItems.first().click()
      await page.waitForURL(/\/chats\//)

      const messageInput = page.locator(selectors.chat.messageInput)

      // Type and send a message.
      await messageInput.fill('Test message')
      await page.locator(selectors.chat.sendButton).click()

      // Input should be cleared after sending.
      await expect(messageInput).toHaveValue('')
    })
  })

  test.describe('Message Display', () => {
    test('should display messages container', async ({ mockedAuthenticatedPage: page }) => {
      await page.goto(`/chats/${SESSION_ID}`)

      await expect(page.locator(selectors.chat.messagesContainer)).toBeVisible()
    })

    test('should show existing messages in session', async ({ mockedAuthenticatedPage: page }) => {
      await page.goto(`/chats/${SESSION_ID}`)

      await expect(page.locator(selectors.chat.messagesContainer)).toBeVisible()

      // mockConversation is the seeded thread for session-123 — assert its
      // content actually renders rather than a meaningless >= 0 count.
      await expect(page.getByText('Hello, can you help me?')).toBeVisible()
    })
  })

  test.describe('Keyboard Shortcuts', () => {
    test('should send message on Enter key @mobile', async ({ mockedAuthenticatedPage: page }) => {
      await page.goto(`/chats/${SESSION_ID}`)

      const messageInput = page.locator(selectors.chat.messageInput)
      await messageInput.fill('Test message via Enter')

      // Press Enter to send.
      await messageInput.press('Enter')

      // Input should be cleared.
      await expect(messageInput).toHaveValue('')
    })

    test('should add newline on Shift+Enter', async ({ mockedAuthenticatedPage: page }) => {
      await page.goto(`/chats/${SESSION_ID}`)

      const messageInput = page.locator(selectors.chat.messageInput)
      await messageInput.fill('Line 1')

      // Press Shift+Enter to add a newline, then continue typing.
      await messageInput.press('Shift+Enter')
      await messageInput.pressSequentially('Line 2')

      // Value should contain a newline.
      await expect(messageInput).toHaveValue(/\n/)
    })
  })

  test.describe('Typing Indicator', () => {
    test('should have typing indicator element', async ({ mockedAuthenticatedPage: page }) => {
      await page.goto(`/chats/${SESSION_ID}`)

      // The container always renders (only the inner label is conditional).
      await expect(page.locator(selectors.chat.typingIndicator)).toBeVisible()
    })
  })
})
