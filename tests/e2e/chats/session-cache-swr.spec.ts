/**
 * Stale-while-revalidate on session revisit (E2E).
 *
 * Revisiting a >staleTime session must show its cached messages INSTANTLY (no
 * shimmer) while a background refetch runs and eventually swaps in fresh data.
 *
 * Uses the plain `page` fixture (not mockedAuthenticatedPage): page.clock.install()
 * must run before the app loads any scripts, so auth is seeded via
 * seedAuthLocalStorage() and time is driven with the Playwright clock API rather
 * than a real 11s wait.
 */

import { test, expect, fulfillOk, seedAuthLocalStorage, mockAllApis } from '../fixtures'
import { selectors } from '../selectors'
import { mockSessions } from '../mocks/data/sessions'
import { createMockMessage } from '../mocks/data/messages'

const GET_SESSION_BY_ID = '**/api/AIWebAPI/GetSessionById'
const WELCOME_TEXT = '**/api/AIWebAPI/welcomeText'

test.describe('Session cache — stale-while-revalidate', () => {
  test('revisiting a stale session renders cache instantly, then swaps in the background refetch', async ({
    page,
  }) => {
    // Must precede every goto so the fake clock is in place before app scripts load.
    await page.clock.install()

    await mockAllApis(page)

    // welcomeText 500s for this agent (mirrors the real backend). Registered AFTER
    // mockAllApis so this LIFO override wins. The >=500 guard resolves the welcome
    // queryFn synchronously to an empty message — no retry timer left in flight to
    // break the fake clock during fastForward, and (post-fix) no shimmer held over
    // the cached thread on revisit.
    await page.route(WELCOME_TEXT, async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          data: null,
          success: null,
          warning: null,
          error: { code: 'SERVER_ERROR', message: 'Internal server error', statusCode: 500 },
        }),
      })
    })

    const v1Message = createMockMessage({
      messageID: 'a-v1',
      messageText: 'Alpha message v1',
      sessionId: 'session-123',
    })
    const v2Message = createMockMessage({
      messageID: 'a-v2',
      messageText: 'Fresh message v2',
      sessionId: 'session-123',
    })

    // Gate that holds the background refetch response until the test releases it,
    // so any v1 still on screen can only have come from the cache.
    let releaseRefetch!: () => void
    const refetchGate = new Promise<void>((resolve) => {
      releaseRefetch = resolve
    })

    let s123Fetches = 0
    // Registered AFTER mockAllApis (LIFO): this override runs first; other ids
    // fall back to the baseline GetSessionById handler underneath.
    await page.route(GET_SESSION_BY_ID, async (route) => {
      const { sessionId } = (route.request().postDataJSON() ?? {}) as { sessionId?: string }
      if (sessionId !== 'session-123') {
        await route.fallback()
        return
      }

      s123Fetches += 1
      if (s123Fetches === 1) {
        await fulfillOk(route, { ...mockSessions.basicHeader, messages: [v1Message] })
        return
      }

      await refetchGate
      await fulfillOk(route, { ...mockSessions.basicHeader, messages: [v1Message, v2Message] })
    })

    const getSessionRequests: string[] = []
    page.on('request', (req) => {
      if (!req.url().includes('/api/AIWebAPI/GetSessionById')) return
      const body = req.postDataJSON() as { sessionId?: string } | null
      if (body?.sessionId) getSessionRequests.push(body.sessionId)
    })

    await seedAuthLocalStorage(page)
    await page.goto('/chats')

    await page.locator(selectors.chats.sessionItem('session-123')).click()
    await expect(page.getByText('Alpha message v1')).toBeVisible()

    await page.locator(selectors.chats.sessionItem('session-456')).click()
    await expect(page.getByText('Hello, can you help me?')).toBeVisible()

    // Jump Date.now() past the 10s staleTime (fires due timers at most once; done
    // between navigations with no requests in flight).
    await page.clock.fastForward(11_000)

    await page.locator(selectors.chats.sessionItem('session-123')).click()

    // Cache served instantly: v1 is visible within a tight budget while the refetch
    // response is still gated, and NO shimmer covers it — the render gate is decoupled
    // from the (500ing) welcome query.
    await expect(page.getByText('Alpha message v1')).toBeVisible({ timeout: 1000 })
    await expect(page.getByTestId('messages-shimmer')).toHaveCount(0)

    // Background refetch fired: a 2nd GetSessionById for session-123.
    await expect.poll(() => getSessionRequests.filter((id) => id === 'session-123').length).toBe(2)

    // Release the gate → fresh server data replaces the cache.
    releaseRefetch()
    await expect(page.getByText('Fresh message v2')).toBeVisible()
  })
})
