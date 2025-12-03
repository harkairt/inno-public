/**
 * User App Actions
 * User workflows for user-related operations
 */

import type { Page } from '@playwright/test'
import { selectors } from '../selectors'

/**
 * User workflow: Search for users
 */
export async function searchUsers(page: Page, query: string) {
  await page.locator(selectors.users.userSearch).fill(query)
}

/**
 * User workflow: Clear user search
 */
export async function clearUserSearch(page: Page) {
  await page.locator(selectors.users.userSearch).clear()
}

/**
 * User workflow: Select a user to start chat
 */
export async function selectUser(page: Page, userId: number) {
  await page.locator(selectors.users.userCard(userId)).click()
}

/**
 * Helper: Get visible user count
 */
export async function getVisibleUserCount(page: Page): Promise<number> {
  const users = page.locator(selectors.users.userCards)
  return users.count()
}

/**
 * Helper: Check if user is visible in list
 */
export async function isUserVisible(page: Page, userId: number): Promise<boolean> {
  const userCard = page.locator(selectors.users.userCard(userId))
  return userCard.isVisible()
}

/**
 * Helper: Wait for user list to load
 */
export async function waitForUserList(page: Page, timeout = 5000) {
  await page.locator(selectors.users.userList).waitFor({ timeout })
}
