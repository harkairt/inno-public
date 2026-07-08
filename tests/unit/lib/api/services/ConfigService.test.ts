import { describe, it, expect } from 'vitest'
import { delay } from 'msw'
import { server, http, HttpResponse } from '@/tests/msw/server'
import { apiError } from '@/tests/msw/http'
import { configService } from '@/lib/api/services/ConfigService'
import { useConfigStore } from '@/app/stores/config'
import { DEFAULT_CONFIG } from '@/lib/config/defaults'

// MSW at the network boundary. config.json is served RAW (no ApiResponse
// envelope): ConfigService.loadConfig validates response.data directly, so the
// handler must return the bare config object, not apiOk().
const CONFIG_PATH = '/api/settings/config.json'

/** Raw config.json handler that counts how many times the wire was hit. */
function countingConfigHandler() {
  const state = { calls: 0 }
  server.use(
    http.get(CONFIG_PATH, () => {
      state.calls++
      return HttpResponse.json({ ...DEFAULT_CONFIG })
    }),
  )
  return state
}

describe('ConfigService.getConfig', () => {
  it('loads and validates config.json on the happy path', async () => {
    server.use(
      http.get(CONFIG_PATH, () => HttpResponse.json({ ...DEFAULT_CONFIG, mainColor: '#123456' })),
    )

    const result = await configService.getConfig()

    expect(result.isOk()).toBe(true)
    if (result.isOk()) expect(result.value.mainColor).toBe('#123456')
  })

  it('caches the config: a second getConfig makes zero HTTP calls', async () => {
    const state = countingConfigHandler()

    const first = await configService.getConfig()
    const second = await configService.getConfig()

    expect(first.isOk()).toBe(true)
    expect(second.isOk()).toBe(true)
    expect(state.calls).toBe(1)
    expect(configService.getCachedConfig()).not.toBeNull()
  })

  it('dedupes concurrent loads into a single request via configPromise', async () => {
    const state = { calls: 0 }
    server.use(
      http.get(CONFIG_PATH, async () => {
        state.calls++
        await delay(20)
        return HttpResponse.json({ ...DEFAULT_CONFIG })
      }),
    )

    const [a, b] = await Promise.all([configService.getConfig(), configService.getConfig()])

    expect(a.isOk()).toBe(true)
    expect(b.isOk()).toBe(true)
    expect(state.calls).toBe(1)
  })

  it('returns an error Result when the fetch fails (silent-failure input)', async () => {
    server.use(http.get(CONFIG_PATH, () => apiError(500)))

    const result = await configService.getConfig()

    expect(result.isErr()).toBe(true)
    expect(configService.getCachedConfig()).toBeNull()
  })

  it('refetches after clearCache()', async () => {
    const state = countingConfigHandler()

    await configService.getConfig()
    configService.clearCache()
    await configService.getConfig()

    expect(state.calls).toBe(2)
  })

  it('refreshConfig() drops the cache and reloads', async () => {
    const state = countingConfigHandler()

    await configService.getConfig()
    const refreshed = await configService.refreshConfig()

    expect(refreshed.isOk()).toBe(true)
    expect(state.calls).toBe(2)
  })
})

describe('config store silent-failure contract', () => {
  it('falls back to DEFAULT_CONFIG with isLoaded=true and loadError set on failure', async () => {
    server.use(http.get(CONFIG_PATH, () => apiError(500)))
    const store = useConfigStore()

    await store.loadConfig()

    // Silent failure: the app keeps running on defaults.
    expect(store.loadError).not.toBeNull()
    expect(store.isLoaded).toBe(true)
    expect(store.config.mainColor).toBe(DEFAULT_CONFIG.mainColor)
  })

  it('loads config and clears loadError on success', async () => {
    server.use(
      http.get(CONFIG_PATH, () => HttpResponse.json({ ...DEFAULT_CONFIG, mainColor: '#abcdef' })),
    )
    const store = useConfigStore()

    await store.loadConfig()

    expect(store.loadError).toBeNull()
    expect(store.isLoaded).toBe(true)
    expect(store.config.mainColor).toBe('#abcdef')
  })
})
