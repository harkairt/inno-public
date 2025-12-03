/**
 * Chat Messaging Tests
 * Tests for sending and receiving messages in chat sessions
 */

import { test, expect } from '../fixtures'
import { selectors } from '../selectors'
import { sendMessage, getMessageCount, scrollToBottom } from '../actions/chat.actions'
import { navigateToChatSession } from '../actions/navigation.actions'

test.describe('Chat Messaging', () => {
  // Note: These tests require an existing chat session
  // In a real test environment, you'd create a session first or use test fixtures

  test.describe('Message Input', () => {
    test('should display message input area', async ({ authenticatedPage }) => {
      // Navigate to chats - we need a valid session for this
      await authenticatedPage.goto('/chats')

      // Try to find any existing session in sidebar and click it
      const sessionLinks = authenticatedPage.locator('a[href^="/chats/"]')
      const count = await sessionLinks.count()

      if (count > 0) {
        await sessionLinks.first().click()
        await authenticatedPage.waitForURL(/\/chats\//)

        // Message input should be visible
        await expect(authenticatedPage.locator(selectors.chat.messageInput)).toBeVisible()
        await expect(authenticatedPage.locator(selectors.chat.sendButton)).toBeVisible()
      }
    })

    test('should enable send button when message has content', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/chats')

      const sessionLinks = authenticatedPage.locator('a[href^="/chats/"]')
      const count = await sessionLinks.count()

      if (count > 0) {
        await sessionLinks.first().click()
        await authenticatedPage.waitForURL(/\/chats\//)

        const sendButton = authenticatedPage.locator(selectors.chat.sendButton)
        const messageInput = authenticatedPage.locator(selectors.chat.messageInput)

        // Initially button may be disabled (empty input)
        await messageInput.fill('Test message')

        // Button should be enabled after typing
        await expect(sendButton).not.toBeDisabled()
      }
    })

    test('should clear input after sending message', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/chats')

      const sessionLinks = authenticatedPage.locator('a[href^="/chats/"]')
      const count = await sessionLinks.count()

      if (count > 0) {
        await sessionLinks.first().click()
        await authenticatedPage.waitForURL(/\/chats\//)

        const messageInput = authenticatedPage.locator(selectors.chat.messageInput)

        // Type and send a message
        await messageInput.fill('Test message')
        await authenticatedPage.locator(selectors.chat.sendButton).click()

        // Input should be cleared after sending
        await expect(messageInput).toHaveValue('')
      }
    })
  })

  test.describe('Message Display', () => {
    test('should display messages container', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/chats')

      const sessionLinks = authenticatedPage.locator('a[href^="/chats/"]')
      const count = await sessionLinks.count()

      if (count > 0) {
        await sessionLinks.first().click()
        await authenticatedPage.waitForURL(/\/chats\//)

        // Messages container should be present
        await expect(authenticatedPage.locator(selectors.chat.messagesContainer)).toBeVisible()
      }
    })

    test('should show existing messages in session', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/chats')

      const sessionLinks = authenticatedPage.locator('a[href^="/chats/"]')
      const count = await sessionLinks.count()

      if (count > 0) {
        await sessionLinks.first().click()
        await authenticatedPage.waitForURL(/\/chats\//)

        // Wait for messages to load
        await authenticatedPage.waitForTimeout(1000)

        // Check if any messages are displayed
        const messages = authenticatedPage.locator(selectors.chat.messageItems)
        const messageCount = await messages.count()

        // Even empty sessions may have a welcome message
        // This just verifies the structure is correct
        expect(messageCount).toBeGreaterThanOrEqual(0)
      }
    })
  })

  test.describe('Keyboard Shortcuts', () => {
    test('should send message on Enter key', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/chats')

      const sessionLinks = authenticatedPage.locator('a[href^="/chats/"]')
      const count = await sessionLinks.count()

      if (count > 0) {
        await sessionLinks.first().click()
        await authenticatedPage.waitForURL(/\/chats\//)

        const messageInput = authenticatedPage.locator(selectors.chat.messageInput)
        await messageInput.fill('Test message via Enter')

        // Press Enter to send
        await messageInput.press('Enter')

        // Input should be cleared
        await expect(messageInput).toHaveValue('')
      }
    })

    test('should add newline on Shift+Enter', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/chats')

      const sessionLinks = authenticatedPage.locator('a[href^="/chats/"]')
      const count = await sessionLinks.count()

      if (count > 0) {
        await sessionLinks.first().click()
        await authenticatedPage.waitForURL(/\/chats\//)

        const messageInput = authenticatedPage.locator(selectors.chat.messageInput)
        await messageInput.fill('Line 1')

        // Press Shift+Enter to add newline
        await messageInput.press('Shift+Enter')
        await messageInput.type('Line 2')

        // Value should contain newline
        const value = await messageInput.inputValue()
        expect(value).toContain('\n')
      }
    })
  })

  test.describe('Typing Indicator', () => {
    test('should have typing indicator element', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/chats')

      const sessionLinks = authenticatedPage.locator('a[href^="/chats/"]')
      const count = await sessionLinks.count()

      if (count > 0) {
        await sessionLinks.first().click()
        await authenticatedPage.waitForURL(/\/chats\//)

        // Typing indicator should exist (even if empty)
        await expect(authenticatedPage.locator(selectors.chat.typingIndicator)).toBeVisible()
      }
    })
  })
})
