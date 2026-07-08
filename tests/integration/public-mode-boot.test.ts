/**
 * Integration test — the full public/iframe boot chain.
 *
 * Exercises the REAL stack end-to-end: MSW serves a public-mode config.json →
 * the config-init plugin loads it into the real config store → the public-auth
 * plugin reads public mode, switches storage to sessionStorage, clears auth, and
 * auto-logs-in via the real auth store → AuthService → axios → MSW login. HTTP
 * is faked ONLY at the network boundary; SignalR is swapped for a fake to avoid
 * a real /chatHub negotiate. Nothing else is mocked.
 */
import { describe, it, expect } from 'vitest'
import { server, http, HttpResponse } from '@/tests/msw/server'
import { apiOk } from '@/tests/msw/http'
import { DEFAULT_CONFIG } from '@/lib/config/defaults'
import { makeUser } from '@/tests/utils/factories'
import { installFakeSignalR } from '@/tests/utils/fakeSignalR'
import { useConfigStore } from '@/app/stores/config'
import { useAuthStore, getStorageMode } from '@/app/stores/auth'
import configInitPlugin from '@/app/plugins/config-init.client'
import publicAuthPlugin from '@/app/plugins/public-auth.client'

const CONFIG_PATH = '/api/settings/config.json'
const LOGIN_PATH = '/api/authentication/login'
const AUTH_STORAGE_KEY = 'innochat-auth'

const runSetup = (plugin: unknown) => (plugin as { setup: () => Promise<unknown> }).setup()

describe('public-mode boot chain (real stack, MSW at the boundary)', () => {
  it('loads public config, auto-logs-in, and lands tokens in sessionStorage', async () => {
    installFakeSignalR()

    // Backend serves a public-mode config (raw, no envelope).
    server.use(
      http.get(CONFIG_PATH, () =>
        HttpResponse.json({
          ...DEFAULT_CONFIG,
          publicMode: 1,
          publicAgent: 5,
          publicLoginEmail: 'kiosk@example.com',
          publicLoginPassword: 'kiosk-secret',
        }),
      ),
    )

    let loginEmail: unknown
    server.use(
      http.post(LOGIN_PATH, async ({ request }) => {
        loginEmail = ((await request.json()) as { email?: unknown }).email
        return apiOk({
          user: makeUser({ email: 'kiosk@example.com' }),
          accessToken: 'public-access',
          refreshToken: 'public-refresh',
        })
      }),
    )

    // 1) config-init loads the config into the store.
    await runSetup(configInitPlugin)
    const configStore = useConfigStore()
    expect(configStore.isLoaded).toBe(true)
    expect(configStore.config.publicMode).toBe(1)

    // 2) public-auth reads public mode and auto-logs-in.
    await runSetup(publicAuthPlugin)

    // Storage switched to sessionStorage; login used the config credentials.
    expect(getStorageMode()).toBe('sessionStorage')
    expect(loginEmail).toBe('kiosk@example.com')

    // Tokens landed in the store and in sessionStorage — never localStorage.
    const authStore = useAuthStore()
    expect(authStore.isAuthenticated).toBe(true)
    expect(authStore.accessToken).toBe('public-access')

    const persisted = JSON.parse(sessionStorage.getItem(AUTH_STORAGE_KEY) ?? 'null') as {
      accessToken?: string
      refreshToken?: string
    } | null
    expect(persisted?.accessToken).toBe('public-access')
    expect(persisted?.refreshToken).toBe('public-refresh')
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull()

    // No auth error on the happy path.
    expect(configStore.publicAuthError).toBe(false)
  })
})
