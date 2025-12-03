/**
 * Auth App Actions
 * User workflows for authentication-related operations
 */

import type { Page } from '@playwright/test'
import { selectors } from '../selectors'

/**
 * User workflow: Login with credentials
 */
export async function login(
  page: Page,
  email: string,
  password: string,
  options: { rememberMe?: boolean } = {}
) {
  await page.goto('/login')

  // Fill credentials
  await page.locator(selectors.auth.emailInput).fill(email)
  await page.locator(selectors.auth.passwordInput).fill(password)

  // Handle remember me checkbox
  if (options.rememberMe) {
    await page.locator(selectors.auth.rememberCheckbox).check()
  }

  // Submit form
  await page.getByRole(selectors.auth.submitButton.role, {
    name: selectors.auth.submitButton.name,
  }).click()

  // Wait for redirect to chats page
  await page.waitForURL('/chats')
}

/**
 * User workflow: Login with environment credentials
 */
export async function loginWithEnvCredentials(page: Page) {
  await login(
    page,
    process.env.TEST_USER_EMAIL!,
    process.env.TEST_USER_PASSWORD!
  )
}

/**
 * User workflow: Login as admin
 */
export async function loginAsAdmin(page: Page) {
  await login(
    page,
    process.env.TEST_ADMIN_EMAIL!,
    process.env.TEST_ADMIN_PASSWORD!
  )
}

/**
 * User workflow: Logout
 */
export async function logout(page: Page) {
  await page.getByRole(selectors.auth.logoutButton.role, {
    name: selectors.auth.logoutButton.name,
  }).click()

  // Wait for redirect to login page
  await page.waitForURL('/login')
}

/**
 * User workflow: Attempt login (without waiting for success)
 * Useful for testing error cases
 */
export async function attemptLogin(
  page: Page,
  email: string,
  password: string
) {
  await page.goto('/login')
  await page.locator(selectors.auth.emailInput).fill(email)
  await page.locator(selectors.auth.passwordInput).fill(password)
  await page.getByRole(selectors.auth.submitButton.role, {
    name: selectors.auth.submitButton.name,
  }).click()
}

/**
 * Helper: Check if user is logged in
 */
export async function isLoggedIn(page: Page): Promise<boolean> {
  try {
    await page.getByRole(selectors.auth.logoutButton.role, {
      name: selectors.auth.logoutButton.name,
    }).waitFor({ timeout: 3000 })
    return true
  } catch {
    return false
  }
}

/**
 * Helper: Check if on login page
 */
export async function isOnLoginPage(page: Page): Promise<boolean> {
  const url = page.url()
  return url.includes('/login')
}
