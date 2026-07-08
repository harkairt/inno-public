/**
 * Slow-network session-list loading (hermetic, fully mocked)
 *
 * WHAT THIS COVERS
 * ----------------
 * On a SLOW (but successful) session-list response, the sidebar must show its
 * loading skeleton first, then swap in the rendered session items once the
 * response arrives. We make this deterministic with a delayed-then-success
 * route: the mock waits 1500ms, then fulfills 200 with real session headers.
 *
 * WHY A HAND-ROLLED DELAYED ROUTE — NOT mockTimeout()
 * ---------------------------------------------------
 * mockTimeout() in fixtures/api-mocks.ts ABORTS the request after its delay
 * (`route.abort('timedout')`). That models a FAILED request, not a slow SUCCESS
 * — the query would error, never rendering session items. We need a delivered
 * 200, so we register our own route that awaits, then fulfills with data.
 *
 * WHY seedAuthLocalStorage() — NOT the mockedAuthenticatedPage fixture
 * -------------------------------------------------------------------
 * mockedAuthenticatedPage drives the real login UI and only reaches /chats
 * AFTER a full login round-trip + redirect, by which point first paint of the
 * sidebar has already happened — we'd miss the loading phase entirely, and the
 * fixture also installs its own (non-delayed) session route before we can
 * shadow it. Instead we SEED persisted auth into localStorage before boot, then
 * control the sessions route ourselves BEFORE the first navigation, so the
 * delayed response is in flight during the sidebar's very first render.
 *
 * DETERMINISM OF THE LOADING-PHASE ASSERTION
 * ------------------------------------------
 * The skeleton is gated by `v-if="isLoadingSessions"` in ChatListPanel.vue and
 * stays mounted for the entire 1500ms the route is in flight. The USkeleton
 * theme base class is `animate-pulse rounded-md bg-elevated` (verified in
 * @nuxt/ui dist), so `[data-testid="chat-list-panel"] .animate-pulse` is a
 * robust skeleton locator. We assert it visible with a 1000ms timeout: config
 * boot + first paint land well inside that window, and the window closes before
 * the 1500ms delivery — so the assertion observes the loading phase, not the
 * loaded one. Playwright polls, so it passes as soon as the skeleton appears.
 */

import { test, expect, mockAllApis, seedAuthLocalStorage } from './fixtures'
import { selectors } from './selectors'
import { mockSessionHeaders } from './mocks/data/sessions'

test.describe('Slow network', () => {
  test('shows the session-list loading skeleton, then renders sessions', async ({ page }) => {
    // Authenticated before boot (no login UI), happy-path baseline for everything else.
    await seedAuthLocalStorage(page)
    await mockAllApis(page)

    // LIFO override: this delayed-then-success route shadows mockAllApis' instant
    // session route. Waits 1500ms, then fulfills 200 with the real headers.
    await page.route('**/api/AIWebAPI/GetSessionHeadersByUserId', async (route) => {
      await new Promise((r) => setTimeout(r, 1500))
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: mockSessionHeaders,
          success: null,
          warning: null,
          error: null,
        }),
      })
    })

    await page.goto('/chats')

    // Loading phase: at least one skeleton is visible while the response is in
    // flight (observed inside the 1500ms window; see header note on determinism).
    const skeleton = page.locator('[data-testid="chat-list-panel"] .animate-pulse')
    await expect(skeleton.first()).toBeVisible({ timeout: 1_000 })

    // Loaded phase: once the delayed response arrives, session items render.
    await expect(page.locator(selectors.chats.sessionItem('session-123'))).toBeVisible({
      timeout: 15_000,
    })
  })
})
