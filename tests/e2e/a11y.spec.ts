/**
 * Accessibility smoke tests (axe-core)
 *
 * Scans key UI states with axe-core (via @axe-core/playwright) restricted to the
 * WCAG 2 A + AA rule sets. Fully mocked / no backend, same setup as the rest of
 * the e2e suite.
 *
 * RATCHET (baselines only ever go DOWN, never up)
 * -----------------------------------------------
 * Each state has a committed baseline: the number of axe violations that existed
 * when the scan was first added. A test asserts the CURRENT violation count is
 * `<=` its baseline. This means:
 *
 *   - A NEW violation pushes the count ABOVE the baseline → the test FAILS. So a
 *     regression that adds an inaccessible control is caught immediately.
 *   - FIXING violations drops the count BELOW the baseline → still green. When you
 *     fix some, LOWER the baseline constant to the new count in the same change
 *     so the gain is locked in and can never silently regress back.
 *   - You may NEVER raise a baseline to make a failing scan pass. Raising a
 *     baseline is the one edit this file forbids — fix the violation instead.
 *
 * A state that is already clean uses `toEqual([])` (a hard zero) rather than a
 * numeric baseline, so it can never regress even by one.
 *
 * The UI is asserted in ENGLISH (Playwright's default en-US locale drives i18n),
 * so axe scans and the render-gate assertions both see English strings.
 */

import type { Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { test, expect, mockAllApis } from './fixtures'
import { selectors } from './selectors'

// ── Baselines (current violation counts; lower these when you fix issues) ──────
const BASELINE_LOGIN = 3
const BASELINE_CHAT_LIST = 1
const BASELINE_CONVERSATION = 2
const BASELINE_DELETE_DIALOG = 2
const BASELINE_PUBLIC_MODE = 4
const BASELINE_CHAT_LIST_MOBILE = 1
// The two remaining findings are the app-wide document title/lang baselines.
const BASELINE_USERS = 2

/** Run axe over the whole page, scoped to the stable WCAG 2 A/AA rule sets. */
async function scan(page: Page) {
  return new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
}

/**
 * Assert the violation count is within its ratchet baseline. When baseline is 0
 * we demand a hard zero (toEqual([])) so a clean state can never regress.
 */
function assertWithinBaseline(
  violations: Awaited<ReturnType<typeof scan>>['violations'],
  baseline: number,
  label: string,
) {
  // Surface the current count so the baseline can be re-ratcheted after a fix.
  // eslint-disable-next-line no-console
  console.log(`[a11y] ${label}: ${violations.length} violation(s) (baseline ${baseline})`)
  if (baseline === 0) {
    expect(violations).toEqual([])
  } else {
    expect(violations.length).toBeLessThanOrEqual(baseline)
  }
}

// PUBLIC config: mockAllApis lays down a non-public config; registering this
// AFTER it shadows the config route (Playwright routes are LIFO). Mirrors
// public-mode.spec.ts PUBLIC_CONFIG.
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

async function overridePublicConfig(page: Page) {
  await page.route('**/api/settings/config.json', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(PUBLIC_CONFIG),
    })
  })
}

test.describe('Accessibility smoke (axe-core, WCAG 2 A/AA)', () => {
  test('login page (unauthenticated)', async ({ page }) => {
    await mockAllApis(page)
    await page.goto('/login')

    // Render gate + English UI assertion.
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()

    const { violations } = await scan(page)
    assertWithinBaseline(violations, BASELINE_LOGIN, 'login')
  })

  test('chat list (authenticated, sessions loaded)', async ({ mockedAuthenticatedPage: page }) => {
    await page.goto('/chats')

    // Render gate: sessions loaded + English session name from mock data.
    await expect(page.locator(selectors.chats.sessionItems).first()).toBeVisible()
    await expect(page.getByText('Chat with AI Assistant').first()).toBeVisible()

    const { violations } = await scan(page)
    assertWithinBaseline(violations, BASELINE_CHAT_LIST, 'chat-list')
  })

  test('partner directory (authenticated, users loaded)', async ({
    mockedAuthenticatedPage: page,
  }) => {
    await page.goto('/users')

    await expect(page.locator(selectors.users.userItems).first()).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Agents & People' })).toBeVisible()

    const { violations } = await scan(page)
    assertWithinBaseline(violations, BASELINE_USERS, 'users')
  })

  test('active conversation (messages rendered)', async ({ mockedAuthenticatedPage: page }) => {
    await page.goto('/chats/session-123')

    // Render gate: messages container + a rendered English message.
    await expect(page.locator(selectors.chat.messagesContainer)).toBeVisible()
    await expect(page.getByText('Hello, can you help me?').first()).toBeVisible()

    const { violations } = await scan(page)
    assertWithinBaseline(violations, BASELINE_CONVERSATION, 'conversation')
  })

  test('session item menu — delete-confirm dialog open (dynamic state)', async ({
    mockedAuthenticatedPage: page,
  }) => {
    await page.goto('/chats')

    // Open the SessionItemMenu for a deletable session row, then the confirm modal.
    const targetSessionId = 'session-456'
    const sessionItem = page.locator(selectors.chats.sessionItem(targetSessionId))
    await expect(sessionItem).toBeVisible()
    const row = sessionItem.locator('..')
    await row.hover()
    await row.getByRole('button', { name: 'Session options' }).click()
    await page.getByRole('menuitem', { name: 'Delete' }).click()

    // Render gate: modal open with the English confirmation copy.
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(
      dialog.getByText(
        'Are you sure you want to delete this session? This action cannot be undone.',
      ),
    ).toBeVisible()

    const { violations } = await scan(page)
    assertWithinBaseline(violations, BASELINE_DELETE_DIALOG, 'delete-dialog')
  })

  test('public / iframe mode', async ({ page }) => {
    await mockAllApis(page)
    await overridePublicConfig(page)

    await page.goto('/chats/public/new/100')
    await expect(page).toHaveURL(/\/chats\/public\/new\/100/, { timeout: 15_000 })

    // Render gate: public header (role banner) + agent name resolved via auto-login.
    await expect(page.getByRole('banner')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('AI Assistant').first()).toBeVisible({ timeout: 15_000 })

    const { violations } = await scan(page)
    assertWithinBaseline(violations, BASELINE_PUBLIC_MODE, 'public-mode')
  })

  test('chat list under mobile viewport @mobile', async ({ mockedAuthenticatedPage: page }) => {
    // Force the mobile layout in the desktop project too; the mobile-chromium
    // project already emulates the device viewport on top of this.
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/chats')

    await expect(page.locator(selectors.chats.sessionItems).first()).toBeVisible()
    await expect(page.getByText('Chat with AI Assistant').first()).toBeVisible()

    const { violations } = await scan(page)
    assertWithinBaseline(violations, BASELINE_CHAT_LIST_MOBILE, 'chat-list-mobile')
  })
})
