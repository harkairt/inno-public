/**
 * index.vue page test.
 *
 * index.vue has no template logic — it only registers a page-meta middleware
 * that unconditionally redirects to /chats via navigateTo. We render the page
 * (which invokes definePageMeta during setup), capture the middleware it
 * registered, invoke it, and assert the redirect target.
 */
import { describe, it, expect, vi } from 'vitest'
import type { Component } from 'vue'
import { renderWithProviders } from '@/tests/utils/render'
import IndexPage from '@/app/pages/index.vue'

describe('index page', () => {
  it('redirects to /chats via its page-meta middleware', () => {
    vi.mocked(definePageMeta).mockClear()
    vi.mocked(navigateTo).mockClear()

    renderWithProviders(IndexPage as Component)

    const meta = vi.mocked(definePageMeta).mock.calls.at(-1)?.[0] as
      | { middleware?: () => unknown }
      | undefined
    const middleware = meta?.middleware
    expect(typeof middleware).toBe('function')

    middleware?.()
    expect(navigateTo).toHaveBeenCalledWith('/chats')
  })
})
