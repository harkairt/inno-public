/**
 * AppRail — the desktop side navigation rail.
 *
 * Note on "visibility per auth/public mode": AppRail does NOT gate its own
 * visibility — the parent layout mounts/unmounts it via useNavigationVisibility
 * (`showRail`, covered in that composable's B4 test). So here we test what the
 * component itself owns: nav-item rendering, route-active states, and the unread
 * badge. useChatListData is mocked to a controllable totalUnreadCount so no
 * queries fire (no MSW needed). useRoute is the global Nuxt stub, overridden
 * per test to drive the active branch. navigateTo is the global stub.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/vue'
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
  UTooltip: { name: 'UTooltip', template: '<div><slot /></div>' },
  UChip: {
    name: 'UChip',
    props: ['text', 'show'],
    template: '<div><span v-if="show" data-testid="rail-badge">{{ text }}</span><slot /></div>',
  },
  // Single-root stub: undeclared bindings (data-testid, aria-current, aria-label,
  // variant, color) fall through as DOM attributes; @click works natively.
  UButton: { name: 'UButton', template: '<button><slot /></button>' },
}

// `navigateTo` is called from the template, so Vue resolves it via
// globalProperties (not JS globals). Inject a spy through VTU's `global.mocks`.
const navigateToSpy = vi.fn()

async function renderRail() {
  const { default: AppRail } = (await import('~/components/navigation/AppRail.vue')) as {
    default: Component
  }
  return render(AppRail, { global: { stubs, mocks: { navigateTo: navigateToSpy } } })
}

beforeEach(() => {
  vi.clearAllMocks()
  listDataMock.totalUnreadCount.value = 0
  setRoute('/chats')
})

describe('AppRail — rendering', () => {
  it('renders the rail with all nav items', async () => {
    await renderRail()
    expect(screen.getByTestId('app-rail')).toBeTruthy()
    expect(screen.getByTestId('rail-chats')).toBeTruthy()
    expect(screen.getByTestId('rail-users')).toBeTruthy()
    expect(screen.getByTestId('rail-profile')).toBeTruthy()
  })
})

describe('AppRail — active route', () => {
  it('marks the chats item active on /chats routes', async () => {
    setRoute('/chats/abc-123')
    await renderRail()
    expect(screen.getByTestId('rail-chats').getAttribute('aria-current')).toBe('page')
    expect(screen.getByTestId('rail-users').getAttribute('aria-current')).toBeNull()
  })

  it('marks the users item active on /users', async () => {
    setRoute('/users')
    await renderRail()
    expect(screen.getByTestId('rail-users').getAttribute('aria-current')).toBe('page')
    expect(screen.getByTestId('rail-chats').getAttribute('aria-current')).toBeNull()
  })
})

describe('AppRail — navigation', () => {
  it('navigates to the item route on click', async () => {
    setRoute('/chats')
    await renderRail()
    await fireEvent.click(screen.getByTestId('rail-users'))
    expect(navigateToSpy).toHaveBeenCalledWith('/users')
  })
})

describe('AppRail — unread badge', () => {
  it('hides the badge when there are no unread messages', async () => {
    listDataMock.totalUnreadCount.value = 0
    await renderRail()
    expect(screen.queryByTestId('rail-badge')).toBeNull()
  })

  it('shows the unread count when there are unread messages', async () => {
    listDataMock.totalUnreadCount.value = 5
    await renderRail()
    expect(screen.getByTestId('rail-badge').textContent).toContain('5')
  })

  it('caps the badge at 99+', async () => {
    listDataMock.totalUnreadCount.value = 150
    await renderRail()
    expect(screen.getByTestId('rail-badge').textContent).toContain('99+')
  })
})
