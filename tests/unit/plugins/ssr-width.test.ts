/**
 * Tests for the ssr-width plugin: it provides a fixed SSR viewport width so
 * @vueuse/core's responsive helpers have a deterministic first-render value.
 */
import { describe, it, expect, vi } from 'vitest'
import { provideSSRWidth } from '@vueuse/core'
import ssrWidthPlugin from '@/app/plugins/ssr-width'

vi.mock('@vueuse/core', () => ({ provideSSRWidth: vi.fn() }))

describe('ssr-width plugin', () => {
  it('provides an SSR width of 768 on the Vue app', () => {
    const vueApp = { name: 'test-app' }

    ;(ssrWidthPlugin as unknown as (nuxtApp: { vueApp: unknown }) => void)({ vueApp })

    expect(provideSSRWidth).toHaveBeenCalledWith(768, vueApp)
  })
})
