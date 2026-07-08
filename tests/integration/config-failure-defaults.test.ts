/**
 * Integration flow #7 — config.json load failure → defaults, no crash.
 *
 * Drives the REAL config-init plugin end to end: config-init setup() →
 * config store loadConfig() → real ConfigService → real axios → MSW at the
 * network boundary. When config.json fails (HTTP 500 or a network error) the
 * store applies its silent-failure contract: keep DEFAULT_CONFIG, still set
 * isLoaded=true, record loadError, and never throw. The plugin then applies the
 * default axios timeout. Nothing here mocks the store, service, or apiClient.
 */
import { describe, it, expect } from 'vitest'
import { server, http, HttpResponse } from '@/tests/msw/server'
import { httpError } from '@/tests/msw/http'
import { DEFAULT_CONFIG } from '@/lib/config/defaults'
import { apiClient } from '@/lib/api/client'
import { useConfigStore } from '@/app/stores/config'
import configInitPlugin from '@/app/plugins/config-init.client'

const CONFIG_PATH = '/api/settings/config.json'

/** The plugin is authored in object form; run its setup() directly. */
function runPlugin() {
  return (configInitPlugin as unknown as { setup: () => Promise<unknown> }).setup()
}

describe('config failure → defaults (real stack, MSW at the boundary)', () => {
  it('falls back to defaults without crashing when config.json returns 500', async () => {
    server.use(http.get(CONFIG_PATH, () => httpError(500)))

    await expect(runPlugin()).resolves.toBeDefined()

    const configStore = useConfigStore()
    // Silent-failure contract: still marked loaded, error recorded, defaults kept.
    expect(configStore.isLoaded).toBe(true)
    expect(configStore.loadError).not.toBeNull()
    expect(configStore.config).toEqual(DEFAULT_CONFIG)
    expect(configStore.config.publicMode).toBe(DEFAULT_CONFIG.publicMode)

    // Default axios timeout applied downstream — no crash.
    expect(apiClient.defaults.timeout).toBe(DEFAULT_CONFIG.axiosTimeout)
  })

  it('falls back to defaults when config.json errors at the network level', async () => {
    server.use(http.get(CONFIG_PATH, () => HttpResponse.error()))

    await expect(runPlugin()).resolves.toBeDefined()

    const configStore = useConfigStore()
    expect(configStore.isLoaded).toBe(true)
    expect(configStore.loadError).not.toBeNull()
    expect(configStore.config).toEqual(DEFAULT_CONFIG)
    expect(apiClient.defaults.timeout).toBe(DEFAULT_CONFIG.axiosTimeout)
  })
})
