import { describe, it, expect } from 'vitest'
import { server, http, HttpResponse } from '@/tests/msw/server'
import { apiOk, apiError } from '@/tests/msw/http'
import { authService } from '@/lib/api/services/AuthService'
import { makeUser } from '@/tests/utils/factories'
import { AuthenticationMode, ErrorCode } from '@/types/enums'

// MSW at the network boundary — no apiClient mock. The real axios request hits
// the handler, so a wrong path (onUnhandledRequest: 'error') or a wrong response
// shape fails the test — exactly the drift the old client mock hid.

const LOGIN_PATH = '/api/authentication/login'
const REFRESH_PATH = '/api/authentication/refresh-token'
const PROFILE_PATH = '/api/authentication/profile'

describe('AuthService.login', () => {
  it('returns user + tokens on success and hashes nothing itself (raw passthrough)', async () => {
    let capturedBody: unknown
    server.use(
      http.post(LOGIN_PATH, async ({ request }) => {
        capturedBody = await request.json()
        return apiOk({
          user: makeUser({ email: 'agent@example.com' }),
          accessToken: 'access-1',
          refreshToken: 'refresh-1',
        })
      }),
    )

    const result = await authService.login({
      email: 'agent@example.com',
      password: 'already-hashed',
      mode: AuthenticationMode.Basic,
    })

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.data.accessToken).toBe('access-1')
      expect(result.value.data.user?.email).toBe('agent@example.com')
    }
    // Request-shape assertion moved to a handler body spy.
    expect(capturedBody).toMatchObject({ email: 'agent@example.com', password: 'already-hashed' })
  })

  it('maps the invalid-credentials warning to an error Result', async () => {
    server.use(
      http.post(LOGIN_PATH, () =>
        HttpResponse.json({
          data: null,
          success: null,
          warning: 'Hibás felhasználónév / jelszó',
          error: null,
        }),
      ),
    )

    const result = await authService.login({
      email: 'agent@example.com',
      password: 'x',
      mode: AuthenticationMode.Basic,
    })

    expect(result.isErr()).toBe(true)
  })

  it('returns UNAUTHORIZED when the login payload has no data', async () => {
    server.use(http.post(LOGIN_PATH, () => apiOk(null)))

    const result = await authService.login({
      email: 'agent@example.com',
      password: 'x',
      mode: AuthenticationMode.Basic,
    })

    expect(result.isErr()).toBe(true)
    if (result.isErr()) expect(result.error.code).toBe(ErrorCode.UNAUTHORIZED)
  })

  it('returns an error on network/HTTP failure', async () => {
    server.use(http.post(LOGIN_PATH, () => apiError(500)))

    const result = await authService.login({
      email: 'agent@example.com',
      password: 'x',
      mode: AuthenticationMode.Basic,
    })

    expect(result.isErr()).toBe(true)
  })
})

describe('AuthService.refreshToken', () => {
  it('returns the new (camelCase) tokens on success', async () => {
    let capturedBody: unknown
    server.use(
      http.post(REFRESH_PATH, async ({ request }) => {
        capturedBody = await request.json()
        return apiOk({ accessToken: 'new-access-token', refreshToken: 'new-refresh-token' })
      }),
    )

    const result = await authService.refreshToken('old-access', 'old-refresh')

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value).toEqual({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      })
    }
    // The wire body carries the current tokens (was toHaveBeenCalledWith).
    expect(capturedBody).toEqual({ accessToken: 'old-access', refreshToken: 'old-refresh' })
  })

  it('returns UNAUTHORIZED when the response carries no data', async () => {
    server.use(http.post(REFRESH_PATH, () => apiOk(null)))

    const result = await authService.refreshToken('access', 'refresh')

    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.code).toBe(ErrorCode.UNAUTHORIZED)
      expect(result.error.message).toBe('Failed to refresh token')
    }
  })

  it('returns an error on network failure', async () => {
    server.use(http.post(REFRESH_PATH, () => HttpResponse.error()))

    const result = await authService.refreshToken('access', 'refresh')

    expect(result.isErr()).toBe(true)
  })

  it('returns an error when the API returns 401', async () => {
    server.use(http.post(REFRESH_PATH, () => apiError(401)))

    const result = await authService.refreshToken('expired-access', 'invalid-refresh')

    expect(result.isErr()).toBe(true)
  })
})

describe('AuthService.getProfile', () => {
  it('returns a validated UserDTO on success', async () => {
    let capturedEmail: string | null = null
    server.use(
      http.get(PROFILE_PATH, ({ request }) => {
        capturedEmail = new URL(request.url).searchParams.get('email')
        return apiOk(makeUser({ email: 'profile@example.com' }))
      }),
    )

    const result = await authService.getProfile('profile@example.com')

    expect(result.isOk()).toBe(true)
    if (result.isOk()) expect(result.value.email).toBe('profile@example.com')
    expect(capturedEmail).toBe('profile@example.com')
  })

  it('returns NOT_FOUND when data is null', async () => {
    server.use(http.get(PROFILE_PATH, () => apiOk(null)))

    const result = await authService.getProfile('nobody@example.com')

    expect(result.isErr()).toBe(true)
    if (result.isErr()) expect(result.error.code).toBe(ErrorCode.NOT_FOUND)
  })

  it('returns VALIDATION_ERROR when the user shape is invalid', async () => {
    server.use(http.get(PROFILE_PATH, () => apiOk({ id: 'not-a-number' })))

    const result = await authService.getProfile('bad@example.com')

    expect(result.isErr()).toBe(true)
    if (result.isErr()) expect(result.error.code).toBe(ErrorCode.VALIDATION_ERROR)
  })
})

describe('AuthService.forgottenPassword / setPassword', () => {
  it('resolves ok on a successful forgotten-password request', async () => {
    const result = await authService.forgottenPassword('user@example.com')
    expect(result.isOk()).toBe(true)
  })

  it('maps a forgotten-password HTTP failure to an error Result', async () => {
    server.use(http.patch('/api/authentication/forgotten-password', () => apiError(500)))

    const result = await authService.forgottenPassword('user@example.com')
    expect(result.isErr()).toBe(true)
  })

  it('resolves ok on a successful set-password request', async () => {
    const result = await authService.setPassword('reset-token', 'new-password')
    expect(result.isOk()).toBe(true)
  })

  it('maps a set-password HTTP failure to an error Result', async () => {
    server.use(http.patch('/api/authentication/set-password', () => apiError(400)))

    const result = await authService.setPassword('reset-token', 'new-password')
    expect(result.isErr()).toBe(true)
  })
})
