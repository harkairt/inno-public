/**
 * Tests for the vue-query client plugin. Runs setup() with a mocked nuxtApp
 * (vueApp.use spy) and asserts VueQueryPlugin is installed with the singleton
 * QueryClient + expected options.
 */
import { describe, it, expect, vi } from 'vitest'
import { VueQueryPlugin } from '@tanstack/vue-query'
import { getQueryClient } from '@/lib/queryClientSingleton'
import vueQueryPlugin from '@/app/plugins/vue-query.client'

function runPlugin() {
  const use = vi.fn()
  const nuxtApp = { vueApp: { use } }
  const provided = (
    vueQueryPlugin as unknown as { setup: (app: unknown) => { provide: { queryClient: unknown } } }
  ).setup(nuxtApp)
  return { use, provided }
}

describe('vue-query plugin', () => {
  it('installs VueQueryPlugin with the singleton query client', () => {
    const { use } = runPlugin()

    expect(use).toHaveBeenCalledTimes(1)
    const [plugin, options] = use.mock.calls[0] as [
      unknown,
      { queryClient: unknown; enableDevtoolsV6Plugin: boolean },
    ]
    expect(plugin).toBe(VueQueryPlugin)
    expect(options.queryClient).toBe(getQueryClient())
    expect(options.enableDevtoolsV6Plugin).toBe(true)
  })

  it('provides the query client to the Nuxt app', () => {
    const { provided } = runPlugin()
    expect(provided.provide.queryClient).toBe(getQueryClient())
  })
})
