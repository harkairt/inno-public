/**
 * chats/new/[userId].vue page tests.
 *
 * Drives the REAL new-chat page: useSelectableUsers → userService →
 * MSW (/api/user/get-selectable-users); real Pinia stores throughout.
 *
 * The "session creation" flow here is client-side: the page mints a UUID for
 * the not-yet-created session and registers a chatStore.onNewSessionConfirmed
 * callback. When the server later confirms (via SignalR in production), the
 * callback navigates to /chats/<sessionId>. We drive that confirmation directly
 * through the real store (executeNewSessionCallback) and assert the navigation.
 *
 * generateUUID is mocked so the minted sessionId is known to the test.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/vue'
import type { Component } from 'vue'
import { renderWithProviders } from '@/tests/utils/render'
import { server, http } from '@/tests/msw/server'
import { apiOk } from '@/tests/msw/http'
import { makeUser } from '@/tests/utils/factories'
import { seedAuthStorage } from '@/tests/utils/authSeed'
import { useChatStore } from '@/app/stores/chat'
import NewChatPage from '@/app/pages/chats/new/[userId].vue'
import ChatMessages from '@/app/components/chat/ChatMessages.vue'

const SESSION_UUID = 'minted-session-uuid'

// The page mints the new sessionId via generateUUID; pin it so we know the
// navigation target and which callback key to confirm.
vi.mock('@/lib/utils/uuid', () => ({ generateUUID: () => SESSION_UUID }))

const ME = 'me@example.com'
const USER_ID = 42
const GET_SELECTABLE = '/api/user/get-selectable-users'

const stubs = {
  NuxtErrorBoundary: { template: '<div><slot /></div>' },
  MessageInput: { template: '<div data-testid="message-input-stub" />' },
  TypingIndicator: { template: '<div data-testid="typing-indicator-stub" />' },
  MarkdownContent: { props: ['content'], template: '<div class="markdown">{{ content }}</div>' },
  MessageRating: { template: '<div />' },
  OptionsMessage: { template: '<div />' },
  UButton: { template: '<button v-bind="$attrs"><slot /></button>' },
  UAlert: { props: ['title', 'description'], template: '<div role="alert" />' },
  UIcon: { template: '<i />' },
  USkeleton: { template: '<div />' },
}

/** Serve the selectable-users list (drives selectedUser resolution). */
function serveSelectableUsers(users: unknown[]) {
  server.use(http.get(GET_SELECTABLE, () => apiOk(users)))
}

function renderPage() {
  return renderWithProviders(NewChatPage as Component, {
    global: { stubs, components: { ChatMessages: ChatMessages as Component } },
  })
}

beforeEach(() => {
  vi.stubGlobal('useSeoMeta', vi.fn())
  vi.mocked(navigateTo).mockClear()
  vi.mocked(useRoute).mockReturnValue({
    params: { userId: String(USER_ID) },
    query: {},
    path: `/chats/new/${USER_ID}`,
    fullPath: `/chats/new/${USER_ID}`,
    name: 'chats-new-userId',
  } as never)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('chats/new/[userId] page', () => {
  it('renders the selected user header once the user list loads', async () => {
    seedAuthStorage({ user: makeUser({ email: ME }) })
    serveSelectableUsers([
      makeUser({ id: USER_ID, name: 'Agent Smith', email: 'agent@example.com', isVirtual: true }),
    ])

    renderPage()

    expect(await screen.findByText('Agent Smith')).toBeTruthy()
  })

  it('navigates to the created session when the server confirms the new session', async () => {
    seedAuthStorage({ user: makeUser({ email: ME }) })
    serveSelectableUsers([
      makeUser({ id: USER_ID, name: 'Agent Smith', email: 'agent@example.com', isVirtual: true }),
    ])

    renderPage()

    // Wait for the page to resolve the user (callback registration happens in setup).
    await screen.findByText('Agent Smith')

    // Simulate the server confirming the new session (SignalR path in prod).
    const chatStore = useChatStore()
    chatStore.executeNewSessionCallback(SESSION_UUID)

    await waitFor(() =>
      expect(vi.mocked(navigateTo)).toHaveBeenCalledWith(`/chats/${SESSION_UUID}`, {
        replace: true,
      }),
    )
  })

  it('redirects to /chats when the userId does not match any selectable user', async () => {
    seedAuthStorage({ user: makeUser({ email: ME }) })
    // List loads but contains no user with id === USER_ID → watchEffect bails out.
    serveSelectableUsers([makeUser({ id: 999, name: 'Someone Else' })])

    renderPage()

    await waitFor(() =>
      expect(vi.mocked(navigateTo)).toHaveBeenCalledWith('/chats', { replace: true }),
    )
  })
})
