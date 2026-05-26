/**
 * API Mock Helpers for E2E Tests
 * Provides utilities for mocking API responses with Playwright route interception
 */

import type { Page } from '@playwright/test'
import { mockUsers, mockAllUsers } from '../mocks/data/users'
import { mockSessionHeaders, mockUnreadCounts } from '../mocks/data/sessions'
import { mockConversation } from '../mocks/data/messages'

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
    await route.fulfill({
      status: statusCode,
      contentType: 'application/json',
      body: JSON.stringify({
        data: null,
        error: {
          code: statusCode === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN',
          message: statusCode === 401 ? 'Invalid credentials' : 'Access denied',
          statusCode,
        },
        success: null,
        warning: null,
      }),
    })
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
    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({
        data: null,
        error: {
          code: 'NOT_FOUND',
          message,
          statusCode: 404,
        },
        success: null,
        warning: null,
      }),
    })
  })
}

// ============================================================================
// AUTH MOCKS
// ============================================================================

type AuthScenario = 'success' | 'invalid-credentials' | 'network-error' | 'locked-account'

/**
 * Setup auth-related API mocks
 */
export async function setupAuthMocks(page: Page, scenario: AuthScenario = 'success') {
  if (scenario === 'network-error') {
    await mockNetworkError(page, '**/api/auth/login')
    return
  }

  if (scenario === 'invalid-credentials') {
    await mockAuthError(page, '**/api/auth/login', 401)
    return
  }

  if (scenario === 'locked-account') {
    await page.route('**/api/auth/login', async (route) => {
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({
          data: null,
          error: {
            code: 'ACCOUNT_LOCKED',
            message: 'Account is locked. Please contact support.',
            statusCode: 403,
          },
          success: null,
          warning: null,
        }),
      })
    })
    return
  }

  // Success case
  await page.route('**/api/auth/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          accessToken: 'mock-access-token-12345',
          refreshToken: 'mock-refresh-token-67890',
          user: mockUsers.regularUser,
        },
        success: 'Login successful',
        warning: null,
        error: null,
      }),
    })
  })

  // Mock token refresh
  await page.route('**/api/auth/refresh', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          accessToken: 'mock-refreshed-access-token',
          refreshToken: 'mock-refreshed-refresh-token',
        },
        success: null,
        warning: null,
        error: null,
      }),
    })
  })

  // Mock logout
  await page.route('**/api/auth/logout', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: null,
        success: 'Logged out successfully',
        warning: null,
        error: null,
      }),
    })
  })
}

// ============================================================================
// USER MOCKS
// ============================================================================

type UserScenario = 'success' | 'network-error' | 'empty'

/**
 * Setup user-related API mocks
 */
export async function setupUserMocks(page: Page, scenario: UserScenario = 'success') {
  if (scenario === 'network-error') {
    await mockNetworkError(page, '**/api/users/**')
    return
  }

  if (scenario === 'empty') {
    await page.route('**/api/users', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [],
          success: null,
          warning: null,
          error: null,
        }),
      })
    })
    return
  }

  // Success - list all users
  await page.route('**/api/users', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: mockAllUsers,
        success: null,
        warning: null,
        error: null,
      }),
    })
  })

  // Success - get single user
  await page.route('**/api/users/*', async (route) => {
    const url = new URL(route.request().url())
    const userId = parseInt(url.pathname.split('/').pop() ?? '0')
    const user = mockAllUsers.find((u) => u.id === userId)

    if (user) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: user,
          success: null,
          warning: null,
          error: null,
        }),
      })
    } else {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({
          data: null,
          error: {
            code: 'NOT_FOUND',
            message: 'User not found',
            statusCode: 404,
          },
          success: null,
          warning: null,
        }),
      })
    }
  })
}

// ============================================================================
// CHAT MOCKS
// ============================================================================

interface ChatMockOptions {
  sessions?: typeof mockSessionHeaders
  messages?: typeof mockConversation
  unreadCounts?: typeof mockUnreadCounts
  scenario?: 'success' | 'network-error' | 'not-found' | 'empty'
}

/**
 * Setup chat-related API mocks
 */
export async function setupChatMocks(page: Page, options: ChatMockOptions = {}) {
  const {
    sessions = mockSessionHeaders,
    messages = mockConversation,
    unreadCounts = mockUnreadCounts,
    scenario = 'success',
  } = options

  if (scenario === 'network-error') {
    await mockNetworkError(page, '**/api/chat/**')
    return
  }

  if (scenario === 'not-found') {
    await mockNotFoundError(page, '**/api/chat/**', 'Session not found')
    return
  }

  if (scenario === 'empty') {
    await page.route('**/api/chat/sessions', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [],
          success: null,
          warning: null,
          error: null,
        }),
      })
    })
    return
  }

  // Mock session list
  await page.route('**/api/chat/sessions', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: sessions,
        success: null,
        warning: null,
        error: null,
      }),
    })
  })

  // Mock single session with messages
  await page.route('**/api/chat/session/*', async (route) => {
    const url = new URL(route.request().url())
    const sessionId = url.pathname.split('/').pop()
    const session = sessions.find((s) => s.sessionId === sessionId)

    if (session) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            ...session,
            messages,
          },
          success: null,
          warning: null,
          error: null,
        }),
      })
    } else {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({
          data: null,
          error: {
            code: 'NOT_FOUND',
            message: 'Session not found',
            statusCode: 404,
          },
          success: null,
          warning: null,
        }),
      })
    }
  })

  // Mock unread counts
  await page.route('**/api/chat/unread', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: unreadCounts,
        success: null,
        warning: null,
        error: null,
      }),
    })
  })

  // Mock send message
  await page.route('**/api/chat/message', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            messageID: `msg-${Date.now()}`,
            success: true,
          },
          success: 'Message sent',
          warning: null,
          error: null,
        }),
      })
    } else {
      await route.continue()
    }
  })

  // Mock mark as read
  await page.route('**/api/chat/read', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: null,
          success: 'Messages marked as read',
          warning: null,
          error: null,
        }),
      })
    } else {
      await route.continue()
    }
  })

  // Mock welcome message
  await page.route('**/api/chat/welcome/*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          message: 'Welcome! How can I assist you today?',
        },
        success: null,
        warning: null,
        error: null,
      }),
    })
  })

  // Mock update session name
  await page.route('**/api/chat/session/name', async (route) => {
    if (route.request().method() === 'PUT' || route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: null,
          success: 'Session name updated',
          warning: null,
          error: null,
        }),
      })
    } else {
      await route.continue()
    }
  })
}

// ============================================================================
// COMBINED SETUP
// ============================================================================

interface AllMocksOptions {
  auth?: AuthScenario
  users?: UserScenario
  chat?: ChatMockOptions
}

/**
 * Setup all API mocks at once
 */
export async function setupAllMocks(page: Page, options: AllMocksOptions = {}) {
  await setupAuthMocks(page, options.auth ?? 'success')
  await setupUserMocks(page, options.users ?? 'success')
  await setupChatMocks(page, options.chat ?? {})
}

/**
 * Clear all routes and restore original behavior
 */
export async function clearAllMocks(page: Page) {
  await page.unrouteAll()
}
