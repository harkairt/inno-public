import { describe, it, expect } from 'vitest'
import { server, http, HttpResponse } from '@/tests/msw/server'
import { httpError } from '@/tests/msw/http'
import { DEFAULT_CONFIG } from '@/lib/config/defaults'
import { apiClient } from '@/lib/api/client'
import { useConfigStore } from '@/app/stores/config'
import type { InnoChatConfig } from '@/types/api/schemas'
import configInitPlugin from '@/app/plugins/config-init.client'

const CONFIG_PATH = '/api/settings/config.json'

function runPlugin() {
  return (configInitPlugin as unknown as { setup: () => Promise<unknown> }).setup()
}

function serveConfig(overrides: Partial<InnoChatConfig>) {
  server.use(http.get(CONFIG_PATH, () => HttpResponse.json({ ...DEFAULT_CONFIG, ...overrides })))
}

describe('config-init plugin', () => {
  it('applies the axios timeout on success', async () => {
    serveConfig({ axiosTimeout: 55000 })

    await runPlugin()

    const configStore = useConfigStore()
    expect(configStore.isLoaded).toBe(true)
    expect(configStore.loadError).toBeNull()
    expect(apiClient.defaults.timeout).toBe(55000)
  })

  it('falls back to defaults without crashing when config.json fails (500)', async () => {
    server.use(http.get(CONFIG_PATH, () => httpError(500)))

    await runPlugin()

    const configStore = useConfigStore()
    expect(configStore.isLoaded).toBe(true)
    expect(configStore.loadError).not.toBeNull()
    expect(apiClient.defaults.timeout).toBe(DEFAULT_CONFIG.axiosTimeout)
  })
})
