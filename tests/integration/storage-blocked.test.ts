/**
 * Wave D2 — hostile browser Storage (Safari private mode / third-party iframe).
 *
 * Drives the REAL auth store → AuthService → axios → interceptor chain with MSW
 * at the boundary, but with a Storage that throws on every access. Proves the
 * app degrades gracefully: auth is usable in memory, remembered-email helpers
 * no-op, and public-mode boot survives a blocked sessionStorage.
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { server, http } from '@/tests/msw/server'
import { apiOk } from '@/tests/msw/http'
import { makeUser } from '@/tests/utils/factories'
import { installBlockedStorage } from '@/tests/utils/storage'
import { enablePublicMode } from '@/tests/utils/authSeed'
import { installFakeSignalR } from '@/tests/utils/fakeSignalR'
import {
  useAuthStore,
  saveRememberedEmail,
  getRememberedEmail,
  clearRememberedEmail,
} from '@/app/stores/auth'
import { configureApiInterceptors } from '@/lib/api/interceptors/setup'
import { AuthenticationMode } from '@/types/enums'

const LOGIN_PATH = '/api/authentication/login'

let restoreStorage: (() => void) | null = null

afterEach(() => {
  restoreStorage?.()
  restoreStorage = null
})

function armInterceptors() {
  const authStore = useAuthStore()
  const redirectToLogin = vi.fn()
  configureApiInterceptors({ authStore, redirectToLogin })
  return { authStore, redirectToLogin }
}

describe('blocked Storage — graceful degradation', () => {
  it('logs in successfully with blocked localStorage: auth lives in memory, no throw', async () => {
    restoreStorage = installBlockedStorage('localStorage')
    installFakeSignalR() // avoid a real /chatHub negotiate
    const { authStore } = armInterceptors()

    server.use(
      http.post(LOGIN_PATH, () =>
        apiOk({
          user: makeUser({ email: 'agent@example.com' }),
          accessToken: 'access-token-1',
          refreshToken: 'refresh-token-1',
        }),
      ),
    )

    const result = await authStore.login({
      email: 'agent@example.com',
      password: 'my-Secret-Password-123',
      mode: AuthenticationMode.Basic,
    })

    // Login succeeded and tokens are usable in memory despite storage throwing.
    expect(result.isOk()).toBe(true)
    expect(authStore.isAuthenticated).toBe(true)
    expect(authStore.accessToken).toBe('access-token-1')
    expect(authStore.refreshToken).toBe('refresh-token-1')
    expect(authStore.user?.email).toBe('agent@example.com')
  })

  it('remembered-email save + read degrade silently with blocked localStorage', () => {
    restoreStorage = installBlockedStorage('localStorage')

    // None of these throw; the getter reports "nothing remembered".
    expect(() => saveRememberedEmail('user@example.com')).not.toThrow()
    expect(() => clearRememberedEmail()).not.toThrow()
    expect(getRememberedEmail()).toBeNull()
  })

  it('public-mode boot survives a blocked sessionStorage and logs in to memory', async () => {
    restoreStorage = installBlockedStorage('sessionStorage')
    installFakeSignalR()
    enablePublicMode() // sessionStorage-backed store (public/iframe mode)

    // Store hydration reads sessionStorage — must not throw even when blocked.
    const authStore = useAuthStore()
    const redirectToLogin = vi.fn()
    configureApiInterceptors({ authStore, redirectToLogin })
    expect(authStore.isAuthenticated).toBe(false)

    server.use(
      http.post(LOGIN_PATH, () =>
        apiOk({
          user: makeUser({ email: 'public@example.com' }),
          accessToken: 'public-access',
          refreshToken: 'public-refresh',
        }),
      ),
    )

    const result = await authStore.login({
      email: 'public@example.com',
      password: 'pw',
      mode: AuthenticationMode.Basic,
    })

    expect(result.isOk()).toBe(true)
    expect(authStore.isAuthenticated).toBe(true)
    expect(authStore.accessToken).toBe('public-access')
  })
})
