/**
 * Tests for the pinia-persistence plugin. It registers the persisted-state
 * plugin on the active Pinia. usePinia is a Nuxt auto-import, stubbed here.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import piniaPersistencePlugin from '@/app/plugins/pinia-persistence.client'

function runPlugin() {
  return (piniaPersistencePlugin as unknown as () => void)()
}

afterEach(() => vi.unstubAllGlobals())

describe('pinia-persistence plugin', () => {
  it('registers a persisted-state plugin on the active Pinia', () => {
    const use = vi.fn()
    vi.stubGlobal('usePinia', () => ({ use }))

    runPlugin()

    expect(use).toHaveBeenCalledTimes(1)
    // createPersistedState() returns the plugin function passed to pinia.use.
    expect(typeof use.mock.calls[0]?.[0]).toBe('function')
  })
})
