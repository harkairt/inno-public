/**
 * chats/index.vue page tests.
 *
 * Drives the REAL desktop empty-state view: useSelectableUsers / useChatSessions
 * / useUnreadMessageCounts → real services → MSW at the network boundary. No
 * store/service/apiClient mocking. happy-dom's default width (>=768) puts the
 * page on the desktop branch, which renders virtual-agent tiles + unread cards
 * (the mobile ChatListPanel branch is covered by its own component tests).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/vue'
import type { Component } from 'vue'
import { renderWithProviders } from '@/tests/utils/render'
import { server, http } from '@/tests/msw/server'
import { apiOk } from '@/tests/msw/http'
import { makeSession, makeUser } from '@/tests/utils/factories'
import { seedAuthStorage } from '@/tests/utils/authSeed'
import ChatsIndexPage from '@/app/pages/chats/index.vue'

// useSeoMeta is a Nuxt auto-import the SFC calls during setup; stub it away.
beforeEach(() => {
  vi.stubGlobal('useSeoMeta', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// Leaf stubs: keep UnreadChatCard real (asserting its unread badge) but stub its
// heavy avatar child + the Nuxt UI primitives to plain DOM.
const stubs = {
  ChatListPanel: { template: '<div data-testid="chat-list-panel-stub" />' },
  AgentTile: {
    props: ['agent'],
    template: '<div :data-testid="`agent-tile-${agent.id}`">{{ agent.name }}</div>',
  },
  SessionMembers: { template: '<div />' },
  UCard: { template: '<div><slot /></div>' },
  UBadge: { template: '<span class="badge"><slot /></span>' },
  UIcon: { template: '<i />' },
  USkeleton: { template: '<div />' },
  UAvatar: { template: '<div><slot /></div>' },
  UEmpty: {
    props: ['title', 'description'],
    template: '<div>{{ title }} {{ description }}</div>',
  },
}

const GET_HEADERS = '/api/AIWebAPI/GetSessionHeadersByUserId'
const GET_UNREAD = '/api/AIWebAPI/GetUnreadMessages'
const GET_USERS = '/api/user/get-selectable-users'

function renderPage() {
  return renderWithProviders(ChatsIndexPage as Component, { global: { stubs } })
}

describe('chats/index page (desktop)', () => {
  it('renders a session with its unread badge from MSW', async () => {
    seedAuthStorage({ user: makeUser({ email: 'me@example.com' }) })
    server.use(
      http.post(GET_HEADERS, () =>
        apiOk([
          makeSession({
            sessionId: 's1',
            sessionName: 'Team Chat',
            members: ['me@example.com', 'other@example.com'],
          }),
        ]),
      ),
      http.post(GET_UNREAD, () => apiOk([{ sessionId: 's1', unreadMessageCount: 4 }])),
    )

    renderPage()

    const card = await screen.findByTestId('unread-card-s1')
    expect(within(card).getByText('Team Chat')).toBeTruthy()
    expect(within(card).getByText('4')).toBeTruthy() // unread badge
  })

  it('renders the empty state when there are no sessions or agents', async () => {
    seedAuthStorage({ user: makeUser({ email: 'me@example.com' }) })
    server.use(
      http.get(GET_USERS, () => apiOk([])),
      http.post(GET_HEADERS, () => apiOk([])),
      http.post(GET_UNREAD, () => apiOk([])),
    )

    renderPage()

    await waitFor(() => expect(screen.getByText('chat.selectChatInstruction')).toBeTruthy())
    expect(screen.queryByTestId('unread-card-s1')).toBeNull()
  })

  it('renders virtual-agent tiles from MSW', async () => {
    seedAuthStorage({ user: makeUser({ email: 'me@example.com' }) })
    server.use(
      http.get(GET_USERS, () => apiOk([makeUser({ name: 'AI Bot', isVirtual: true })])),
      http.post(GET_HEADERS, () => apiOk([])),
      http.post(GET_UNREAD, () => apiOk([])),
    )

    renderPage()

    await waitFor(() => expect(screen.getByText('AI Bot')).toBeTruthy())
    expect(screen.getByText('emptyPage.startConversation')).toBeTruthy()
  })
})
