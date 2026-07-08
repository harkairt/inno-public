/**
 * Single-session fetch error → Retry → recovery (hermetic, fully mocked)
 *
 * WHAT THIS COVERS
 * ----------------
 * The single-session page (app/pages/chats/[sessionId].vue) fetches via
 * useChatSession → POST /api/AIWebAPI/GetSessionById. On a server error the page
 * renders its error state (`v-else-if="isError"`): a UAlert with a **Retry**
 * button wired to TanStack `refetch()`. This test drives that path: force the
 * fetch to fail, confirm the Retry button appears and no messages render, let the
 * route recover, click Retry, and confirm the messages container shows.
 *
 * WHY THIS PAGE, NOT THE SIDEBAR SESSION LIST
 * -------------------------------------------
 * The sidebar list error renders only an alert with NO retry affordance. This
 * page has a genuine retry button, so it's the meaningful target.
 *
 * WHY A FAIL-FLAG + route.fallback() (NOT times:N)
 * ------------------------------------------------
 * While `failSession` is true the route 500s EVERY hit, so TanStack exhausts its
 * auto-retries (retry config in useChatQueries.ts: `failureCount < 2` for non-
 * NOT_FOUND) and settles into `isError` — regardless of exactly how many attempts
 * the query layer (and any interceptor retry) makes. Flipping the flag and letting
 * the handler `route.fallback()` hands the next hit to mockAllApis' success route.
 * This is robust to the precise retry count, which `{ times: N }` is not.
 *
 * WHY HTTP 500 (NOT 404/403/401)
 * ------------------------------
 * The page redirects away on NOT_FOUND/404 (after 3s) and FORBIDDEN/403
 * (immediate), so those never let the retry UI settle. A 401 would trip the
 * refresh-token interceptor instead of surfacing as a query error. A 500
 * (INTERNAL_SERVER_ERROR) does none of those — it stays put and shows the retry UI.
 *
 * LOCALE NOTE
 * -----------
 * Although nuxt.config's defaultLocale is 'hu', normal (non-public) mode renders
 * in the browser-detected locale (English under Playwright's default
 * Accept-Language). The Retry button label is therefore matched with a bilingual
 * regex (en "Try Again" / hu "Próbálja újra") so the test is locale-robust; the
 * regex excludes the sibling Back button.
 */

import { test, expect, mockAllApis, seedAuthLocalStorage } from './fixtures'
import { selectors } from './selectors'

test.describe('Error states', () => {
  test('session fetch error shows a retry button that recovers', async ({ page }) => {
    // Authenticated before boot (no login UI); happy-path baseline for everything else.
    await seedAuthLocalStorage(page)
    await mockAllApis(page)

    // LIFO override: 500 while failSession is true; once flipped, fall through to
    // mockAllApis' GetSessionById success handler. Retry-count-agnostic.
    let failSession = true
    await page.route('**/api/AIWebAPI/GetSessionById', async (route) => {
      if (failSession) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            data: null,
            success: null,
            warning: null,
            error: { code: 'INTERNAL_SERVER_ERROR', message: 'Server error', statusCode: 500 },
          }),
        })
      } else {
        await route.fallback()
      }
    })

    await page.goto('/chats/session-123')

    // Error state: the Retry button appears once auto-retries are exhausted.
    // Generous timeout for the exponential backoff between retries.
    const retryButton = page.getByRole('button', { name: /try again|próbálja újra/i })
    await expect(retryButton).toBeVisible({ timeout: 20_000 })

    // Messages are not rendered while in the error state.
    await expect(page.locator(selectors.chat.messagesContainer)).toHaveCount(0)

    // Recover the route, then Retry: refetch() now hits mockAllApis' success handler.
    failSession = false
    await retryButton.click()

    // Recovery: messages render.
    await expect(page.locator(selectors.chat.messagesContainer)).toBeVisible({ timeout: 15_000 })
  })
})
