import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/vue'
import { nextTick, ref, computed, type Component } from 'vue'
import type { AISessionHeaderDTO } from '@/types/api/schemas'
import { makeSession } from '../../../utils/factories'
import { resetChatListFilters } from '@/app/composables/useChatListFilters'

vi.mock('@tanstack/vue-virtual', () => ({
  useVirtualizer: (optionsRef: { value: { count: number } }) => {
    return computed(() => ({
      getTotalSize: () => optionsRef.value.count * 54,
      getVirtualItems: () =>
        Array.from({ length: optionsRef.value.count }, (_, i) => ({
          index: i,
          start: i * 54,
          size: 62,
          key: i,
        })),
      measureElement: () => {},
    }))
  },
}))

const clearDraftConversationMock = vi.fn()
const navigateToMock = vi.fn()
const favoriteIdsRef = ref<number[]>([])

vi.mock('~/composables/useUserFavorites', () => ({
  useUserFavorites: () => ({
    favoriteIds: favoriteIdsRef,
    isFavorite: (id: number) => favoriteIdsRef.value.includes(id),
    toggleFavorite: vi.fn(),
  }),
}))

const listDataMock = {
  users: ref([{ id: 10, email: 'alice@example.com', name: 'Alice Agent', isVirtual: false }]),
  filteredSessions: ref<AISessionHeaderDTO[]>([]),
  filteredDraftSessions: ref([
    {
      draftId: 'draft-new-10',
      draftKey: 'new-10',
      userId: 10,
      userName: 'Alice Agent',
      userEmail: 'alice@example.com',
      preview: 'Draft preview',
      route: '/chats/new/10',
    },
  ]),
  isLoadingSessions: ref(false),
  sessionsError: ref(null),
  sessionSearchQuery: ref(''),
  totalUnreadCount: ref(0),
  getUnreadCount: vi.fn(() => 0),
  getOtherMembers: vi.fn((members: string[]) => members),
  getMemberNames: vi.fn(() => 'Alice'),
  getDisplayName: vi.fn(() => 'Session Name'),
  isPrimarySessionCheck: vi.fn(() => false),
  clearDraftConversation: clearDraftConversationMock,
  formatRelativeDate: vi.fn(() => 'now'),
}

vi.mock('~/composables/useChatListData', () => ({
  useChatListData: () => listDataMock,
}))

vi.mock('~/composables/useNavigationVisibility', () => ({
  useNavigationVisibility: () => ({ isMobile: ref(false) }),
}))

describe('ChatListPanel drafts', () => {
  beforeEach(() => {
    clearDraftConversationMock.mockReset()
    navigateToMock.mockReset()
    listDataMock.formatRelativeDate.mockClear()
    ;(global.useRoute as ReturnType<typeof vi.fn>).mockReturnValue({
      params: {},
      path: '/chats',
      fullPath: '/chats',
      query: {},
    })
    ;(global.navigateTo as ReturnType<typeof vi.fn>).mockImplementation(navigateToMock)
    listDataMock.filteredSessions.value = []
    listDataMock.filteredDraftSessions.value = [
      {
        draftId: 'draft-new-10',
        draftKey: 'new-10',
        userId: 10,
        userName: 'Alice Agent',
        userEmail: 'alice@example.com',
        preview: 'Draft preview',
        route: '/chats/new/10',
      },
    ]
  })

  async function renderPanel() {
    const mod = (await import('~/components/chat/ChatListPanel.vue')) as { default: Component }
    return render(mod.default, {
      global: {
        stubs: {
          UInput: { template: '<input />' },
          UButton: {
            props: ['ariaLabel', 'label', 'color', 'variant'],
            template:
              '<button :aria-label="ariaLabel" :data-color="color" :data-variant="variant" @click="$emit(\'click\', $event)">{{ label }}<slot /></button>',
          },
          UFieldGroup: { template: '<div data-testid="button-group"><slot /></div>' },
          USkeleton: { template: '<div />' },
          UAlert: { template: '<div><slot /></div>' },
          UEmpty: {
            props: ['description'],
            template: '<div data-testid="empty">{{ description }}</div>',
          },
          SessionItemMenu: { template: '<div />' },
          SessionMembers: { template: '<div data-testid="session-members"></div>' },
          SessionListItem: {
            props: [
              'session',
              'users',
              'isActive',
              'unreadCount',
              'displayName',
              'memberNames',
              'otherMembers',
              'isPrimarySession',
              'isMobile',
            ],
            template:
              '<div :data-testid="`session-item-${session.sessionId}`" :data-session-id="session.sessionId"></div>',
          },
          NuxtLink: {
            props: ['to'],
            template: '<a :href="to"><slot /></a>',
          },
        },
      },
    })
  }

  it('renders draft section and draft row above sessions', async () => {
    await renderPanel()

    expect(screen.getByText('sidebar.draftChats')).toBeTruthy()
    expect(screen.getByText('Alice Agent')).toBeTruthy()
    expect(screen.getByText('Draft preview')).toBeTruthy()

    const draftLink = screen.getByRole('link', { name: /Alice Agent/i })
    expect(draftLink.getAttribute('href')).toBe('/chats/new/10')
  })

  it('clears draft when trash button is clicked', async () => {
    await renderPanel()

    const clearButton = screen.getByRole('button', { name: 'sidebar.clearDraft' })
    await fireEvent.click(clearButton)

    expect(clearDraftConversationMock).toHaveBeenCalledWith('new-10')
  })

  it('navigates back to /chats when clearing the currently open draft chat', async () => {
    ;(global.useRoute as ReturnType<typeof vi.fn>).mockReturnValue({
      params: {},
      path: '/chats/new/10',
      fullPath: '/chats/new/10',
      query: {},
    })

    await renderPanel()

    const clearButton = screen.getByRole('button', { name: 'sidebar.clearDraft' })
    await fireEvent.click(clearButton)

    expect(navigateToMock).toHaveBeenCalledWith('/chats')
  })

  it('shows empty state when no real sessions and no draft sessions', async () => {
    listDataMock.filteredDraftSessions.value = []
    await renderPanel()

    expect(screen.getByTestId('empty')).toBeTruthy()
  })

  it('renders a SessionListItem for each session', async () => {
    listDataMock.filteredSessions.value = [
      makeSession({
        sessionId: 'session-modified',
        insertDate: '2024-01-01T00:00:00Z',
        modifiedAt: '2024-09-01T00:00:00Z',
      }),
    ]

    await renderPanel()

    expect(screen.getByTestId('session-item-session-modified')).toBeTruthy()
  })

  it('renders multiple sessions in the list', async () => {
    listDataMock.filteredSessions.value = [
      makeSession({ sessionId: 'session-a' }),
      makeSession({ sessionId: 'session-b' }),
    ]

    await renderPanel()

    expect(screen.getByTestId('session-item-session-a')).toBeTruthy()
    expect(screen.getByTestId('session-item-session-b')).toBeTruthy()
  })
})

describe('ChatListPanel filters', () => {
  beforeEach(() => {
    clearDraftConversationMock.mockReset()
    navigateToMock.mockReset()
    resetChatListFilters()
    ;(global.useRoute as ReturnType<typeof vi.fn>).mockReturnValue({
      params: {},
      path: '/chats',
      fullPath: '/chats',
      query: {},
    })
    ;(global.navigateTo as ReturnType<typeof vi.fn>).mockImplementation(navigateToMock)
    listDataMock.filteredSessions.value = [makeSession({ sessionId: 'session-a' })]
    listDataMock.filteredDraftSessions.value = []
    listDataMock.sessionSearchQuery.value = ''
  })

  async function renderPanel() {
    const mod = (await import('~/components/chat/ChatListPanel.vue')) as { default: Component }
    return render(mod.default, {
      global: {
        stubs: {
          UInput: { template: '<input />' },
          UButton: {
            props: ['ariaLabel', 'label', 'color', 'variant'],
            template:
              '<button :aria-label="ariaLabel" :data-color="color" :data-variant="variant" @click="$emit(\'click\', $event)">{{ label }}<slot /></button>',
          },
          UFieldGroup: { template: '<div data-testid="button-group"><slot /></div>' },
          USkeleton: { template: '<div />' },
          UAlert: { template: '<div><slot /></div>' },
          UEmpty: {
            props: ['description'],
            template: '<div data-testid="empty">{{ description }}</div>',
          },
          SessionItemMenu: { template: '<div />' },
          SessionMembers: { template: '<div data-testid="session-members"></div>' },
          SessionListItem: {
            props: [
              'session',
              'users',
              'isActive',
              'unreadCount',
              'displayName',
              'memberNames',
              'otherMembers',
              'isPrimarySession',
              'isMobile',
            ],
            template:
              '<div :data-testid="`session-item-${session.sessionId}`" :data-session-id="session.sessionId"></div>',
          },
          NuxtLink: {
            props: ['to'],
            template: '<a :href="to"><slot /></a>',
          },
        },
      },
    })
  }

  it('renders three participant segment buttons', async () => {
    await renderPanel()

    expect(screen.getByTestId('filter-participant-all')).toBeTruthy()
    expect(screen.getByTestId('filter-participant-ai')).toBeTruthy()
    expect(screen.getByTestId('filter-participant-people')).toBeTruthy()
  })

  it('highlights the active segment button with primary/subtle', async () => {
    await renderPanel()

    const allBtn = screen.getByTestId('filter-participant-all')
    expect(allBtn.getAttribute('data-color')).toBe('primary')
    expect(allBtn.getAttribute('data-variant')).toBe('subtle')

    const aiBtn = screen.getByTestId('filter-participant-ai')
    expect(aiBtn.getAttribute('data-color')).toBe('neutral')
    expect(aiBtn.getAttribute('data-variant')).toBe('outline')
  })

  it('switches active segment on click', async () => {
    await renderPanel()

    await fireEvent.click(screen.getByTestId('filter-participant-ai'))

    const aiBtn = screen.getByTestId('filter-participant-ai')
    expect(aiBtn.getAttribute('data-color')).toBe('primary')
    expect(aiBtn.getAttribute('data-variant')).toBe('subtle')

    const allBtn = screen.getByTestId('filter-participant-all')
    expect(allBtn.getAttribute('data-color')).toBe('neutral')
    expect(allBtn.getAttribute('data-variant')).toBe('outline')
  })

  it('renders unread and favorites toggle buttons', async () => {
    await renderPanel()

    expect(screen.getByTestId('filter-unread')).toBeTruthy()
    expect(screen.getByTestId('filter-favorites')).toBeTruthy()
  })

  it('toggles unread button on click', async () => {
    const { useChatListFilters } = await import('~/composables/useChatListFilters')
    const filters = useChatListFilters()

    await renderPanel()

    const btn = screen.getByTestId('filter-unread')
    expect(btn.getAttribute('data-color')).toBe('neutral')

    filters.unreadOnly.value = true
    await nextTick()
    expect(btn.getAttribute('data-color')).toBe('primary')
    expect(btn.getAttribute('data-variant')).toBe('subtle')

    filters.unreadOnly.value = false
    await nextTick()
    expect(btn.getAttribute('data-color')).toBe('neutral')
  })

  it('toggles favorites button independently of unread', async () => {
    const { useChatListFilters } = await import('~/composables/useChatListFilters')
    const filters = useChatListFilters()

    await renderPanel()

    filters.unreadOnly.value = true
    filters.favoritesOnly.value = true
    await nextTick()

    expect(screen.getByTestId('filter-unread').getAttribute('data-color')).toBe('primary')
    expect(screen.getByTestId('filter-favorites').getAttribute('data-color')).toBe('primary')
  })

  it('hides clear-all button when no filters are active', async () => {
    await renderPanel()

    expect(screen.queryByTestId('filter-clear-all')).toBeNull()
  })

  it('shows clear-all button when a filter is active', async () => {
    await renderPanel()

    await fireEvent.click(screen.getByTestId('filter-participant-ai'))
    expect(screen.getByTestId('filter-clear-all')).toBeTruthy()
  })

  it('clicking clear-all resets all filters', async () => {
    await renderPanel()

    await fireEvent.click(screen.getByTestId('filter-participant-ai'))
    await fireEvent.click(screen.getByTestId('filter-unread'))
    await fireEvent.click(screen.getByTestId('filter-favorites'))

    await fireEvent.click(screen.getByTestId('filter-clear-all'))

    expect(screen.getByTestId('filter-participant-all').getAttribute('data-color')).toBe('primary')
    expect(screen.getByTestId('filter-unread').getAttribute('data-color')).toBe('neutral')
    expect(screen.getByTestId('filter-favorites').getAttribute('data-color')).toBe('neutral')
    expect(screen.queryByTestId('filter-clear-all')).toBeNull()
  })

  it('shows clear-filters button in empty state when filters are active', async () => {
    listDataMock.filteredSessions.value = []
    listDataMock.filteredDraftSessions.value = []
    await renderPanel()

    await fireEvent.click(screen.getByTestId('filter-participant-ai'))
    expect(screen.getByTestId('empty-clear-filters')).toBeTruthy()
  })

  it('hides clear-filters button in empty state when no filters are active', async () => {
    listDataMock.filteredSessions.value = []
    listDataMock.filteredDraftSessions.value = []
    await renderPanel()

    expect(screen.queryByTestId('empty-clear-filters')).toBeNull()
  })
})
