/**
 * Wave D2 — storage-mode collision (normal → public/iframe switch).
 *
 * Verifies setStorageMode('sessionStorage') wipes the old localStorage-backed
 * auth and that a subsequent public-mode login persists only to sessionStorage,
 * so a token can never bleed across modes.
 */

import { describe, it, expect, vi } from 'vitest'
import { server, http } from '@/tests/msw/server'
import { apiOk } from '@/tests/msw/http'
import { makeUser } from '@/tests/utils/factories'
import { seedAuthStorage } from '@/tests/utils/authSeed'
import { installFakeSignalR } from '@/tests/utils/fakeSignalR'
import { useAuthStore, setStorageMode } from '@/app/stores/auth'
import { configureApiInterceptors } from '@/lib/api/interceptors/setup'
import { AuthenticationMode } from '@/types/enums'

const AUTH_STORAGE_KEY = 'innochat-auth'
const LOGIN_PATH = '/api/authentication/login'

describe('storage-mode collision (normal ↔ public)', () => {
  it('switching to public mode clears the old localStorage auth without bleeding into sessionStorage', () => {
    seedAuthStorage({ accessToken: 'ls-access', refreshToken: 'ls-refresh' })
    const authStore = useAuthStore()

    expect(authStore.isAuthenticated).toBe(true)
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toContain('ls-access')

    setStorageMode('sessionStorage')

    // Old localStorage-backed auth wiped; nothing copied into sessionStorage.
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull()
    expect(sessionStorage.getItem(AUTH_STORAGE_KEY)).toBeNull()
  })

  it('a public-mode login persists only to sessionStorage, never localStorage', async () => {
    installFakeSignalR()
    setStorageMode('sessionStorage')

    const authStore = useAuthStore()
    const redirectToLogin = vi.fn()
    configureApiInterceptors({ authStore, redirectToLogin })

    server.use(
      http.post(LOGIN_PATH, () =>
        apiOk({
          user: makeUser({ email: 'public@example.com' }),
          accessToken: 'pub-access',
          refreshToken: 'pub-refresh',
        }),
      ),
    )

    const result = await authStore.login({
      email: 'public@example.com',
      password: 'pw',
      mode: AuthenticationMode.Basic,
    })

    expect(result.isOk()).toBe(true)
    expect(sessionStorage.getItem(AUTH_STORAGE_KEY)).toContain('pub-access')
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull()
  })
})
