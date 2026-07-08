/**
 * Navigation App Actions
 * User workflows for navigation-related operations
 */

import type { Page } from '@playwright/test'

/**
 * User workflow: Navigate to chats page
 */
export async function navigateToChats(page: Page) {
  await page.goto('/chats')
}

/**
 * User workflow: Navigate to users page
 */
export async function navigateToUsers(page: Page) {
  await page.goto('/users')
}

/**
 * User workflow: Navigate to login page
 */
export async function navigateToLogin(page: Page) {
  await page.goto('/login')
}

/**
 * User workflow: Navigate to a specific chat session
 */
export async function navigateToChatSession(page: Page, sessionId: string) {
  await page.goto(`/chats/${sessionId}`)
}

/**
 * User workflow: Navigate to new chat with specific user
 */
export async function navigateToNewChat(page: Page, userId: number) {
  await page.goto(`/chats/new/${userId}`)
}

/**
 * Helper: Wait for page to be ready
 */
export async function waitForPageReady(page: Page) {
  await page.waitForLoadState('networkidle')
}

/**
 * User workflow: Navigate back in history
 */
export async function navigateBack(page: Page) {
  await page.goBack()
}

/**
 * User workflow: Navigate forward in history
 */
export async function navigateForward(page: Page) {
  await page.goForward()
}

/**
 * User workflow: Refresh current page
 */
export async function refreshPage(page: Page) {
  await page.reload()
}
