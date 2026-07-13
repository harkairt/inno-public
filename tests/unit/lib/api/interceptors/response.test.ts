import { describe, it, expect, vi, afterEach } from 'vitest'
import { delay } from 'msw'
import { AxiosHeaders } from 'axios'
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { apiClient } from '@/lib/api/client'
import { cacheResponseInterceptor, startCacheCleanup } from '@/lib/api/interceptors/response'
import { extractTokensFromResponse } from '@/lib/api/utils/tokens'
import { configureApiInterceptors } from '@/lib/api/interceptors/setup'
import { server, http, HttpResponse } from '@/tests/msw/server'
import { apiOk, apiError } from '@/tests/msw/http'
import { seedAuthStorage } from '@/tests/utils/authSeed'
import { makeUser } from '@/tests/utils/factories'
import { useAuthStore } from '@/app/stores/auth'
import { useFakeTimersSafe, advance, useRealTimers } from '@/tests/utils/timers'

// The old file mocked apiClient and hand-built AxiosError objects. This version
// drives the REAL client through MSW so the whole response interceptor chain
// (401 → refresh → retry queue, 429/503 backoff) actually runs — plus a thin
// unit layer for the pure helpers (extractTokensFromResponse, cache interceptor).

const PROBE_PATH = '/api/authentication/profile'
const REFRESH_PATH = '/api/authentication/refresh-token'
const AUTH_STORAGE_KEY = 'innochat-auth'

/** Arm the real interceptor chain against the real auth store. */
function armInterceptors() {
  const authStore = useAuthStore()
  const redirectToLogin = vi.fn()
  configureApiInterceptors({ authStore, redirectToLogin })
  return { authStore, redirectToLogin }
}

// ---------------------------------------------------------------------------
// Pure helper: extractTokensFromResponse
// ---------------------------------------------------------------------------

describe('extractTokensFromResponse', () => {
  it('reads camelCase token fields', () => {
    expect(extractTokensFromResponse({ accessToken: 'a', refreshToken: 'r' })).toEqual({
      accessToken: 'a',
      refreshToken: 'r',
    })
  })

  it('treats empty / whitespace-only tokens as null', () => {
    expect(extractTokensFromResponse({ accessToken: '', refreshToken: '   ' })).toEqual({
      accessToken: null,
      refreshToken: null,
    })
  })

  it('returns nulls for null / undefined / missing fields', () => {
    expect(extractTokensFromResponse(null)).toEqual({ accessToken: null, refreshToken: null })
    expect(extractTokensFromResponse(undefined)).toEqual({ accessToken: null, refreshToken: null })
    expect(extractTokensFromResponse({})).toEqual({ accessToken: null, refreshToken: null })
  })
})

// ---------------------------------------------------------------------------
// Pure helper: cacheResponseInterceptor + startCacheCleanup
// ---------------------------------------------------------------------------

function makeCacheableResponse(overrides: {
  method?: string
  url?: string
  cacheControl?: string
}): AxiosResponse {
  const headers: Record<string, unknown> = {}
  if (overrides.cacheControl) headers['cache-control'] = overrides.cacheControl
  return {
    data: { ok: true },
    status: 200,
    statusText: 'OK',
    headers,
    config: {
      url: overrides.url ?? '/api/thing',
      method: overrides.method ?? 'get',
      headers: new AxiosHeaders(),
    } as InternalAxiosRequestConfig,
    request: {},
  } as AxiosResponse
}

describe('cacheResponseInterceptor', () => {
  it('returns the response for a cacheable GET (default max-age)', () => {
    const response = makeCacheableResponse({ method: 'get' })
    expect(cacheResponseInterceptor(response)).toBe(response)
  })

  it('respects an explicit max-age directive', () => {
    const response = makeCacheableResponse({ method: 'get', cacheControl: 'max-age=60' })
    expect(cacheResponseInterceptor(response)).toBe(response)
  })

  it('skips caching when the response is no-cache / no-store', () => {
    const response = makeCacheableResponse({ method: 'get', cacheControl: 'no-store' })
    expect(cacheResponseInterceptor(response)).toBe(response)
  })

  it('skips non-GET responses', () => {
    const response = makeCacheableResponse({ method: 'post' })
    expect(cacheResponseInterceptor(response)).toBe(response)
  })
})

describe('startCacheCleanup', () => {
  afterEach(() => useRealTimers())

  it('schedules periodic cleanup and returns a stop function', async () => {
    useFakeTimersSafe()
    // Populate an entry with a short TTL so the cleanup pass evicts it.
    cacheResponseInterceptor(makeCacheableResponse({ method: 'get', cacheControl: 'max-age=1' }))

    const stop = startCacheCleanup(1000)
    expect(typeof stop).toBe('function')

    await advance(2000) // fires clearExpiredCache; the 1s-TTL entry is now expired
    stop()
  })
})

// ---------------------------------------------------------------------------
// Integration: response interceptor over the real client (MSW at the boundary)
// ---------------------------------------------------------------------------

describe('responseInterceptor success path', () => {
  it('camelCases /user response data and attaches metadata', async () => {
    seedAuthStorage({ accessToken: 'access-1', refreshToken: 'refresh-1' })
    armInterceptors()
    server.use(
      http.get('/api/user/get-selectable-users', () =>
        HttpResponse.json({
          data: { user_name: 'ada' },
          success: null,
          warning: null,
          error: null,
        }),
      ),
    )

    const res = await apiClient.get('/api/user/get-selectable-users', {
      params: { email: 'a@b.c' },
    })

    // snake_case → camelCase transform ran for the /user endpoint.
    expect((res.data as { data: { userName: string } }).data.userName).toBe('ada')
    // Tracking metadata was attached.
    expect(res.metadata).toBeDefined()
  })
})

describe('token refresh over the real client', () => {
  afterEach(() => useRealTimers())

  it('refreshes on 401 and retries with the new bearer token', async () => {
    seedAuthStorage({ accessToken: 'old-access', refreshToken: 'old-refresh' })
    const { authStore } = armInterceptors()

    let refreshCount = 0
    let retriedAuth: string | null = null
    server.use(
      http.get(PROBE_PATH, ({ request }) => {
        retriedAuth = request.headers.get('Authorization')
        return apiOk(makeUser())
      }),
    )
    server.use(http.get(PROBE_PATH, () => apiError(401), { once: true }))
    server.use(
      http.post(REFRESH_PATH, () => {
        refreshCount++
        return apiOk({ accessToken: 'new-access', refreshToken: 'new-refresh' })
      }),
    )

    const res = await apiClient.get(PROBE_PATH, { params: { email: 'a@b.c' } })

    expect(res.status).toBe(200)
    expect(refreshCount).toBe(1)
    expect(retriedAuth).toBe('Bearer new-access')
    expect(authStore.accessToken).toBe('new-access')
  })

  it('clears auth and redirects when the refresh itself returns 401', async () => {
    seedAuthStorage({ accessToken: 'old-access', refreshToken: 'old-refresh' })
    const { authStore, redirectToLogin } = armInterceptors()

    server.use(http.get(PROBE_PATH, () => apiError(401)))
    server.use(http.post(REFRESH_PATH, () => apiError(401)))

    await expect(apiClient.get(PROBE_PATH, { params: { email: 'a@b.c' } })).rejects.toBeDefined()

    expect(authStore.isAuthenticated).toBe(false)
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull()
    expect(redirectToLogin).toHaveBeenCalledTimes(1)
  })

  it('clears auth without attempting refresh when no tokens are available', async () => {
    // Unseeded store → no tokens → handleTokenRefresh throws before any POST.
    const { authStore, redirectToLogin } = armInterceptors()
    expect(authStore.isAuthenticated).toBe(false)

    server.use(http.get(PROBE_PATH, () => apiError(401)))

    await expect(apiClient.get(PROBE_PATH, { params: { email: 'a@b.c' } })).rejects.toBeDefined()
    expect(redirectToLogin).toHaveBeenCalledTimes(1)
  })

  it('does not refresh when skipAuthRefresh is set', async () => {
    seedAuthStorage({ accessToken: 'old-access', refreshToken: 'old-refresh' })
    armInterceptors()

    let refreshCount = 0
    server.use(http.get(PROBE_PATH, () => apiError(401)))
    server.use(
      http.post(REFRESH_PATH, () => {
        refreshCount++
        return apiOk({ accessToken: 'x', refreshToken: 'y' })
      }),
    )

    await expect(
      apiClient.get(PROBE_PATH, {
        params: { email: 'a@b.c' },
        skipAuthRefresh: true,
      } as InternalAxiosRequestConfig),
    ).rejects.toBeDefined()

    expect(refreshCount).toBe(0)
  })

  it('does not refresh a request that already has the _retry flag', async () => {
    seedAuthStorage({ accessToken: 'old-access', refreshToken: 'old-refresh' })
    armInterceptors()

    let refreshCount = 0
    server.use(http.get(PROBE_PATH, () => apiError(401)))
    server.use(
      http.post(REFRESH_PATH, () => {
        refreshCount++
        return apiOk({ accessToken: 'x', refreshToken: 'y' })
      }),
    )

    await expect(
      apiClient.get(PROBE_PATH, {
        params: { email: 'a@b.c' },
        _retry: true,
      } as InternalAxiosRequestConfig),
    ).rejects.toBeDefined()

    expect(refreshCount).toBe(0)
  })

  it('rejects all queued requests when a coalesced refresh fails', async () => {
    seedAuthStorage({ accessToken: 'old-access', refreshToken: 'old-refresh' })
    const { authStore } = armInterceptors()

    server.use(http.get(PROBE_PATH, () => apiError(401)))
    // Slow refresh so the concurrent burst queues behind the first request.
    server.use(
      http.post(REFRESH_PATH, async () => {
        await delay(30)
        return apiError(401)
      }),
    )

    const results = await Promise.allSettled([
      apiClient.get(PROBE_PATH, { params: { email: 'a@b.c' } }),
      apiClient.get(PROBE_PATH, { params: { email: 'a@b.c' } }),
      apiClient.get(PROBE_PATH, { params: { email: 'a@b.c' } }),
    ])

    expect(results.every((r) => r.status === 'rejected')).toBe(true)
    expect(authStore.isAuthenticated).toBe(false)
  })
})

describe('rate limiting (429) and service unavailable (503) retries', () => {
  afterEach(() => useRealTimers())

  it('retries a 429 after exponential backoff and eventually succeeds', async () => {
    useFakeTimersSafe()
    seedAuthStorage({ accessToken: 'access-1', refreshToken: 'refresh-1' })
    armInterceptors()

    let calls = 0
    server.use(
      http.get(PROBE_PATH, () => {
        calls++
        return calls === 1 ? apiError(429) : apiOk(makeUser())
      }),
    )

    const promise = apiClient.get(PROBE_PATH, { params: { email: 'a@b.c' } })

    await advance(500) // < ~1000ms backoff: the retry has not fired yet
    expect(calls).toBe(1)

    await advance(1000) // now past the backoff window
    const res = await promise

    expect(res.status).toBe(200)
    expect(calls).toBe(2)
  })

  it('gives up after the max 429 retries', async () => {
    seedAuthStorage({ accessToken: 'access-1', refreshToken: 'refresh-1' })
    armInterceptors()
    server.use(http.get(PROBE_PATH, () => apiError(429)))

    await expect(
      apiClient.get(PROBE_PATH, {
        params: { email: 'a@b.c' },
        _retryCount: 3,
      } as InternalAxiosRequestConfig),
    ).rejects.toBeDefined()
  })

  it('retries a 503 after a fixed delay and eventually succeeds', async () => {
    useFakeTimersSafe()
    seedAuthStorage({ accessToken: 'access-1', refreshToken: 'refresh-1' })
    armInterceptors()

    let calls = 0
    server.use(
      http.get(PROBE_PATH, () => {
        calls++
        return calls === 1 ? apiError(503) : apiOk(makeUser())
      }),
    )

    const promise = apiClient.get(PROBE_PATH, { params: { email: 'a@b.c' } })

    await advance(1000) // < 2000ms delay: retry not fired yet
    expect(calls).toBe(1)

    await advance(1500)
    const res = await promise

    expect(res.status).toBe(200)
    expect(calls).toBe(2)
  })

  it('gives up after the max 503 retries', async () => {
    seedAuthStorage({ accessToken: 'access-1', refreshToken: 'refresh-1' })
    armInterceptors()
    server.use(http.get(PROBE_PATH, () => apiError(503)))

    await expect(
      apiClient.get(PROBE_PATH, {
        params: { email: 'a@b.c' },
        _retryCount: 2,
      } as InternalAxiosRequestConfig),
    ).rejects.toBeDefined()
  })

  // The `_retryCount > maxRetries` guard is off-by-one sensitive: mutating `>`
  // to `>=` drops the last retry. Asserting the EXACT number of requests the
  // server sees pins the retry budget. maxRetries(429)=3 → 1 original + 3
  // retries = 4 requests; a `>=` mutant would stop one short at 3.
  it('makes exactly maxRetries + 1 requests before giving up on sustained 429', async () => {
    useFakeTimersSafe()
    seedAuthStorage({ accessToken: 'access-1', refreshToken: 'refresh-1' })
    armInterceptors()

    let calls = 0
    server.use(
      http.get(PROBE_PATH, () => {
        calls++
        return apiError(429)
      }),
    )

    const settled = apiClient
      .get(PROBE_PATH, { params: { email: 'a@b.c' } })
      .then(() => 'resolved')
      .catch(() => 'rejected')

    // Cover 1000 + 2000 + 4000ms of exponential backoff (plus jitter).
    await advance(10_000)
    expect(await settled).toBe('rejected')
    expect(calls).toBe(4)
  })

  // maxRetries(503)=2 → 1 original + 2 retries = 3 requests.
  it('makes exactly maxRetries + 1 requests before giving up on sustained 503', async () => {
    useFakeTimersSafe()
    seedAuthStorage({ accessToken: 'access-1', refreshToken: 'refresh-1' })
    armInterceptors()

    let calls = 0
    server.use(
      http.get(PROBE_PATH, () => {
        calls++
        return apiError(503)
      }),
    )

    const settled = apiClient
      .get(PROBE_PATH, { params: { email: 'a@b.c' } })
      .then(() => 'resolved')
      .catch(() => 'rejected')

    await advance(10_000) // 2000 + 2000ms fixed delays
    expect(await settled).toBe('rejected')
    expect(calls).toBe(3)
  })

  // Pins the exponential progression (baseDelay * 2^(n-1)): the 2nd retry must
  // wait ~2000ms, not another ~1000ms. A mutant that drops the doubling would
  // fire the 2nd retry early, bumping the call count before we advance past 2s.
  it('doubles the backoff between successive 429 retries', async () => {
    useFakeTimersSafe()
    seedAuthStorage({ accessToken: 'access-1', refreshToken: 'refresh-1' })
    armInterceptors()

    let calls = 0
    server.use(
      http.get(PROBE_PATH, () => {
        calls++
        return calls >= 3 ? apiOk(makeUser()) : apiError(429)
      }),
    )

    const promise = apiClient.get(PROBE_PATH, { params: { email: 'a@b.c' } })

    await advance(1100) // first backoff (~1000ms) elapsed → first retry fired
    expect(calls).toBe(2)

    await advance(1500) // total ~2600ms: still inside the ~2000ms second backoff
    expect(calls).toBe(2) // proves the 2nd wait is longer than the 1st (doubled)

    await advance(1000) // past ~3000ms → second retry fires and succeeds
    const res = await promise
    expect(res.status).toBe(200)
    expect(calls).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// Additional refresh + transform edge cases (mutant-targeted)
// ---------------------------------------------------------------------------

describe('token refresh — partial credentials', () => {
  // handleTokenRefresh guards with `!accessToken || !refreshToken`. Seeding an
  // access token but no refresh token must abort refresh (clear + redirect) and
  // never POST to the refresh endpoint. An `&&` mutant would proceed to refresh.
  it('aborts refresh when the refresh token is missing', async () => {
    seedAuthStorage({ accessToken: 'access-only', refreshToken: '' })
    const { redirectToLogin } = armInterceptors()

    let refreshCount = 0
    server.use(http.get(PROBE_PATH, () => apiError(401)))
    server.use(
      http.post(REFRESH_PATH, () => {
        refreshCount++
        return apiOk({ accessToken: 'x', refreshToken: 'y' })
      }),
    )

    await expect(apiClient.get(PROBE_PATH, { params: { email: 'a@b.c' } })).rejects.toBeDefined()

    expect(refreshCount).toBe(0)
    expect(redirectToLogin).toHaveBeenCalledTimes(1)
  })
})

describe('responseInterceptor camelCase transform (endpoint matching)', () => {
  it('camelCases /login response data', async () => {
    armInterceptors()
    server.use(
      http.post('/api/authentication/login', () =>
        HttpResponse.json({
          data: { access_token: 'tok' },
          success: null,
          warning: null,
          error: null,
        }),
      ),
    )

    const res = await apiClient.post('/api/authentication/login', {})

    expect((res.data as { data: { accessToken: string } }).data.accessToken).toBe('tok')
  })

  it('leaves snake_case untouched for endpoints that are neither /login nor /user', async () => {
    // Guards against the `includes('')` mutant, which matches every URL and
    // would camelCase responses it should leave alone.
    seedAuthStorage({ accessToken: 'access-1', refreshToken: 'refresh-1' })
    armInterceptors()
    server.use(
      http.get('/api/AIWebAPI/raw', () =>
        HttpResponse.json({ data: { snake_key: 1 }, success: null, warning: null, error: null }),
      ),
    )

    const res = await apiClient.get('/api/AIWebAPI/raw')

    expect((res.data as { data: Record<string, unknown> }).data).toEqual({ snake_key: 1 })
  })
})
