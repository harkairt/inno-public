/**
 * Tests for the viewer plugin. Runs setup() with a mocked nuxtApp (vueApp.use
 * spy) and asserts the v-viewer plugin is installed with the expected
 * single-image default options.
 */
import { describe, it, expect, vi } from 'vitest'
import VueViewer from 'v-viewer'
import viewerPlugin from '@/app/plugins/viewer.client'

function runPlugin() {
  const use = vi.fn()
  const nuxtApp = { vueApp: { use } }
  ;(viewerPlugin as unknown as { setup: (app: unknown) => void }).setup(nuxtApp)
  return { use }
}

describe('viewer plugin', () => {
  it('installs v-viewer with single-image default options', () => {
    const { use } = runPlugin()

    expect(use).toHaveBeenCalledTimes(1)
    const [plugin, options] = use.mock.calls[0] as [
      unknown,
      { defaultOptions: Record<string, unknown> & { toolbar: Record<string, unknown> } },
    ]
    expect(plugin).toBe(VueViewer)
    expect(options.defaultOptions.initialCoverage).toBe(0.8)
    expect(options.defaultOptions.navbar).toBe(false)
    expect(options.defaultOptions.rotatable).toBe(false)
    expect(options.defaultOptions.toolbar.zoomIn).toBe(1)
    expect(options.defaultOptions.toolbar.next).toBe(false)
    // A ready hook is wired to inject the download button.
    expect(typeof options.defaultOptions.ready).toBe('function')
  })
})
