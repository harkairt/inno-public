/**
 * AppBottomTabBar — the mobile bottom tab navigation.
 *
 * Note on "visibility per auth/public mode": like AppRail, this component does
 * NOT gate its own visibility — the parent layout mounts/unmounts it via
 * useNavigationVisibility (`showBottomTabBar`, covered in that composable's B4
 * test). Here we test what the component owns: tab rendering, route-active
 * states, link targets, and the unread badge. useChatListData is mocked to a
 * controllable totalUnreadCount so no queries fire (no MSW needed). useRoute is
 * the global Nuxt stub, overridden per test to drive the active branch.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, type RenderResult } from '@testing-library/vue'
import { ref, type Component } from 'vue'

const listDataMock = {
  totalUnreadCount: ref(0),
}

vi.mock('~/composables/useChatListData', () => ({
  useChatListData: () => listDataMock,
}))

function setRoute(path: string) {
  ;(global.useRoute as ReturnType<typeof vi.fn>).mockReturnValue({
    path,
    fullPath: path,
    params: {},
    query: {},
  })
}

const stubs = {
  // Renders as an anchor so `to` is observable; undeclared bindings (data-testid,
  // aria-current, aria-label) fall through as DOM attributes.
  NuxtLink: {
    name: 'NuxtLink',
    props: ['to'],
    template: '<a :href="to"><slot /></a>',
  },
  UChip: {
    name: 'UChip',
    props: ['text', 'show'],
    template: '<div><span v-if="show" data-testid="tab-badge">{{ text }}</span><slot /></div>',
  },
  UIcon: { name: 'UIcon', props: ['name'], template: '<i :data-icon="name" />' },
}

async function renderBar(): Promise<RenderResult> {
  const { default: AppBottomTabBar } =
    (await import('~/components/navigation/AppBottomTabBar.vue')) as { default: Component }
  return render(AppBottomTabBar, { global: { stubs } })
}

beforeEach(() => {
  vi.clearAllMocks()
  listDataMock.totalUnreadCount.value = 0
  setRoute('/chats')
})

describe('AppBottomTabBar — rendering', () => {
  it('renders the tab bar with all tabs', async () => {
    await renderBar()
    expect(screen.getByTestId('bottom-tab-bar')).toBeTruthy()
    expect(screen.getByTestId('tab-chats')).toBeTruthy()
    expect(screen.getByTestId('tab-users')).toBeTruthy()
    expect(screen.getByTestId('tab-profile')).toBeTruthy()
  })

  it('links each tab to its route', async () => {
    await renderBar()
    expect(screen.getByTestId('tab-chats').getAttribute('href')).toBe('/chats')
    expect(screen.getByTestId('tab-users').getAttribute('href')).toBe('/users')
    expect(screen.getByTestId('tab-profile').getAttribute('href')).toBe('/profile')
  })
})

describe('AppBottomTabBar — active route', () => {
  it('marks the chats tab active on /chats routes', async () => {
    setRoute('/chats/abc-123')
    await renderBar()
    expect(screen.getByTestId('tab-chats').getAttribute('aria-current')).toBe('page')
    expect(screen.getByTestId('tab-users').getAttribute('aria-current')).toBeNull()
  })

  it('marks the profile tab active on /profile', async () => {
    setRoute('/profile')
    await renderBar()
    expect(screen.getByTestId('tab-profile').getAttribute('aria-current')).toBe('page')
    expect(screen.getByTestId('tab-chats').getAttribute('aria-current')).toBeNull()
  })
})

describe('AppBottomTabBar — unread badge', () => {
  it('hides the badge when there are no unread messages', async () => {
    listDataMock.totalUnreadCount.value = 0
    await renderBar()
    expect(screen.queryByTestId('tab-badge')).toBeNull()
  })

  it('shows the unread count when there are unread messages', async () => {
    listDataMock.totalUnreadCount.value = 7
    await renderBar()
    expect(screen.getByTestId('tab-badge').textContent).toContain('7')
  })

  it('caps the badge at 99+', async () => {
    listDataMock.totalUnreadCount.value = 200
    await renderBar()
    expect(screen.getByTestId('tab-badge').textContent).toContain('99+')
  })
})
