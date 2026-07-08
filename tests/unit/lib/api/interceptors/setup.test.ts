/**
 * Tests configureApiInterceptors / clearApiInterceptors.
 *
 * Two angles:
 *  - structural: the full request/response chain is attached to the singleton
 *    apiClient, idempotently, and cleared on demand (handler counts).
 *  - behavioral: setAuthStore + setRedirectToLogin are wired, so a 401 whose
 *    refresh fails clears auth and invokes the injected login redirect (driven
 *    end-to-end through MSW + the real interceptor chain).
 *
 * resetAllState() runs clearApiInterceptors() in the global beforeEach, so every
 * test starts with an empty interceptor chain.
 */
import { describe, it, expect, vi } from 'vitest'
import { server, http } from '@/tests/msw/server'
import { apiError } from '@/tests/msw/http'
import { apiClient } from '@/lib/api/client'
import {
  configureApiInterceptors,
  clearApiInterceptors,
  type AuthStoreLike,
} from '@/lib/api/interceptors/setup'

/** Count non-ejected (non-null) interceptor handlers. */
function handlerCount(kind: 'request' | 'response'): number {
  const handlers = (apiClient.interceptors[kind] as unknown as { handlers: unknown[] }).handlers
  return handlers.filter((h) => h !== null).length
}

function makeAuthStore(overrides: Partial<AuthStoreLike> = {}): AuthStoreLike {
  return {
    accessToken: 'access',
    refreshToken: 'refresh',
    getAccessToken: 'access',
    setTokens: vi.fn(() => Promise.resolve()),
    clearAuth: vi.fn(),
    ...overrides,
  }
}

describe('configureApiInterceptors — structure', () => {
  it('attaches the full 6-request / 2-response chain', () => {
    configureApiInterceptors({ authStore: makeAuthStore(), redirectToLogin: vi.fn() })
    expect(handlerCount('request')).toBe(6)
    expect(handlerCount('response')).toBe(2)
  })

  it('is idempotent — a second call adds nothing', () => {
    const deps = { authStore: makeAuthStore(), redirectToLogin: vi.fn() }
    configureApiInterceptors(deps)
    configureApiInterceptors(deps)
    expect(handlerCount('request')).toBe(6)
    expect(handlerCount('response')).toBe(2)
  })

  it('clearApiInterceptors removes every handler and re-enables configuration', () => {
    configureApiInterceptors({ authStore: makeAuthStore(), redirectToLogin: vi.fn() })
    clearApiInterceptors()
    expect(handlerCount('request')).toBe(0)
    expect(handlerCount('response')).toBe(0)

    // Flag was reset — a fresh configure re-attaches the chain.
    configureApiInterceptors({ authStore: makeAuthStore(), redirectToLogin: vi.fn() })
    expect(handlerCount('request')).toBe(6)
  })
})

describe('configureApiInterceptors — store + redirect wiring', () => {
  it('clears auth and redirects to login when a 401 refresh fails', async () => {
    const authStore = makeAuthStore()
    const redirectToLogin = vi.fn()
    configureApiInterceptors({ authStore, redirectToLogin })

    server.use(
      http.get('/api/AIWebAPI/Protected', () => apiError(401)),
      // The refresh attempt also fails → handleTokenRefreshFailure path.
      http.post('/api/authentication/refresh-token', () => apiError(401)),
    )

    await expect(apiClient.get('/api/AIWebAPI/Protected')).rejects.toBeTruthy()

    expect(authStore.clearAuth).toHaveBeenCalledTimes(1)
    expect(redirectToLogin).toHaveBeenCalledTimes(1)
  })

  it('injects the access token from the store into outgoing requests', async () => {
    const authStore = makeAuthStore({ getAccessToken: 'the-token' })
    configureApiInterceptors({ authStore, redirectToLogin: vi.fn() })

    let authHeader: string | null = null
    server.use(
      http.get('/api/AIWebAPI/Ping', ({ request }) => {
        authHeader = request.headers.get('authorization')
        return apiError(200)
      }),
    )

    await apiClient.get('/api/AIWebAPI/Ping')

    expect(authHeader).toBe('Bearer the-token')
  })
})
