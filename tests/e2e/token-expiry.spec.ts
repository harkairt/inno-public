/**
 * Token Expiry Tests
 *
 * Exercises the two token-expiry branches in the REAL Axios response
 * interceptor (lib/api/interceptors/response.ts), fully mocked / no backend:
 *
 *  1. Silent refresh — a normal call returns 401, the interceptor POSTs
 *     /api/authentication/refresh-token (happy path from mockAllApis), stores
 *     the new tokens and RETRIES the original request. The user never leaves
 *     the page. Modeled with a one-shot 401 that then falls through to the
 *     underlying success handler.
 *
 *  2. Hard logout — the refresh-token call ITSELF 401s, so the interceptor
 *     clearAuth()s and navigates to /login. Modeled with a persistent 401.
 *
 * Playwright routes are LIFO: a page.route(...) registered here (after the
 * fixture ran mockAllApis) shadows the happy-path route.
 */

import type { Route } from '@playwright/test'
import { test, expect, mockRefreshFailure } from './fixtures'
import { selectors } from './selectors'

// Backend ApiResponse<T> error envelope (mirrors api-mocks.ts fulfillError,
// which is not exported).
const unauthorizedEnvelope = {
  data: null,
  success: null,
  warning: null,
  error: { code: 'UNAUTHORIZED', message: 'Token expired', statusCode: 401 },
}

async function fulfill401(route: Route) {
  await route.fulfill({
    status: 401,
    contentType: 'application/json',
    body: JSON.stringify(unauthorizedEnvelope),
  })
}

test.describe('Token expiry', () => {
  test('silent refresh keeps the user on the page', async ({ mockedAuthenticatedPage: page }) => {
    // One-shot 401 on the session fetch; the retry falls through to mockAllApis' success.
    await page.route('**/api/AIWebAPI/GetSessionById', fulfill401, { times: 1 })

    await page.goto('/chats/session-123')

    // No bounce to login: refresh + retry succeeded, session renders.
    await expect(page).toHaveURL(/\/chats\/session-123/, { timeout: 15_000 })
    await expect(page.locator(selectors.chat.messagesContainer)).toBeVisible({ timeout: 15_000 })
  })

  test('refresh failure redirects to /login', async ({ mockedAuthenticatedPage: page }) => {
    await mockRefreshFailure(page)
    // Persistent 401 on the session fetch (no `times`) — every hit fails.
    await page.route('**/api/AIWebAPI/GetSessionById', fulfill401)

    await page.goto('/chats/session-123')

    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 })
    const stored = await page.evaluate(() => localStorage.getItem('innochat-auth'))
    expect(stored).toBeNull()
  })
})
