/**
 * Tests apiClient base-URL resolution and default config.
 *
 * getApiBaseUrl runs once at module load, so each base-URL case re-imports the
 * module fresh (vi.resetModules) after arranging window.__NUXT__ / the env var.
 *
 * Note: the `import.meta.dev` branch (returns '' for the Nitro dev proxy) is not
 * exercised — Vitest has no Nuxt build, so `import.meta.dev` is undefined and the
 * branch is unreachable without a build-time define we must not add here.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import type { AxiosInstance } from 'axios'

type NuxtWindow = Window & {
  __NUXT__?: { config?: { public?: { apiBaseUrl?: string } } }
}

async function importFreshClient(): Promise<AxiosInstance> {
  vi.resetModules()
  const mod = await import('@/lib/api/client')
  return mod.apiClient
}

afterEach(() => {
  delete (window as NuxtWindow).__NUXT__
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('apiClient — base URL resolution', () => {
  it('uses window.__NUXT__ runtime config when present', async () => {
    ;(window as NuxtWindow).__NUXT__ = {
      config: { public: { apiBaseUrl: 'https://api.example.com' } },
    }
    const client = await importFreshClient()
    expect(client.defaults.baseURL).toBe('https://api.example.com')
  })

  it('falls back to the NUXT_PUBLIC_API_BASE_URL env var when no runtime config', async () => {
    // No window.__NUXT__; the vitest env block sets NUXT_PUBLIC_API_BASE_URL.
    const client = await importFreshClient()
    expect(client.defaults.baseURL).toBe('http://localhost:3000')
  })

  it('falls back to empty string (relative URLs) when neither is set', async () => {
    vi.stubEnv('NUXT_PUBLIC_API_BASE_URL', '')
    const client = await importFreshClient()
    expect(client.defaults.baseURL).toBe('')
  })

  it('ignores window.__NUXT__ when apiBaseUrl is absent (falls through to env)', async () => {
    ;(window as NuxtWindow).__NUXT__ = { config: { public: {} } }
    const client = await importFreshClient()
    expect(client.defaults.baseURL).toBe('http://localhost:3000')
  })
})

describe('apiClient — defaults', () => {
  it('sets JSON content-negotiation headers', async () => {
    const client = await importFreshClient()
    expect(client.defaults.headers['Content-Type']).toBe('application/json')
    expect(client.defaults.headers['Accept']).toBe('application/json')
  })

  it('sets the 5-minute request timeout', async () => {
    const client = await importFreshClient()
    expect(client.defaults.timeout).toBe(300000)
  })
})
