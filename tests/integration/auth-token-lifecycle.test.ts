/**
 * F5 — Proof-of-life integration test.
 *
 * Exercises the REAL stack end-to-end: real Pinia auth store → real
 * AuthService/ChatService → real axios → real interceptor chain
 * (401 → refresh → retry queue). HTTP is faked ONLY at the network boundary
 * by MSW. Nothing here mocks apiClient, a service, or a store — that is the
 * entire point of this test.
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { sha512 } from 'js-sha512'
import { server, http, HttpResponse } from '@/tests/msw/server'
import { apiOk, apiError } from '@/tests/msw/http'
import { makeUser, makeSession } from '@/tests/utils/factories'
import { useFakeTimersSafe, advance, useRealTimers } from '@/tests/utils/timers'
import { seedAuthStorage } from '@/tests/utils/authSeed'
import { installFakeSignalR } from '@/tests/utils/fakeSignalR'
import { useAuthStore } from '@/app/stores/auth'
import { chatService } from '@/lib/api/services/ChatService'
import { apiClient } from '@/lib/api/client'
import { configureApiInterceptors } from '@/lib/api/interceptors/setup'
import {
  responseInterceptor,
  responseErrorInterceptor,
  setAuthStore,
} from '@/lib/api/interceptors/response'
import { AuthenticationMode } from '@/types/enums'
import type { GetSessionHeadersByUserIdRequestDTO } from '@/types/api/schemas'

const SESSIONS_PATH = '/api/AIWebAPI/GetSessionHeadersByUserId'
const REFRESH_PATH = '/api/authentication/refresh-token'
const AUTH_STORAGE_KEY = 'innochat-auth'

const sessionsRequest: GetSessionHeadersByUserIdRequestDTO = {
  userCode: 'testuser',
  agents: [1],
  filterText: '',
}

/** Arm the real interceptor chain against the real auth store. */
function armInterceptors() {
  const authStore = useAuthStore()
  const redirectToLogin = vi.fn()
  configureApiInterceptors({ authStore, redirectToLogin })
  return { authStore, redirectToLogin }
}

function readAuthStorage(): Record<string, unknown> | null {
  const raw = localStorage.getItem(AUTH_STORAGE_KEY)
  return raw ? (JSON.parse(raw) as Record<string, unknown>) : null
}

/**
 * Arm the real response interceptor chain against the real auth store but
 * DELIBERATELY skip setRedirectToLogin — leaves the module's redirectToLoginFn
 * null so a refresh failure exercises the window.location fallback branch
 * (response.ts redirectToLogin ~261-275). configureApiInterceptors always wires
 * a redirect fn, so we bypass it and attach the response interceptors directly.
 * clearApiInterceptors() (resetAllState beforeEach) tears these down.
 */
function armInterceptorsWithoutRedirect() {
  const authStore = useAuthStore()
  setAuthStore(authStore) // tokens available for the refresh attempt
  apiClient.interceptors.response.use(responseInterceptor, responseErrorInterceptor)
  return { authStore }
}

type NuxtWindow = { __NUXT__?: { config?: { app?: { baseURL?: string } } } }

describe('auth token lifecycle (real stack, MSW at the boundary)', () => {
  // --------------------------------------------------------------------------
  // 1. Login happy path
  // --------------------------------------------------------------------------
  it('logs in, hashes the password, and persists tokens + user', async () => {
    installFakeSignalR() // avoid a real /chatHub negotiate; not the unit under test
    const { authStore } = armInterceptors()

    const rawPassword = 'my-Secret-Password-123'
    let capturedPassword: unknown
    server.use(
      http.post('/api/authentication/login', async ({ request }) => {
        const body = (await request.json()) as { password?: unknown }
        capturedPassword = body.password
        return apiOk({
          user: makeUser({ email: 'agent@example.com' }),
          accessToken: 'access-token-1',
          refreshToken: 'refresh-token-1',
        })
      }),
    )

    const result = await authStore.login({
      email: 'agent@example.com',
      password: rawPassword,
      mode: AuthenticationMode.Basic,
    })

    expect(result.isOk()).toBe(true)

    // Password reached the wire hashed (SHA-512), never as plaintext.
    expect(capturedPassword).toBe(sha512(rawPassword))
    expect(capturedPassword).not.toBe(rawPassword)

    // Tokens + user landed in the store.
    expect(authStore.isAuthenticated).toBe(true)
    expect(authStore.accessToken).toBe('access-token-1')
    expect(authStore.refreshToken).toBe('refresh-token-1')
    expect(authStore.user?.email).toBe('agent@example.com')

    // And in storage.
    const stored = readAuthStorage()
    expect(stored?.accessToken).toBe('access-token-1')
    expect(stored?.refreshToken).toBe('refresh-token-1')
  })

  // --------------------------------------------------------------------------
  // 2. Token expiry, silent recovery (FLAGSHIP)
  // --------------------------------------------------------------------------
  it('recovers silently from a 401: refreshes once and retries with the new token', async () => {
    seedAuthStorage({ accessToken: 'seeded-access-token', refreshToken: 'seeded-refresh-token' })
    const { authStore } = armInterceptors()
    expect(authStore.isAuthenticated).toBe(true)

    let refreshCount = 0
    let retriedAuthHeader: string | null = null

    // Registration order matters: the success handler is the fallback; the
    // once-401 (registered last → matched first) fires on the initial request,
    // is consumed, and the retry then falls through to success.
    server.use(
      http.post(SESSIONS_PATH, ({ request }) => {
        retriedAuthHeader = request.headers.get('Authorization')
        return apiOk([makeSession()])
      }),
    )
    server.use(http.post(SESSIONS_PATH, () => apiError(401), { once: true }))
    server.use(
      http.post(REFRESH_PATH, () => {
        refreshCount++
        return apiOk({ accessToken: 'access-token-2', refreshToken: 'refresh-token-2' })
      }),
    )

    const result = await chatService.getSessionHeaders(sessionsRequest)

    expect(result.isOk()).toBe(true)
    expect(refreshCount).toBe(1)
    expect(retriedAuthHeader).toBe('Bearer access-token-2')
    // New tokens persisted by the interceptor.
    expect(authStore.accessToken).toBe('access-token-2')
  })

  // --------------------------------------------------------------------------
  // 3. Concurrent 401s, single refresh (failedQueue coalescing)
  // --------------------------------------------------------------------------
  it('coalesces concurrent 401s into a single refresh, then retries all', async () => {
    seedAuthStorage({ accessToken: 'seeded-access-token', refreshToken: 'seeded-refresh-token' })
    armInterceptors()

    let refreshCount = 0
    let sessionsCall = 0

    // First three hits (the concurrent burst) 401; retries (calls 4-6) succeed.
    server.use(
      http.post(SESSIONS_PATH, () => {
        sessionsCall++
        if (sessionsCall <= 3) return apiError(401)
        return apiOk([makeSession()])
      }),
    )
    server.use(
      http.post(REFRESH_PATH, () => {
        refreshCount++
        return apiOk({ accessToken: 'access-token-2', refreshToken: 'refresh-token-2' })
      }),
    )

    const results = await Promise.all([
      chatService.getSessionHeaders(sessionsRequest),
      chatService.getSessionHeaders(sessionsRequest),
      chatService.getSessionHeaders(sessionsRequest),
    ])

    expect(refreshCount).toBe(1)
    expect(results.every((r) => r.isOk())).toBe(true)
  })

  // --------------------------------------------------------------------------
  // 4. Refresh failure → logout + redirect
  // --------------------------------------------------------------------------
  it('clears auth and redirects to login when the refresh itself fails', async () => {
    seedAuthStorage({ accessToken: 'seeded-access-token', refreshToken: 'seeded-refresh-token' })
    const { authStore, redirectToLogin } = armInterceptors()
    expect(authStore.isAuthenticated).toBe(true)

    server.use(http.post(SESSIONS_PATH, () => apiError(401)))
    server.use(http.post(REFRESH_PATH, () => apiError(401)))

    const result = await chatService.getSessionHeaders(sessionsRequest)

    expect(result.isErr()).toBe(true)
    expect(authStore.isAuthenticated).toBe(false)
    expect(authStore.accessToken).toBeNull()
    expect(authStore.refreshToken).toBeNull()
    expect(readAuthStorage()).toBeNull()
    expect(redirectToLogin).toHaveBeenCalledTimes(1)
  })

  // --------------------------------------------------------------------------
  // 5. Refresh fails at the network level (not an HTTP status) → logout+redirect
  // --------------------------------------------------------------------------
  it('clears auth and redirects when the refresh request errors at the network level', async () => {
    seedAuthStorage({ accessToken: 'seeded-access-token', refreshToken: 'seeded-refresh-token' })
    const { authStore, redirectToLogin } = armInterceptors()
    expect(authStore.isAuthenticated).toBe(true)

    server.use(http.post(SESSIONS_PATH, () => apiError(401)))
    server.use(http.post(REFRESH_PATH, () => HttpResponse.error()))

    const result = await chatService.getSessionHeaders(sessionsRequest)

    expect(result.isErr()).toBe(true)
    expect(authStore.isAuthenticated).toBe(false)
    expect(readAuthStorage()).toBeNull()
    expect(redirectToLogin).toHaveBeenCalledTimes(1)
  })

  // --------------------------------------------------------------------------
  // 6. Retry backoff on 429 / 503 (fake timers assert count + spacing)
  // --------------------------------------------------------------------------
  it('retries a 429 after exponential backoff and eventually succeeds', async () => {
    useFakeTimersSafe()
    seedAuthStorage({ accessToken: 'seeded-access-token', refreshToken: 'seeded-refresh-token' })
    armInterceptors()

    let calls = 0
    server.use(
      http.post(SESSIONS_PATH, () => {
        calls++
        return calls === 1 ? apiError(429) : apiOk([makeSession()])
      }),
    )

    const promise = chatService.getSessionHeaders(sessionsRequest)

    await advance(500) // < ~1000ms backoff → the retry has not fired yet
    expect(calls).toBe(1)

    await advance(1000) // past the backoff window → retry fires
    const result = await promise

    expect(result.isOk()).toBe(true)
    expect(calls).toBe(2)
  })

  it('retries a 503 after a fixed delay and eventually succeeds', async () => {
    useFakeTimersSafe()
    seedAuthStorage({ accessToken: 'seeded-access-token', refreshToken: 'seeded-refresh-token' })
    armInterceptors()

    let calls = 0
    server.use(
      http.post(SESSIONS_PATH, () => {
        calls++
        return calls === 1 ? apiError(503) : apiOk([makeSession()])
      }),
    )

    const promise = chatService.getSessionHeaders(sessionsRequest)

    await advance(1000) // < 2000ms delay → retry not fired yet
    expect(calls).toBe(1)

    await advance(1500)
    const result = await promise

    expect(result.isOk()).toBe(true)
    expect(calls).toBe(2)
  })

  // --------------------------------------------------------------------------
  // 7. Token extraction ignores extra casings and lands the camelCase tokens
  //    (per extractTokensFromResponse — the interceptor only reads camelCase).
  // --------------------------------------------------------------------------
  it('lands the camelCase refresh tokens even when the response carries extra fields', async () => {
    seedAuthStorage({ accessToken: 'seeded-access-token', refreshToken: 'seeded-refresh-token' })
    const { authStore } = armInterceptors()

    server.use(
      http.post(SESSIONS_PATH, ({ request }) => {
        if (request.headers.get('Authorization') === 'Bearer refreshed-access') {
          return apiOk([makeSession()])
        }
        return apiError(401)
      }),
    )
    server.use(
      http.post(REFRESH_PATH, () =>
        apiOk({
          // Extra PascalCase fields must be ignored; camelCase is the contract.
          AccessToken: 'ignored',
          RefreshToken: 'ignored',
          accessToken: 'refreshed-access',
          refreshToken: 'refreshed-refresh',
        }),
      ),
    )

    const result = await chatService.getSessionHeaders(sessionsRequest)

    expect(result.isOk()).toBe(true)
    expect(authStore.accessToken).toBe('refreshed-access')
    expect(authStore.refreshToken).toBe('refreshed-refresh')
  })

  // --------------------------------------------------------------------------
  // 8. redirectToLogin fallback: no redirect fn registered (plugin uninitialized)
  //    → hard window.location redirect honoring the __NUXT__ baseURL.
  // --------------------------------------------------------------------------
  it('falls back to a window.location redirect (honoring __NUXT__ baseURL) when no redirect fn was registered', async () => {
    const originalHref = window.location.href
    // baseURL without a trailing slash → exercises the normalization branch.
    ;(window as unknown as NuxtWindow).__NUXT__ = { config: { app: { baseURL: '/app' } } }

    seedAuthStorage({ accessToken: 'seeded-access-token', refreshToken: 'seeded-refresh-token' })
    const { authStore } = armInterceptorsWithoutRedirect()
    expect(authStore.isAuthenticated).toBe(true)

    server.use(http.post(SESSIONS_PATH, () => apiError(401)))
    server.use(http.post(REFRESH_PATH, () => apiError(401)))

    const result = await chatService.getSessionHeaders(sessionsRequest)

    expect(result.isErr()).toBe(true)
    // Fallback drove the hard redirect; baseURL '/app' was normalized to '/app/'.
    expect(window.location.pathname).toBe('/app/login')
    // Auth still cleared on refresh failure.
    expect(authStore.isAuthenticated).toBe(false)
    expect(readAuthStorage()).toBeNull()

    // Restore window state so we don't leak into sibling tests.
    delete (window as unknown as NuxtWindow).__NUXT__
    window.location.href = originalHref
  })

  // --------------------------------------------------------------------------
  // 9. Refresh succeeds but the retried original request 401s AGAIN → the
  //    _retry guard breaks the loop (exactly one refresh, no infinite retry).
  // --------------------------------------------------------------------------
  it('stops after a single refresh when the retried request 401s again (the _retry guard breaks the loop)', async () => {
    seedAuthStorage({ accessToken: 'seeded-access-token', refreshToken: 'seeded-refresh-token' })
    armInterceptors()

    let refreshCount = 0
    let sessionsCall = 0

    // Always 401 — even the retry after a fresh token fails.
    server.use(
      http.post(SESSIONS_PATH, () => {
        sessionsCall++
        return apiError(401)
      }),
    )
    server.use(
      http.post(REFRESH_PATH, () => {
        refreshCount++
        return apiOk({ accessToken: 'access-token-2', refreshToken: 'refresh-token-2' })
      }),
    )

    const result = await chatService.getSessionHeaders(sessionsRequest)

    expect(result.isErr()).toBe(true) // error surfaces to the caller
    expect(refreshCount).toBe(1) // refreshed exactly once
    expect(sessionsCall).toBe(2) // initial + one retry, then _retry guard stops
  })

  afterEach(() => useRealTimers())
})
