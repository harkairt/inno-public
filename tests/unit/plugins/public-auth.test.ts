/**
 * Tests for the public-auth client plugin (the iframe auto-login flow).
 *
 * Drives the plugin's setup() against a REAL config store (seeded public-mode),
 * a REAL auth store, and MSW's login handler. SignalR is swapped for a fake to
 * avoid a real /chatHub negotiate; nothing else is mocked.
 */
import { describe, it, expect, vi } from 'vitest'
import { server, http, HttpResponse } from '@/tests/msw/server'
import { apiOk, apiError } from '@/tests/msw/http'
import { makeUser } from '@/tests/utils/factories'
import { installFakeSignalR } from '@/tests/utils/fakeSignalR'
import { useConfigStore } from '@/app/stores/config'
import { useAuthStore, getStorageMode } from '@/app/stores/auth'
import type { InnoChatConfig } from '@/types/api/schemas'
import publicAuthPlugin from '@/app/plugins/public-auth.client'

const LOGIN_PATH = '/api/authentication/login'
const AUTH_STORAGE_KEY = 'innochat-auth'

/** The plugin is authored in object form; run its setup() directly. */
function runPlugin() {
  return (publicAuthPlugin as unknown as { setup: () => Promise<unknown> }).setup()
}

/** Seed the config store, returning both stores for assertions/spies. */
function seed(partial: Partial<InnoChatConfig>) {
  const configStore = useConfigStore()
  configStore.setConfig(partial)
  const authStore = useAuthStore()
  return { configStore, authStore }
}

const PUBLIC_CREDS = {
  publicMode: 1 as const,
  publicAgent: 5,
  publicLoginEmail: 'bot@example.com',
  publicLoginPassword: 'bot-secret',
}

describe('public-auth plugin', () => {
  it('switches to sessionStorage, clears auth, and auto-logs-in in public mode', async () => {
    installFakeSignalR()
    const { authStore } = seed(PUBLIC_CREDS)
    const clearSpy = vi.spyOn(authStore, 'clearAuth')

    await runPlugin()

    // Storage switched to sessionStorage and prior auth cleared.
    expect(getStorageMode()).toBe('sessionStorage')
    expect(clearSpy).toHaveBeenCalledTimes(1)

    // Auto-login succeeded and tokens landed in sessionStorage, not localStorage.
    expect(authStore.isAuthenticated).toBe(true)
    expect(authStore.accessToken).toBe('access-token-1')
    expect(sessionStorage.getItem(AUTH_STORAGE_KEY)).not.toBeNull()
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull()
  })

  it('sends credentials to the login endpoint', async () => {
    installFakeSignalR()
    seed(PUBLIC_CREDS)

    let capturedEmail: unknown
    server.use(
      http.post(LOGIN_PATH, async ({ request }) => {
        capturedEmail = ((await request.json()) as { email?: unknown }).email
        return apiOk({ user: makeUser(), accessToken: 'a', refreshToken: 'r' })
      }),
    )

    await runPlugin()

    expect(capturedEmail).toBe('bot@example.com')
  })

  it('sets publicAuthError and does not attempt login when credentials are missing', async () => {
    installFakeSignalR()
    const { configStore, authStore } = seed({ ...PUBLIC_CREDS, publicLoginPassword: null })
    const loginSpy = vi.spyOn(authStore, 'login')

    await runPlugin()

    // Storage mode still switches before the credential check.
    expect(getStorageMode()).toBe('sessionStorage')
    expect(loginSpy).not.toHaveBeenCalled()
    expect(configStore.publicAuthError).toBe(true)
    expect(authStore.isAuthenticated).toBe(false)
  })

  it('sets publicAuthError when login returns 401', async () => {
    installFakeSignalR()
    const { configStore, authStore } = seed(PUBLIC_CREDS)
    server.use(http.post(LOGIN_PATH, () => apiError(401)))

    await runPlugin()

    expect(configStore.publicAuthError).toBe(true)
    expect(authStore.isAuthenticated).toBe(false)
  })

  it('sets publicAuthError when the login request fails at the network level', async () => {
    installFakeSignalR()
    const { configStore, authStore } = seed(PUBLIC_CREDS)
    server.use(http.post(LOGIN_PATH, () => HttpResponse.error()))

    await runPlugin()

    expect(configStore.publicAuthError).toBe(true)
    expect(authStore.isAuthenticated).toBe(false)
  })

  it('early-returns for non-public config: no storage switch, no clearAuth, no login', async () => {
    const { configStore, authStore } = seed({ publicMode: 0 })
    const clearSpy = vi.spyOn(authStore, 'clearAuth')
    const loginSpy = vi.spyOn(authStore, 'login')

    await runPlugin()

    expect(getStorageMode()).toBe('localStorage')
    expect(clearSpy).not.toHaveBeenCalled()
    expect(loginSpy).not.toHaveBeenCalled()
    expect(configStore.publicAuthError).toBe(false)
  })
})
