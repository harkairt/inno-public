/**
 * Tests for the api-interceptors client plugin. The plugin's job is pure wiring:
 * grab the auth store, hand the interceptor setup a router-aware redirect, and
 * start the periodic cache cleanup. We spy on its two collaborators and assert
 * the plugin calls them correctly, then exercise the redirect closure.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useAuthStore } from '@/app/stores/auth'
import * as setupModule from '@/lib/api/interceptors/setup'
import * as responseModule from '@/lib/api/interceptors/response'
import apiInterceptorsPlugin from '@/app/plugins/api-interceptors.client'

beforeEach(() => {
  vi.stubGlobal('useAuthStore', useAuthStore)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

/** The plugin is authored as a bare setup function. */
function runPlugin() {
  return (apiInterceptorsPlugin as unknown as () => void)()
}

describe('api-interceptors plugin', () => {
  it('wires the interceptor chain against the auth store and starts cache cleanup', () => {
    const configureSpy = vi
      .spyOn(setupModule, 'configureApiInterceptors')
      .mockImplementation(() => {})
    const cleanupSpy = vi.spyOn(responseModule, 'startCacheCleanup').mockImplementation(() => {})

    runPlugin()

    expect(configureSpy).toHaveBeenCalledTimes(1)
    const arg = configureSpy.mock.calls[0]![0]
    expect(arg.authStore).toBe(useAuthStore())
    expect(typeof arg.redirectToLogin).toBe('function')
    expect(cleanupSpy).toHaveBeenCalledTimes(1)
  })

  it("redirectToLogin navigates to '/login' with replace", () => {
    let captured: (() => void) | undefined
    vi.spyOn(setupModule, 'configureApiInterceptors').mockImplementation((opts) => {
      captured = opts.redirectToLogin
    })
    vi.spyOn(responseModule, 'startCacheCleanup').mockImplementation(() => {})

    runPlugin()
    captured?.()

    expect(vi.mocked(navigateTo)).toHaveBeenCalledWith('/login', { replace: true })
  })
})
