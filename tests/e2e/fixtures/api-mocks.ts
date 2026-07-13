/**
 * API Mock Helpers for E2E Tests
 * Provides utilities for mocking API responses with Playwright route interception
 *
 * SOURCE OF TRUTH: `lib/api/services/*.ts` is authoritative for every backend
 * path/method mocked here. The MSW handlers under `tests/msw/handlers/*.ts`
 * mirror the same real paths and can be used to cross-check spellings/methods.
 * Do NOT reintroduce the old `**\/api/auth/*` or `**\/api/chat/*` patterns —
 * they match nothing against the real C# backend.
 */

import type { Page, Route } from '@playwright/test'
import { mockUsers, mockAllUsers } from '../mocks/data/users'
import {
  mockSessionHeaders,
  mockUnreadCounts,
  createMockSessionHeader,
} from '../mocks/data/sessions'
import { mockConversation, createMockMessage } from '../mocks/data/messages'

// ============================================================================
// ENVELOPE HELPERS
// ============================================================================

// Mirror the backend ApiResponse<T> envelope produced by `tests/msw/http.ts`
// (apiOk / apiError). Playwright cannot cleanly import the vitest-side helpers,
// so keep these tiny local copies. NOTE: config.json is served RAW (no envelope)
// — do NOT route it through these.

/** 200 (or init.status) + { data, success:null, warning:null, error:null }. */
async function fulfillOk(route: Route, data: unknown, init?: { status?: number }) {
  await route.fulfill({
    status: init?.status ?? 200,
    contentType: 'application/json',
    body: JSON.stringify({ data, success: null, warning: null, error: null }),
  })
}

/** status + { data:null, success:null, warning:null, error:{ code, message, statusCode } }. */
async function fulfillError(route: Route, status: number, code: string, message?: string) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify({
      data: null,
      success: null,
      warning: null,
      error: { code, message, statusCode: status },
    }),
  })
}

// ============================================================================
// ERROR HELPERS
// ============================================================================

/**
 * Simulate a network error for a given URL pattern
 */
export async function mockNetworkError(page: Page, urlPattern: string | RegExp) {
  await page.route(urlPattern, (route) => route.abort('failed'))
}

/**
 * Simulate a timeout for a given URL pattern
 */
export async function mockTimeout(page: Page, urlPattern: string | RegExp, delayMs = 30000) {
  await page.route(urlPattern, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, delayMs))
    await route.abort('timedout')
  })
}

/**
 * Simulate an auth error (401 or 403)
 */
export async function mockAuthError(
  page: Page,
  urlPattern: string | RegExp,
  statusCode: 401 | 403 = 401,
) {
  await page.route(urlPattern, async (route) => {
    await fulfillError(
      route,
      statusCode,
      statusCode === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN',
      statusCode === 401 ? 'Invalid credentials' : 'Access denied',
    )
  })
}

/**
 * Simulate a validation error (400)
 */
export async function mockValidationError(
  page: Page,
  urlPattern: string | RegExp,
  message = 'Validation failed',
  validationErrors: Array<{ field: string; message: string }> = [],
) {
  await page.route(urlPattern, async (route) => {
    await route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message,
          statusCode: 400,
          validationErrors,
        },
        success: null,
        warning: null,
      }),
    })
  })
}

/**
 * Simulate a not found error (404)
 */
export async function mockNotFoundError(
  page: Page,
  urlPattern: string | RegExp,
  message = 'Resource not found',
) {
  await page.route(urlPattern, async (route) => {
    await fulfillError(route, 404, 'NOT_FOUND', message)
  })
}

// ============================================================================
// AUTH MOCKS
// ============================================================================

/**
 * Install ONLY the login-success route. Individual override — call AFTER
 * mockAllApis to shadow its happy-path login (see LAYERING CONTRACT below).
 * Defaults to the standard mock user; pass `user` to log in as someone else.
 */
export async function mockLoginSuccess(
  page: Page,
  user: typeof mockUsers.regularUser = mockUsers.regularUser,
) {
  await page.route('**/api/authentication/login', async (route) => {
    await fulfillOk(route, {
      accessToken: 'mock-access-token-12345',
      refreshToken: 'mock-refresh-token-67890',
      user,
    })
  })
}

/**
 * Pre-seed persisted auth state into localStorage BEFORE the app boots, so the
 * auth store hydrates as already-authenticated without running the login UI.
 *
 * Writes the EXACT `innochat-auth` key + shape the store reads on boot — see
 * app/stores/auth.ts: AUTH_STORAGE_KEY = 'innochat-auth', saveAuthStateToStorage
 * writes `{ user, accessToken, refreshToken, timestamp }`, and
 * loadAuthStateFromStorage() hydrates only when `user` + `accessToken` are set
 * (the ISO timestamp is written by the app but ignored on load).
 *
 * Use the `mockedAuthenticatedPage` fixture when the login flow ITSELF is the
 * subject under test; use THIS seeder when login is NOT the subject and you just
 * need a logged-in starting point fast (it skips the whole login round-trip).
 *
 * Must be called BEFORE page.goto(): addInitScript runs on every navigation
 * before app code, so the store sees the seeded state on its first hydrate.
 */
export async function seedAuthLocalStorage(
  page: Page,
  overrides: {
    user?: typeof mockUsers.regularUser
    accessToken?: string
    refreshToken?: string
  } = {},
): Promise<void> {
  const authData = {
    user: overrides.user ?? mockUsers.regularUser,
    accessToken: overrides.accessToken ?? 'seeded-access-token',
    refreshToken: overrides.refreshToken ?? 'seeded-refresh-token',
    timestamp: new Date().toISOString(),
  }

  await page.addInitScript(
    ({ key, value }) => {
      window.localStorage.setItem(key, value)
    },
    { key: 'innochat-auth', value: JSON.stringify(authData) },
  )
}

/**
 * Install a failing login route (401 by default, 403 for locked accounts).
 * Individual override — call AFTER mockAllApis to shadow its happy-path login.
 */
export async function mockLoginFailure(page: Page, status: 401 | 403 = 401) {
  await mockAuthError(page, '**/api/authentication/login', status)
}

/**
 * Install a failing refresh-token route (401). Drives the silent-refresh →
 * logout path. Individual override — call AFTER mockAllApis to shadow its
 * happy-path refresh route.
 */
export async function mockRefreshFailure(page: Page) {
  await page.route('**/api/authentication/refresh-token', async (route) => {
    await fulfillError(route, 401, 'UNAUTHORIZED', 'Refresh token expired')
  })
}

/**
 * Install the happy-path refresh-token route. Internal — part of mockAllApis.
 */
async function installRefreshSuccess(page: Page) {
  await page.route('**/api/authentication/refresh-token', async (route) => {
    await fulfillOk(route, {
      accessToken: 'mock-refreshed-access-token',
      refreshToken: 'mock-refreshed-refresh-token',
    })
  })

  // NOTE: No logout mock — logout is client-side only (clears store/storage,
  // disconnects SignalR). There is no backend logout endpoint. See
  // app/composables/useAuth.ts (useLogout) and app/stores/auth.ts (performLogout).
}

// ============================================================================
// USER MOCKS
// ============================================================================

/**
 * Install the happy-path user routes. Internal — part of mockAllApis.
 */
async function installUserMocks(page: Page) {
  // Success - selectable users list (GET /api/user/get-selectable-users?email=...)
  // The `**` suffix also matches the ?email query string.
  await page.route('**/api/user/get-selectable-users**', async (route) => {
    await fulfillOk(route, mockAllUsers)
  })

  // NOTE: There is no "get single user by id" backend endpoint. UserService only
  // exposes getSelectableUsers (GET /api/user/get-selectable-users). The old
  // `**/api/users/*` single-user route was removed — retargeting it to the same
  // real path would shadow the list mock above.
}

// ============================================================================
// CHAT MOCKS
// ============================================================================

/**
 * Install the happy-path chat routes. Internal — part of mockAllApis.
 */
async function installChatMocks(page: Page) {
  const sessions = mockSessionHeaders
  const messages = mockConversation
  const unreadCounts = mockUnreadCounts

  // Mock session list
  await page.route('**/api/AIWebAPI/GetSessionHeadersByUserId', async (route) => {
    await fulfillOk(route, sessions)
  })

  // Mock single session with messages (POST /api/AIWebAPI/GetSessionById — sessionId is in the request body)
  await page.route('**/api/AIWebAPI/GetSessionById', async (route) => {
    const { sessionId } = (route.request().postDataJSON() ?? {}) as { sessionId?: string }
    const session = sessions.find((s) => s.sessionId === sessionId)

    if (session) {
      await fulfillOk(route, { ...session, messages })
    } else {
      await fulfillError(route, 404, 'NOT_FOUND', 'Session not found')
    }
  })

  // Mock unread counts
  await page.route('**/api/AIWebAPI/GetUnreadMessages', async (route) => {
    await fulfillOk(route, unreadCounts)
  })

  // Mock send message
  await page.route('**/api/AIWebAPI/question/text', async (route) => {
    if (route.request().method() === 'POST') {
      await fulfillOk(route, {
        messageID: `msg-${Date.now()}`,
        success: true,
      })
    } else {
      await route.continue()
    }
  })

  // Mock mark as read
  await page.route('**/api/AIWebAPI/Set_SessionMessagesRead', async (route) => {
    if (route.request().method() === 'POST') {
      await fulfillOk(route, null)
    } else {
      await route.continue()
    }
  })

  // Mock welcome message
  await page.route('**/api/AIWebAPI/welcomeText', async (route) => {
    await fulfillOk(route, {
      message: 'Welcome! How can I assist you today?',
    })
  })

  // Mock update session name (POST /api/AIWebAPI/SetSessionName)
  await page.route('**/api/AIWebAPI/SetSessionName', async (route) => {
    if (route.request().method() === 'PUT' || route.request().method() === 'POST') {
      await fulfillOk(route, null)
    } else {
      await route.continue()
    }
  })

  // Mock delete session (POST /api/AIWebAPI/DeleteSessionById). ChatService
  // validates the payload with validateMutationSuccess: the data field must be
  // the JSON-stringified backend success message (same shape as mutationOk() in
  // tests/msw/http.ts) or the mutation errors and the UI keeps the session.
  await page.route('**/api/AIWebAPI/DeleteSessionById', async (route) => {
    if (route.request().method() === 'POST') {
      await fulfillOk(route, JSON.stringify({ message: 'kész.' }))
    } else {
      await route.continue()
    }
  })

  // Mock public-chat bootstrap (POST /api/AIWebAPI/startPublicChat). Public mode
  // fetches the agent's UserDTO via usePublicChatAgent to render PublicChatHeader.
  // Returns { user, agent } per AIPublicChatStartDTOSchema. mockUsers.virtualAgent
  // has id 100, matching the publicAgent used by public-mode specs.
  await page.route('**/api/AIWebAPI/startPublicChat', async (route) => {
    await fulfillOk(route, { user: mockUsers.regularUser, agent: mockUsers.virtualAgent })
  })
}

// ============================================================================
// CONFIG MOCK
// ============================================================================

// Mirrors DEFAULT_CONFIG (lib/config/defaults.ts). ConfigService.loadConfig
// validates response.data DIRECTLY against InnoChatConfigSchema — config.json is
// served RAW, so this body is NOT wrapped in the { data, success, warning, error }
// envelope. publicAgent: -1 / publicMode: 0 => authenticated (non-public) mode.
const MOCK_CONFIG = {
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
  publicMode: 0,
  publicLoginEmail: null,
  publicLoginPassword: null,
  publicAgent: -1,
}

/**
 * Install the config.json mock. REQUIRED for app boot — config-init.client.ts
 * blocks startup until InnoChatConfig loads. Served raw (no envelope) by design.
 * Internal — part of mockAllApis.
 */
async function installConfigMock(page: Page, config: Record<string, unknown> = MOCK_CONFIG) {
  await page.route('**/api/settings/config.json', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(config),
    })
  })
}

// ============================================================================
// LOG SINK
// ============================================================================

/**
 * Install a 200 sink for the fire-and-forget client logger (LogService POSTs
 * /api/Log/log). Prevents background log requests from hitting the real backend
 * or failing the test. Internal — part of mockAllApis.
 */
async function installLogSink(page: Page) {
  await page.route('**/api/Log/log', async (route) => {
    await fulfillOk(route, null)
  })
}

// ============================================================================
// NEW-SESSION ROUND-TRIP MOCK
// ============================================================================

/** Schema-valid agent reply message for a session (stable, non-colliding id). */
function agentReplyMessage(sessionId: string, replyText: string) {
  return createMockMessage({
    messageID: `${sessionId}-reply`,
    messageText: replyText,
    senderName: 'AI Assistant',
    senderUserCode: 'ai@virtual.agent',
    readByUsers: [],
    sessionId,
  })
}

/**
 * Mock the "first message creates a session" round-trip. Individual override —
 * call AFTER mockAllApis (LIFO) so it shadows two happy-path routes:
 *
 *  - POST /api/AIWebAPI/question/text → records { sessionId → question } from
 *    the request body and responds with a schema-valid agent reply (replyText).
 *    The mockAllApis default ({ messageID, success }) fails AISessionMessageDTO
 *    validation, so the send mutation errors — fine for input-clearing specs,
 *    wrong for round-trip specs that assert the reply renders.
 *  - POST /api/AIWebAPI/GetSessionById → for a recorded sessionId, returns a
 *    synthetic session containing the user's question + the agent reply (the
 *    app refetches the new session right after the send resolves). Unknown ids
 *    fall back to the previously registered happy-path route.
 */
export async function mockNewSessionRoundTrip(
  page: Page,
  replyText = 'This is the mocked AI reply.',
): Promise<void> {
  const askedQuestions = new Map<string, string>()

  await page.route('**/api/AIWebAPI/question/text', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback()
      return
    }
    const body = (route.request().postDataJSON() ?? {}) as {
      sessionId?: string
      question?: string
    }
    const sessionId = body.sessionId ?? ''
    askedQuestions.set(sessionId, body.question ?? '')
    await fulfillOk(route, agentReplyMessage(sessionId, replyText))
  })

  await page.route('**/api/AIWebAPI/GetSessionById', async (route) => {
    const { sessionId } = (route.request().postDataJSON() ?? {}) as { sessionId?: string }
    const question = sessionId ? askedQuestions.get(sessionId) : undefined
    if (sessionId === undefined || question === undefined) {
      await route.fallback()
      return
    }

    await fulfillOk(route, {
      ...createMockSessionHeader({ sessionId, sessionName: question }),
      messages: [
        createMockMessage({ messageID: `${sessionId}-user`, messageText: question, sessionId }),
        agentReplyMessage(sessionId, replyText),
      ],
    })
  })
}

// ============================================================================
// COMBINED SETUP
// ============================================================================

/**
 * Install the full happy-path API mock set in one call: config.json + Log sink
 * + login success + refresh success + users + chat. This is the default baseline
 * for a test; layer scenario variation on top with the individual override
 * helpers (mockLoginSuccess/mockLoginFailure/mockRefreshFailure) and the error
 * helpers (mockNetworkError/mockTimeout/mockAuthError/...).
 *
 * LAYERING CONTRACT: Playwright dispatches the LAST-registered matching route
 * first. Call mockAllApis FIRST to lay down the happy path, then call an
 * individual override AFTER it to shadow a specific route. Each override
 * registers the SAME URL pattern as its happy-path counterpart, so the
 * later registration wins.
 */
export async function mockAllApis(page: Page): Promise<void> {
  // Config + log sink must be registered so app boot and background logging never
  // hit the real backend.
  await installConfigMock(page)
  await installLogSink(page)
  await mockLoginSuccess(page)
  await installRefreshSuccess(page)
  await installUserMocks(page)
  await installChatMocks(page)
}

/**
 * Clear all routes and restore original behavior
 */
export async function clearAllMocks(page: Page) {
  await page.unrouteAll()
}
