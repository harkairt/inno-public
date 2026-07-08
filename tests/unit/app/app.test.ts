/**
 * Root app component: renders the skip-to-content link, route announcer, the
 * layout/page slot, and the update banner inside UApp. Heavy Nuxt/UI children
 * are stubbed so this stays a focused shell test.
 */
import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/vue'
import { renderWithProviders } from '@/tests/utils/render'
import App from '@/app/app.vue'

const stubs = {
  UApp: { template: '<div><slot /></div>' },
  NuxtLayout: { template: '<div data-testid="layout"><slot /></div>' },
  NuxtPage: { template: '<div data-testid="page" />' },
  NuxtRouteAnnouncer: true,
  AppUpdateBanner: true,
}

describe('app.vue', () => {
  it('renders the skip-to-content link and the layout/page shell', () => {
    renderWithProviders(App, { global: { stubs } })

    // i18n global stub returns the key verbatim.
    expect(screen.getByText('common.skipToContent')).toBeTruthy()
    expect(screen.getByTestId('layout')).toBeTruthy()
    expect(screen.getByTestId('page')).toBeTruthy()
  })
})
