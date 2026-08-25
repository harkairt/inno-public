/**
 * UserAvatar component tests.
 * Wraps Nuxt UI's UAvatar; picks image vs darkImage per colorMode and forwards
 * size + slot (initials fallback). useColorMode is stubbed per-test (not a
 * global test stub).
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { screen } from '@testing-library/vue'
import { ref, type Component } from 'vue'
import { renderWithProviders } from '@/tests/utils/render'
import UserAvatar from '~/components/UserAvatar.vue'

const UAvatarStub = {
  name: 'UAvatar',
  inheritAttrs: false,
  props: ['src', 'alt', 'size'],
  template:
    '<div data-testid="u-avatar" :data-src="src" :data-alt="alt" :data-size="size"><slot /></div>',
}

function renderAvatar(
  props: Record<string, unknown> = {},
  slots: Record<string, string> = {},
  mode: 'light' | 'dark' = 'light',
) {
  vi.stubGlobal('useColorMode', () => ref(mode))
  return renderWithProviders(UserAvatar as Component, {
    props,
    slots,
    global: { stubs: { UAvatar: UAvatarStub } },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('UserAvatar — initials fallback', () => {
  it('renders slot content when no image is provided', () => {
    renderAvatar({ alt: 'Alice' }, { default: 'AL' })
    const avatar = screen.getByTestId('u-avatar')
    expect(avatar.textContent).toContain('AL')
    expect(avatar.getAttribute('data-src')).toBeNull()
  })
})

describe('UserAvatar — image path', () => {
  it('uses the light image by default', () => {
    renderAvatar({ image: '/light.png', darkImage: '/dark.png' }, {}, 'light')
    expect(screen.getByTestId('u-avatar').getAttribute('data-src')).toBe('/light.png')
  })

  it('uses the dark image in dark mode when provided', () => {
    renderAvatar({ image: '/light.png', darkImage: '/dark.png' }, {}, 'dark')
    expect(screen.getByTestId('u-avatar').getAttribute('data-src')).toBe('/dark.png')
  })

  it('falls back to the light image in dark mode when darkImage is absent', () => {
    renderAvatar({ image: '/light.png' }, {}, 'dark')
    expect(screen.getByTestId('u-avatar').getAttribute('data-src')).toBe('/light.png')
  })
})

describe('UserAvatar — size variants', () => {
  it('forwards the size prop to UAvatar', () => {
    renderAvatar({ image: 'x.png', size: 'lg' })
    expect(screen.getByTestId('u-avatar').getAttribute('data-size')).toBe('lg')
  })
})
