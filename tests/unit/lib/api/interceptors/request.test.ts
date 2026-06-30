import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AxiosHeaders } from 'axios'
import type { InternalAxiosRequestConfig } from 'axios'
import type { AppError } from '@/lib/errors/types'
import { ErrorCode } from '@/types/enums'

vi.mock('@/lib/utils/uuid', () => ({
  generateUUID: vi.fn(() => 'mock-uuid-1234'),
}))

function makeConfig(
  overrides: Partial<InternalAxiosRequestConfig> = {},
): InternalAxiosRequestConfig {
  return {
    headers: new AxiosHeaders(),
    method: 'get',
    url: '/api/test',
    ...overrides,
  } as InternalAxiosRequestConfig
}

describe('requestInterceptor', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-06-01T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('adds X-Request-ID header using generateUUID', async () => {
    const { requestInterceptor } = await import('@/lib/api/interceptors/request')
    const config = makeConfig()

    const result = requestInterceptor(config)

    expect(result.headers['X-Request-ID']).toBe('mock-uuid-1234')
  })

  it('adds X-Client-Timestamp header with ISO string', async () => {
    const { requestInterceptor } = await import('@/lib/api/interceptors/request')
    const config = makeConfig()

    const result = requestInterceptor(config)

    expect(result.headers['X-Client-Timestamp']).toBe('2025-06-01T12:00:00.000Z')
  })

  it('adds X-Client-User-Agent header when navigator is available', async () => {
    const { requestInterceptor } = await import('@/lib/api/interceptors/request')
    const config = makeConfig()

    const result = requestInterceptor(config)

    // jsdom provides navigator.userAgent
    expect(result.headers['X-Client-User-Agent']).toBeDefined()
    expect(typeof result.headers['X-Client-User-Agent']).toBe('string')
  })

  it('adds X-App-Version header from NUXT_PUBLIC_BUILD_VERSION', async () => {
    const original = import.meta.env.NUXT_PUBLIC_BUILD_VERSION
    import.meta.env.NUXT_PUBLIC_BUILD_VERSION = '847-a1b2c3d'

    vi.resetModules()
    const { requestInterceptor } = await import('@/lib/api/interceptors/request')
    const config = makeConfig()

    const result = requestInterceptor(config)

    expect(result.headers['X-App-Version']).toBe('847-a1b2c3d')

    import.meta.env.NUXT_PUBLIC_BUILD_VERSION = original
  })

  it('defaults X-App-Version to unknown when env var is not set', async () => {
    const original = import.meta.env.NUXT_PUBLIC_BUILD_VERSION
    delete import.meta.env.NUXT_PUBLIC_BUILD_VERSION

    vi.resetModules()
    const { requestInterceptor } = await import('@/lib/api/interceptors/request')
    const config = makeConfig()

    const result = requestInterceptor(config)

    expect(result.headers['X-App-Version']).toBe('unknown')

    import.meta.env.NUXT_PUBLIC_BUILD_VERSION = original
  })

  it('returns the config object', async () => {
    const { requestInterceptor } = await import('@/lib/api/interceptors/request')
    const config = makeConfig()

    const result = requestInterceptor(config)

    expect(result).toBe(config)
  })
})

describe('requestErrorInterceptor', () => {
  it('rejects with the provided error', async () => {
    const { requestErrorInterceptor } = await import('@/lib/api/interceptors/request')
    const error = new Error('request config failed')

    await expect(requestErrorInterceptor(error)).rejects.toBe(error)
  })

  it('rejects with non-Error values', async () => {
    const { requestErrorInterceptor } = await import('@/lib/api/interceptors/request')

    await expect(requestErrorInterceptor('string error')).rejects.toBe('string error')
  })
})

describe('createAuthRequestInterceptor', () => {
  it('returns a function', async () => {
    const { createAuthRequestInterceptor } = await import('@/lib/api/interceptors/request')
    const interceptor = createAuthRequestInterceptor(() => null)

    expect(typeof interceptor).toBe('function')
  })

  it('adds Bearer token when getToken returns a value', async () => {
    const { createAuthRequestInterceptor } = await import('@/lib/api/interceptors/request')
    const interceptor = createAuthRequestInterceptor(() => 'my-access-token-xyz')
    const config = makeConfig()

    const result = interceptor(config)

    expect(result.headers['Authorization']).toBe('Bearer my-access-token-xyz')
  })

  it('does not add Authorization header when getToken returns null', async () => {
    const { createAuthRequestInterceptor } = await import('@/lib/api/interceptors/request')
    const interceptor = createAuthRequestInterceptor(() => null)
    const config = makeConfig()

    const result = interceptor(config)

    expect(result.headers['Authorization']).toBeUndefined()
  })

  it('returns the config object', async () => {
    const { createAuthRequestInterceptor } = await import('@/lib/api/interceptors/request')
    const interceptor = createAuthRequestInterceptor(() => 'token')
    const config = makeConfig()

    const result = interceptor(config)

    expect(result).toBe(config)
  })
})

describe('rateLimitInterceptor', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // Re-import to get a fresh RateLimiter instance each time
    vi.resetModules()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('allows requests under the limit', async () => {
    const { rateLimitInterceptor } = await import('@/lib/api/interceptors/request')
    const config = makeConfig({ method: 'get', url: '/api/items' })

    const result = rateLimitInterceptor(config)

    expect(result).toBe(config)
  })

  it('allows multiple requests under the limit', async () => {
    const { rateLimitInterceptor } = await import('@/lib/api/interceptors/request')

    // Make 99 requests (under default limit of 100)
    for (let i = 0; i < 99; i++) {
      const config = makeConfig({ method: 'get', url: '/api/data' })
      const result = rateLimitInterceptor(config)
      expect(result).toBe(config)
    }
  })

  it('rejects when the rate limit is exceeded', async () => {
    const { rateLimitInterceptor } = await import('@/lib/api/interceptors/request')

    // Exhaust the limit (100 requests for same method_url key)
    for (let i = 0; i < 100; i++) {
      const config = makeConfig({ method: 'get', url: '/api/limited' })
      void rateLimitInterceptor(config)
    }

    // 101st request should be rejected
    const config = makeConfig({ method: 'get', url: '/api/limited' })

    await expect(rateLimitInterceptor(config)).rejects.toMatchObject({
      name: 'AppError',
      code: ErrorCode.RATE_LIMITED,
    })
  })

  it('rejected error message contains wait time', async () => {
    const { rateLimitInterceptor } = await import('@/lib/api/interceptors/request')

    for (let i = 0; i < 100; i++) {
      void rateLimitInterceptor(makeConfig({ method: 'post', url: '/api/action' }))
    }

    try {
      await rateLimitInterceptor(makeConfig({ method: 'post', url: '/api/action' }))
      expect.unreachable('should have rejected')
    } catch (error: unknown) {
      const appError = error as AppError
      expect(appError.name).toBe('AppError')
      expect(appError.message).toMatch(/Rate limit exceeded/)
      expect(appError.message).toMatch(/Try again in \d+s/)
    }
  })

  it('uses method_url as the rate limit key', async () => {
    const { rateLimitInterceptor } = await import('@/lib/api/interceptors/request')

    // Exhaust limit for GET /api/a
    for (let i = 0; i < 100; i++) {
      void rateLimitInterceptor(makeConfig({ method: 'get', url: '/api/a' }))
    }

    // POST /api/a should still work (different key)
    const config = makeConfig({ method: 'post', url: '/api/a' })
    const result = rateLimitInterceptor(config)
    expect(result).toBe(config)

    // GET /api/b should still work (different key)
    const config2 = makeConfig({ method: 'get', url: '/api/b' })
    const result2 = rateLimitInterceptor(config2)
    expect(result2).toBe(config2)
  })

  it('resets after the time window passes', async () => {
    const { rateLimitInterceptor } = await import('@/lib/api/interceptors/request')

    // Exhaust the limit
    for (let i = 0; i < 100; i++) {
      void rateLimitInterceptor(makeConfig({ method: 'get', url: '/api/reset-test' }))
    }

    // Should be rejected now
    await expect(
      rateLimitInterceptor(makeConfig({ method: 'get', url: '/api/reset-test' })),
    ).rejects.toMatchObject({ name: 'AppError' })

    // Advance time past the window (default 60000ms)
    vi.advanceTimersByTime(60001)

    // Should be allowed again
    const config = makeConfig({ method: 'get', url: '/api/reset-test' })
    const result = rateLimitInterceptor(config)
    expect(result).toBe(config)
  })
})

describe('cacheInterceptor', () => {
  it('adds no-cache headers for /messages endpoint', async () => {
    const { cacheInterceptor } = await import('@/lib/api/interceptors/request')
    const config = makeConfig({ method: 'get', url: '/api/chats/123/messages' })

    const result = cacheInterceptor(config)

    expect(result.headers['Cache-Control']).toBe('no-cache')
    expect(result.headers['Pragma']).toBe('no-cache')
  })

  it('adds no-cache headers for /sessions endpoint', async () => {
    const { cacheInterceptor } = await import('@/lib/api/interceptors/request')
    const config = makeConfig({ method: 'get', url: '/api/sessions' })

    const result = cacheInterceptor(config)

    expect(result.headers['Cache-Control']).toBe('no-cache')
    expect(result.headers['Pragma']).toBe('no-cache')
  })

  it('adds no-cache headers for /unread endpoint', async () => {
    const { cacheInterceptor } = await import('@/lib/api/interceptors/request')
    const config = makeConfig({
      method: 'get',
      url: '/api/chats/unread/count',
    })

    const result = cacheInterceptor(config)

    expect(result.headers['Cache-Control']).toBe('no-cache')
    expect(result.headers['Pragma']).toBe('no-cache')
  })

  it('adds max-age for static/non-dynamic GET endpoints', async () => {
    const { cacheInterceptor } = await import('@/lib/api/interceptors/request')
    const config = makeConfig({ method: 'get', url: '/api/config' })

    const result = cacheInterceptor(config)

    expect(result.headers['Cache-Control']).toBe('max-age=300')
    expect(result.headers['Pragma']).toBeUndefined()
  })

  it('does not add cache headers for non-GET requests', async () => {
    const { cacheInterceptor } = await import('@/lib/api/interceptors/request')
    const config = makeConfig({
      method: 'post',
      url: '/api/sessions',
    })

    const result = cacheInterceptor(config)

    expect(result.headers['Cache-Control']).toBeUndefined()
    expect(result.headers['Pragma']).toBeUndefined()
  })

  it('handles uppercase method', async () => {
    const { cacheInterceptor } = await import('@/lib/api/interceptors/request')
    const config = makeConfig({ method: 'GET', url: '/api/config' })

    const result = cacheInterceptor(config)

    expect(result.headers['Cache-Control']).toBe('max-age=300')
  })

  it('handles undefined url gracefully', async () => {
    const { cacheInterceptor } = await import('@/lib/api/interceptors/request')
    const config = makeConfig({ method: 'get', url: undefined })

    const result = cacheInterceptor(config)

    // undefined url won't match any no-cache endpoint, so should get max-age
    expect(result.headers['Cache-Control']).toBe('max-age=300')
  })

  it('returns the config object', async () => {
    const { cacheInterceptor } = await import('@/lib/api/interceptors/request')
    const config = makeConfig()

    const result = cacheInterceptor(config)

    expect(result).toBe(config)
  })
})

describe('transformRequestInterceptor', () => {
  it('removes Content-Type header for FormData requests', async () => {
    const { transformRequestInterceptor } = await import('@/lib/api/interceptors/request')
    const headers = new AxiosHeaders()
    headers.set('Content-Type', 'application/json')
    const config = makeConfig({
      data: new FormData(),
      headers,
    })

    const result = transformRequestInterceptor(config)

    expect(result.headers['Content-Type']).toBeUndefined()
  })

  it('returns config early for FormData without further processing', async () => {
    const { transformRequestInterceptor } = await import('@/lib/api/interceptors/request')
    const config = makeConfig({
      data: new FormData(),
      url: '/api/login',
    })

    const result = transformRequestInterceptor(config)

    expect(result).toBe(config)
  })

  it('passes through non-FormData requests unchanged', async () => {
    const { transformRequestInterceptor } = await import('@/lib/api/interceptors/request')
    const config = makeConfig({
      data: { username: 'test' },
      url: '/api/data',
    })

    const result = transformRequestInterceptor(config)

    expect(result).toBe(config)
    expect(result.data).toEqual({ username: 'test' })
  })

  it('handles requests with no data', async () => {
    const { transformRequestInterceptor } = await import('@/lib/api/interceptors/request')
    const config = makeConfig()

    const result = transformRequestInterceptor(config)

    expect(result).toBe(config)
  })
})

describe('debugInterceptor', () => {
  it('returns the config unchanged', async () => {
    const { debugInterceptor } = await import('@/lib/api/interceptors/request')
    const config = makeConfig({
      method: 'post',
      url: '/api/debug-test',
      data: { foo: 'bar' },
    })

    const result = debugInterceptor(config)

    expect(result).toBe(config)
    expect(result.method).toBe('post')
    expect(result.url).toBe('/api/debug-test')
    expect(result.data).toEqual({ foo: 'bar' })
  })
})
