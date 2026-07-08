/**
 * Unit tests for useConfig. Query keys are pure; the query is driven through the
 * REAL ConfigService against MSW's /api/settings/config.json (no mocking).
 */
import { describe, it, expect, vi } from 'vitest'
import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query'
import { createPinia, setActivePinia } from 'pinia'
import { server, http, HttpResponse } from '@/tests/msw/server'
import { DEFAULT_CONFIG } from '@/lib/config/defaults'
import { useConfig, configQueryKeys } from '@/app/composables/useConfig'

function createTestQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
}

function mountQuery(queryClient: QueryClient, options?: Parameters<typeof useConfig>[0]) {
  const pinia = createPinia()
  setActivePinia(pinia)

  let query!: ReturnType<typeof useConfig>
  const TestComponent = defineComponent({
    setup() {
      query = useConfig(options)
      return () => null
    },
  })
  mount(TestComponent, { global: { plugins: [[VueQueryPlugin, { queryClient }], pinia] } })
  return query
}

describe('configQueryKeys', () => {
  it('all is the base key', () => {
    expect(configQueryKeys.all).toEqual(['config'])
  })

  it('main scopes under all', () => {
    expect(configQueryKeys.main()).toEqual(['config', 'main'])
  })
})

describe('useConfig', () => {
  it('fetches configuration from config.json', async () => {
    server.use(
      http.get('/api/settings/config.json', () =>
        HttpResponse.json({ ...DEFAULT_CONFIG, axiosTimeout: 12345, publicMode: 1 }),
      ),
    )

    const query = mountQuery(createTestQueryClient())

    await vi.waitFor(() => expect(query.isSuccess.value).toBe(true))
    expect(query.data.value?.axiosTimeout).toBe(12345)
    expect(query.data.value?.publicMode).toBe(1)
  })

  it('stays disabled (no fetch) when enabled is false', async () => {
    const query = mountQuery(createTestQueryClient(), { enabled: false })
    await Promise.resolve()

    expect(query.fetchStatus.value).toBe('idle')
    expect(query.data.value).toBeUndefined()
  })
})
