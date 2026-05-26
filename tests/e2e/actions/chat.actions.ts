/**
 * Chat App Actions
 * User workflows for chat-related operations
 */

import type { Page } from '@playwright/test'
import { selectors } from '../selectors'

/**
 * User workflow: Send a message in the current chat
 */
export async function sendMessage(page: Page, message: string) {
  // Fill message input
  await page.locator(selectors.chat.messageInput).fill(message)

  // Click send button
  await page.locator(selectors.chat.sendButton).click()
}

/**
 * User workflow: Start a new chat with an agent
 */
export async function startChatWithAgent(page: Page, agentId: number) {
  // Click on agent tile
  await page.locator(selectors.chats.agentTile(agentId)).click()

  // Wait for navigation to chat session
  await page.waitForURL(/\/chats\/new\/.*/)
}

/**
 * User workflow: Open an existing chat session
 */
export async function openChatSession(page: Page, sessionId: string) {
  await page.goto(`/chats/${sessionId}`)

  // Wait for messages to load
  await page.locator(selectors.chat.messagesContainer).waitFor()
}

/**
 * User workflow: Open an unread chat from the card
 */
export async function openUnreadChat(page: Page, sessionId: string) {
  await page.locator(selectors.chats.unreadCard(sessionId)).click()

  // Wait for navigation to chat session
  await page.waitForURL(`/chats/${sessionId}`)
}

/**
 * User workflow: Edit session title
 */
export async function editSessionTitle(page: Page, newTitle: string) {
  // Click on edit button
  await page.locator(selectors.chat.editTitleButton).click()

  // Wait for input to appear
  const titleInput = page.locator(selectors.chat.sessionTitleInput)
  await titleInput.waitFor()

  // Clear and fill new title
  await titleInput.clear()
  await titleInput.fill(newTitle)

  // Press Enter to save
  await page.keyboard.press('Enter')
}

/**
 * User workflow: Search sessions in sidebar
 */
export async function searchSessions(page: Page, query: string) {
  await page.locator(selectors.chats.sessionSearch).fill(query)
}

/**
 * User workflow: Clear session search
 */
export async function clearSessionSearch(page: Page) {
  await page.locator(selectors.chats.sessionSearch).clear()
}

/**
 * Helper: Get the current session title
 */
export async function getSessionTitle(page: Page): Promise<string | null> {
  const titleElement = page.locator(selectors.chat.sessionTitle)
  return titleElement.textContent()
}

/**
 * Helper: Count messages in current chat
 */
export async function getMessageCount(page: Page): Promise<number> {
  const messages = page.locator(selectors.chat.messageItems)
  return messages.count()
}

/**
 * Helper: Wait for a specific message to appear
 */
export async function waitForMessage(page: Page, messageId: string, timeout = 5000) {
  await page.locator(selectors.chat.messageItem(messageId)).waitFor({ timeout })
}

/**
 * Helper: Check if typing indicator is visible
 */
export async function isTypingIndicatorVisible(page: Page): Promise<boolean> {
  const indicator = page.locator(selectors.chat.typingIndicator)
  const text = await indicator.textContent()
  return text !== null && text.length > 0
}

/**
 * Helper: Scroll to bottom of messages
 */
export async function scrollToBottom(page: Page) {
  const container = page.locator(selectors.chat.messagesContainer)
  await container.evaluate((el) => {
    el.scrollTop = el.scrollHeight
  })
}
