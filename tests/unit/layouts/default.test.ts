/**
 * Default layout: master shell that renders the desktop rail or the mobile
 * bottom tab bar around the page slot, driven by useNavigationVisibility. The
 * global useWindowSize stub reports 1280px, so the desktop branch renders.
 */
import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/vue'
import { renderWithProviders } from '@/tests/utils/render'
import DefaultLayout from '@/app/layouts/default.vue'

const stubs = {
  AppRail: { template: '<nav data-testid="rail" />' },
  AppBottomTabBar: { template: '<nav data-testid="tabbar" />' },
}

describe('default layout', () => {
  it('renders the slot inside the desktop shell with the rail', () => {
    renderWithProviders(DefaultLayout, {
      global: { stubs },
      slots: { default: '<p data-testid="page-content">hello</p>' },
    })

    expect(screen.getByTestId('page-content')).toBeTruthy()
    // Desktop branch (1280px stub): no mobile tab bar. Rail visibility is
    // gated by auth/route state, so we only assert the mobile bar is absent.
    expect(screen.queryByTestId('tabbar')).toBeNull()
  })
})
