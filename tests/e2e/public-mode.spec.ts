/**
 * Public / iframe mode boot tests
 *
 * Proves the public-mode boot sequence, fully mocked / no backend:
 *
 *   config.json (publicMode: 1) → public-auth.client.ts flips storage to
 *   sessionStorage, clears any auth, then auto-logs-in with the config
 *   credentials against the MOCKED /api/authentication/login. The middleware
 *   keeps the browser on the public chat route and the tokens land in
 *   sessionStorage (NOT localStorage).
 *
 * Setup: mockAllApis lays down the happy path but with a NON-public config
 * (publicMode: 0). Playwright routes are LIFO, so registering a config.json
 * route AFTER mockAllApis shadows it with a PUBLIC config. config.json is
 * served RAW (no ApiResponse envelope) — it is validated directly against
 * InnoChatConfigSchema, so every field of MOCK_CONFIG must be present.
 *
 * See app/composables/usePublicMode.ts, app/plugins/public-auth.client.ts,
 * app/middleware/auth.global.ts, app/stores/auth.ts (AUTH_STORAGE_KEY /
 * setStorageMode).
 */

import type { Page } from '@playwright/test'
import { test, expect, mockAllApis } from './fixtures'

// Full config copied verbatim from api-mocks.ts MOCK_CONFIG, flipped to public
// mode (publicMode/publicAgent/publicLoginEmail/publicLoginPassword changed).
const PUBLIC_CONFIG = {
  mainColor: '#027be2',
  backgroundColor: '#ffffff',
  watermarkEnabled: false,
  partnerMessageBackgroundColor: 'rgba(0, 188, 212, 0.302)',
  ownMessageBackgroundColor: 'rgba(189, 189, 189, 0.302)',
  messageBorderThickness: 0,
  messageBorderColor: 'rgba(0, 0, 0, 0)',
  messageBorderStyle: 'solid',
  messageBorderRounded: 2,
  messageTextOwnItalic: false,
  messageTextOwnBold: false,
  messageTextOwnSize: 14,
  messageTextPartnerItalic: false,
  messageTextPartnerBold: false,
  messageTextPartnerSize: 14,
  axiosTimeout: 30000,
  publicMode: 1,
  publicLoginEmail: 'public@example.com',
  publicLoginPassword: 'public-pass',
  publicAgent: 100,
}

/** Shadow mockAllApis' non-public config.json with the public config (LIFO). */
async function overridePublicConfig(page: Page) {
  await page.route('**/api/settings/config.json', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(PUBLIC_CONFIG),
    })
  })
}

test.describe('Public mode', () => {
  test('auto-login fires and lands on the public chat route', async ({ page }) => {
    // Spy on the login call BEFORE navigating so we don't miss the async fire.
    const loginCalls: string[] = []
    page.on('request', (r) => {
      if (r.url().includes('/api/authentication/login')) loginCalls.push(r.url())
    })

    await mockAllApis(page)
    await overridePublicConfig(page)

    await page.goto('/chats/public/new/100')

    // Middleware validates agent 100 against config and keeps us here.
    await expect(page).toHaveURL(/\/chats\/public\/new\/100/, { timeout: 15_000 })

    // public-auth plugin auto-logged-in with the config credentials.
    await expect.poll(() => loginCalls.length, { timeout: 15_000 }).toBeGreaterThan(0)
  })

  test('tokens are stored in sessionStorage, not localStorage', async ({ page }) => {
    await mockAllApis(page)
    await overridePublicConfig(page)

    await page.goto('/chats/public/new/100')
    await expect(page).toHaveURL(/\/chats\/public\/new\/100/, { timeout: 15_000 })

    // Auto-login is async — poll until the session-store write lands.
    await expect
      .poll(() => page.evaluate(() => sessionStorage.getItem('innochat-auth')), {
        timeout: 15_000,
      })
      .not.toBeNull()

    // Public mode must NOT touch localStorage for the auth blob.
    const localStored = await page.evaluate(() => localStorage.getItem('innochat-auth'))
    expect(localStored).toBeNull()
  })

  test('public layout renders the public chat header (agent name)', async ({ page }) => {
    await mockAllApis(page)
    await overridePublicConfig(page)

    await page.goto('/chats/public/new/100')
    await expect(page).toHaveURL(/\/chats\/public\/new\/100/, { timeout: 15_000 })

    // The header (<header> = role "banner") renders only once the agent fetch
    // resolves, which happens after the async auto-login. mockAllApis mocks
    // startPublicChat → agent 'AI Assistant' (id 100), so it resolves.
    await expect(page.getByRole('banner')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('AI Assistant').first()).toBeVisible({ timeout: 15_000 })

    // NOTE: we do NOT assert the private session sidebar is absent. The parent
    // route page app/pages/chats.vue renders <ChatListPanel> and wraps ALL
    // /chats/* routes (including /chats/public/*) via <NuxtPage>, so the sidebar
    // is present here too. The public layout is proven instead by PublicChatHeader
    // (role "banner" + agent name), which only app/layouts/public.vue renders.
  })
})
