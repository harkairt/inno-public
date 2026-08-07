import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/vue'
import { ref, type Component } from 'vue'
import type { AISessionHeaderDTO } from '@/types/api/schemas'
import { makeSession } from '../../../utils/factories'

const clearDraftConversationMock = vi.fn()
const navigateToMock = vi.fn()

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
            props: ['ariaLabel'],
            template:
              '<button :aria-label="ariaLabel" @click="$emit(\'click\', $event)"><slot /></button>',
          },
          USkeleton: { template: '<div />' },
          UAlert: { template: '<div><slot /></div>' },
          UEmpty: { template: '<div data-testid="empty"></div>' },
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
