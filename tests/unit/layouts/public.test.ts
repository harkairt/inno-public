/**
 * Public (iframe) layout: shows a loading spinner until the config store has
 * loaded, then either an auth-error panel or the chat shell. Config is unloaded
 * by default in tests, so the spinner branch renders.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref } from 'vue'
import { renderWithProviders } from '@/tests/utils/render'
import PublicLayout from '@/app/layouts/public.vue'

// The layout destructures setLocale from useI18n; the global stub omits it.
beforeEach(() => {
  vi.mocked(useI18n).mockReturnValue({
    t: (key: string) => key,
    locale: ref('en'),
    setLocale: vi.fn(),
    d: (val: unknown) => String(val),
    n: (val: unknown) => String(val),
  } as unknown as ReturnType<typeof useI18n>)
})

describe('public layout', () => {
  it('shows the loading spinner while config is not yet loaded', () => {
    const { container } = renderWithProviders(PublicLayout, {
      global: { stubs: { PublicChatHeader: true } },
      slots: { default: '<div data-testid="public-page" />' },
    })

    // Loading branch: spinner present, page slot not yet rendered.
    expect(container.querySelector('.animate-spin')).toBeTruthy()
  })
})
