/**
 * Unit tests for usePWAUpdate. The @vite-pwa virtual module is aliased to a test
 * stub (see tests/stubs/pwaRegister.ts + vitest.config alias) whose state lives on
 * globalThis. The composable keeps a module-level singleton with a one-shot
 * `initialized` guard, so it is re-imported per test after resetModules; the stub
 * state survives because it is not module-local.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { nextTick } from 'vue'
import { useFakeTimersSafe, advance, useRealTimers } from '@/tests/utils/timers'
import { getPwaStub } from '@/tests/stubs/pwaRegister'

beforeEach(() => {
  vi.resetModules()
  const stub = getPwaStub()
  stub.needRefresh.value = false
  stub.offlineReady.value = false
  stub.onRegisteredSW = undefined
  stub.calls = 0
  stub.updateServiceWorker = vi.fn(() => Promise.resolve())
})

afterEach(() => {
  useRealTimers()
})

async function importPWA() {
  const { usePWAUpdate } = await import('@/app/composables/usePWAUpdate')
  return usePWAUpdate
}

describe('usePWAUpdate', () => {
  it('registers the SW and schedules a 10-minute update poll', async () => {
    useFakeTimersSafe()
    const usePWAUpdate = await importPWA()

    usePWAUpdate()
    const stub = getPwaStub()
    await vi.waitFor(() => expect(stub.onRegisteredSW).toBeDefined())

    const update = vi.fn()
    stub.onRegisteredSW!('/sw.js', { update })

    await advance(10 * 60 * 1000)
    expect(update).toHaveBeenCalledTimes(1)

    await advance(10 * 60 * 1000)
    expect(update).toHaveBeenCalledTimes(2)
  })

  it('does not schedule a poll when no registration is provided', async () => {
    useFakeTimersSafe()
    const usePWAUpdate = await importPWA()

    usePWAUpdate()
    const stub = getPwaStub()
    await vi.waitFor(() => expect(stub.onRegisteredSW).toBeDefined())

    expect(() => stub.onRegisteredSW!('/sw.js', undefined)).not.toThrow()
    await advance(10 * 60 * 1000)
  })

  it('mirrors the needRefresh flag reactively', async () => {
    const usePWAUpdate = await importPWA()
    const stub = getPwaStub()

    const api = usePWAUpdate()
    await vi.waitFor(() => expect(stub.calls).toBeGreaterThan(0))

    expect(api.needRefresh.value).toBe(false)
    stub.needRefresh.value = true
    await nextTick()
    expect(api.needRefresh.value).toBe(true)
  })

  it('mirrors the offlineReady flag reactively', async () => {
    const usePWAUpdate = await importPWA()
    const stub = getPwaStub()

    const api = usePWAUpdate()
    await vi.waitFor(() => expect(stub.calls).toBeGreaterThan(0))

    stub.offlineReady.value = true
    await nextTick()
    expect(api.offlineReady.value).toBe(true)
  })

  it('applyUpdate delegates to updateServiceWorker(true)', async () => {
    const usePWAUpdate = await importPWA()
    const stub = getPwaStub()

    const api = usePWAUpdate()
    await vi.waitFor(() => expect(stub.calls).toBeGreaterThan(0))

    await api.applyUpdate()
    expect(stub.updateServiceWorker).toHaveBeenCalledWith(true)
  })
})
